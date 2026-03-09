import { Cron } from "croner";
import Project from "../models/project.js";

/**
 * Get current time in WIB (Waktu Indonesia Barat, UTC+7)
 */
const getWIBDate = (date = new Date()) => {
  const utc = date.getTime() + (date.getTimezoneOffset() * 60000);
  const wib = new Date(utc + (7 * 3600000)); // UTC+7
  return wib;
};

/**
 * Normalize a JS Date to midnight (00:00:00.000) in WIB time.
 */
const normalizeToDateOnly = (date = new Date()) => {
  const wib = getWIBDate(date);
  wib.setHours(0, 0, 0, 0);
  return wib;
};

/**
 * Auto-start projects: Change status from "planned" to "ongoing" if start_date has passed
 * Runs daily at 00:00 WIB (midnight)
 */
export const startProjectCronJob = () => {
  // Run every day at 00:00 WIB (midnight)
  // Cron expression: "0 0 * * *" = every day at 00:00 (server time)
  // We'll run it at 00:00 server time, but check using WIB date logic
  const cron = new Cron("0 0 * * *", {
    timezone: "Asia/Jakarta", // WIB timezone
  }, async () => {
    try {
      const todayWIB = normalizeToDateOnly(new Date());
      
      // Find all projects with status "planned" and start_date <= today (in WIB)
      const projectsToStart = await Project.find({
        status: "planned",
        start_date: { $exists: true, $ne: null, $lte: todayWIB },
      });

      if (projectsToStart.length === 0) {
        console.log(`[Project Cron] No projects to auto-start on ${todayWIB.toISOString()}`);
        return;
      }

      // Update status to "ongoing"
      const updateResult = await Project.updateMany(
        {
          _id: { $in: projectsToStart.map(p => p._id) },
        },
        {
          $set: { status: "ongoing" },
        }
      );

      console.log(`[Project Cron] Auto-started ${updateResult.modifiedCount} project(s) on ${todayWIB.toISOString()}`);
    } catch (error) {
      console.error("[Project Cron] Error auto-starting projects:", error);
    }
  });

  console.log("[Project Cron] Auto-start project cron job initialized (runs daily at 00:00 WIB)");
  return cron;
};
