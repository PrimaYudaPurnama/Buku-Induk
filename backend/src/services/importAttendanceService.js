import Attendance from "../models/Attendance.js";
import { buildLookupMaps } from "../utils/lookupMaps.js";
import { resolveRow } from "../utils/resolveRow.js";
import { buildMergeOperation } from "../utils/mergeAttendance.js";
import { updateProjectPercentages } from "../utils/updateProjectPercentages.js";

const BATCH_SIZE = 100;

/**
 * Main attendance import service.
 *
 * After saving attendance documents it also accumulates each row's
 * contribution_percentage into the corresponding Project.percentage
 * (capped at 100).
 *
 * @param {RawRow[]} rawRows  – output of parseExcelBuffer()
 * @returns {Promise<ImportResult>}
 */
export async function importAttendanceService(rawRows) {
  // ── Pre-load all lookup data ───────────────────────────────────────────────
  const maps = await buildLookupMaps();

  const errors   = [];
  const newDocs  = [];   // payloads for insertMany
  const mergeOps = [];   // bulkWrite ops for existing attendance docs

  /**
   * Flat list of every project contribution from SUCCESSFUL rows.
   * Used after all attendance writes to update Project.percentage.
   * Shape: { project_id: ObjectId, contribution_percentage: number }
   */
  const allContributions = [];

  // ── Resolve every row ─────────────────────────────────────────────────────
  for (const raw of rawRows) {
    const result = await resolveRow(raw, maps);

    if (!result.ok) {
      errors.push({ rowNumber: result.rowNumber, reason: result.reason });
      continue;
    }

    const { payload } = result;

    // Check for existing attendance record (unique index: user_id + date)
    const existing = await Attendance.findOne({
      user_id: payload.user_id,
      date:    payload.date,
    }).lean();

    if (existing) {
      // For merges: only count contributions for *new* projects being added.
      // Projects already present in the existing doc were already counted
      // during the original import — do NOT accumulate again.
      const existingProjectIds = new Set(
        existing.projects.map((p) => p.project_id.toString())
      );

      for (const p of payload.projects) {
        if (!existingProjectIds.has(p.project_id.toString())) {
          allContributions.push({
            project_id: p.project_id,
            contribution_percentage: p.contribution_percentage,
          });
        }
      }

      mergeOps.push(buildMergeOperation(existing, payload));
    } else {
      // Brand-new attendance doc → count all its project contributions
      for (const p of payload.projects) {
        allContributions.push({
          project_id: p.project_id,
          contribution_percentage: p.contribution_percentage,
        });
      }
      newDocs.push(payload);
    }
  }

  let successCount = 0;

  // ── Batch insert new attendance documents ─────────────────────────────────
  for (let i = 0; i < newDocs.length; i += BATCH_SIZE) {
    const batch = newDocs.slice(i, i + BATCH_SIZE);
    try {
      const inserted = await Attendance.insertMany(batch, {
        ordered:   false,
        rawResult: true,
      });
      successCount += inserted.insertedCount ?? batch.length;
    } catch (err) {
      if (err.result?.nInserted != null) {
        successCount += err.result.nInserted;
      }
    }
  }

  // ── Batch update existing attendance documents ────────────────────────────
  for (let i = 0; i < mergeOps.length; i += BATCH_SIZE) {
    const batch = mergeOps.slice(i, i + BATCH_SIZE);
    try {
      const result = await Attendance.bulkWrite(batch, { ordered: false });
      successCount += result.modifiedCount ?? 0;
    } catch (err) {
      if (err.result?.nModified != null) {
        successCount += err.result.nModified;
      }
      errors.push({ rowNumber: "bulk-update", reason: err.message });
    }
  }

  // ── Update Project.percentage (accumulate, cap at 100) ────────────────────
  // Only runs if at least one successful row had project contributions.
  try {
    await updateProjectPercentages(allContributions);
  } catch (err) {
    // Non-fatal: attendance data is already saved. Log and surface as a warning.
    console.error("[importAttendance] failed to update project percentages:", err);
    errors.push({
      rowNumber: "project-percentage-update",
      reason:    `Project percentage update failed: ${err.message}`,
    });
  }

  return {
    success_rows: successCount,
    failed_rows:  errors.length,
    errors,
  };
}