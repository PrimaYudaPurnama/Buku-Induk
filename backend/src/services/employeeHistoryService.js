import EmployeeHistory from "../models/employeeHistory.js";

/**
 * Auto-create employee history record
 * @param {string} eventType - Event type (hired, promotion, demotion, transfer, etc.)
 * @param {object} oldData - Old data (role, division, salary, status)
 * @param {object} newData - New data (role, division, salary, status)
 * @param {string} createdBy - User ID who created the history
 * @param {object} options - Additional options (effective_date, reason, notes)
 * @returns {Promise<object>} Created history record
 */
export const autoCreateHistory = async (
  eventType,
  oldData = {},
  newData = {},
  createdBy,
  options = {}
) => {
  const {
    effective_date = new Date(),
    reason = "",
    notes = "",
    user_id,
  } = options;

  if (!user_id) {
    throw new Error("user_id is required");
  }

  const history = await EmployeeHistory.create({
    user_id,
    event_type: eventType,
    old_role: oldData.role_id || null,
    new_role: newData.role_id || null,
    old_division: oldData.division_id || null,
    new_division: newData.division_id || null,
    old_salary: oldData.salary || null,
    new_salary: newData.salary || null,
    effective_date,
    reason,
    notes,
    created_by: createdBy,
  });

  return history;
};

/**
 * Get employee history for a user
 * @param {string} userId - User ID
 * @param {object} options - Options (limit, offset, eventType)
 * @returns {Promise<object>} History records and pagination
 */
export const getUserHistory = async (userId, options = {}) => {
  const { limit = 50, offset = 0, eventType = null } = options;

  const query = { user_id: userId };
  if (eventType) {
    query.event_type = eventType;
  }

  const history = await EmployeeHistory.find(query)
    .populate("old_role", "name")
    .populate("new_role", "name")
    .populate("old_division", "name")
    .populate("new_division", "name")
    .populate("created_by", "full_name email")
    .sort({ effective_date: -1, created_at: -1 })
    .limit(limit)
    .skip(offset);

  const total = await EmployeeHistory.countDocuments(query);

  return {
    history,
    pagination: {
      total,
      limit,
      offset,
      hasMore: offset + limit < total,
    },
  };
};

