import { Hono } from "hono";
import AttendanceController from "../controllers/attendance.js";
import TaskController from "../controllers/task.js";
import LateAttendanceRequestController from "../controllers/lateAttendanceRequest.js";
import AbsenceRequestController from "../controllers/absenceRequest.js";
import { authenticate, authorize } from "../middleware/auth.js";

const attendanceRouter = new Hono();

// =========================
// Daily tasks (before check-in / carry-over)
// =========================
attendanceRouter.get(
  "/tasks/daily",
  authenticate(),
  authorize({
    permissions: ["system:attendance", "system:manage_projects"],
  }),
  (c) => TaskController.getDailyTasks(c)
);

attendanceRouter.post(
  "/tasks",
  authenticate(),
  authorize({
    permissions: ["system:attendance", "system:manage_projects"],
  }),
  (c) => TaskController.createTask(c)
);

attendanceRouter.get(
  "/tasks/by-project/:projectId",
  authenticate(),
  authorize({
    permissions: ["system:attendance", "system:manage_projects"],
  }),
  (c) => TaskController.getTasksByProject(c)
);

attendanceRouter.patch(
  "/tasks/:id",
  authenticate(),
  authorize({
    permissions: ["system:attendance", "system:manage_projects"],
  }),
  (c) => TaskController.updateTask(c)
);

attendanceRouter.post(
  "/tasks/:id/approve",
  authenticate(),
  authorize({
    permissions: ["system:attendance", "system:manage_projects"],
  }),
  (c) => TaskController.approveTask(c)
);

attendanceRouter.post(
  "/tasks/:id/reject",
  authenticate(),
  authorize({
    permissions: ["system:attendance", "system:manage_projects"],
  }),
  (c) => TaskController.rejectTask(c)
);

attendanceRouter.delete(
  "/tasks/:id",
  authenticate(),
  authorize({
    permissions: ["system:attendance", "system:manage_projects"],
  }),
  (c) => TaskController.deleteTask(c)
);

attendanceRouter.get(
  "/tasks/:id",
  authenticate(),
  authorize({
    permissions: ["system:attendance", "system:manage_projects"],
  }),
  (c) => TaskController.getTaskById(c)
);

// Attendance routes
attendanceRouter.post(
  "/check-in",
  authenticate(),
  authorize({
    permissions: ["system:attendance"],
  }),
  (c) => AttendanceController.checkIn(c)
);

attendanceRouter.patch(
  "/work",
  authenticate(),
  authorize({
    permissions: ["system:attendance"],
  }),
  (c) => AttendanceController.updateDailyWork(c)
);

attendanceRouter.patch(
  "/work/:id",
  authenticate(),
  authorize({
    permissions: ["system:attendance"],
  }),
  (c) => AttendanceController.updateDailyWorkById(c)
);

attendanceRouter.post(
  "/check-out",
  authenticate(),
  authorize({
    permissions: ["system:attendance"],
  }),
  (c) => AttendanceController.checkOut(c)
);

attendanceRouter.get(
  "/today",
  authenticate(),
  authorize({
    permissions: ["system:attendance"],
  }),
  (c) => AttendanceController.getTodayAttendance(c)
);

attendanceRouter.get(
  "/history",
  authenticate(),
  authorize({
    permissions: ["system:attendance"],
  }),
  (c) => AttendanceController.getAttendanceHistory(c)
);

attendanceRouter.get(
  "/my-calendar",
  authenticate(),
  authorize({
    permissions: ["system:attendance"],
  }),
  (c) => AttendanceController.getMyAttendanceCalendar(c)
);

// Attendance by date (self)
attendanceRouter.get(
  "/by-date",
  authenticate(),
  authorize({
    permissions: ["system:attendance"],
  }),
  (c) => AttendanceController.getAttendanceByDate(c)
);

// =========================
// Late attendance requests
// =========================
attendanceRouter.post(
  "/late-request",
  authenticate(),
  authorize({
    permissions: ["system:attendance"],
  }),
  (c) => LateAttendanceRequestController.requestLateAttendance(c)
);

attendanceRouter.post(
  "/late-approve/:id",
  authenticate(),
  authorize({
    permissions: ["user:update"],
  }),
  (c) => LateAttendanceRequestController.approveLateAttendance(c)
);

attendanceRouter.post(
  "/late-reject/:id",
  authenticate(),
  authorize({
    permissions: ["user:update"],
  }),
  (c) => LateAttendanceRequestController.rejectLateAttendance(c)
);

attendanceRouter.get(
  "/late-requests/mine",
  authenticate(),
  authorize({
    permissions: ["system:attendance"],
  }),
  (c) => LateAttendanceRequestController.myLateRequests(c)
);

attendanceRouter.get(
  "/late-requests/pending",
  authenticate(),
  authorize({
    permissions: ["user:update"],
  }),
  (c) => LateAttendanceRequestController.pendingRequests(c)
);

// =========================
// Absence requests (sick/leave/permission)
// =========================
attendanceRouter.post(
  "/absence-request",
  authenticate(),
  authorize({
    permissions: ["system:attendance"],
  }),
  (c) => AbsenceRequestController.requestAbsence(c)
);

attendanceRouter.get(
  "/absence-requests/mine",
  authenticate(),
  authorize({
    permissions: ["system:attendance"],
  }),
  (c) => AbsenceRequestController.myRequests(c)
);

attendanceRouter.get(
  "/absence-requests/pending",
  authenticate(),
  authorize({
    permissions: ["user:update"],
  }),
  (c) => AbsenceRequestController.pendingRequests(c)
);

attendanceRouter.post(
  "/absence-approve/:id",
  authenticate(),
  authorize({
    permissions: ["user:update"],
  }),
  (c) => AbsenceRequestController.approveAbsence(c)
);

attendanceRouter.post(
  "/absence-reject/:id",
  authenticate(),
  authorize({
    permissions: ["user:update"],
  }),
  (c) => AbsenceRequestController.rejectAbsence(c)
);

// =========================
// Late attendance creation & submission
// =========================
attendanceRouter.post(
  "/late-create/:id",
  authenticate(),
  authorize({
    permissions: ["system:attendance"],
  }),
  (c) => AttendanceController.createLateAttendance(c)
);

attendanceRouter.post(
  "/late-submit/:id",
  authenticate(),
  authorize({
    permissions: ["system:attendance"],
  }),
  (c) => AttendanceController.submitLateAttendance(c)
);

// Master data endpoints for dropdowns
attendanceRouter.get(
  "/activities",
  authenticate(),
  authorize({
    permissions: ["system:attendance"],
  }),
  (c) => AttendanceController.getActivities(c)
);

attendanceRouter.get(
  "/projects",
  authenticate(),
  authorize({
    permissions: ["system:attendance"],
  }),
  (c) => AttendanceController.getProjects(c)
);

// Working config for today (or ?date=YYYY-MM-DD)
attendanceRouter.get(
  "/working-config",
  authenticate(),
  authorize({
    permissions: ["system:attendance"],
  }),
  (c) => AttendanceController.getWorkingConfig(c)
);

export default attendanceRouter;

