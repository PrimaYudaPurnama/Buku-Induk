import Task from "../models/task.js";
import { recalculateProjectPercentage } from "./projectProgressService.js";

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
 * List tasks for a given project.
 * - Manager (system:manage_projects) can see all tasks for the project.
 * - Regular user only sees their own tasks for that project.
 */
async function getTasksByProject({ user, projectId }) {
  if (!user?._id) {
    const err = new Error("User context is required");
    err.code = "MISSING_USER";
    err.status = 400;
    throw err;
  }

  if (!projectId) {
    const err = new Error("projectId is required");
    err.code = "MISSING_PROJECT_ID";
    err.status = 400;
    throw err;
  }

  const permissions = user?.role_id?.permissions || [];
  const canManageProjects = Array.isArray(permissions)
    ? permissions.includes("system:manage_projects")
    : false;

  let query;
  if (canManageProjects) {
    // Manager sees all tasks of this project (including approved).
    query = { project_id: projectId };
  } else {
    // Attendance needs:
    // - planned: visible & selectable
    // - rejected: visible & selectable
    // - ongoing: only if belongs to current user (auto-selected)
    // - approved: hidden
    // - done: hidden from planning list (handled on attendance after check-in)
    query = {
      project_id: projectId,
      $or: [
        { status: { $in: ["planned", "rejected"] } },
        { status: "ongoing", user_id: user._id },
      ],
      status: { $ne: "approved" },
    };
  }

  const tasks = await Task.find(query)
    .sort({ created_at: -1 })
    .populate("user_id", "full_name email")
    .populate("approved_by", "full_name email")
    .lean();
  return tasks;
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

  // Allow linking task to a project (optional for backward compatibility).
  const projectId = payload?.project_id || payload?.projectId || null;

  // hour_weight: required in new flow, but we keep a safe default for legacy callers
  const rawHourWeight =
    payload?.hour_weight ?? payload?.hourWeight ?? payload?.weight ?? 1;
  const hourWeight = Number(rawHourWeight);
  if (Number.isNaN(hourWeight) || hourWeight <= 0) {
    const err = new Error("hour_weight must be a positive number");
    err.code = "INVALID_HOUR_WEIGHT";
    err.status = 400;
    throw err;
  }

  const initialStatus =
    typeof payload?.status === "string" &&
    ["planned", "ongoing", "done", "approved", "rejected"].includes(
      payload.status
    )
      ? payload.status
      : "planned";

  const permissions = user?.role_id?.permissions || [];
  const canManageProjects = Array.isArray(permissions)
    ? permissions.includes("system:manage_projects")
    : false;

  const ownerUserId =
    canManageProjects && payload?.user_id === null ? null : user._id;

  const task = await Task.create({
    user_id: ownerUserId,
    project_id: projectId || null,
    title,
    description:
      typeof payload?.description === "string"
        ? payload.description.trim()
        : "",
    start_at: new Date(),
    hour_weight: hourWeight,
    status: initialStatus,
  });

  // Recalculate project percentage if this task is linked to a project.
  if (task.project_id) {
    await recalculateProjectPercentage(task.project_id);
  }

  return task;
}

/**
 * Update task (title, description, hour_weight, limited status/project). Only owner can update.
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

  const { title, description, hour_weight, status, project_id } = payload || {};

  const previousProjectId = task.project_id ? task.project_id.toString() : null;

  if (typeof title === "string") {
    const t = title.trim();
    if (t) {
      task.title = t;
    }
  }

  if (typeof description === "string") {
    task.description = description.trim();
  }

  if (hour_weight !== undefined) {
    if (task.status === "approved") {
      const err = new Error("Cannot change hour_weight of an approved task");
      err.code = "TASK_APPROVED_LOCKED";
      err.status = 400;
      throw err;
    }
    const n = Number(hour_weight);
    if (Number.isNaN(n) || n <= 0) {
      const err = new Error("hour_weight must be a positive number");
      err.code = "INVALID_HOUR_WEIGHT";
      err.status = 400;
      throw err;
    }
    task.hour_weight = n;
  }

  if (project_id !== undefined) {
    if (task.status === "approved") {
      const err = new Error("Cannot change project of an approved task");
      err.code = "TASK_APPROVED_LOCKED";
      err.status = 400;
      throw err;
    }
    task.project_id = project_id || null;
  }

  if (status !== undefined) {
    if (!["planned", "ongoing", "done"].includes(status)) {
      const err = new Error(
        "Invalid status change. Only planned, ongoing, or done are allowed from this endpoint"
      );
      err.code = "INVALID_STATUS";
      err.status = 400;
      throw err;
    }
    task.status = status;
  }

  await task.save();

  // Recalculate project percentages where this task contributes.
  const nextProjectId = task.project_id ? task.project_id.toString() : null;
  const uniqueProjectIds = new Set(
    [previousProjectId, nextProjectId].filter(Boolean)
  );
  for (const pid of uniqueProjectIds) {
    await recalculateProjectPercentage(pid);
  }

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

/**
 * Approve a task (manager only).
 * Optionally adjusts hour_weight before approval.
 */
async function approveTask({ user, taskId, payload }) {
  if (!user?._id) {
    const err = new Error("User context is required");
    err.code = "MISSING_USER";
    err.status = 400;
    throw err;
  }

  const permissions = user?.role_id?.permissions || [];
  const canManageProjects = Array.isArray(permissions)
    ? permissions.includes("system:manage_projects")
    : false;

  if (!canManageProjects) {
    const err = new Error("You do not have permission to approve tasks");
    err.code = "FORBIDDEN_APPROVE_TASK";
    err.status = 403;
    throw err;
  }

  const task = await Task.findById(taskId);
  if (!task) {
    const err = new Error("Task not found");
    err.code = "TASK_NOT_FOUND";
    err.status = 404;
    throw err;
  }

  if (payload && payload.hour_weight !== undefined) {
    const n = Number(payload.hour_weight);
    if (Number.isNaN(n) || n <= 0) {
      const err = new Error("hour_weight must be a positive number");
      err.code = "INVALID_HOUR_WEIGHT";
      err.status = 400;
      throw err;
    }
    task.hour_weight = n;
  }

  task.status = "approved";
  task.approved_by = user._id;
  task.approved_at = new Date();

  await task.save();

  if (task.project_id) {
    await recalculateProjectPercentage(task.project_id);
  }

  return task;
}

/**
 * Reject a task (manager only).
 * Clears approval metadata and sets status to rejected.
 */
async function rejectTask({ user, taskId }) {
  if (!user?._id) {
    const err = new Error("User context is required");
    err.code = "MISSING_USER";
    err.status = 400;
    throw err;
  }

  const permissions = user?.role_id?.permissions || [];
  const canManageProjects = Array.isArray(permissions)
    ? permissions.includes("system:manage_projects")
    : false;

  if (!canManageProjects) {
    const err = new Error("You do not have permission to reject tasks");
    err.code = "FORBIDDEN_REJECT_TASK";
    err.status = 403;
    throw err;
  }

  const task = await Task.findById(taskId);
  if (!task) {
    const err = new Error("Task not found");
    err.code = "TASK_NOT_FOUND";
    err.status = 404;
    throw err;
  }

  task.status = "rejected";
  task.approved_by = null;
  task.approved_at = null;

  await task.save();

  if (task.project_id) {
    await recalculateProjectPercentage(task.project_id);
  }

  return task;
}

async function deleteTask({ user, taskId }) {
  if (!user?._id) {
    const err = new Error("User context is required");
    err.code = "MISSING_USER";
    err.status = 400;
    throw err;
  }

  const permissions = user?.role_id?.permissions || [];
  const canManageProjects = Array.isArray(permissions)
    ? permissions.includes("system:manage_projects")
    : false;

  if (!canManageProjects) {
    const err = new Error("You do not have permission to delete tasks");
    err.code = "FORBIDDEN_DELETE_TASK";
    err.status = 403;
    throw err;
  }

  const task = await Task.findById(taskId);
  if (!task) {
    const err = new Error("Task not found");
    err.code = "TASK_NOT_FOUND";
    err.status = 404;
    throw err;
  }

  const projectId = task.project_id;
  await Task.deleteOne({ _id: task._id });

  if (projectId) {
    await recalculateProjectPercentage(projectId);
  }

  return { deleted: true };
}

export default {
  getDailyTasks,
  getTasksByProject,
  createTask,
  updateTask,
  getTaskById,
  approveTask,
  rejectTask,
  deleteTask,
};
