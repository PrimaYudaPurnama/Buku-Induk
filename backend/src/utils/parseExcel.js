import * as XLSX from "xlsx";

/**
 * Column indices (0-based) in the Excel sheet.
 * Adjust if your sheet layout differs.
 *
 * Col 0  → timestamp          e.g. "2/13/2026 15:56:10"
 * Col 1  → full_name
 * Col 2  → institution        (ignored)
 * Col 3  → activities         e.g. "Dzikir Pagi, Baca Alquran"
 * Col 4  → management_code    e.g. "MANMAR0001"  or "-"
 * Col 5  → technical_code     e.g. "PROJDSGN0002" or "-"
 * Col 6  → note / task text   (free text, stored in note)
 * Col 7  → management_pct     e.g. 50  or "-"
 * Col 8  → technical_pct      e.g. 30  or "-"
 * Col 9  → consent_text       (the "Dengan ini saya menyatakan…" string)
 */
const COL = {
  TIMESTAMP: 0,
  FULL_NAME: 1,
  // INSTITUTION: 2  → skipped
  ACTIVITIES: 3,
  MGMT_CODE: 4,
  TECH_CODE: 5,
  NOTE: 6,
  MGMT_PCT: 7,
  TECH_PCT: 8,
  // CONSENT: 9 → skipped
};

/**
 * Parse an uploaded Excel file (Buffer | ArrayBuffer | Uint8Array)
 * and return an array of raw row objects.
 *
 * @param {Buffer} fileBuffer
 * @returns {RawRow[]}
 */
export function parseExcelBuffer(fileBuffer) {
  const workbook = XLSX.read(fileBuffer, { type: "buffer", cellDates: false });
  const sheetName = workbook.SheetNames[0];
  const sheet = workbook.Sheets[sheetName];

  // Get as array-of-arrays; skip header row (row index 0)
  const rows = XLSX.utils.sheet_to_json(sheet, {
    header: 1,        // return raw arrays
    defval: "",       // empty cells become ""
    blankrows: false,
  });

  // Drop header row if it looks like a header (non-date first cell)
  const dataRows = isHeaderRow(rows[0]) ? rows.slice(1) : rows;

  return dataRows
    .filter((row) => row.length > 0 && row[COL.TIMESTAMP])
    .map((row, idx) => parseRow(row, idx + (isHeaderRow(rows[0]) ? 2 : 1)));
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function isHeaderRow(row) {
  if (!row || !row[COL.TIMESTAMP]) return false;
  const cell = String(row[COL.TIMESTAMP]).toLowerCase();
  return cell.includes("timestamp") || cell.includes("tanggal") || cell.includes("waktu");
}

function parseRow(row, rowNumber) {
  const raw = (i) => (row[i] != null ? String(row[i]).trim() : "");
  const num = (i) => {
    const v = raw(i);
    if (!v || v === "-") return null;
    const n = parseFloat(v);
    return isNaN(n) ? null : n;
  };

  const timestampRaw = raw(COL.TIMESTAMP);
  const activitiesRaw = raw(COL.ACTIVITIES);

  return {
    rowNumber,
    timestampRaw,
    full_name: raw(COL.FULL_NAME),
    activities: activitiesRaw
      ? activitiesRaw
          .split(",")
          .map((a) => a.trim())
          .filter(Boolean)
      : [],
    management_code: raw(COL.MGMT_CODE) === "-" ? null : raw(COL.MGMT_CODE) || null,
    technical_code: raw(COL.TECH_CODE) === "-" ? null : raw(COL.TECH_CODE) || null,
    management_pct: num(COL.MGMT_PCT),
    technical_pct: num(COL.TECH_PCT),
    note: raw(COL.NOTE) === "-" ? "" : raw(COL.NOTE),
  };
}