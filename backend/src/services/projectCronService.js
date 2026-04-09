import { Cron } from "croner";
import Project from "../models/project.js";
import Attendance from "../models/attendance.js";
import Task from "../models/task.js";

// ===== WIB helpers (UTC+7) =====
const getWIBDate = (date = new Date()) => {
  const utc = date.getTime() + date.getTimezoneOffset() * 60000;
  return new Date(utc + 7 * 3600000);
};

const normalizeToDateOnly = (date = new Date()) => {
  const wib = getWIBDate(date);
  return new Date(Date.UTC(wib.getFullYear(), wib.getMonth(), wib.getDate()));
};

export const startProjectCronJob = () => {
  new Cron("0 0 */6 * * *", async () => {
    try {

      const now = new Date()

      const result = await Project.updateMany(
        {
          status: "planned",
          start_date: { $lte: now }
        },
        {
          $set: { status: "ongoing" }
        }
      )

      console.log("updated:", result.modifiedCount)

    } catch (err) {
      console.error(err)
    }
  })

  // Cleanup: after 21:00 WIB, delete attendance records for today that have no check-out yet.
  // This is a data-integrity guard if user accidentally closes the checkout proof modal.
  new Cron("0 0 21 * * *", async () => {
    try {
      const wibNow = getWIBDate(new Date());
      const cutoffTotalMinutes = 21 * 60; // 21:00
      const nowTotalMinutes = wibNow.getHours() * 60 + wibNow.getMinutes();
      if (nowTotalMinutes < cutoffTotalMinutes) return;

      const today = normalizeToDateOnly(wibNow);
      const toDelete = await Attendance.find({
        date: today,
        checkOut_at: null,
      }).select({ _id: 1, tasks_today: 1, user_id: 1 });

      if (!toDelete || toDelete.length === 0) return;

      const attendanceIds = toDelete.map((a) => a._id);
      const taskIds = [];
      for (const a of toDelete) {
        for (const tid of a.tasks_today || []) {
          if (tid) taskIds.push(tid);
        }
      }

      // Best-effort: revert selected tasks back to planned for those still marked ongoing.
      if (taskIds.length > 0) {
        await Task.updateMany(
          { _id: { $in: taskIds }, status: "ongoing" },
          { $set: { status: "planned", user_id: null } }
        );
      }

      await Attendance.deleteMany({ _id: { $in: attendanceIds } });
    } catch (err) {
      console.error("Attendance cleanup cron error:", err);
    }
  });
}