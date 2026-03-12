import * as XLSX from "xlsx";

const DEFAULT_MAX_ROWS = 8;

// ─────────────────────────────────────────────────────────────────────────────
// Columns yang BENAR-BENAR diproses backend, per mode.
// Urutan di sini = urutan kolom di tabel preview.
// Match pakai .includes() case-insensitive terhadap nama header di Excel.
// ─────────────────────────────────────────────────────────────────────────────

const ATTENDANCE_DISPLAY_HEADERS = [
  "nama lengkap",            // Col 0  → user lookup
  "kehadiran",               // Col 2  → filter: hanya "Hadir" yang diproses
  "timestamp",               // Col 3  → checkIn_at
  "jam pulang",              // Col 4  → checkOut_at
  "kegiatan",                // Col 14 → activities
  "kode projek management",  // Col 8  → management project codes (multi)
  "presentase target pekerjaan management", // Col 16 → management pct (multi)
  "target pekerjaan menegement",            // Col 9  → management task titles (typo intentional)
  "kode projek teknis",      // Col 10 → technical project codes (multi)
  "presentase target pekerjaan teknis",     // Col 17 → technical pct (multi)
  "target pekerjaan teknis", // Col 11 → technical task titles
  "keterangan tambahan",     // Col 12 → note (digabung dengan col 18)
];

const PROJECT_DISPLAY_HEADERS = [
  "kode",                    // Col 0  → group prefix
  "number of project",       // Col 1  → sequence
  "kode pekerjaan",          // Col 2  → unique project code (PK)
  "nama projek",             // Col 3  → project name
  "start date",              // Col 4  → start_date
  "end date",                // Col 5  → end_date
];

// ─────────────────────────────────────────────────────────────────────────────
// Pilih headers yang akan ditampilkan berdasarkan mode
// ─────────────────────────────────────────────────────────────────────────────
function selectDisplayHeaders(allHeaders, mode) {
  const priorities =
    mode === "project"
      ? PROJECT_DISPLAY_HEADERS
      : ATTENDANCE_DISPLAY_HEADERS;

  const matched = [];
  for (const keyword of priorities) {
    const found = allHeaders.find(
      (h) => h.toLowerCase().includes(keyword.toLowerCase())
    );
    if (found && !matched.includes(found)) matched.push(found);
  }

  // Fallback kalau tidak ada yang cocok sama sekali
  return matched.length > 0 ? matched : allHeaders.slice(0, 8);
}

// ─────────────────────────────────────────────────────────────────────────────
// Normalize nilai cell untuk tampilan
// ─────────────────────────────────────────────────────────────────────────────
function normalizeCell(v) {
  if (v == null) return "";

  // JS Date (cellDates: true)
  if (v instanceof Date) {
    if (isNaN(v.getTime())) return "";
    const pad = (n) => String(n).padStart(2, "0");
    return (
      `${pad(v.getDate())}/${pad(v.getMonth() + 1)}/${v.getFullYear()} ` +
      `${pad(v.getHours())}:${pad(v.getMinutes())}:${pad(v.getSeconds())}`
    );
  }

  if (typeof v === "number") {
    if (!Number.isFinite(v)) return "";
    // Excel time-only serial (0 < n < 1) → "HH:mm:ss"
    // Muncul di kolom "Total Jam Kerja" / "Disparitas" — tapi kolom ini
    // tidak masuk displayHeaders attendance, jadi ini hanya safety net
    if (v > 0 && v < 1) {
      const totalSec = Math.round(v * 86400);
      const pad = (n) => String(n).padStart(2, "0");
      return `${pad(Math.floor(totalSec / 3600))}:${pad(Math.floor((totalSec % 3600) / 60))}:${pad(totalSec % 60)}`;
    }
    return v;
  }

  const s = String(v).trim();
  if (!s || s === "-") return "-";
  // Potong string panjang (misal teks pernyataan consent)
  return s.length > 55 ? s.slice(0, 52) + "…" : s;
}

// ─────────────────────────────────────────────────────────────────────────────
// Main export
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Parse Excel file dan kembalikan preview payload.
 *
 * @param {File} file
 * @param {{ maxRows?: number, mode?: "attendance" | "project" }} opts
 * @returns {Promise<{
 *   sheetName      : string,
 *   headers        : string[],       // semua header (untuk info jumlah kolom)
 *   displayHeaders : string[],       // subset yang ditampilkan di tabel
 *   rows           : Record<string, any>[],
 *   totalRows      : number,
 * }>}
 */
export async function buildExcelPreview(file, opts = {}) {
  const maxRows = opts.maxRows ?? DEFAULT_MAX_ROWS;
  const mode    = opts.mode    ?? "attendance";

  if (!file) throw new Error("File belum dipilih");

  const ext = (file.name ?? "").split(".").pop()?.toLowerCase();
  if (!["xlsx", "xls"].includes(ext)) {
    throw new Error("File harus .xlsx atau .xls");
  }

  const arrayBuffer = await file.arrayBuffer();

  // cellDates:true → Date objects untuk sel tanggal/waktu
  // raw:true       → angka tetap sebagai number (normalizeCell yg urus display)
  // JANGAN kombinasikan cellDates:true + raw:false → output tidak konsisten
  const wb = XLSX.read(arrayBuffer, { type: "array", cellDates: true, raw: true });

  const sheetName = wb.SheetNames?.[0];
  if (!sheetName) throw new Error("Sheet Excel tidak ditemukan");

  const ws       = wb.Sheets[sheetName];
  const rows2d   = XLSX.utils.sheet_to_json(ws, {
    header   : 1,
    raw      : true,
    defval   : null,
    blankrows: false,
  });

  if (!rows2d.length) {
    return { sheetName, headers: [], displayHeaders: [], rows: [], totalRows: 0 };
  }

  const headers = (rows2d[0] ?? []).map((h, i) =>
    h != null && String(h).trim() ? String(h).trim() : `Kolom ${i + 1}`
  );

  const dataRows      = rows2d.slice(1);
  const displayHeaders = selectDisplayHeaders(headers, mode);

  const previewRows = dataRows.slice(0, maxRows).map((r) => {
    const obj = {};
    headers.forEach((h, idx) => {
      obj[h] = normalizeCell(r?.[idx] ?? null);
    });
    return obj;
  });

  return {
    sheetName,
    headers,
    displayHeaders,
    rows      : previewRows,
    totalRows : dataRows.length,
  };
}