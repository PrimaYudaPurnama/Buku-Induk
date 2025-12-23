import { Hono } from "hono";
import AuditLogController from "../controllers/auditLog.js";
import { authenticate, authorize } from "../middleware/auth.js";

const auditLogRouter = new Hono();

// GET /api/v1/audit-logs
auditLogRouter.get(
  "/",
  authenticate(),
  authorize({
    permissions: ["system:view_audit_logs", "dashboard:read"],
  }),
  (c) => AuditLogController.getAuditLogs(c)
);

// GET /api/v1/audit-logs/:id
auditLogRouter.get(
  "/:id",
  authenticate(),
  authorize({
    permissions: ["system:view_audit_logs"],
  }),
  (c) => AuditLogController.getAuditLogById(c)
);

// GET /api/v1/audit-logs/resource/:type/:id
auditLogRouter.get(
  "/resource/:type/:id",
  authenticate(),
  authorize({
    permissions: ["system:view_audit_logs"],
  }),
  (c) => AuditLogController.getResourceAuditLogs(c)
);

export default auditLogRouter;

