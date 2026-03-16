import AttendanceService from "../services/attendanceService.js";

class AttendanceController {
  async checkIn(c) {
    try {
      const user = c.get("user");
      const body = await c.req.json().catch(() => ({}));

      // Client is NOT allowed to send date or timestamps
      const forbidden = ["date", "checkIn_at", "checkOut_at", "status"];
      const bodyKeys = Object.keys(body || {});
      const invalid = bodyKeys.filter((k) => forbidden.includes(k));
      if (invalid.length > 0) {
        return c.json(
          {
            success: false,
            error: {
              message: `Forbidden fields in payload: ${invalid.join(", ")}`,
              code: "FORBIDDEN_FIELDS",
            },
          },
          400
        );
      }

      const attendance = await AttendanceService.checkIn({
        user,
        consentCheckIn:
          body.user_consent?.checkIn ?? body.consentCheckIn ?? true,
        taskIds: body.task_ids ?? body.taskIds ?? [],
      });

      return c.json(
        {
          success: true,
          data: attendance,
        },
        201
      );
    } catch (error) {
      const status = error.status || 500;
      return c.json(
        {
          success: false,
          error: {
            message: error.message || "Failed to check in",
            code: error.code || "CHECKIN_ERROR",
          },
        },
        status
      );
    }
  }

  async updateDailyWork(c) {
    try {
      const user = c.get("user");
      const body = await c.req.json().catch(() => ({}));

      const attendance = await AttendanceService.updateDailyWork({
        user,
        payload: body,
      });

      return c.json({
        success: true,
        data: attendance,
      });
    } catch (error) {
      const status = error.status || 500;
      return c.json(
        {
          success: false,
          error: {
            message: error.message || "Failed to update daily work",
            code: error.code || "UPDATE_DAILY_WORK_ERROR",
          },
        },
        status
      );
    }
  }

  async checkOut(c) {
    try {
      const user = c.get("user");
      const body = await c.req.json().catch(() => ({}));

      // Client is NOT allowed to send date or timestamps
      const forbidden = ["date", "checkIn_at", "checkOut_at", "status"];
      const bodyKeys = Object.keys(body || {});
      const invalid = bodyKeys.filter((k) => forbidden.includes(k));
      if (invalid.length > 0) {
        return c.json(
          {
            success: false,
            error: {
              message: `Forbidden fields in payload: ${invalid.join(", ")}`,
              code: "FORBIDDEN_FIELDS",
            },
          },
          400
        );
      }

      const attendance = await AttendanceService.checkOut({
        user,
        consentCheckOut:
          body.user_consent?.checkOut ?? body.consentCheckOut ?? true,
        tasksPayload: Array.isArray(body.tasks) ? body.tasks : [],
      });

      return c.json({
        success: true,
        data: attendance,
      });
    } catch (error) {
      const status = error.status || 500;
      return c.json(
        {
          success: false,
          error: {
            message: error.message || "Failed to check out",
            code: error.code || "CHECKOUT_ERROR",
          },
        },
        status
      );
    }
  }

  async getTodayAttendance(c) {
    try {
      const user = c.get("user");

      const attendance = await AttendanceService.getTodayAttendance({ user });

      return c.json({
        success: true,
        data: attendance,
      });
    } catch (error) {
      const status = error.status || 500;
      return c.json(
        {
          success: false,
          error: {
            message: error.message || "Failed to fetch today attendance",
            code: error.code || "GET_TODAY_ATTENDANCE_ERROR",
          },
        },
        status
      );
    }
  }

  async getAttendanceHistory(c) {
    try {
      const user = c.get("user");
      const from = c.req.query("from") || null;
      const to = c.req.query("to") || null;

      const history = await AttendanceService.getAttendanceHistory({
        user,
        from,
        to,
      });

      return c.json({
        success: true,
        data: history,
      });
    } catch (error) {
      const status = error.status || 500;
      return c.json(
        {
          success: false,
          error: {
            message: error.message || "Failed to fetch attendance history",
            code: error.code || "GET_ATTENDANCE_HISTORY_ERROR",
          },
        },
        status
      );
    }
  }

  async getActivities(c) {
    try {
      const Activity = (await import("../models/activity.js")).default;
      const activities = await Activity.find({}).sort({ name_activity: 1 }).lean();
      return c.json({
        success: true,
        data: activities,
      });
    } catch (error) {
      return c.json(
        {
          success: false,
          error: {
            message: error.message || "Failed to fetch activities",
            code: "FETCH_ACTIVITIES_ERROR",
          },
        },
        500
      );
    }
  }

  async getProjects(c) {
    try {
      const Project = (await import("../models/project.js")).default;
      const projects = await Project.find({}).sort({ name: 1 }).lean();
      return c.json({
        success: true,
        data: projects,
      });
    } catch (error) {
      return c.json(
        {
          success: false,
          error: {
            message: error.message || "Failed to fetch projects",
            code: "FETCH_PROJECTS_ERROR",
          },
        },
        500
      );
    }
  }

  async createLateAttendance(c) {
    try {
      const user = c.get("user");
      const requestId = c.req.param("id");
      const body = await c.req.json().catch(() => ({}));

      // Explicitly reject forbidden fields
      const forbidden = ["date", "status", "user_id", "late_request_id"];
      const invalid = Object.keys(body || {}).filter((k) => forbidden.includes(k));
      if (invalid.length > 0) {
        return c.json(
          {
            success: false,
            error: {
              message: `Forbidden fields in payload: ${invalid.join(", ")}`,
              code: "FORBIDDEN_FIELDS",
            },
          },
          400
        );
      }

      const attendance = await AttendanceService.createLateAttendance({
        user,
        requestId,
        payload: body,
      });

      return c.json({ success: true, data: attendance }, 201);
    } catch (error) {
      const status = error.status || 500;
      return c.json(
        {
          success: false,
          error: {
            message: error.message || "Failed to create late attendance",
            code: error.code || "LATE_CREATE_ERROR",
          },
        },
        status
      );
    }
  }

  async submitLateAttendance(c) {
    try {
      const user = c.get("user");
      const id = c.req.param("id");

      const attendance = await AttendanceService.submitLateAttendance({
        user,
        attendanceId: id,
      });

      return c.json({ success: true, data: attendance });
    } catch (error) {
      const status = error.status || 500;
      return c.json(
        {
          success: false,
          error: {
            message: error.message || "Failed to submit late attendance",
            code: error.code || "LATE_SUBMIT_ERROR",
          },
        },
        status
      );
    }
  }

  async getAttendanceByDate(c) {
    try {
      const user = c.get("user");
      const date = c.req.query("date");
      const attendance = await AttendanceService.getAttendanceByDate({ user, date });
      return c.json({ success: true, data: attendance });
    } catch (error) {
      const status = error.status || 500;
      return c.json(
        {
          success: false,
          error: {
            message: error.message || "Failed to fetch attendance by date",
            code: error.code || "ATTENDANCE_BY_DATE_ERROR",
          },
        },
        status
      );
    }
  }

  async updateDailyWorkById(c) {
    try {
      const user = c.get("user");
      const id = c.req.param("id");
      const body = await c.req.json().catch(() => ({}));

      // Explicitly reject timestamp/date fields
      const forbidden = ["date", "checkIn_at", "checkOut_at", "status"];
      const invalid = Object.keys(body || {}).filter((k) => forbidden.includes(k));
      if (invalid.length > 0) {
        return c.json(
          {
            success: false,
            error: {
              message: `Forbidden fields in payload: ${invalid.join(", ")}`,
              code: "FORBIDDEN_FIELDS",
            },
          },
          400
        );
      }

      const attendance = await AttendanceService.updateDailyWorkById({
        user,
        attendanceId: id,
        payload: body,
      });

      return c.json({ success: true, data: attendance });
    } catch (error) {
      const status = error.status || 500;
      return c.json(
        {
          success: false,
          error: {
            message: error.message || "Failed to update daily work",
            code: error.code || "UPDATE_DAILY_WORK_ERROR",
          },
        },
        status
      );
    }
  }
}

export default new AttendanceController();

