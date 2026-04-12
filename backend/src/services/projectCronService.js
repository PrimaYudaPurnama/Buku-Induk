import { Cron } from "croner";
import Project from "../models/project.js";
import Attendance from "../models/attendance.js";
import Task from "../models/task.js";
import User from "../models/user.js";
import { createAuditLog } from "./auditLogService.js";

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
  new Cron("0 0 * * * *", async () => {
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
      const c = await getContext(ctx);
      if (!c) return;

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
      await createAuditLog(
        null,
        "attendance_cleanup",
        "attendance",
        null,
        null,
        { attendance_ids: attendanceIds.map((id) => String(id)), date: today },
        null,
        "cron"
      );
    } catch (err) {
      console.error("Attendance cleanup cron error:", err);
    }
  });

  // Daily (02:00): deactivate active users whose contract end date (WIB calendar) is before today.
  new Cron("0 0 2 * * *", async () => {
    try {
      const result = await User.updateMany(
        {
          status: "active",
          expired_date: { $exists: true, $ne: null },
          $expr: {
            $lt: [
              {
                $dateToString: {
                  format: "%Y-%m-%d",
                  date: "$expired_date",
                  timezone: "Asia/Jakarta",
                },
              },
              {
                $dateToString: {
                  format: "%Y-%m-%d",
                  date: "$$NOW",
                  timezone: "Asia/Jakarta",
                },
              },
            ],
          },
        },
        { $set: { status: "inactive" } }
      );
      if (result.modifiedCount > 0) {
        console.log(
          "[cron] contract_expired: set inactive:",
          result.modifiedCount,
          "user(s)"
        );
      }
    } catch (err) {
      console.error("Contract expiry cron error:", err);
    }
  });
}