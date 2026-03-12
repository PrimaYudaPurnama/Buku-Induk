import { Hono } from "hono";
import { parseExcelBuffer } from "../utils/parseExcel.js";
import { importAttendanceService } from "../services/importAttendanceService.js";
import { parseProjectExcelBuffer } from "../utils/parseProjectExcel.js";
import { importProjectService }    from "../services/importProjectService.js";
import Attendance from "../models/attendance.js";

const importRouter = new Hono();

/**
 * POST /import/attendance
 *
 * Accepts a multipart/form-data upload with a single field named "file"
 * containing an .xlsx or .xls Excel workbook.
 *
 * Response 200:
 * {
 *   success_rows : number,
 *   failed_rows  : number,
 *   errors       : { rowNumber: number|string, reason: string }[]
 * }
 */
importRouter.post("/attendance", async (c) => {
  // ── 1. Parse multipart form ──────────────────────────────────────────────
  let formData;
  try {
    formData = await c.req.formData();
  } catch {
    return c.json({ error: "Expected multipart/form-data body" }, 400);
  }

  const file = formData.get("file");
  if (!file || typeof file === "string") {
    return c.json({ error: 'Missing file field "file"' }, 400);
  }

  const filename = file.name ?? "";
  const ext = filename.split(".").pop()?.toLowerCase();
  if (!["xlsx", "xls"].includes(ext)) {
    return c.json({ error: "Only .xlsx / .xls files are accepted" }, 400);
  }

  // ── 2. Read file into buffer ──────────────────────────────────────────────
  let buffer;
  try {
    const arrayBuffer = await file.arrayBuffer();
    buffer = Buffer.from(arrayBuffer);
  } catch (err) {
    return c.json({ error: `Failed to read uploaded file: ${err.message}` }, 400);
  }

  // ── 3. Parse Excel rows ───────────────────────────────────────────────────
  let rawRows;
  try {
    rawRows = parseExcelBuffer(buffer);
  } catch (err) {
    return c.json({ error: `Excel parsing failed: ${err.message}` }, 422);
  }

  if (rawRows.length === 0) {
    return c.json({ error: "No data rows found in the uploaded file" }, 422);
  }

  // ── 4. Run import ─────────────────────────────────────────────────────────
  let result;
  try {
    result = await importAttendanceService(rawRows);
  } catch (err) {
    console.error("[importAttendance] unexpected error:", err);
    return c.json({ error: "Import failed due to an internal error" }, 500);
  }

  return c.json(result, 200);
});

/**
 * GET /analytics/attendance?start=YYYY-MM-DD&end=YYYY-MM-DD
 *
 * Returns aggregated stats that power the AttendanceAnalytics React page.
 */
importRouter.get("/attendance", async (c) => {
  const { start, end } = c.req.query();

  // ── Date filter ────────────────────────────────────────────────────────────
  const dateFilter = {};
  if (start) dateFilter.$gte = new Date(start);
  if (end) {
    const endDay = new Date(end);
    endDay.setUTCHours(23, 59, 59, 999);
    dateFilter.$lte = endDay;
  }

  const matchStage = Object.keys(dateFilter).length
    ? { $match: { date: dateFilter } }
    : { $match: {} };

  // ── Run aggregations in parallel ───────────────────────────────────────────
  const [summary, activityFreq, projectContrib] = await Promise.all([
    // 1. Summary counts
    Attendance.aggregate([
      matchStage,
      {
        $group: {
          _id: null,
          total_attendance: { $sum: 1 },
          unique_employees: { $addToSet: "$user_id" },
          late_count: {
            $sum: { $cond: [{ $in: ["$status", ["late", "late_checkin"]] }, 1, 0] },
          },
          manual_count: {
            $sum: { $cond: [{ $eq: ["$status", "manual"] }, 1, 0] },
          },
        },
      },
      {
        $project: {
          _id: 0,
          total_attendance: 1,
          unique_employees: { $size: "$unique_employees" },
          late_count: 1,
          manual_count: 1,
        },
      },
    ]),

    // 2. Activity frequency
    Attendance.aggregate([
      matchStage,
      { $unwind: "$activities" },
      { $group: { _id: "$activities", count: { $sum: 1 } } },
      { $sort: { count: -1 } },
      { $limit: 20 },
      {
        $lookup: {
          from: "activities",
          localField: "_id",
          foreignField: "_id",
          as: "activity",
        },
      },
      { $unwind: "$activity" },
      {
        $project: {
          _id: 0,
          name: "$activity.name_activity",
          count: 1,
        },
      },
    ]),

    // 3. Project contribution averages
    Attendance.aggregate([
      matchStage,
      { $unwind: "$projects" },
      {
        $group: {
          _id: "$projects.project_id",
          avg_pct: { $avg: "$projects.contribution_percentage" },
          appearances: { $sum: 1 },
        },
      },
      { $sort: { avg_pct: -1 } },
      {
        $lookup: {
          from: "projects",
          localField: "_id",
          foreignField: "_id",
          as: "project",
        },
      },
      { $unwind: "$project" },
      {
        $project: {
          _id: 0,
          name: "$project.name",
          code: "$project.code",
          avg_pct: { $round: ["$avg_pct", 1] },
          appearances: 1,
        },
      },
    ]),
  ]);

  return c.json({
    ...(summary[0] ?? {
      total_attendance: 0,
      unique_employees: 0,
      late_count: 0,
      manual_count: 0,
    }),
    activity_frequency: activityFreq,
    project_contributions: projectContrib,
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Shared helper – read & validate the uploaded file from FormData
// ─────────────────────────────────────────────────────────────────────────────
async function readUploadedFile(c) {
  let formData;
  try {
    formData = await c.req.formData();
  } catch {
    return { err: c.json({ error: "Expected multipart/form-data body" }, 400) };
  }

  const file = formData.get("file");
  if (!file || typeof file === "string") {
    return { err: c.json({ error: 'Missing file field "file"' }, 400) };
  }

  const ext = (file.name ?? "").split(".").pop()?.toLowerCase();
  if (!["xlsx", "xls"].includes(ext)) {
    return { err: c.json({ error: "Only .xlsx / .xls files are accepted" }, 400) };
  }

  try {
    const arrayBuffer = await file.arrayBuffer();
    return { buffer: Buffer.from(arrayBuffer) };
  } catch (err) {
    return { err: c.json({ error: `Failed to read uploaded file: ${err.message}` }, 400) };
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// POST /import/projects
// ─────────────────────────────────────────────────────────────────────────────
/**
 * @body  multipart/form-data  { file: .xlsx }
 * @returns {
 *   success_rows : number,
 *   inserted     : number,
 *   updated      : number,
 *   failed_rows  : number,
 *   errors       : { rowNumber, code, reason }[]
 * }
 */
importRouter.post("/projects", async (c) => {
  const { buffer, err } = await readUploadedFile(c);
  if (err) return err;

  let rawRows;
  try {
    rawRows = parseProjectExcelBuffer(buffer);
  } catch (e) {
    return c.json({ error: `Excel parsing failed: ${e.message}` }, 422);
  }

  if (!rawRows.length) {
    return c.json({ error: "No data rows found in the uploaded file" }, 422);
  }

  try {
    const result = await importProjectService(rawRows);
    return c.json(result, 200);
  } catch (e) {
    console.error("[importProjects] unexpected error:", e);
    return c.json({ error: "Import failed due to an internal error" }, 500);
  }
});

export default importRouter;