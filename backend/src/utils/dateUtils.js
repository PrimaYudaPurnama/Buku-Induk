/**
 * Date utilities for the attendance importer.
 *
 * All timestamps in the Excel file are in Asia/Jakarta (WIB, UTC+7).
 * MongoDB / Mongoose stores dates in UTC.
 */

const WIB_OFFSET_MS = 7 * 60 * 60 * 1000; // UTC+7

/**
 * Parse an Excel timestamp string like "2/13/2026 15:56:10"
 * treating it as Asia/Jakarta local time, then return a UTC Date.
 *
 * @param {string} raw  e.g. "2/13/2026 15:56:10"
 * @returns {Date|null}
 */
export function parseWIBTimestamp(raw) {
  if (!raw) return null;

  // Attempt native parse – JS Date constructor treats "M/D/YYYY HH:mm:ss" as local,
  // so we parse the components ourselves to avoid host-timezone confusion.
  const match = raw.match(
    /^(\d{1,2})\/(\d{1,2})\/(\d{4})\s+(\d{1,2}):(\d{2}):(\d{2})$/
  );

  if (!match) {
    // Fallback: try treating it as a plain ISO string
    const d = new Date(raw);
    return isNaN(d.getTime()) ? null : d;
  }

  const [, month, day, year, hour, minute, second] = match.map(Number);

  // Build a UTC timestamp that represents the WIB local time
  const utcMs =
    Date.UTC(year, month - 1, day, hour, minute, second) - WIB_OFFSET_MS;

  return new Date(utcMs);
}

/**
 * Return midnight UTC of the same calendar day in Asia/Jakarta.
 *
 * e.g. WIB 2026-02-13 15:56:10 → UTC 2026-02-13T00:00:00.000Z  (still Feb 13 in WIB)
 *
 * @param {Date} utcDate  A UTC Date that was originally WIB local time
 * @returns {Date}
 */
export function startOfDayWIB(utcDate) {
  // Geser ke WIB untuk dapat tanggal kalender yang benar
  const wibMs = utcDate.getTime() + WIB_OFFSET_MS;
  const wib   = new Date(wibMs);

  // Simpan sebagai midnight UTC murni (00:00:00.000Z) dari tanggal WIB-nya.
  // Sistem menyimpan date sebagai 2026-01-15T00:00:00.000Z, bukan
  // 2026-01-14T17:00:00.000Z (midnight WIB dalam UTC) — jadi JANGAN kurangi offset.
  return new Date(Date.UTC(wib.getUTCFullYear(), wib.getUTCMonth(), wib.getUTCDate()));
}