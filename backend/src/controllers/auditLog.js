import {
  getAuditLogs,
  getAuditLogById,
  getResourceAuditLogs,
} from "../services/auditLogService.js";

class AuditLogController {
  /**
   * GET /api/v1/audit-logs
   * Get audit logs with filtering and pagination
   */
  static async getAuditLogs(c) {
    try {
      const query = c.req.query();
      const {
        page = 1,
        limit = 50,
        user_id,
        action,
        resource_type,
        resource_id,
        start_date,
        end_date,
      } = query;

      const filters = {
        page,
        limit,
        user_id,
        action,
        resource_type,
        resource_id,
        start_date,
        end_date,
      };

      const result = await getAuditLogs(filters, { page, limit });

      return c.json({
        success: true,
        data: result.logs,
        meta: {
          pagination: result.pagination,
        },
      });
    } catch (error) {
      console.error("Get audit logs error:", error);
      return c.json({
        success: false,
        error: {
          message: error.message || "Internal server error",
          code: "AUDIT_LOG_FETCH_ERROR",
        },
      }, 500);
    }
  }

  /**
   * GET /api/v1/audit-logs/:id
   * Get audit log by ID
   */
  static async getAuditLogById(c) {
    try {
      const logId = c.req.param("id");

      const log = await getAuditLogById(logId);

      return c.json({
        success: true,
        data: log,
      });
    } catch (error) {
      console.error("Get audit log by ID error:", error);
      if (error.message === "Audit log not found") {
        return c.json({
          success: false,
          error: {
            message: error.message,
            code: "AUDIT_LOG_NOT_FOUND",
          },
        }, 404);
      }
      return c.json({
        success: false,
        error: {
          message: error.message || "Internal server error",
          code: "AUDIT_LOG_FETCH_ERROR",
        },
      }, 500);
    }
  }

  /**
   * GET /api/v1/audit-logs/resource/:type/:id
   * Get audit logs for a specific resource
   */
  static async getResourceAuditLogs(c) {
    try {
      const resourceType = c.req.param("type");
      const resourceId = c.req.param("id");
      const query = c.req.query();
      const { limit = 50, offset = 0 } = query;

      const result = await getResourceAuditLogs(resourceType, resourceId, {
        limit: parseInt(limit),
        offset: parseInt(offset),
      });

      return c.json({
        success: true,
        data: result.logs,
        meta: {
          pagination: result.pagination,
        },
      });
    } catch (error) {
      console.error("Get resource audit logs error:", error);
      return c.json({
        success: false,
        error: {
          message: error.message || "Internal server error",
          code: "AUDIT_LOG_FETCH_ERROR",
        },
      }, 500);
    }
  }
}

export default AuditLogController;

