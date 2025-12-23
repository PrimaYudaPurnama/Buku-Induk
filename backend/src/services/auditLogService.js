import AuditLog from "../models/auditLog.js";

/**
 * Create audit log entry
 * @param {string} userId - User ID who performed the action (null for system actions)
 * @param {string} action - Action type (create, update, delete, approve, reject, etc.)
 * @param {string} resourceType - Resource type (user, role, division, account_request, approval, document)
 * @param {string} resourceId - Resource ID
 * @param {object} oldValue - Old value (before change)
 * @param {object} newValue - New value (after change)
 * @param {string} ipAddress - IP address
 * @param {string} userAgent - User agent string
 * @returns {Promise<object>} Created audit log
 */
export const createAuditLog = async (
  userId,
  action,
  resourceType,
  resourceId,
  oldValue = null,
  newValue = null,
  ipAddress = null,
  userAgent = null
) => {
  const auditLog = await AuditLog.create({
    user_id: userId || null,
    action,
    resource_type: resourceType,
    resource_id: resourceId,
    old_value: oldValue,
    new_value: newValue,
    ip_address: ipAddress,
    user_agent: userAgent,
  });

  return auditLog;
};

/**
 * Get audit logs with filtering and pagination
 * @param {object} filters - Filter options
 * @param {object} pagination - Pagination options
 * @returns {Promise<object>} Audit logs and pagination info
 */
export const getAuditLogs = async (filters = {}, pagination = {}) => {
  const {
    page = 1,
    limit = 50,
    user_id,
    action,
    resource_type,
    resource_id,
    start_date,
    end_date,
  } = filters;

  const query = {};

  if (user_id) query.user_id = user_id;
  if (action) query.action = action;
  if (resource_type) query.resource_type = resource_type;
  if (resource_id) query.resource_id = resource_id;

  // Date range filter
  if (start_date || end_date) {
    query.created_at = {};
    if (start_date) {
      query.created_at.$gte = new Date(start_date);
    }
    if (end_date) {
      query.created_at.$lte = new Date(end_date);
    }
  }

  const skip = (parseInt(page) - 1) * parseInt(limit);

  const [logs, total] = await Promise.all([
    AuditLog.find(query)
      .populate("user_id", "full_name email")
      .sort({ created_at: -1 })
      .skip(skip)
      .limit(parseInt(limit))
      .lean(),
    AuditLog.countDocuments(query),
  ]);

  return {
    logs,
    pagination: {
      page: parseInt(page),
      limit: parseInt(limit),
      total,
      total_pages: Math.ceil(total / parseInt(limit)),
    },
  };
};

/**
 * Get audit log by ID
 * @param {string} logId - Audit log ID
 * @returns {Promise<object>} Audit log
 */
export const getAuditLogById = async (logId) => {
  const log = await AuditLog.findById(logId)
    .populate("user_id", "full_name email")
    .lean();

  if (!log) {
    throw new Error("Audit log not found");
  }

  return log;
};

/**
 * Get audit logs for a specific resource
 * @param {string} resourceType - Resource type
 * @param {string} resourceId - Resource ID
 * @param {object} options - Options (limit, offset)
 * @returns {Promise<object>} Audit logs
 */
export const getResourceAuditLogs = async (resourceType, resourceId, options = {}) => {
  const { limit = 50, offset = 0 } = options;

  const logs = await AuditLog.find({
    resource_type: resourceType,
    resource_id: resourceId,
  })
    .populate("user_id", "full_name email")
    .sort({ created_at: -1 })
    .limit(limit)
    .skip(offset)
    .lean();

  const total = await AuditLog.countDocuments({
    resource_type: resourceType,
    resource_id: resourceId,
  });

  return {
    logs,
    pagination: {
      total,
      limit,
      offset,
      hasMore: offset + limit < total,
    },
  };
};

