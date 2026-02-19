import { Hono } from "hono";
import AttendanceController from "../controllers/attendance.js";
import LateAttendanceRequestController from "../controllers/lateAttendanceRequest.js";
import { authenticate, authorize } from "../middleware/auth.js";

const attendanceRouter = new Hono();

// Attendance routes
attendanceRouter.post(
  "/check-in",
  authenticate(),
  // SAFEST OPTION: reuse generic dashboard/user self permissions
  authorize({
    permissions: ["dashboard:read", "user:read:any", "user:read:self"],
  }),
  (c) => AttendanceController.checkIn(c)
);

attendanceRouter.patch(
  "/work",
  authenticate(),
  authorize({
    permissions: ["dashboard:read", "user:read:any", "user:read:self"],
  }),
  (c) => AttendanceController.updateDailyWork(c)
);

attendanceRouter.patch(
  "/work/:id",
  authenticate(),
  authorize({
    permissions: ["dashboard:read", "user:read:any", "user:read:self"],
  }),
  (c) => AttendanceController.updateDailyWorkById(c)
);

attendanceRouter.post(
  "/check-out",
  authenticate(),
  authorize({
    permissions: ["dashboard:read", "user:read:any", "user:read:self"],
  }),
  (c) => AttendanceController.checkOut(c)
);

attendanceRouter.get(
  "/today",
  authenticate(),
  authorize({
    permissions: ["dashboard:read", "user:read:any", "user:read:self"],
  }),
  (c) => AttendanceController.getTodayAttendance(c)
);

attendanceRouter.get(
  "/history",
  authenticate(),
  authorize({
    permissions: ["dashboard:read", "user:read:any", "user:read:self"],
  }),
  (c) => AttendanceController.getAttendanceHistory(c)
);

// Attendance by date (self)
attendanceRouter.get(
  "/by-date",
  authenticate(),
  authorize({
    permissions: ["dashboard:read", "user:read:any", "user:read:self"],
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
    permissions: ["dashboard:read", "user:read:any", "user:read:self"],
  }),
  (c) => LateAttendanceRequestController.requestLateAttendance(c)
);

attendanceRouter.post(
  "/late-approve/:id",
  authenticate(),
  authorize({
    permissions: ["dashboard:read", "user:read:any"],
  }),
  (c) => LateAttendanceRequestController.approveLateAttendance(c)
);

attendanceRouter.post(
  "/late-reject/:id",
  authenticate(),
  authorize({
    permissions: ["dashboard:read", "user:read:any"],
  }),
  (c) => LateAttendanceRequestController.rejectLateAttendance(c)
);

attendanceRouter.get(
  "/late-requests/mine",
  authenticate(),
  authorize({
    permissions: ["dashboard:read", "user:read:any", "user:read:self"],
  }),
  (c) => LateAttendanceRequestController.myLateRequests(c)
);

attendanceRouter.get(
  "/late-requests/pending",
  authenticate(),
  authorize({
    permissions: ["dashboard:read", "user:read:any"],
  }),
  (c) => LateAttendanceRequestController.pendingRequests(c)
);

// =========================
// Late attendance creation & submission
// =========================
attendanceRouter.post(
  "/late-create/:id",
  authenticate(),
  authorize({
    permissions: ["dashboard:read", "user:read:any", "user:read:self"],
  }),
  (c) => AttendanceController.createLateAttendance(c)
);

attendanceRouter.post(
  "/late-submit/:id",
  authenticate(),
  authorize({
    permissions: ["dashboard:read", "user:read:any", "user:read:self"],
  }),
  (c) => AttendanceController.submitLateAttendance(c)
);

// Master data endpoints for dropdowns
attendanceRouter.get(
  "/activities",
  authenticate(),
  authorize({
    permissions: ["dashboard:read", "user:read:any", "user:read:self"],
  }),
  (c) => AttendanceController.getActivities(c)
);

attendanceRouter.get(
  "/projects",
  authenticate(),
  authorize({
    permissions: ["dashboard:read", "user:read:any", "user:read:self"],
  }),
  (c) => AttendanceController.getProjects(c)
);

export default attendanceRouter;

