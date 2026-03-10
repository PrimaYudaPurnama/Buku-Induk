import { parseWIBTimestamp, startOfDayWIB } from "./dateUtils.js";
import { resolveOrCreateActivity } from "./lookupMaps.js";

/**
 * Resolve one parsed Excel row into an attendance payload.
 *
 * Returns either:
 *   { ok: true,  payload: AttendancePayload }
 *   { ok: false, rowNumber, reason: string }
 *
 * @param {object} row           – from parseExcel
 * @param {object} maps          – { userMap, projectMap, activityMap }
 */
export async function resolveRow(row, maps) {
  const { userMap, projectMap, activityMap } = maps;
  const fail = (reason) => ({ ok: false, rowNumber: row.rowNumber, reason });

  // ── 1. Resolve user ────────────────────────────────────────────────────────
  const userKey = row.full_name.trim().toLowerCase();
  const user = userMap.get(userKey);
  if (!user) {
    return fail(`User not found: "${row.full_name}"`);
  }

  // ── 2. Parse timestamp ─────────────────────────────────────────────────────
  const checkIn_at = parseWIBTimestamp(row.timestampRaw);
  if (!checkIn_at) {
    return fail(`Invalid timestamp: "${row.timestampRaw}"`);
  }
  const date = startOfDayWIB(checkIn_at);

  // ── 3. Resolve activities (create if missing) ──────────────────────────────
  const activityIds = [];
  for (const name of row.activities) {
    if (!name) continue;
    const id = await resolveOrCreateActivity(name, activityMap);
    activityIds.push(id);
  }

  // ── 4. Resolve projects ────────────────────────────────────────────────────
  const projects = [];

  if (row.management_code) {
    const proj = projectMap.get(row.management_code.toUpperCase());
    if (!proj) {
      return fail(`Management project not found: "${row.management_code}"`);
    }
    if (row.management_pct == null) {
      return fail(`Missing management percentage for project "${row.management_code}"`);
    }
    projects.push({
      project_id: proj._id,
      contribution_percentage: row.management_pct,
    });
  }

  if (row.technical_code) {
    const proj = projectMap.get(row.technical_code.toUpperCase());
    if (!proj) {
      return fail(`Technical project not found: "${row.technical_code}"`);
    }
    if (row.technical_pct == null) {
      return fail(`Missing technical percentage for project "${row.technical_code}"`);
    }
    projects.push({
      project_id: proj._id,
      contribution_percentage: row.technical_pct,
    });
  }

  // ── 5. Build payload ───────────────────────────────────────────────────────
  return {
    ok: true,
    payload: {
      user_id: user._id,
      date,
      checkIn_at,
      checkOut_at: null,
      status: "manual",
      activities: activityIds,
      projects,
      note: row.note || "",
      user_consent: { checkIn: true, checkOut: false },
    },
  };
}