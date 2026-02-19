import LateAttendanceRequestService from "../services/lateAttendanceRequestService.js";

class LateAttendanceRequestController {
  async requestLateAttendance(c) {
    try {
      const user = c.get("user");
      const body = await c.req.json().catch(() => ({}));

      // Strict payload: only date + late_reason accepted
      const allowed = ["date", "late_reason"];
      const forbidden = Object.keys(body || {}).filter((k) => !allowed.includes(k));
      if (forbidden.length > 0) {
        return c.json(
          {
            success: false,
            error: {
              message: `Forbidden fields in payload: ${forbidden.join(", ")}`,
              code: "FORBIDDEN_FIELDS",
            },
          },
          400
        );
      }

      const reqDoc = await LateAttendanceRequestService.requestLateAttendance({
        user,
        date: body.date,
        late_reason: body.late_reason,
      });

      return c.json({ success: true, data: reqDoc }, 201);
    } catch (error) {
      const status = error.status || 500;
      return c.json(
        {
          success: false,
          error: {
            message: error.message || "Failed to create late attendance request",
            code: error.code || "LATE_REQUEST_ERROR",
          },
        },
        status
      );
    }
  }

  async approveLateAttendance(c) {
    try {
      const approver = c.get("user");
      const requestId = c.req.param("id");

      const reqDoc = await LateAttendanceRequestService.approveLateAttendance({
        approver,
        requestId,
      });

      return c.json({ success: true, data: reqDoc });
    } catch (error) {
      const status = error.status || 500;
      return c.json(
        {
          success: false,
          error: {
            message: error.message || "Failed to approve late attendance request",
            code: error.code || "LATE_APPROVE_ERROR",
          },
        },
        status
      );
    }
  }

  async rejectLateAttendance(c) {
    try {
      const approver = c.get("user");
      const requestId = c.req.param("id");
      const body = await c.req.json().catch(() => ({}));

      const allowed = ["rejected_reason"];
      const forbidden = Object.keys(body || {}).filter((k) => !allowed.includes(k));
      if (forbidden.length > 0) {
        return c.json(
          {
            success: false,
            error: {
              message: `Forbidden fields in payload: ${forbidden.join(", ")}`,
              code: "FORBIDDEN_FIELDS",
            },
          },
          400
        );
      }

      const reqDoc = await LateAttendanceRequestService.rejectLateAttendance({
        approver,
        requestId,
        rejected_reason: body.rejected_reason,
      });

      return c.json({ success: true, data: reqDoc });
    } catch (error) {
      const status = error.status || 500;
      return c.json(
        {
          success: false,
          error: {
            message: error.message || "Failed to reject late attendance request",
            code: error.code || "LATE_REJECT_ERROR",
          },
        },
        status
      );
    }
  }

  async myLateRequests(c) {
    try {
      const user = c.get("user");
      const data = await LateAttendanceRequestService.listMyRequests({ user });
      return c.json({ success: true, data });
    } catch (error) {
      const status = error.status || 500;
      return c.json(
        {
          success: false,
          error: {
            message: error.message || "Failed to fetch late attendance requests",
            code: error.code || "LATE_REQUEST_LIST_ERROR",
          },
        },
        status
      );
    }
  }

  async pendingRequests(c) {
    try {
      const approver = c.get("user");
      const data = await LateAttendanceRequestService.listPendingRequests({ approver });
      return c.json({ success: true, data });
    } catch (error) {
      const status = error.status || 500;
      return c.json(
        {
          success: false,
          error: {
            message: error.message || "Failed to fetch pending late requests",
            code: error.code || "LATE_PENDING_LIST_ERROR",
          },
        },
        status
      );
    }
  }
}

export default new LateAttendanceRequestController();

