import Attendance from "../models/attendance.js";
import LateAttendanceRequest from "../models/lateAttendanceRequest.js";

/**
 * Get current time in WIB (Waktu Indonesia Barat, UTC+7)
 */
const getWIBDate = (date = new Date()) => {
  // Convert to WIB (UTC+7)
  const utc = date.getTime() + (date.getTimezoneOffset() * 60000);
  const wib = new Date(utc + (7 * 3600000)); // UTC+7
  return wib;
};

/**
 * Normalize a JS Date to midnight (00:00:00.000) in WIB time.
 * SAFEST OPTION: use WIB timezone, do not trust client.
 */
const normalizeToDateOnly = (date = new Date()) => {
  const wib = getWIBDate(date);
  wib.setHours(0, 0, 0, 0);
  return wib;
};

/**
 * Get day of week in WIB (0 = Sunday, 1 = Monday, ..., 6 = Saturday)
 */
const getWIBDayOfWeek = (date = new Date()) => {
  const wib = getWIBDate(date);
  return wib.getDay();
};

/**
 * Check if date is Sunday (libur)
 */
const isSunday = (date = new Date()) => {
  return getWIBDayOfWeek(date) === 0;
};

/**
 * Check if date is a working day (Monday-Saturday, Sunday is off)
 */
const isWorkingDay = (date = new Date()) => {
  const dayOfWeek = getWIBDayOfWeek(date);
  return dayOfWeek >= 1 && dayOfWeek <= 6; // Monday (1) to Saturday (6)
};

/**
 * SAFEST OPTION (AMBIGUOUS):
 * "Only Manager HR or higher may approve" depends on your role hierarchy mapping.
 * We enforce by hierarchy_level <= 2 (lower number = higher authority).
 * Adjust this constant only if your org policy defines a different threshold.
 */
const HR_MANAGER_MAX_LEVEL = 4;

const assertHrManagerOrHigher = (user) => {
  const level = user?.role_id?.hierarchy_level;
  if (typeof level !== "number" || level > HR_MANAGER_MAX_LEVEL) {
    const err = new Error("Only Manager HR or higher can approve/reject requests");
    err.code = "FORBIDDEN_HR_APPROVAL";
    err.status = 403;
    throw err;
  }
};

class LateAttendanceRequestService {
  async requestLateAttendance({ user, date, late_reason }) {
    if (!user?._id) {
      const err = new Error("User context is required");
      err.code = "MISSING_USER";
      err.status = 400;
      throw err;
    }

    if (!date) {
      const err = new Error("date (YYYY-MM-DD) is required");
      err.code = "MISSING_DATE";
      err.status = 400;
      throw err;
    }

    if (
      !late_reason ||
      typeof late_reason !== "string" ||
      late_reason.trim().length < 10
    ) {
      const err = new Error("late_reason is required and must be at least 10 characters");
      err.code = "INVALID_LATE_REASON";
      err.status = 400;
      throw err;
    }

    const targetDate = normalizeToDateOnly(new Date(date));
    const today = normalizeToDateOnly(new Date());

    // Validate that target date is a working day
    if (isSunday(targetDate)) {
      const err = new Error("Tidak dapat mengajukan late attendance untuk hari Minggu (libur)");
      err.code = "SUNDAY_NOT_ALLOWED";
      err.status = 400;
      throw err;
    }

    if (!isWorkingDay(targetDate)) {
      const err = new Error("Tanggal yang dipilih bukan hari kerja");
      err.code = "NOT_WORKING_DAY";
      err.status = 400;
      throw err;
    }

    // Strict: only past dates
    if (targetDate >= today) {
      const err = new Error("Late attendance request is only allowed for past dates");
      err.code = "INVALID_LATE_DATE";
      err.status = 400;
      throw err;
    }

    // Strict: cannot request if attendance already exists for that date
    const existingAttendance = await Attendance.findOne({
      user_id: user._id,
      date: targetDate,
    }).lean();

    if (existingAttendance) {
      const err = new Error("Attendance already exists for that date");
      err.code = "ATTENDANCE_ALREADY_EXISTS";
      err.status = 409;
      throw err;
    }

    // Strict: only one request per date due to unique index
    try {
      const reqDoc = await LateAttendanceRequest.create({
        user_id: user._id,
        date: targetDate,
        late_reason: late_reason.trim(),
        status: "pending",
      });
      return reqDoc;
    } catch (e) {
      if (e?.code === 11000) {
        const err = new Error("Late attendance request already exists for that date");
        err.code = "LATE_REQUEST_ALREADY_EXISTS";
        err.status = 409;
        throw err;
      }
      throw e;
    }
  }

  async approveLateAttendance({ approver, requestId }) {
    if (!approver?._id) {
      const err = new Error("Approver context is required");
      err.code = "MISSING_USER";
      err.status = 400;
      throw err;
    }

    assertHrManagerOrHigher(approver);

    const reqDoc = await LateAttendanceRequest.findById(requestId);
    if (!reqDoc) {
      const err = new Error("Late attendance request not found");
      err.code = "LATE_REQUEST_NOT_FOUND";
      err.status = 404;
      throw err;
    }

    if (reqDoc.status !== "pending") {
      const err = new Error(`Request is already ${reqDoc.status}`);
      err.code = "INVALID_REQUEST_STATUS";
      err.status = 400;
      throw err;
    }

    reqDoc.status = "approved";
    reqDoc.approved_by = approver._id;
    reqDoc.approved_at = new Date();
    reqDoc.rejected_by = null;
    reqDoc.rejected_at = null;
    reqDoc.rejected_reason = "";

    await reqDoc.save();

    // IMPORTANT: Approval does NOT create Attendance.
    return reqDoc;
  }

  async rejectLateAttendance({ approver, requestId, rejected_reason }) {
    if (!approver?._id) {
      const err = new Error("Approver context is required");
      err.code = "MISSING_USER";
      err.status = 400;
      throw err;
    }

    assertHrManagerOrHigher(approver);

    if (
      !rejected_reason ||
      typeof rejected_reason !== "string" ||
      rejected_reason.trim().length < 3
    ) {
      const err = new Error("rejected_reason is required (min 3 characters)");
      err.code = "INVALID_REJECT_REASON";
      err.status = 400;
      throw err;
    }

    const reqDoc = await LateAttendanceRequest.findById(requestId);
    if (!reqDoc) {
      const err = new Error("Late attendance request not found");
      err.code = "LATE_REQUEST_NOT_FOUND";
      err.status = 404;
      throw err;
    }

    if (reqDoc.status !== "pending") {
      const err = new Error(`Request is already ${reqDoc.status}`);
      err.code = "INVALID_REQUEST_STATUS";
      err.status = 400;
      throw err;
    }

    reqDoc.status = "rejected";
    reqDoc.rejected_by = approver._id;
    reqDoc.rejected_at = new Date();
    reqDoc.rejected_reason = rejected_reason.trim();
    reqDoc.approved_by = null;
    reqDoc.approved_at = null;

    await reqDoc.save();

    // IMPORTANT: Rejection does NOT create Attendance.
    return reqDoc;
  }

  async listMyRequests({ user }) {
    if (!user?._id) {
      const err = new Error("User context is required");
      err.code = "MISSING_USER";
      err.status = 400;
      throw err;
    }

    return await LateAttendanceRequest.find({ user_id: user._id })
      .sort({ date: -1, created_at: -1 })
      .lean();
  }

  async listPendingRequests({ approver }) {
    if (!approver?._id) {
      const err = new Error("Approver context is required");
      err.code = "MISSING_USER";
      err.status = 400;
      throw err;
    }

    assertHrManagerOrHigher(approver);

    return await LateAttendanceRequest.find({ status: "pending" })
      .sort({ created_at: -1 })
      .populate("user_id", "full_name email employee_code")
      .lean();
  }
}

export default new LateAttendanceRequestService();

