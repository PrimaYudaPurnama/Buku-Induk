import * as XLSX from "xlsx";

/**
 * Column indices (0-based) matching the t1Migration_project.xlsx format:
 *
 * Col 0 → Kode            e.g. "PROJWEB"   (group prefix, not the unique code)
 * Col 1 → Number of Project  e.g. 1, 2, 3  (sequence within the group)
 * Col 2 → Kode Pekerjaan  e.g. "PROJWEB0001"  ← unique project code
 * Col 3 → Nama projek     e.g. "Website Toko Material Murah"
 * Col 4 → Start date      e.g. "2025-12-08 00:00:00" or "8/15/2025"
 * Col 5 → End date        e.g. "8/15/2025" or null/empty
 */
const COL = {
  GROUP_CODE : 0,
  NUMBER     : 1,
  CODE       : 2,
  NAME       : 3,
  START_DATE : 4,
  END_DATE   : 5,
};

function deriveWorkType(code = "") {
  const upper = code.toUpperCase();
  // MAN...  → management
  // PROJ... → technic
  if (upper.startsWith("MAN")) return "management";
  if (upper.startsWith("PROJ")) return "technic";
  // default fallback
  return "technic";
}

/**
 * Safely parse a date cell that may be:
 *  - a JS Date object (xlsx with cellDates:true)
 *  - a string "2025-12-08 00:00:00" or "8/15/2025"
 *  - an Excel serial number
 *  - empty / "-"
 *
 * @param {any} raw
 * @returns {Date|null}
 */
function parseFlexibleDate(raw) {
  if (!raw || raw === "-") return null;

  // Already a Date (xlsx cellDates:true)
  if (raw instanceof Date) return isNaN(raw.getTime()) ? null : raw;

  // Excel serial number
  if (typeof raw === "number") {
    const d = XLSX.SSF.parse_date_code(raw);
    if (!d) return null;
    return new Date(Date.UTC(d.y, d.m - 1, d.d));
  }

  // String – try native parse (handles ISO and M/D/YYYY)
  const str = String(raw).trim();
  if (!str || str === "-") return null;

  const d = new Date(str);
  return isNaN(d.getTime()) ? null : d;
}

/**
 * Parse an uploaded project Excel file (Buffer | ArrayBuffer | Uint8Array)
 * and return an array of raw project row objects.
 *
 * @param {Buffer} fileBuffer
 * @returns {RawProjectRow[]}
 */
export function parseProjectExcelBuffer(fileBuffer) {
  const workbook = XLSX.read(fileBuffer, { type: "buffer", cellDates: true });
  const sheetName = workbook.SheetNames[0];
  const sheet = workbook.Sheets[sheetName];

  const rows = XLSX.utils.sheet_to_json(sheet, {
    header: 1,
    defval: "",
    blankrows: false,
  });

  // Detect and skip header row
  const dataRows = isHeaderRow(rows[0]) ? rows.slice(1) : rows;

  return dataRows
    .filter((row) => row.length > 0 && row[COL.CODE])
    .map((row, idx) => {
      const raw = (i) => (row[i] != null ? String(row[i]).trim() : "");
      const code = raw(COL.CODE).toUpperCase();

      return {
        rowNumber  : idx + (isHeaderRow(rows[0]) ? 2 : 1),
        group_code : raw(COL.GROUP_CODE).toUpperCase(),
        number     : row[COL.NUMBER] ? Number(row[COL.NUMBER]) : null,
        code,
        name       : raw(COL.NAME),
        work_type  : deriveWorkType(code),
        start_date : parseFlexibleDate(row[COL.START_DATE]),
        end_date   : parseFlexibleDate(row[COL.END_DATE]),
      };
    });
}

function isHeaderRow(row) {
  if (!row) return false;
  const cell = String(row[COL.CODE] ?? row[0] ?? "").toLowerCase();
  return (
    cell.includes("kode") ||
    cell.includes("code") ||
    cell.includes("nama") ||
    cell.includes("name")
  );
}