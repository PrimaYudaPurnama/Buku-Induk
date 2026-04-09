import AbsenceRequestService from "../services/absenceRequestService.js";

class AbsenceRequestController {
  async requestAbsence(c) {
    try {
      const user = c.get("user");
      const body = await c.req.json().catch(() => ({}));
      const allowed = [
        "type",
        "start_date",
        "end_date",
        "reason",
        "attachment_url",
        "attachment_document_id",
      ];
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

      const doc = await AbsenceRequestService.requestAbsence({
        user,
        type: body.type,
        start_date: body.start_date,
        end_date: body.end_date,
        reason: body.reason,
        attachment_url: body.attachment_url,
        attachment_document_id: body.attachment_document_id,
      });
      return c.json({ success: true, data: doc }, 201);
    } catch (error) {
      const status = error.status || 500;
      return c.json(
        {
          success: false,
          error: {
            message: error.message || "Failed to create absence request",
            code: error.code || "ABSENCE_REQUEST_ERROR",
          },
        },
        status
      );
    }
  }

  async myRequests(c) {
    try {
      const user = c.get("user");
      const data = await AbsenceRequestService.listMyRequests({ user });
      return c.json({ success: true, data });
    } catch (error) {
      const status = error.status || 500;
      return c.json(
        {
          success: false,
          error: {
            message: error.message || "Failed to fetch absence requests",
            code: error.code || "ABSENCE_REQUEST_LIST_ERROR",
          },
        },
        status
      );
    }
  }

  async pendingRequests(c) {
    try {
      const approver = c.get("user");
      const data = await AbsenceRequestService.listPendingRequests({ approver });
      return c.json({ success: true, data });
    } catch (error) {
      const status = error.status || 500;
      return c.json(
        {
          success: false,
          error: {
            message: error.message || "Failed to fetch pending absence requests",
            code: error.code || "ABSENCE_PENDING_LIST_ERROR",
          },
        },
        status
      );
    }
  }

  async approveAbsence(c) {
    try {
      const approver = c.get("user");
      const requestId = c.req.param("id");
      const data = await AbsenceRequestService.approveAbsence({ approver, requestId });
      return c.json({ success: true, data });
    } catch (error) {
      const status = error.status || 500;
      return c.json(
        {
          success: false,
          error: {
            message: error.message || "Failed to approve absence request",
            code: error.code || "ABSENCE_APPROVE_ERROR",
          },
        },
        status
      );
    }
  }

  async rejectAbsence(c) {
    try {
      const approver = c.get("user");
      const requestId = c.req.param("id");
      const body = await c.req.json().catch(() => ({}));
      const data = await AbsenceRequestService.rejectAbsence({
        approver,
        requestId,
        rejected_reason: body.rejected_reason || "",
      });
      return c.json({ success: true, data });
    } catch (error) {
      const status = error.status || 500;
      return c.json(
        {
          success: false,
          error: {
            message: error.message || "Failed to reject absence request",
            code: error.code || "ABSENCE_REJECT_ERROR",
          },
        },
        status
      );
    }
  }
}

export default new AbsenceRequestController();
