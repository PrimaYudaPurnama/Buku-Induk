import * as XLSX from "xlsx";

/**
 * Column map for the NEW Excel format (0-based):
 *
 * Col 0  → Nama Lengkap
 * Col 1  → Divisi                        (ignored)
 * Col 2  → Kehadiran                     (ignored)
 * Col 3  → Timestamp / Jam Berangkat     e.g. "1/13/2026 8:56:24"
 * Col 4  → Jam Pulang                    e.g. "1/13/2026 17:11:07"
 * Col 5  → Total Jam Kerja               (ignored)
 * Col 6  → Disparitas                    (ignored)
 * Col 7  → Pecapaian Jam Kerja           (ignored)
 * Col 8  → Kode Projek Management        e.g. "MANMAR0001" or "MANMAR0001,MANMAR0002" or "-"
 * Col 9  → Target Pekerjaan Management   e.g. "Mencari 20 perusahaan" or multi-comma
 * Col 10 → Kode Projek Teknis            e.g. "PROJDSGN0001" or "-"
 * Col 11 → Target Pekerjaan Teknis       e.g. "Revisi UI" or multi-comma
 * Col 12 → Keterangan Tambahan           (digabung dengan col 18)
 * Col 13 → Pernyataan                    (ignored)
 * Col 14 → Kegiatan / Activities         e.g. "Dzikir Pagi"
 * Col 15 → Presentase Projek             (ignored — digantikan col 16 & 17)
 * Col 16 → Presentase Target Management  e.g. 40 or "40,60"
 * Col 17 → Presentase Target Teknis      e.g. 30 or "30,70"
 * Col 18 → Keterangan                    (digabung dengan col 12)
 * Col 19 → Pernyataan 1                  (ignored)
 */
const COL = {
  FULL_NAME   : 0,
  ATTENDANCE  : 2,   // "Hadir" / "Tidak Hadir" / "Izin" / etc.
  TIMESTAMP   : 3,
  CHECKOUT    : 4,
  MGMT_CODES  : 8,
  MGMT_TASKS  : 9,
  TECH_CODES  : 10,
  TECH_TASKS  : 11,
  NOTE_A      : 12,
  ACTIVITIES  : 14,
  MGMT_PCTS   : 16,
  TECH_PCTS   : 17,
  NOTE_B      : 18,
};

/**
 * Parse an uploaded Excel attendance file and return an array of raw row objects.
 *
 * @param {Buffer} fileBuffer
 * @returns {RawRow[]}
 */
export function parseExcelBuffer(fileBuffer) {
  const workbook = XLSX.read(fileBuffer, { type: "buffer", cellDates: false });
  const sheet    = workbook.Sheets[workbook.SheetNames[0]];

  const rows = XLSX.utils.sheet_to_json(sheet, {
    header   : 1,
    defval   : "",
    blankrows: false,
  });

  const hasHeader = isHeaderRow(rows[0]);
  const dataRows  = hasHeader ? rows.slice(1) : rows;

  return dataRows
    .filter((row) => {
      if (row.length === 0 || !row[COL.TIMESTAMP]) return false;
      // Only process rows where Kehadiran = "Hadir" (case-insensitive)
      const kehadiran = String(row[COL.ATTENDANCE] ?? "").trim().toLowerCase();
      return kehadiran === "hadir";
    })
    .map((row, idx) => parseRow(row, idx + (hasHeader ? 2 : 1)));
}

// ─────────────────────────────────────────────────────────────────────────────
// Internal helpers
// ─────────────────────────────────────────────────────────────────────────────

function isHeaderRow(row) {
  if (!row) return false;
  const cell = String(row[COL.FULL_NAME] ?? row[0] ?? "").toLowerCase();
  return cell.includes("nama") || cell.includes("name") || cell.includes("timestamp");
}

/** Read a cell as trimmed string; return "" for empty/dash/NaN */
function str(row, i) {
  const v = row[i];
  if (v == null) return "";
  const s = String(v).trim();
  return s === "-" || s.toLowerCase() === "nan" ? "" : s;
}

/**
 * Split a comma-separated cell into a trimmed, non-empty string array.
 * Returns [] for empty / dash cells.
 */
function splitComma(row, i) {
  const s = str(row, i);
  if (!s) return [];
  return s.split(",").map((x) => x.trim()).filter(Boolean);
}

/**
 * Split a comma-separated numeric cell into a number array.
 * Non-numeric segments become null.
 */
function splitNums(row, i) {
  const s = str(row, i);
  if (!s) return [];
  return s.split(",").map((x) => {
    const n = parseFloat(x.trim());
    return isNaN(n) ? null : n;
  });
}

function parseRow(row, rowNumber) {
  // Merge the two note columns into one
  const noteA = str(row, COL.NOTE_A);
  const noteB = str(row, COL.NOTE_B);
  const note  = [noteA, noteB].filter(Boolean).join(" ").trim();

  return {
    rowNumber,
    full_name      : str(row, COL.FULL_NAME),
    timestampRaw   : str(row, COL.TIMESTAMP),
    checkoutRaw    : str(row, COL.CHECKOUT),
    activities     : splitComma(row, COL.ACTIVITIES),
    management_codes: splitComma(row, COL.MGMT_CODES),
    management_tasks: splitComma(row, COL.MGMT_TASKS),
    management_pcts : splitNums(row, COL.MGMT_PCTS),
    technical_codes : splitComma(row, COL.TECH_CODES),
    technical_tasks : splitComma(row, COL.TECH_TASKS),
    technical_pcts  : splitNums(row, COL.TECH_PCTS),
    note,
  };
}