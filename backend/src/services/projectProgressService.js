import Project from "../models/project.js";
import Task from "../models/task.js";

/**
 * Recalculate a project's percentage based on its tasks' hour_weight and status.
 * Formula:
 *   percentage = (sum(hour_weight where status = 'approved') / sum(all hour_weight)) * 100
 *
 * If no tasks are found, percentage is reset to 0 and status is kept as-is
 * (caller may decide to adjust status manually if needed).
 *
 * This helper is intentionally idempotent and safe to call frequently.
 */
export async function recalculateProjectPercentage(projectId) {
  if (!projectId) return;

  const project = await Project.findById(projectId);
  if (!project) return;
  const prevStatus = project.status;
  const prevPercentage = project.percentage;

  const tasks = await Task.find({
    project_id: projectId,
  }).lean();

  if (!tasks.length) {
    project.percentage = 0;
    await project.save();
    return;
  }

  let totalHours = 0;
  let approvedHours = 0;

  for (const t of tasks) {
    const w = Number(t.hour_weight ?? 0);
    if (Number.isNaN(w) || w <= 0) continue;
    totalHours += w;
    if (t.status === "approved") {
      approvedHours += w;
    }
  }

  const percentage =
    totalHours <= 0 ? 0 : Math.round((approvedHours / totalHours) * 100);

  project.percentage = Math.max(0, Math.min(100, percentage));

  // Derive status from percentage when not cancelled.
  if (project.status !== "cancelled") {
    if (project.percentage <= 0) {
      // Keep planned unless it was already ongoing/completed.
      if (!["ongoing", "completed"].includes(project.status)) {
        project.status = "planned";
      }
    } else if (project.percentage >= 100) {
      project.status = "completed";
      if (!project.end_date) {
        project.end_date = new Date();
      }
    } else {
      // If previously completed and now drops below 100, clear end_date
      if (prevStatus === "completed" && typeof project.end_date !== "undefined" && project.end_date) {
        project.end_date = null;
      }
      project.status = "ongoing";
    }
  }

  await project.save();
}

export default {
  recalculateProjectPercentage,
};

