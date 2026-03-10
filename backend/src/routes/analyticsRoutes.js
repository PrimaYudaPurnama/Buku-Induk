import { Hono } from "hono";
import Attendance from "../models/attendance.js";
import Activity from "../models/activity.js";
import Project from "../models/project.js";

const analyticsRouter = new Hono();

/**
 * GET /analytics/attendance?start=YYYY-MM-DD&end=YYYY-MM-DD
 *
 * Returns aggregated stats that power the AttendanceAnalytics React page.
 */
analyticsRouter.get("/attendance", async (c) => {
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

export default analyticsRouter;