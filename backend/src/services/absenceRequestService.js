import AbsenceRequest from "../models/absenceRequest.js";
import Attendance from "../models/attendance.js";
import LateAttendanceRequest from "../models/lateAttendanceRequest.js";
import WeeklySchedule from "../models/weeklySchedule.js";
import WorkDay from "../models/workDay.js";
import mongoose from "mongoose";

const HR_MANAGER_MAX_LEVEL = 4;

const getWIBDate = (date = new Date()) => {
  const utc = date.getTime() + (date.getTimezoneOffset() * 60000);
  return new Date(utc + 7 * 3600000);
};

const normalizeToDateOnly = (date = new Date()) => {
  const wib = getWIBDate(date);
  return new Date(Date.UTC(wib.getFullYear(), wib.getMonth(), wib.getDate()));
};

const normalizeDateKey = (date) => {
  const d = getWIBDate(new Date(date));
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
};

const addDays = (date, amount) => {
  const d = new Date(date);
  d.setUTCDate(d.getUTCDate() + amount);
  return d;
};

const eachDateInclusive = (startDate, endDate) => {
  const dates = [];
  let cursor = new Date(startDate);
  while (cursor <= endDate) {
    dates.push(new Date(cursor));
    cursor = addDays(cursor, 1);
  }
  return dates;
};

const assertHrManagerOrHigher = (user) => {
  const level = user?.role_id?.hierarchy_level;
  if (typeof level !== "number" || level > HR_MANAGER_MAX_LEVEL) {
    const err = new Error("Only Manager HR or higher can approve/reject requests");
    err.code = "FORBIDDEN_HR_APPROVAL";
    err.status = 403;
    throw err;
  }
};

const assertValidType = (type) => {
  if (!["sick", "leave", "permission"].includes(type)) {
    const err = new Error("type must be one of: sick, leave, permission");
    err.code = "INVALID_ABSENCE_TYPE";
    err.status = 400;
    throw err;
  }
};

const getDayOfWeekWib = (date = new Date()) => getWIBDate(date).getDay();

/** Untuk rentang izin: hari libur / non-kerja (sesuai WorkDay) dilewati; tetap 1 record request. */
const classifyDayForAbsence = async (date) => {
  const norm = normalizeToDateOnly(date);
  const dow = getDayOfWeekWib(date);
  const workDay = await WorkDay.findOne({ date: norm }).lean();
  const weekly = await WeeklySchedule.findOne({ day_of_week: dow }).lean();

  if (!workDay) {
    return { kind: "missing_workday" };
  }
  if (!workDay.is_working_day || workDay.is_holiday) {
    return { kind: "skip" };
  }
  if (!weekly?.is_working_day || !weekly?.check_in || !weekly?.check_out) {
    return { kind: "invalid", reason: "Jadwal mingguan belum lengkap" };
  }
  return { kind: "working" };
};

const resolveWorkingDatesInRange = async (start, end) => {
  const dates = eachDateInclusive(start, end);
  const workingDates = [];
  for (const d of dates) {
    const c = await classifyDayForAbsence(d);
    if (c.kind === "missing_workday") {
      const err = new Error(`Tanggal ${normalizeDateKey(d)} belum diset HR (WorkDay tidak tersedia)`);
      err.code = "WORKDAY_NOT_CONFIGURED";
      err.status = 400;
      throw err;
    }
    if (c.kind === "invalid") {
      const err = new Error(`Tanggal ${normalizeDateKey(d)} tidak bisa diajukan: ${c.reason}`);
      err.code = "INVALID_SCHEDULE";
      err.status = 400;
      throw err;
    }
    if (c.kind === "working") workingDates.push(d);
  }
  return workingDates;
};

const collectDateConflicts = async ({ userId, dates, skipAbsenceId = null }) => {
  if (!Array.isArray(dates) || dates.length === 0) return [];

  const start = dates[0];
  const end = dates[dates.length - 1];
  const dateKeys = new Set(dates.map((d) => normalizeDateKey(d)));

  const [attendanceDocs, lateDocs, absenceDocs] = await Promise.all([
    Attendance.find({
      user_id: userId,
      date: { $gte: start, $lte: end },
    })
      .select({ date: 1 })
      .lean(),
    LateAttendanceRequest.find({
      user_id: userId,
      status: { $in: ["pending", "approved", "filled"] },
      date: { $gte: start, $lte: end },
    })
      .select({ date: 1, status: 1 })
      .lean(),
    AbsenceRequest.find({
      user_id: userId,
      status: { $in: ["pending", "approved"] },
      start_date: { $lte: end },
      end_date: { $gte: start },
      ...(skipAbsenceId ? { _id: { $ne: skipAbsenceId } } : {}),
    })
      .select({ _id: 1, start_date: 1, end_date: 1, status: 1 })
      .lean(),
  ]);

  const conflicts = [];

  for (const d of attendanceDocs) {
    const key = normalizeDateKey(d.date);
    if (dateKeys.has(key)) conflicts.push(`${key}: attendance sudah ada`);
  }

  for (const d of lateDocs) {
    const key = normalizeDateKey(d.date);
    if (dateKeys.has(key)) conflicts.push(`${key}: late attendance request (${d.status})`);
  }

  for (const req of absenceDocs) {
    const reqStart = normalizeToDateOnly(req.start_date);
    const reqEnd = normalizeToDateOnly(req.end_date);
    let cursor = new Date(reqStart);
    while (cursor <= reqEnd) {
      const key = normalizeDateKey(cursor);
      if (dateKeys.has(key)) {
        conflicts.push(`${key}: absence request lain (${req.status})`);
      }
      cursor = addDays(cursor, 1);
    }
  }

  return Array.from(new Set(conflicts));
};

class AbsenceRequestService {
  async requestAbsence({
    user,
    type,
    start_date,
    end_date,
    reason,
    attachment_url = null,
    attachment_document_id = null,
  }) {
    if (!reason || typeof reason !== "string" || reason.trim().length < 10) {
      const err = new Error("reason is required and must be at least 10 characters");
      err.code = "INVALID_REASON";
      err.status = 400;
      throw err;
    }
    if (attachment_url && typeof attachment_url === "string") {
      const valid = /^https?:\/\/.+/i.test(attachment_url.trim());
      if (!valid) {
        const err = new Error("attachment_url must be a valid http/https URL");
        err.code = "INVALID_ATTACHMENT_URL";
        err.status = 400;
        throw err;
      }
    }
    if (attachment_document_id) {
      const validDocId = mongoose.Types.ObjectId.isValid(String(attachment_document_id));
      if (!validDocId) {
        const err = new Error("attachment_document_id is invalid");
        err.code = "INVALID_ATTACHMENT_DOCUMENT_ID";
        err.status = 400;
        throw err;
      }
    }
    if (!user?._id) {
      const err = new Error("User context is required");
      err.code = "MISSING_USER";
      err.status = 400;
      throw err;
    }
    assertValidType(type);
    if (!start_date || !end_date) {
      const err = new Error("start_date and end_date are required");
      err.code = "MISSING_DATE_RANGE";
      err.status = 400;
      throw err;
    }

    const start = normalizeToDateOnly(new Date(start_date));
    const end = normalizeToDateOnly(new Date(end_date));
    if (isNaN(start.getTime()) || isNaN(end.getTime())) {
      const err = new Error("Invalid date format");
      err.code = "INVALID_DATE";
      err.status = 400;
      throw err;
    }
    if (end < start) {
      const err = new Error("end_date must be after or equal to start_date");
      err.code = "INVALID_DATE_RANGE";
      err.status = 400;
      throw err;
    }

    const dates = eachDateInclusive(start, end);
    if (dates.length > 31) {
      const err = new Error("Rentang absence maksimal 31 hari per pengajuan");
      err.code = "DATE_RANGE_TOO_LONG";
      err.status = 400;
      throw err;
    }

    const workingDates = await resolveWorkingDatesInRange(start, end);
    if (workingDates.length === 0) {
      const err = new Error("Rentang tanggal tidak memiliki hari kerja");
      err.code = "NO_WORKING_DAYS_IN_RANGE";
      err.status = 400;
      throw err;
    }

    const conflicts = await collectDateConflicts({ userId: user._id, dates: workingDates });
    if (conflicts.length > 0) {
      const err = new Error(
        `Konflik tanggal ditemukan: ${conflicts.slice(0, 10).join("; ")}${conflicts.length > 10 ? " ..." : ""}`
      );
      err.code = "DATE_CONFLICT";
      err.status = 409;
      throw err;
    }

    const doc = await AbsenceRequest.create({
      user_id: user._id,
      type,
      start_date: start,
      end_date: end,
      reason: typeof reason === "string" ? reason.trim() : "",
      attachment_url: attachment_url || null,
      attachment_document_id: attachment_document_id || null,
      status: "pending",
    });
    return doc;
  }

  async listMyRequests({ user }) {
    if (!user?._id) {
      const err = new Error("User context is required");
      err.code = "MISSING_USER";
      err.status = 400;
      throw err;
    }
    return AbsenceRequest.find({ user_id: user._id })
      .sort({ createdAt: -1 })
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
    return AbsenceRequest.find({ status: "pending" })
      .sort({ createdAt: -1 })
      .populate("user_id", "full_name email employee_code")
      .lean();
  }

  async approveAbsence({ approver, requestId }) {
    if (!approver?._id) {
      const err = new Error("Approver context is required");
      err.code = "MISSING_USER";
      err.status = 400;
      throw err;
    }
    assertHrManagerOrHigher(approver);

    const reqDoc = await AbsenceRequest.findById(requestId);
    if (!reqDoc) {
      const err = new Error("Absence request not found");
      err.code = "ABSENCE_REQUEST_NOT_FOUND";
      err.status = 404;
      throw err;
    }
    if (reqDoc.status !== "pending") {
      const err = new Error(`Request is already ${reqDoc.status}`);
      err.code = "INVALID_REQUEST_STATUS";
      err.status = 400;
      throw err;
    }

    const start = normalizeToDateOnly(reqDoc.start_date);
    const end = normalizeToDateOnly(reqDoc.end_date);
    const workingDates = await resolveWorkingDatesInRange(start, end);
    if (workingDates.length === 0) {
      const err = new Error("Tidak dapat approve: rentang tidak memiliki hari kerja");
      err.code = "NO_WORKING_DAYS_IN_RANGE";
      err.status = 400;
      throw err;
    }
    const conflicts = await collectDateConflicts({
      userId: reqDoc.user_id,
      dates: workingDates,
      skipAbsenceId: reqDoc._id,
    });
    if (conflicts.length > 0) {
      const err = new Error(
        `Approval gagal, konflik tanggal: ${conflicts.slice(0, 10).join("; ")}${conflicts.length > 10 ? " ..." : ""}`
      );
      err.code = "DATE_CONFLICT";
      err.status = 409;
      throw err;
    }

    const attendanceDocs = workingDates.map((d) => {
      const day = getWIBDate(d).getDay();
      const checkInHour = 8;
      const checkOutHour = day === 6 ? 12 : 16;
      const base = getWIBDate(d);
      const checkInAt = new Date(Date.UTC(base.getFullYear(), base.getMonth(), base.getDate(), checkInHour - 7, 0, 0));
      const checkOutAt = new Date(Date.UTC(base.getFullYear(), base.getMonth(), base.getDate(), checkOutHour - 7, 0, 0));
      return {
        user_id: reqDoc.user_id,
        date: normalizeToDateOnly(d),
        checkIn_at: checkInAt,
        checkOut_at: checkOutAt,
        status: "manual",
        user_consent: { checkIn: true, checkOut: true },
        tasks_today: [],
        projects: [],
        activities: [],
        note: `Auto-generated from ${reqDoc.type} request approval${reqDoc.reason ? `: ${reqDoc.reason}` : ""}`,
        absence_type: reqDoc.type,
        leave_request_id: reqDoc._id,
        approved_by: approver._id,
        approved_at: new Date(),
      };
    });

    try {
      await Attendance.insertMany(attendanceDocs, { ordered: true });
    } catch (e) {
      if (e?.code === 11000) {
        const err = new Error("Tidak dapat approve: attendance pada rentang tanggal sudah terbentuk");
        err.code = "ATTENDANCE_ALREADY_EXISTS";
        err.status = 409;
        throw err;
      }
      throw e;
    }

    reqDoc.status = "approved";
    reqDoc.approved_by = approver._id;
    reqDoc.approved_at = new Date();
    await reqDoc.save();

    return reqDoc;
  }

  async rejectAbsence({ approver, requestId, rejected_reason = "" }) {
    if (!approver?._id) {
      const err = new Error("Approver context is required");
      err.code = "MISSING_USER";
      err.status = 400;
      throw err;
    }
    assertHrManagerOrHigher(approver);

    const reqDoc = await AbsenceRequest.findById(requestId);
    if (!reqDoc) {
      const err = new Error("Absence request not found");
      err.code = "ABSENCE_REQUEST_NOT_FOUND";
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
    reqDoc.rejected_reason =
      typeof rejected_reason === "string" ? rejected_reason.trim() : "";
    reqDoc.approved_by = null;
    reqDoc.approved_at = null;
    await reqDoc.save();
    return reqDoc;
  }
}

export default new AbsenceRequestService();
