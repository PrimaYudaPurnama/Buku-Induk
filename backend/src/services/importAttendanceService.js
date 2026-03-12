import Attendance from "../models/attendance.js";
import Task       from "../models/task.js";
import { buildLookupMaps }          from "../utils/lookupMaps.js";
import { resolveRow }               from "../utils/resolveRow.js";
import { buildMergeOperation }      from "../utils/mergeAttendance.js";
import { updateProjectPercentages } from "../utils/updateProjectPercentages.js";

const BATCH_SIZE = 100;

/**
 * Main attendance import service.
 *
 * Per row:
 *  1. Resolve user, timestamps, projects, activities, tasks
 *  2. Derive attendance status (normal / late / late_checkin / early_checkout)
 *  3. Insert new attendance OR merge into existing (by user_id + date)
 *  4. Insert Task documents (one per task title, split by comma)
 *  5. Link Task _ids into attendance.tasks_today
 *  6. Replace Project.percentage with value from this import
 *
 * @param {RawRow[]} rawRows  – output of parseExcelBuffer()
 * @returns {Promise<ImportResult>}
 */
export async function importAttendanceService(rawRows) {
  const maps  = await buildLookupMaps();
  const errors = [];

  // Buckets filled during the resolve pass
  const newAttendanceDocs    = [];   // { payload, tasks }  – no existing record
  const mergeAttendanceOps   = [];   // { op, tasks }       – existing record found
  const allProjectContribs   = [];   // { project_id, contribution_percentage }

  // ── 1. Resolve pass ────────────────────────────────────────────────────────
  for (const raw of rawRows) {
    let result;
    try {
      result = await resolveRow(raw, maps);
    } catch (err) {
      errors.push({ rowNumber: raw.rowNumber, reason: `Resolve error: ${err.message}` });
      continue;
    }

    if (!result.ok) {
      errors.push({ rowNumber: result.rowNumber, reason: result.reason });
      continue;
    }

    const { payload, tasks } = result;

    // Track project contributions for Project.percentage update
    for (const p of payload.projects) {
      allProjectContribs.push({
        project_id             : p.project_id,
        contribution_percentage: p.contribution_percentage,
      });
    }

    // Check for duplicate attendance
    let existing = null;
    try {
      existing = await Attendance.findOne({
        user_id: payload.user_id,
        date   : payload.date,
      }).lean();
    } catch (err) {
      errors.push({ rowNumber: raw.rowNumber, reason: `DB lookup error: ${err.message}` });
      continue;
    }

    if (existing) {
      mergeAttendanceOps.push({ op: buildMergeOperation(existing, payload), tasks });
    } else {
      newAttendanceDocs.push({ payload, tasks });
    }
  }

  let successCount = 0;

  // ── 2. Insert new attendance docs + their tasks ────────────────────────────
  for (let i = 0; i < newAttendanceDocs.length; i += BATCH_SIZE) {
    const batch = newAttendanceDocs.slice(i, i + BATCH_SIZE);

    for (const { payload, tasks } of batch) {
      try {
        // 2a. Insert tasks first so we have their _ids
        const taskIds = await insertTasks(tasks);

        // 2b. Insert attendance with tasks_today linked
        const doc = await Attendance.create({
          ...payload,
          tasks_today: taskIds,
        });

        successCount += 1;
      } catch (err) {
        errors.push({
          rowNumber: "insert",
          reason   : `Insert failed for user ${payload.user_id}: ${err.message}`,
        });
      }
    }
  }

  // ── 3. Merge into existing attendance docs + append tasks ──────────────────
  for (let i = 0; i < mergeAttendanceOps.length; i += BATCH_SIZE) {
    const batch = mergeAttendanceOps.slice(i, i + BATCH_SIZE);

    for (const { op, tasks } of batch) {
      try {
        // 3a. Insert tasks
        const taskIds = await insertTasks(tasks);

        // 3b. Append task _ids to existing attendance doc
        if (taskIds.length) {
          const attendanceId = op.updateOne.filter._id;
          op.updateOne.update.$push = op.updateOne.update.$push ?? {};
          op.updateOne.update.$push.tasks_today = { $each: taskIds };
        }

        // 3c. Execute the merge update
        await Attendance.bulkWrite([op], { ordered: false });
        successCount += 1;
      } catch (err) {
        errors.push({
          rowNumber: "merge",
          reason   : `Merge failed: ${err.message}`,
        });
      }
    }
  }

  // ── 4. Replace Project.percentage ─────────────────────────────────────────
  try {
    await updateProjectPercentages(allProjectContribs);
  } catch (err) {
    console.error("[importAttendance] project percentage update failed:", err);
    errors.push({
      rowNumber: "project-pct",
      reason   : `Project percentage update failed: ${err.message}`,
    });
  }

  return {
    success_rows: successCount,
    failed_rows : errors.length,
    errors,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Helper – insert an array of task payloads and return their _ids.
// Returns [] if tasks is empty. Each task is inserted individually so that
// a single bad task doesn't kill the whole row.
// ─────────────────────────────────────────────────────────────────────────────
async function insertTasks(tasks) {
  if (!tasks || tasks.length === 0) return [];

  const ids = [];
  for (const taskPayload of tasks) {
    try {
      const doc = await Task.create(taskPayload);
      ids.push(doc._id);
    } catch (err) {
      // Non-fatal: log but don't fail the whole attendance row
      console.warn(`[insertTasks] Could not insert task "${taskPayload.title}": ${err.message}`);
    }
  }
  return ids;
}