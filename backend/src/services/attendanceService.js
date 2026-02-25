import Attendance from "../models/attendance.js";
import Task from "../models/task.js";
import Activity from "../models/activity.js";
import Project from "../models/project.js";
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
 * Check if date is a working day (Monday-Saturday, Sunday is off)
 */
const isWorkingDay = (date = new Date()) => {
  const dayOfWeek = getWIBDayOfWeek(date);
  return dayOfWeek >= 1 && dayOfWeek <= 6; // Monday (1) to Saturday (6)
};

/**
 * Check if date is Sunday (libur)
 */
const isSunday = (date = new Date()) => {
  return getWIBDayOfWeek(date) === 0;
};

/**
 * Check if date is Saturday
 */
const isSaturday = (date = new Date()) => {
  return getWIBDayOfWeek(date) === 6;
};

/**
 * Get working hours for a specific date
 * Returns: { startHour: number, startMinute: number, endHour: number, endMinute: number }
 */
const getWorkingHours = (date = new Date()) => {
  if (isSaturday(date)) {
    // Sabtu: 08:00 - 12:00
    return { startHour: 8, startMinute: 0, endHour: 12, endMinute: 0 };
  } else {
    // Senin-Jumat: 08:00 - 16:00
    return { startHour: 8, startMinute: 0, endHour: 16, endMinute: 0 };
  }
};

/**
 * Validate check-in time based on working hours
 */
const validateCheckInTime = (date = new Date()) => {
  const wib = getWIBDate(date);
  const hour = wib.getHours();
  const minute = wib.getMinutes();
  const totalMinutes = hour * 60 + minute;
  const { startHour, startMinute } = getWorkingHours(wib);
  const startTotalMinutes = startHour * 60 + startMinute;
  
  return {
    isValid: totalMinutes >= startTotalMinutes,
    isLate: totalMinutes > startTotalMinutes,
    hour,
    minute,
    totalMinutes,
    startTotalMinutes,
  };
};

/**
 * Validate check-out time based on working hours
 */
const validateCheckOutTime = (date = new Date()) => {
  const wib = getWIBDate(date);
  const hour = wib.getHours();
  const minute = wib.getMinutes();
  const totalMinutes = hour * 60 + minute;
  const { endHour, endMinute } = getWorkingHours(wib);
  const endTotalMinutes = endHour * 60 + endMinute;
  
  return {
    isValid: totalMinutes >= endTotalMinutes,
    isEarly: totalMinutes < endTotalMinutes,
    hour,
    minute,
    totalMinutes,
    endTotalMinutes,
  };
};

/**
 * Ensure the attendance belongs to the given user.
 * Throws explicit error if ownership fails.
 */
const assertOwnership = (attendance, userId) => {
  if (!attendance) return;
  if (attendance.user_id.toString() !== userId.toString()) {
    const err = new Error("Attendance does not belong to current user");
    err.code = "FORBIDDEN_OWNERSHIP";
    err.status = 403;
    throw err;
  }
};

/**
 * Ensure the record is still editable (no checkout and not approved late).
 * SAFEST OPTION: treat any approved late attendance as fully locked.
 */
const assertEditable = (attendance) => {
  if (!attendance) return;

  if (attendance.checkOut_at) {
    const err = new Error("Attendance is already checked out and read-only");
    err.code = "ATTENDANCE_LOCKED";
    err.status = 400;
    throw err;
  }
};

/**
 * Validate that provided ObjectIds for projects and activities exist.
 * SAFEST OPTION: fail fast on any invalid or non-existing reference.
 */
const validateReferences = async ({ projectItems = [], activityIds = [] }) => {
  // Validate project contributions & collect IDs
  const projectIds = [];
  if (projectItems.length > 0) {
    const seen = new Set();
    for (const item of projectItems) {
      if (!item || !item.project_id) {
        const err = new Error(
          "project_id is required for each project contribution"
        );
        err.code = "INVALID_PROJECT_REFERENCE";
        err.status = 400;
        throw err;
      }
      const key = item.project_id.toString();
      if (seen.has(key)) {
        const err = new Error(
          "Duplicate project_id in single attendance is not allowed"
        );
        err.code = "DUPLICATE_PROJECT";
        err.status = 400;
        throw err;
      }
      seen.add(key);

      if (
        typeof item.contribution_percentage !== "number" ||
        Number.isNaN(item.contribution_percentage) ||
        item.contribution_percentage < 0 ||
        item.contribution_percentage > 100
      ) {
        const err = new Error(
          "contribution_percentage must be a number between 0 and 100"
        );
        err.code = "INVALID_PROJECT_CONTRIBUTION";
        err.status = 400;
        throw err;
      }

      projectIds.push(item.project_id);
    }

    const count = await Project.countDocuments({ _id: { $in: projectIds } });
    if (count !== projectIds.length) {
      const err = new Error("One or more project references are invalid");
      err.code = "INVALID_PROJECT_REFERENCE";
      err.status = 400;
      throw err;
    }
  }

  if (activityIds.length > 0) {
    const count = await Activity.countDocuments({ _id: { $in: activityIds } });
    if (count !== activityIds.length) {
      const err = new Error("One or more activity references are invalid");
      err.code = "INVALID_ACTIVITY_REFERENCE";
      err.status = 400;
      throw err;
    }
  }
};

/**
 * Apply today's project contributions from a single attendance into Project.percentage.
 * - Prevents negative contributions.
 * - Prevents percentage > 100 (rejects submission if it would overflow).
 */
const applyProjectContributions = async (attendance) => {
  const items = attendance.projects || [];
  if (!items.length) return;

  const projectIds = items.map((p) => p.project_id);
  const projects = await Project.find({ _id: { $in: projectIds } });
  const map = new Map(projects.map((p) => [p._id.toString(), p]));

  // First pass: validation
  for (const item of items) {
    const id = item.project_id?.toString();
    const contrib = item.contribution_percentage ?? 0;

    if (contrib < 0) {
      const err = new Error("Negative project contribution is not allowed");
      err.code = "NEGATIVE_CONTRIBUTION";
      err.status = 400;
      throw err;
    }

    const proj = map.get(id);
    if (!proj) {
      const err = new Error("Project not found for contribution entry");
      err.code = "PROJECT_NOT_FOUND";
      err.status = 400;
      throw err;
    }

    const current = proj.percentage || 0;
    const next = current + contrib;
    if (next > 100) {
      const err = new Error(
        `Project contribution would exceed 100% (current ${current}, add ${contrib})`
      );
      err.code = "PERCENTAGE_OVERFLOW";
      err.status = 400;
      throw err;
    }
  }

  // Second pass: apply updates
  for (const item of items) {
    const id = item.project_id?.toString();
    const contrib = item.contribution_percentage ?? 0;
    if (contrib === 0) continue;
    const proj = map.get(id);
    const current = proj.percentage || 0;
    proj.percentage = current + contrib;
    await proj.save();
  }
};

class AttendanceService {
  /**
   * Check-in: create new attendance for today.
   * - Fails if attendance for today already exists.
   * - Client is NOT allowed to send date or timestamps.
   */
  async checkIn({ user, consentCheckIn, taskIds }) {
    if (!user?._id) {
      const err = new Error("User context is required");
      err.code = "MISSING_USER";
      err.status = 400;
      throw err;
    }

    if (consentCheckIn !== true) {
      const err = new Error("User consent for check-in is required");
      err.code = "MISSING_CONSENT";
      err.status = 400;
      throw err;
    }

    const now = getWIBDate(new Date());
    const today = normalizeToDateOnly(now);

    // Validate working day (Monday-Saturday, Sunday is off)
    if (isSunday(now)) {
      const err = new Error("Attendance tidak dapat dilakukan pada hari Minggu (libur)");
      err.code = "SUNDAY_NOT_ALLOWED";
      err.status = 400;
      throw err;
    }

    if (!isWorkingDay(now)) {
      const err = new Error("Hari ini bukan hari kerja");
      err.code = "NOT_WORKING_DAY";
      err.status = 400;
      throw err;
    }

    const existing = await Attendance.findOne({
      user_id: user._id,
      date: today,
    });

    if (existing) {
      const err = new Error("Attendance for today already exists");
      err.code = "ATTENDANCE_ALREADY_EXISTS";
      err.status = 409;
      throw err;
    }

    // Validate check-in time based on working hours
    const checkInValidation = validateCheckInTime(now);
    if (!checkInValidation.isValid) {
      const { startHour, startMinute } = getWorkingHours(now);
      const err = new Error(
        `Check-in belum dibuka. Jam kerja ${isSaturday(now) ? 'Sabtu' : 'hari kerja'}: ${String(startHour).padStart(2, '0')}:${String(startMinute).padStart(2, '0')}`
      );
      err.code = "CHECKIN_TOO_EARLY";
      err.status = 400;
      throw err;
    }

    // Determine status based on check-in time
    // late_checkin: check-in after working hours start
    let status = "normal";
    if (checkInValidation.isLate) {
      status = "late_checkin";
    }

    // task_ids: array of Task ObjectIds belonging to user (daily tasks for today)
    let normalizedTaskIds = [];
    if (Array.isArray(taskIds) && taskIds.length > 0) {
      normalizedTaskIds = taskIds.filter((id) => id && id.toString?.()).map((id) => id.toString());
    }

    // Validate that all task IDs exist and belong to user
    if (normalizedTaskIds.length > 0) {
      const tasks = await Task.find({ _id: { $in: normalizedTaskIds }, user_id: user._id });
      if (tasks.length !== normalizedTaskIds.length) {
        const err = new Error("One or more task IDs are invalid or do not belong to you");
        err.code = "INVALID_TASK_IDS";
        err.status = 400;
        throw err;
      }
    }

    const attendance = await Attendance.create({
      user_id: user._id,
      date: today,
      checkIn_at: now,
      checkOut_at: null,
      status: status,
      late_reason: "",
      approved_by: null,
      approved_at: null,
      user_consent: {
        checkIn: true,
        checkOut: false,
      },
      tasks_today: normalizedTaskIds,
      projects: [],
      activities: [],
      note: "",
    });

    return attendance;
  }

  /**
   * Update daily work fields during editable phase.
   * Allowed:
   * - tasks_today (add task IDs via $addToSet)
   * - $addToSet projects, activities
   * - overwrite note (string)
   */
  async updateDailyWork({ user, payload }) {
    if (!user?._id) {
      const err = new Error("User context is required");
      err.code = "MISSING_USER";
      err.status = 400;
      throw err;
    }

    const allowedFields = ["tasks_today", "projects", "activities", "note"];
    const forbidden = Object.keys(payload || {}).filter(
      (k) => !allowedFields.includes(k)
    );
    if (forbidden.length > 0) {
      const err = new Error(
        `Forbidden fields in update: ${forbidden.join(", ")}`
      );
      err.code = "FORBIDDEN_FIELDS";
      err.status = 400;
      throw err;
    }

    const today = normalizeToDateOnly(new Date());

    const attendance = await Attendance.findOne({
      user_id: user._id,
      date: today,
    });

    if (!attendance) {
      const err = new Error("No attendance for today");
      err.code = "ATTENDANCE_NOT_FOUND";
      err.status = 404;
      throw err;
    }

    assertOwnership(attendance, user._id);
    assertEditable(attendance);

    const updateOps = {};

    // tasks_today - $addToSet valid task IDs belonging to user
    if (Array.isArray(payload.tasks_today) && payload.tasks_today.length > 0) {
      const taskIds = payload.tasks_today
        .filter((id) => id && id.toString?.())
        .map((id) => id.toString());
      if (taskIds.length > 0) {
        const tasks = await Task.find({ _id: { $in: taskIds }, user_id: user._id });
        if (tasks.length !== taskIds.length) {
          const err = new Error("One or more task IDs are invalid or do not belong to you");
          err.code = "INVALID_TASK_IDS";
          err.status = 400;
          throw err;
        }
        updateOps.$addToSet = updateOps.$addToSet || {};
        updateOps.$addToSet.tasks_today = { $each: taskIds };
      }
    }

    // projects / activities - $set (replace entire array) to avoid duplicates from $addToSet
    const projectItems = Array.isArray(payload.projects)
      ? payload.projects
      : [];
    const activityIds = Array.isArray(payload.activities)
      ? payload.activities
      : [];

    await validateReferences({ projectItems, activityIds });

    if (payload.projects !== undefined || payload.activities !== undefined) {
      updateOps.$set = updateOps.$set || {};
      if (payload.projects !== undefined) {
        const seen = new Set();
        const deduped = [];
        for (let i = projectItems.length - 1; i >= 0; i--) {
          const id = projectItems[i].project_id?.toString?.() || projectItems[i].project_id;
          if (id && !seen.has(id)) {
            seen.add(id);
            deduped.unshift(projectItems[i]);
          }
        }
        updateOps.$set.projects = deduped;
      }
      if (payload.activities !== undefined) {
        const uniqueIds = [...new Set(activityIds.map((id) => id?.toString?.() || id).filter(Boolean))];
        updateOps.$set.activities = uniqueIds;
      }
    }

    // note - simple overwrite
    if (typeof payload.note === "string") {
      updateOps.$set = {
        ...(updateOps.$set || {}),
        note: payload.note,
      };
    }

    if (
      !updateOps.$addToSet &&
      !(updateOps.$set && Object.keys(updateOps.$set).length > 0)
    ) {
      const err = new Error("No valid updates provided");
      err.code = "NO_UPDATES";
      err.status = 400;
      throw err;
    }

    const updated = await Attendance.findOneAndUpdate(
      { _id: attendance._id },
      updateOps,
      { new: true }
    );

    return updated;
  }

  /**
   * Check-out with strict rules:
   * - attendance exists
   * - checkOut_at === null
   * - tasks_today.length > 0 and at least one task is done (progress 100)
   * - lock record from further edits
   */
  async checkOut({ user, consentCheckOut }) {
    if (!user?._id) {
      const err = new Error("User context is required");
      err.code = "MISSING_USER";
      err.status = 400;
      throw err;
    }

    if (consentCheckOut !== true) {
      const err = new Error("User consent for check-out is required");
      err.code = "MISSING_CONSENT";
      err.status = 400;
      throw err;
    }

    const now = getWIBDate(new Date());
    const today = normalizeToDateOnly(now);

    const attendance = await Attendance.findOne({
      user_id: user._id,
      date: today,
    });

    if (!attendance) {
      const err = new Error("No attendance for today");
      err.code = "ATTENDANCE_NOT_FOUND";
      err.status = 404;
      throw err;
    }

    assertOwnership(attendance, user._id);

    if (attendance.checkOut_at) {
      const err = new Error("Already checked out");
      err.code = "ALREADY_CHECKED_OUT";
      err.status = 400;
      throw err;
    }

    const taskIds = attendance.tasks_today || [];
    if (taskIds.length === 0) {
      const err = new Error(
        "Cannot check out without at least one daily task"
      );
      err.code = "EMPTY_TASKS_TODAY";
      err.status = 400;
      throw err;
    }

    const tasks = await Task.find({ _id: { $in: taskIds } }).lean();
    // const atLeastOneDone = tasks.some((t) => t.status === "done" || (t.progress >= 100));
    // if (!atLeastOneDone) {
    //   const err = new Error(
    //     "Cannot check out without at least one task completed (progress 100% or status done)"
    //   );
    //   err.code = "NO_TASK_DONE";
    //   err.status = 400;
    //   throw err;
    // }

    // Validate check-out time based on working hours
    const checkOutValidation = validateCheckOutTime(now);
    const { endHour, endMinute } = getWorkingHours(now);
    const endTotalMinutes = endHour * 60 + endMinute;
    
    // Allow check-out until 21:00 (grace period for late checkout)
    const maxCheckOutMinutes = 21 * 60; // 21:00
    if (checkOutValidation.totalMinutes > maxCheckOutMinutes) {
      const err = new Error(
        `Check-out sudah lewat dari jam maksimal (21:00). Silakan hubungi HR untuk penanganan lebih lanjut.`
      );
      err.code = "CHECKOUT_TOO_LATE";
      err.status = 400;
      throw err;
    }

    // Apply project contributions safely before locking
    await applyProjectContributions(attendance);

    attendance.checkOut_at = now;
    attendance.user_consent.checkOut = true;

    // Determine if early checkout: check-out before working hours end
    // Only set early_checkout if current status is normal or late_checkin
    // Don't override forget status
    // === Determine final attendance status ===
    const isLateCheckIn = attendance.status === "late_checkin";
    const isEarlyCheckout = checkOutValidation.isEarly;

    // Case 1: Late check-in + Early checkout => late
    if (isLateCheckIn && isEarlyCheckout) {
      attendance.status = "late";
    }

    // Case 2: Late check-in only
    else if (isLateCheckIn) {
      attendance.status = "late_checkin";
    }

    // Case 3: Early checkout only
    else if (
      isEarlyCheckout &&
      attendance.status === "normal"
    ) {
      attendance.status = "early_checkout";
    }

    // Else: do nothing (normal, forget, violation, etc)


    await attendance.save();

    return attendance;
  }

  /**
   * Get today's attendance for the current user.
   */
  async getTodayAttendance({ user }) {
    if (!user?._id) {
      const err = new Error("User context is required");
      err.code = "MISSING_USER";
      err.status = 400;
      throw err;
    }

    const today = normalizeToDateOnly(new Date());

    const attendance = await Attendance.findOne({
      user_id: user._id,
      date: today,
    })
      .populate("tasks_today")
      .populate("projects.project_id")
      .populate("activities");

    return attendance;
  }

  /**
   * Get attendance history for current user.
   * SAFEST OPTION: only own history here; admin reports can be separate.
   */
  async getAttendanceHistory({ user, from, to }) {
    if (!user?._id) {
      const err = new Error("User context is required");
      err.code = "MISSING_USER";
      err.status = 400;
      throw err;
    }

    const filters = {
      user_id: user._id,
    };

    if (from || to) {
      filters.date = {};
      if (from) {
        const fromNorm = normalizeToDateOnly(new Date(from));
        filters.date.$gte = fromNorm;
      }
      if (to) {
        const toNorm = normalizeToDateOnly(new Date(to));
        filters.date.$lte = toNorm;
      }
    }

    const history = await Attendance.find(filters)
      .sort({ date: -1 })
      .populate("tasks_today")
      .populate("projects.project_id")
      .populate("activities");

    return history;
  }

  /**
   * Create late attendance (POST-APPROVAL).
   * Approval does NOT create attendance. Approval grants permission.
   *
   * User may create attendance ONLY IF:
   * - request is approved
   * - request belongs to user
   * - no attendance exists for that date
   *
   * Payload can include:
   * - checkIn_at, checkOut_at (timestamps for the requested date)
   * - tasks_today (array of Task ObjectIds)
   * - projects, activities, note
   *
   * Server sets:
   * - status = "forget" (late attendance is always forget)
   * - Links to late_request_id
   */
  async createLateAttendance({ user, requestId, payload = {} }) {
    if (!user?._id) {
      const err = new Error("User context is required");
      err.code = "MISSING_USER";
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

    if (reqDoc.user_id.toString() !== user._id.toString()) {
      const err = new Error("Late attendance request does not belong to current user");
      err.code = "FORBIDDEN_OWNERSHIP";
      err.status = 403;
      throw err;
    }

    if (reqDoc.status !== "approved") {
      const err = new Error("Late attendance request is not approved");
      err.code = "LATE_REQUEST_NOT_APPROVED";
      err.status = 400;
      throw err;
    }

    const targetDate = normalizeToDateOnly(new Date(reqDoc.date));

    // Validate that target date is a working day
    if (isSunday(targetDate)) {
      const err = new Error("Tidak dapat membuat attendance untuk hari Minggu (libur)");
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

    const existing = await Attendance.findOne({
      user_id: user._id,
      date: targetDate,
    });

    if (existing) {
      const err = new Error("Attendance already exists for that date");
      err.code = "ATTENDANCE_ALREADY_EXISTS";
      err.status = 409;
      throw err;
    }

    // Validate and parse timestamps from payload
    let checkIn_at = new Date();
    let checkOut_at = null;

    if (payload.checkIn_at) {
      checkIn_at = new Date(payload.checkIn_at);
      if (isNaN(checkIn_at.getTime())) {
        const err = new Error("Invalid checkIn_at timestamp");
        err.code = "INVALID_TIMESTAMP";
        err.status = 400;
        throw err;
      }
    }

    if (payload.checkOut_at) {
      checkOut_at = new Date(payload.checkOut_at);
      if (isNaN(checkOut_at.getTime())) {
        const err = new Error("Invalid checkOut_at timestamp");
        err.code = "INVALID_TIMESTAMP";
        err.status = 400;
        throw err;
      }
      if (checkOut_at <= checkIn_at) {
        const err = new Error("checkOut_at must be after checkIn_at");
        err.code = "INVALID_TIMESTAMP_ORDER";
        err.status = 400;
        throw err;
      }
    }

    // tasks_today: array of Task ObjectIds (required when checkOut_at is set)
    const tasksToday = Array.isArray(payload.tasks_today)
      ? payload.tasks_today.filter((id) => id && id.toString?.()).map((id) => id.toString())
      : [];

    if (checkOut_at && tasksToday.length === 0) {
      const err = new Error("tasks_today is required when checkOut_at is provided");
      err.code = "MISSING_TASKS_TODAY";
      err.status = 400;
      throw err;
    }

    if (tasksToday.length > 0) {
      const tasks = await Task.find({ _id: { $in: tasksToday }, user_id: user._id });
      if (tasks.length !== tasksToday.length) {
        const err = new Error("One or more task IDs are invalid or do not belong to you");
        err.code = "INVALID_TASK_IDS";
        err.status = 400;
        throw err;
      }
    }

    // Validate projects structure
    const projects = Array.isArray(payload.projects)
      ? payload.projects
      : [];
    
    if (projects.length > 0) {
      await validateReferences({ projectItems: projects, activityIds: [] });
    }

    // Validate activities
    const activities = Array.isArray(payload.activities)
      ? payload.activities
      : [];
    
    if (activities.length > 0) {
      await validateReferences({ projectItems: [], activityIds: activities });
    }

    const attendance = await Attendance.create({
      user_id: user._id,
      date: targetDate,
      checkIn_at: checkIn_at,
      checkOut_at: checkOut_at,
      status: "forget", // Late attendance is always "forget"
      late_request_id: reqDoc._id,
      late_reason: reqDoc.late_reason,
      approved_by: reqDoc.approved_by,
      approved_at: reqDoc.approved_at,
      user_consent: {
        checkIn: true,
        checkOut: !!checkOut_at,
      },
      tasks_today: tasksToday,
      projects: projects,
      activities: activities,
      note: typeof payload.note === "string" ? payload.note.trim() : "",
    });

    // If checkOut_at is set, apply project contributions and update request status
    if (checkOut_at) {
      await applyProjectContributions(attendance);
      
      // Update LateAttendanceRequest status to "filled"
      reqDoc.status = "filled";
      await reqDoc.save();
    }

    return attendance;
  }

  /**
   * Submit late attendance (locks record).
   * User MUST have at least one task in tasks_today with status done before submission.
   * Server auto-sets checkOut_at at submission time.
   * Updates LateAttendanceRequest status to "filled".
   */
  async submitLateAttendance({ user, attendanceId }) {
    if (!user?._id) {
      const err = new Error("User context is required");
      err.code = "MISSING_USER";
      err.status = 400;
      throw err;
    }

    const attendance = await Attendance.findById(attendanceId);
    if (!attendance) {
      const err = new Error("Attendance not found");
      err.code = "ATTENDANCE_NOT_FOUND";
      err.status = 404;
      throw err;
    }

    assertOwnership(attendance, user._id);

    if (attendance.status !== "forget") {
      const err = new Error("Only forget (late) attendance can be submitted via this endpoint");
      err.code = "INVALID_STATUS";
      err.status = 400;
      throw err;
    }

    if (attendance.checkOut_at) {
      const err = new Error("Late attendance already submitted (read-only)");
      err.code = "ATTENDANCE_LOCKED";
      err.status = 400;
      throw err;
    }

    const taskIds = attendance.tasks_today || [];
    if (taskIds.length === 0) {
      const err = new Error(
        "tasks_today must have at least one task before submission"
      );
      err.code = "EMPTY_TASKS_TODAY";
      err.status = 400;
      throw err;
    }

    const tasks = await Task.find({ _id: { $in: taskIds } }).lean();
    const atLeastOneDone = tasks.some((t) => t.status === "done" || (t.progress >= 100));
    if (!atLeastOneDone) {
      const err = new Error(
        "At least one task must be completed (progress 100% or status done) before submission"
      );
      err.code = "NO_TASK_DONE";
      err.status = 400;
      throw err;
    }

    // Apply project contributions safely before locking
    await applyProjectContributions(attendance);

    const checkOutTime = new Date();
    attendance.checkOut_at = checkOutTime;
    attendance.user_consent.checkOut = true;
    await attendance.save();

    // Update LateAttendanceRequest status to "filled" if linked
    if (attendance.late_request_id) {
      const reqDoc = await LateAttendanceRequest.findById(attendance.late_request_id);
      if (reqDoc && reqDoc.status === "approved") {
        reqDoc.status = "filled";
        await reqDoc.save();
      }
    }

    return attendance;
  }

  async getAttendanceByDate({ user, date }) {
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

    const targetDate = normalizeToDateOnly(new Date(date));
    const attendance = await Attendance.findOne({
      user_id: user._id,
      date: targetDate,
    })
      .populate("tasks_today")
      .populate("projects.project_id")
      .populate("activities");

    return attendance;
  }

  async updateDailyWorkById({ user, attendanceId, payload }) {
    if (!user?._id) {
      const err = new Error("User context is required");
      err.code = "MISSING_USER";
      err.status = 400;
      throw err;
    }

    const attendance = await Attendance.findById(attendanceId);
    if (!attendance) {
      const err = new Error("Attendance not found");
      err.code = "ATTENDANCE_NOT_FOUND";
      err.status = 404;
      throw err;
    }

    assertOwnership(attendance, user._id);
    assertEditable(attendance);

    // Reuse existing strict field validation by delegating to updateDailyWork
    // SAFEST OPTION: do not infer a date; update must target the exact record.
    return await this._updateDailyWorkForAttendance({ attendance, payload });
  }

  // Internal helper to avoid duplicating update rules.
  async _updateDailyWorkForAttendance({ attendance, payload }) {
    const allowedFields = ["tasks_today", "projects", "activities", "note"];
    const forbidden = Object.keys(payload || {}).filter(
      (k) => !allowedFields.includes(k)
    );
    if (forbidden.length > 0) {
      const err = new Error(
        `Forbidden fields in update: ${forbidden.join(", ")}`
      );
      err.code = "FORBIDDEN_FIELDS";
      err.status = 400;
      throw err;
    }

    const updateOps = {};

    // tasks_today - $addToSet valid task IDs belonging to user
    if (Array.isArray(payload.tasks_today) && payload.tasks_today.length > 0) {
      const taskIds = payload.tasks_today
        .filter((id) => id && id.toString?.())
        .map((id) => id.toString());
      if (taskIds.length > 0) {
        const tasks = await Task.find({ _id: { $in: taskIds }, user_id: attendance.user_id });
        if (tasks.length !== taskIds.length) {
          const err = new Error("One or more task IDs are invalid or do not belong to you");
          err.code = "INVALID_TASK_IDS";
          err.status = 400;
          throw err;
        }
        updateOps.$addToSet = updateOps.$addToSet || {};
        updateOps.$addToSet.tasks_today = { $each: taskIds };
      }
    }

    const projectItems = Array.isArray(payload.projects)
      ? payload.projects
      : [];
    const activityIds = Array.isArray(payload.activities)
      ? payload.activities
      : [];

    await validateReferences({ projectItems, activityIds });

    if (payload.projects !== undefined || payload.activities !== undefined) {
      updateOps.$set = updateOps.$set || {};
      if (payload.projects !== undefined) {
        const seen = new Set();
        const deduped = [];
        for (let i = projectItems.length - 1; i >= 0; i--) {
          const id = projectItems[i].project_id?.toString?.() || projectItems[i].project_id;
          if (id && !seen.has(id)) {
            seen.add(id);
            deduped.unshift(projectItems[i]);
          }
        }
        updateOps.$set.projects = deduped;
      }
      if (payload.activities !== undefined) {
        const uniqueIds = [...new Set(activityIds.map((id) => id?.toString?.() || id).filter(Boolean))];
        updateOps.$set.activities = uniqueIds;
      }
    }

    if (typeof payload.note === "string") {
      updateOps.$set = {
        ...(updateOps.$set || {}),
        note: payload.note,
      };
    }

    if (
      !updateOps.$addToSet &&
      !(updateOps.$set && Object.keys(updateOps.$set).length > 0)
    ) {
      const err = new Error("No valid updates provided");
      err.code = "NO_UPDATES";
      err.status = 400;
      throw err;
    }

    const updated = await Attendance.findOneAndUpdate(
      { _id: attendance._id },
      updateOps,
      { new: true }
    );

    return updated;
  }
}

export default new AttendanceService();

