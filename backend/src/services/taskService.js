import Task from "../models/task.js";

/**
 * Get "daily" tasks for the current user:
 * - All ongoing tasks (status=ongoing, progress < 100) — carry-over from previous days
 */
async function getDailyTasks({ user }) {
  if (!user?._id) {
    const err = new Error("User context is required");
    err.code = "MISSING_USER";
    err.status = 400;
    throw err;
  }

  const ongoing = await Task.find({
    user_id: user._id,
    status: "ongoing",
  })
    .sort({ start_at: -1 })
    .lean();

  return ongoing;
}

/**
 * Create a new task for the user (for daily task before check-in or during day)
 */
async function createTask({ user, payload }) {
  if (!user?._id) {
    const err = new Error("User context is required");
    err.code = "MISSING_USER";
    err.status = 400;
    throw err;
  }

  const title =
    typeof payload?.title === "string" ? payload.title.trim() : "";
  if (!title) {
    const err = new Error("title is required");
    err.code = "INVALID_TITLE";
    err.status = 400;
    throw err;
  }

  const task = await Task.create({
    user_id: user._id,
    title,
    description: typeof payload?.description === "string" ? payload.description.trim() : "",
    start_at: new Date(),
    progress: 0,
    status: "ongoing",
    weight: payload?.weight ?? 1,
  });

  return task;
}

/**
 * Update task (progress, title, description). Only owner can update.
 */
async function updateTask({ user, taskId, payload }) {
  if (!user?._id) {
    const err = new Error("User context is required");
    err.code = "MISSING_USER";
    err.status = 400;
    throw err;
  }

  const task = await Task.findById(taskId);
  if (!task) {
    const err = new Error("Task not found");
    err.code = "TASK_NOT_FOUND";
    err.status = 404;
    throw err;
  }

  if (task.user_id.toString() !== user._id.toString()) {
    const err = new Error("Task does not belong to current user");
    err.code = "FORBIDDEN_OWNERSHIP";
    err.status = 403;
    throw err;
  }

  const allowed = ["title", "description", "progress"];
  for (const key of allowed) {
    if (payload[key] !== undefined) {
      if (key === "progress") {
        const n = Number(payload[key]);
        if (!Number.isNaN(n)) task.progress = Math.max(0, Math.min(100, n));
      } else if (key === "title" && typeof payload[key] === "string") {
        const t = payload[key].trim();
        if (t) task.title = t;
      } else if (key === "description" && typeof payload[key] === "string") {
        task.description = payload[key].trim();
      }
    }
  }

  await task.save();
  return task;
}

/**
 * Get a single task by id (for ownership check)
 */
async function getTaskById({ user, taskId }) {
  if (!user?._id) {
    const err = new Error("User context is required");
    err.code = "MISSING_USER";
    err.status = 400;
    throw err;
  }

  const task = await Task.findById(taskId).lean();
  if (!task) {
    const err = new Error("Task not found");
    err.code = "TASK_NOT_FOUND";
    err.status = 404;
    throw err;
  }

  if (task.user_id.toString() !== user._id.toString()) {
    const err = new Error("Task does not belong to current user");
    err.code = "FORBIDDEN_OWNERSHIP";
    err.status = 403;
    throw err;
  }

  return task;
}

export default {
  getDailyTasks,
  createTask,
  updateTask,
  getTaskById,
};
