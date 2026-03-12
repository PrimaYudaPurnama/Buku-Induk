import Project from "../models/project.js";

const BATCH_SIZE = 100;

/**
 * Hitung status proyek berdasarkan start_date & end_date.
 *
 * Rules:
 *  - Jika ada end_date:
 *      • end_date < now          → "completed"
 *      • end_date >= now         → "ongoing"
 *  - Jika TIDAK ada end_date:
 *      • start_date > now        → "planned"
 *      • start_date <= now/null  → "ongoing"
 */
function computeStatus(start_date, end_date) {
  const now = new Date();

  if (end_date instanceof Date) {
    if (!isNaN(end_date.getTime()) && end_date.getTime() < now.getTime()) {
      return "completed";
    }
    return "ongoing";
  }

  if (start_date instanceof Date && !isNaN(start_date.getTime())) {
    if (start_date.getTime() > now.getTime()) {
      return "planned";
    }
    return "ongoing";
  }

  // Tanpa tanggal yang valid → anggap masih berjalan
  return "ongoing";
}

/**
 * Validate a single raw project row.
 * Returns null if valid, or an error string if invalid.
 *
 * @param {object} row
 * @returns {string|null}
 */
function validateRow(row) {
  if (!row.code)      return "Kode Pekerjaan kosong";
  if (!row.name)      return "Nama projek kosong";
  if (!row.work_type) return "work_type tidak bisa ditentukan";

  if (
    row.start_date &&
    row.end_date &&
    row.start_date > row.end_date
  ) {
    return `Start date (${row.start_date.toISOString()}) lebih besar dari end date (${row.end_date.toISOString()})`;
  }

  return null;
}

/**
 * Import project rows into MongoDB.
 *
 * Behaviour per row:
 *  - If project with same `code` does NOT exist → INSERT (status: "planned")
 *  - If project with same `code` already EXISTS  → UPDATE name, work_type,
 *    start_date, end_date (but never overwrite percentage or status)
 *
 * Uses bulkWrite with upsert for efficiency.
 *
 * @param {RawProjectRow[]} rawRows  – output of parseProjectExcelBuffer()
 * @returns {Promise<ImportResult>}
 */
export async function importProjectService(rawRows) {
  const errors      = [];
  const validRows   = [];

  // ── 1. Validate all rows first ────────────────────────────────────────────
  for (const row of rawRows) {
    const err = validateRow(row);
    if (err) {
      errors.push({ rowNumber: row.rowNumber, code: row.code || "—", reason: err });
      continue;
    }
    validRows.push(row);
  }

  if (!validRows.length) {
    return { success_rows: 0, failed_rows: errors.length, errors };
  }

  // ── 2. Pre-load existing projects into memory (by code) ───────────────────
  const codes = validRows.map((r) => r.code);
  const existing = await Project.find({ code: { $in: codes } }, "code").lean();
  const existingCodes = new Set(existing.map((p) => p.code.toUpperCase()));

  // ── 3. Build bulkWrite operations ─────────────────────────────────────────
  const ops = [];

  for (const row of validRows) {
    const isNew = !existingCodes.has(row.code);

    if (isNew) {
      // INSERT – set all fields including defaults
      const status = computeStatus(row.start_date, row.end_date);
      ops.push({
        insertOne: {
          document: {
            code       : row.code,
            name       : row.name,
            work_type  : row.work_type,
            percentage : 0,
            status     : status,
            start_date : row.start_date ?? null,
            end_date   : row.end_date   ?? null,
          },
        },
      });
    } else {
      // UPDATE – only overwrite safe fields; never touch percentage
      const setFields = { name: row.name, work_type: row.work_type };
      if (row.start_date) setFields.start_date = row.start_date;
      if (row.end_date)   setFields.end_date   = row.end_date;

      // Recompute status berdasar tanggal terbaru
      const status = computeStatus(row.start_date, row.end_date);
      setFields.status = status;

      ops.push({
        updateOne: {
          filter: { code: row.code },
          update: { $set: setFields },
        },
      });
    }
  }

  // ── 4. Execute in batches ─────────────────────────────────────────────────
  let insertedCount = 0;
  let updatedCount  = 0;

  for (let i = 0; i < ops.length; i += BATCH_SIZE) {
    const batch = ops.slice(i, i + BATCH_SIZE);
    try {
      const result = await Project.bulkWrite(batch, { ordered: false });
      insertedCount += result.insertedCount  ?? 0;
      updatedCount  += result.modifiedCount  ?? 0;
    } catch (err) {
      // BulkWriteError with partial success (e.g. duplicate key on code)
      const r = err.result;
      if (r) {
        insertedCount += r.nInserted ?? 0;
        updatedCount  += r.nModified ?? 0;

        // Surface individual write errors
        const writeErrors = r.getWriteErrors?.() ?? [];
        for (const we of writeErrors) {
          const failedRow = validRows[i + we.index];
          errors.push({
            rowNumber : failedRow?.rowNumber ?? "?",
            code      : failedRow?.code ?? "?",
            reason    : we.errmsg ?? we.message ?? "Write error",
          });
        }
      } else {
        errors.push({ rowNumber: "batch", code: "—", reason: err.message });
      }
    }
  }

  const successCount = insertedCount + updatedCount;

  return {
    success_rows : successCount,
    inserted     : insertedCount,
    updated      : updatedCount,
    failed_rows  : errors.length,
    errors,
  };
}