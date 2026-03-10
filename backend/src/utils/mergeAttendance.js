import mongoose from "mongoose";

/**
 * Build a bulkWrite operation that merges `payload` into an existing
 * Attendance document (matched by user_id + date).
 *
 * Merge rules:
 *  - activities  → union (no duplicates)
 *  - projects    → update percentage if project_id already present; else push
 *  - note        → append with newline separator
 *  - checkIn_at  → keep earliest (do not overwrite)
 *  - status      → leave as-is (do not downgrade)
 *
 * @param {object} existing  – lean Attendance document
 * @param {object} payload   – resolved payload from resolveRow
 * @returns {object}         – a bulkWrite UpdateOne operation
 */
export function buildMergeOperation(existing, payload) {
  // ── Activities: union ──────────────────────────────────────────────────────
  const existingActivityIds = new Set(
    existing.activities.map((id) => id.toString())
  );
  const newActivityIds = payload.activities.filter(
    (id) => !existingActivityIds.has(id.toString())
  );

  // ── Projects: upsert by project_id ────────────────────────────────────────
  const existingProjectIds = new Set(
    existing.projects.map((p) => p.project_id.toString())
  );

  // Projects that already exist → update percentage via arrayFilters
  const percentageUpdates = {};
  const projectsToPush = [];

  for (const p of payload.projects) {
    const key = p.project_id.toString();
    if (existingProjectIds.has(key)) {
      // Use arrayFilters to target the specific subdocument
      percentageUpdates[`projects.$[proj_${key.slice(-4)}].contribution_percentage`] =
        p.contribution_percentage;
    } else {
      projectsToPush.push(p);
    }
  }

  // ── Note: append ──────────────────────────────────────────────────────────
  const newNote = [existing.note, payload.note]
    .filter(Boolean)
    .join("\n---\n");

  // ── Build $set + $push ────────────────────────────────────────────────────
  const update = { $set: { note: newNote }, $push: {} };

  if (Object.keys(percentageUpdates).length) {
    Object.assign(update.$set, percentageUpdates);
  }

  if (newActivityIds.length) {
    update.$push.activities = { $each: newActivityIds };
  } else {
    delete update.$push.activities;
  }

  if (projectsToPush.length) {
    update.$push.projects = { $each: projectsToPush };
  } else {
    delete update.$push.projects;
  }

  if (!Object.keys(update.$push).length) {
    delete update.$push;
  }

  // Build arrayFilters for percentage updates
  const arrayFilters = Object.keys(percentageUpdates).map((field) => {
    // Extract the short key used in the placeholder
    const match = field.match(/\$\[proj_(\w+)\]/);
    const shortKey = match[1];
    // Find full project_id
    const fullId = payload.projects.find((p) =>
      p.project_id.toString().endsWith(shortKey)
    )?.project_id;

    return { [`proj_${shortKey}.project_id`]: new mongoose.Types.ObjectId(fullId) };
  });

  return {
    updateOne: {
      filter: { _id: existing._id },
      update,
      ...(arrayFilters.length ? { arrayFilters } : {}),
    },
  };
}