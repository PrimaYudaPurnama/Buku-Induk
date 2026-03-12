import { parseWIBTimestamp, startOfDayWIB } from "./dateUtils.js";
import { resolveOrCreateActivity } from "./lookupMaps.js";

// ─── Work-hour thresholds (Asia/Jakarta local time, expressed as minutes from midnight) ───
const WORK_START_MINUTES = 8 * 60;   // 08:00
const WORK_END_MINUTES   = 16 * 60;  // 16:00
const LATE_GRACE_MS      = 0;        // 0 grace — any second after 08:00 = late

/**
 * Return the minutes-from-midnight of a UTC Date interpreted in WIB (UTC+7).
 */
function toWIBMinutes(utcDate) {
  const wibMs  = utcDate.getTime() + 7 * 60 * 60 * 1000;
  const wib    = new Date(wibMs);
  return wib.getUTCHours() * 60 + wib.getUTCMinutes();
}

/**
 * Derive attendance status from checkIn and optional checkOut times.
 *
 * Rules (jam kerja 08:00 – 16:00 WIB):
 *   late_checkin    = checkIn  > 08:00  &&  checkOut on time (or absent)
 *   early_checkout  = checkIn on time   &&  checkOut < 16:00
 *   late            = checkIn  > 08:00  &&  checkOut < 16:00  (both violations)
 *   normal          = checkIn ≤ 08:00   &&  checkOut ≥ 16:00  (or no checkOut)
 */
function deriveStatus(checkIn_at, checkOut_at) {
  const inMin  = toWIBMinutes(checkIn_at);
  const isLate = inMin > WORK_START_MINUTES;

  if (!checkOut_at) {
    return isLate ? "late_checkin" : "normal";
  }

  const outMin    = toWIBMinutes(checkOut_at);
  const isEarly   = outMin < WORK_END_MINUTES;

  if (isLate && isEarly)  return "late";
  if (isLate)             return "late_checkin";
  if (isEarly)            return "early_checkout";
  return "normal";
}

/**
 * Resolve one parsed Excel row into an attendance payload + task payloads.
 *
 * Returns either:
 *   { ok: true,  payload: AttendancePayload, tasks: TaskPayload[] }
 *   { ok: false, rowNumber, reason: string }
 *
 * @param {object} row   – from parseExcelBuffer()
 * @param {object} maps  – { userMap, projectMap, activityMap }
 */
export async function resolveRow(row, maps) {
  const { userMap, projectMap, activityMap } = maps;
  const fail = (reason) => ({ ok: false, rowNumber: row.rowNumber, reason });

  // ── 1. Basic field validation ──────────────────────────────────────────────
  if (!row.full_name) return fail("Nama Lengkap kosong");

  // ── 2. Resolve user ────────────────────────────────────────────────────────
  const user = userMap.get(row.full_name.trim().toLowerCase());
  if (!user) return fail(`User tidak ditemukan: "${row.full_name}"`);

  // ── 3. Parse checkIn timestamp ─────────────────────────────────────────────
  const checkIn_at = parseWIBTimestamp(row.timestampRaw);
  if (!checkIn_at) return fail(`Timestamp tidak valid: "${row.timestampRaw}"`);

  const date = startOfDayWIB(checkIn_at);

  // ── 4. Parse checkOut timestamp (optional) ─────────────────────────────────
  let checkOut_at = null;
  if (row.checkoutRaw) {
    checkOut_at = parseWIBTimestamp(row.checkoutRaw);
    if (!checkOut_at) {
      // Non-fatal: log and proceed without checkout
      console.warn(`[resolveRow] Row ${row.rowNumber}: jam pulang tidak valid "${row.checkoutRaw}", dilewati`);
      checkOut_at = null;
    }
  }

  // Sanity check: checkout must be after checkin
  if (checkOut_at && checkOut_at <= checkIn_at) {
    console.warn(`[resolveRow] Row ${row.rowNumber}: jam pulang <= jam berangkat, dilewati`);
    checkOut_at = null;
  }

  // ── 5. Derive attendance status ────────────────────────────────────────────
  const status = deriveStatus(checkIn_at, checkOut_at);

  // ── 6. Resolve activities ──────────────────────────────────────────────────
  const activityIds = [];
  for (const name of row.activities) {
    if (!name) continue;
    const id = await resolveOrCreateActivity(name, activityMap);
    activityIds.push(id);
  }

  // ── 7. Resolve projects (multi, paired with percentages) ───────────────────
  const projects = [];

  // Management projects
  for (let i = 0; i < row.management_codes.length; i++) {
    const code = row.management_codes[i].toUpperCase();
    const pct  = row.management_pcts[i] ?? null;

    const proj = projectMap.get(code);
    if (!proj) return fail(`Proyek manajemen tidak ditemukan: "${code}"`);
    if (pct == null) return fail(`Presentase manajemen kosong untuk proyek "${code}"`);

    projects.push({ project_id: proj._id, contribution_percentage: pct });
  }

  // Technical projects
  for (let i = 0; i < row.technical_codes.length; i++) {
    const code = row.technical_codes[i].toUpperCase();
    const pct  = row.technical_pcts[i] ?? null;

    const proj = projectMap.get(code);
    if (!proj) return fail(`Proyek teknis tidak ditemukan: "${code}"`);
    if (pct == null) return fail(`Presentase teknis kosong untuk proyek "${code}"`);

    projects.push({ project_id: proj._id, contribution_percentage: pct });
  }

  // ── 8. Build Task payloads ─────────────────────────────────────────────────
  // Every management task title + every technical task title → individual Task docs.
  // Split by comma is already done in parseExcel; each element = one task.
  const taskTitles = [
    ...row.management_tasks,
    ...row.technical_tasks,
  ].filter(Boolean);

  const tasks = taskTitles.map((title) => ({
    user_id      : user._id,
    title,
    description  : "",
    start_at     : checkIn_at,
    progress     : 100,
    status       : "done",
    completed_at : checkOut_at ?? checkIn_at, // fallback to checkIn if no checkout
  }));

  // ── 9. Build attendance payload ────────────────────────────────────────────
  return {
    ok: true,
    tasks,
    payload: {
      user_id     : user._id,
      date,
      checkIn_at,
      checkOut_at,
      status,
      activities  : activityIds,
      projects,
      note        : row.note || "",
      user_consent: {
        checkIn : true,
        checkOut: checkOut_at != null,
      },
    },
  };
}