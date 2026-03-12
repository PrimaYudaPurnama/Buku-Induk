import mongoose from "mongoose";

/**
 * Build a bulkWrite UpdateOne operation that merges `payload` into an
 * existing Attendance document (matched by user_id + date).
 *
 * Merge rules:
 *  activities          → union (no duplicates)
 *  projects            → REPLACE contribution_percentage if project already exists;
 *                        push if new project
 *  note                → append with separator
 *  checkIn_at          → keep the EARLIEST value
 *  checkOut_at         → keep the LATEST value (most recent checkout wins)
 *  status              → re-derive from merged checkIn/checkOut
 *  user_consent        → OR merge (true wins over false)
 *  tasks_today         → merged separately in the service layer (ObjectId refs)
 *
 * @param {object} existing  – lean Attendance document from MongoDB
 * @param {object} payload   – resolved payload from resolveRow()
 * @returns {object}         – a Mongoose bulkWrite UpdateOne operation
 */
export function buildMergeOperation(existing, payload) {
  const $set  = {};
  const $push = {};

  // ── checkIn_at: keep earliest ─────────────────────────────────────────────
  const earliestCheckIn = existing.checkIn_at < payload.checkIn_at
    ? existing.checkIn_at
    : payload.checkIn_at;
  $set.checkIn_at = earliestCheckIn;

  // ── checkOut_at: keep latest ──────────────────────────────────────────────
  const latestCheckOut = (() => {
    if (!existing.checkOut_at && !payload.checkOut_at) return null;
    if (!existing.checkOut_at) return payload.checkOut_at;
    if (!payload.checkOut_at)  return existing.checkOut_at;
    return existing.checkOut_at > payload.checkOut_at
      ? existing.checkOut_at
      : payload.checkOut_at;
  })();
  $set.checkOut_at = latestCheckOut;

  // ── status: re-derive from merged times ───────────────────────────────────
  const WORK_START = 8 * 60;
  const WORK_END   = 16 * 60;
  const toWIBMin   = (d) => {
    const ms = d.getTime() + 7 * 60 * 60 * 1000;
    const w  = new Date(ms);
    return w.getUTCHours() * 60 + w.getUTCMinutes();
  };
  const inMin  = toWIBMin(earliestCheckIn);
  const isLate = inMin > WORK_START;

  if (!latestCheckOut) {
    $set.status = isLate ? "late_checkin" : "normal";
  } else {
    const outMin  = toWIBMin(latestCheckOut);
    const isEarly = outMin < WORK_END;
    if (isLate && isEarly) $set.status = "late";
    else if (isLate)       $set.status = "late_checkin";
    else if (isEarly)      $set.status = "early_checkout";
    else                   $set.status = "normal";
  }

  // ── user_consent: OR merge ────────────────────────────────────────────────
  $set["user_consent.checkIn"]  = existing.user_consent?.checkIn  || payload.user_consent.checkIn;
  $set["user_consent.checkOut"] = existing.user_consent?.checkOut || payload.user_consent.checkOut;

  // ── Activities: union (no duplicates) ─────────────────────────────────────
  const existingActivitySet = new Set(existing.activities.map((id) => id.toString()));
  const newActivityIds = payload.activities.filter(
    (id) => !existingActivitySet.has(id.toString())
  );
  if (newActivityIds.length) {
    $push.activities = { $each: newActivityIds };
  }

  // ── Projects: REPLACE percentage if exists; push if new ───────────────────
  const existingProjectMap = new Map(
    existing.projects.map((p) => [p.project_id.toString(), p])
  );

  const arrayFilters   = [];
  const projectsToPush = [];

  for (const p of payload.projects) {
    const key = p.project_id.toString();
    if (existingProjectMap.has(key)) {
      // Replace (not accumulate) the contribution_percentage
      const filterKey = `proj_${key.slice(-6)}`;
      $set[`projects.$[${filterKey}].contribution_percentage`] = p.contribution_percentage;
      arrayFilters.push({
        [`${filterKey}.project_id`]: new mongoose.Types.ObjectId(p.project_id),
      });
    } else {
      projectsToPush.push(p);
    }
  }

  if (projectsToPush.length) {
    $push.projects = { $each: projectsToPush };
  }

  // ── Note: append ──────────────────────────────────────────────────────────
  const mergedNote = [existing.note, payload.note].filter(Boolean).join("\n---\n");
  $set.note = mergedNote;

  // ── Assemble update ────────────────────────────────────────────────────────
  const update = { $set };
  if (Object.keys($push).length) update.$push = $push;

  return {
    updateOne: {
      filter: { _id: existing._id },
      update,
      ...(arrayFilters.length ? { arrayFilters } : {}),
    },
  };
}