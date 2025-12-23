import { createAuditLog } from "../services/auditLogService.js";

const getIp = (c) => {
  const headers = c.req.header.bind(c.req);
  return (
    headers("x-forwarded-for")?.split(",")[0]?.trim() ||
    headers("cf-connecting-ip") ||
    headers("x-real-ip") ||
    null
  );
};

const getUserAgent = (c) => c.req.header("user-agent") || null;

/**
 * Helper to create audit log using request context
 */
export const logAudit = async (
  c,
  action,
  resourceType,
  resourceId,
  oldValue = null,
  newValue = null
) => {
  try {
    const user = c.get("user");
    const userId = user?._id || null;
    const ip = getIp(c);
    const ua = getUserAgent(c);

    await createAuditLog(
      userId,
      action,
      resourceType,
      resourceId,
      oldValue,
      newValue,
      ip,
      ua
    );
  } catch (err) {
    console.error("Failed to write audit log:", err.message || err);
  }
};

