import Attendance from "../models/attendance.js";
import Task from "../models/task.js";
import Activity from "../models/activity.js";
import Project from "../models/project.js";
import LateAttendanceRequest from "../models/lateAttendanceRequest.js";
import AbsenceRequest from "../models/absenceRequest.js";
import WeeklySchedule from "../models/weeklySchedule.js";
import WorkDay from "../models/workDay.js";

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
  // Gunakan UTC methods karena wib sudah di-offset manual ke WIB
  return new Date(Date.UTC(wib.getFullYear(), wib.getMonth(), wib.getDate()));
};

/**
 * Get day of week in WIB (0 = Sunday, 1 = Monday, ..., 6 = Saturday)
 */
const getWIBDayOfWeek = (date = new Date()) => {
  const wib = getWIBDate(date);
  return wib.getDay();
};

const isSunday = (date = new Date()) => {
  return getWIBDayOfWeek(date) === 0;
};

// ===== ENV DEFAULTS (for seeding + fallback) =====
const parseTimeToMinutes = (hhmm) => {
  if (!hhmm || typeof hhmm !== "string") return null;
  const [h, m] = hhmm.split(":").map((v) => Number(v));
  if (Number.isNaN(h) || Number.isNaN(m)) return null;
  return h * 60 + m;
};

const DEFAULT_WEEKDAY_IN = process.env.DEFAULT_WEEKDAY_CHECKIN || "08:00";
const DEFAULT_WEEKDAY_OUT = process.env.DEFAULT_WEEKDAY_CHECKOUT || "16:00";
const DEFAULT_SATURDAY_IN = process.env.DEFAULT_SATURDAY_CHECKIN || "08:00";
const DEFAULT_SATURDAY_OUT = process.env.DEFAULT_SATURDAY_CHECKOUT || "12:00";
const DEFAULT_MAX_CHECKOUT = process.env.MAX_CHECKOUT || "21:00";

const defaultTimeByDOW = (dayOfWeek) => {
  // 0=Sun ... 6=Sat
  if (dayOfWeek === 0) {
    return { isWorking: false, checkIn: null, checkOut: null };
  }
  if (dayOfWeek === 6) {
    return {
      isWorking: true,
      checkIn: DEFAULT_SATURDAY_IN,
      checkOut: DEFAULT_SATURDAY_OUT,
    };
  }
  return {
    isWorking: true,
    checkIn: DEFAULT_WEEKDAY_IN,
    checkOut: DEFAULT_WEEKDAY_OUT,
  };
};

// Ensure 7 docs exist in WeeklySchedule with sane defaults
const ensureWeeklyScheduleDefaults = async () => {
  const count = await WeeklySchedule.estimatedDocumentCount();
  if (count >= 7) return;
  // Upsert 0..6
  const bulk = [];
  for (let dow = 0; dow <= 6; dow++) {
    const def = defaultTimeByDOW(dow);
    bulk.push({
      updateOne: {
        filter: { day_of_week: dow },
        update: {
          $setOnInsert: {
            day_of_week: dow,
            check_in: def.checkIn,
            check_out: def.checkOut,
            is_working_day: def.isWorking,
          },
        },
        upsert: true,
      },
    });
  }
  if (bulk.length) {
    await WeeklySchedule.bulkWrite(bulk);
  }
};

// Ensure WorkDay for the next 30 days is generated (idempotent)
const ensureRollingWorkDays = async () => {
  await ensureWeeklyScheduleDefaults();
  const start = normalizeToDateOnly(new Date());
  const end = normalizeToDateOnly(new Date(Date.now() + 30 * 24 * 3600 * 1000));
  // Build a set of keys we need
  const toCreate = [];
  const existing = await WorkDay.find({
    date: { $gte: start, $lte: end },
  })
    .select({ date: 1 })
    .lean();
  const have = new Set((existing || []).map((d) => normalizeDateKey(d.date)));
  const weekly = await WeeklySchedule.find({}).lean();
  const weeklyMap = new Map(weekly.map((w) => [w.day_of_week, w]));

  const cursor = new Date(start);
  while (cursor <= end) {
    const key = normalizeDateKey(cursor);
    if (!have.has(key)) {
      const dow = getWIBDayOfWeek(cursor);
      const rule = weeklyMap.get(dow);
      const working = !!(rule?.is_working_day && rule?.check_in && rule?.check_out);
      toCreate.push({
        date: normalizeToDateOnly(cursor),
        is_working_day: working,
        is_holiday: !working && dow === 0 ? true : false, // default Sunday as holiday
        holiday_name: !working && dow === 0 ? "Minggu" : "",
        is_override: false,
      });
    }
    cursor.setDate(cursor.getDate() + 1);
  }
  if (toCreate.length > 0) {
    await WorkDay.insertMany(toCreate, { ordered: false }).catch(() => {});
  }
};

/**
 * Resolve working config for a specific date:
 * Returns:
 * {
 *   isWorkingDay: boolean,
 *   checkInTotalMinutes: number|null,
 *   checkOutTotalMinutes: number|null,
 *   maxCheckOutTotalMinutes: number  // from env
 * }
 */
const getResolvedWorkingConfig = async (date = new Date()) => {
  const norm = normalizeToDateOnly(date);
  const workDay = await WorkDay.findOne({ date: norm }).lean();
  const dow = getWIBDayOfWeek(date);
  const weekly = await WeeklySchedule.findOne({ day_of_week: dow }).lean();

  const maxCheckOutTotalMinutes = parseTimeToMinutes(DEFAULT_MAX_CHECKOUT) ?? (21 * 60);

  // Strict mode: if WorkDay for this date doesn't exist, attendance is unavailable.
  if (!workDay) {
    return {
      isWorkingDay: false,
      checkInTotalMinutes: null,
      checkOutTotalMinutes: null,
      maxCheckOutTotalMinutes,
      holidayName: "Tanggal belum tersedia. Hubungi HR untuk seed jadwal.",
      hasWorkDayConfig: false,
    };
  }

  // If HR override exists
  if (workDay?.is_override) {
    if (!workDay.is_working_day || workDay.is_holiday) {
      return {
        isWorkingDay: false,
        checkInTotalMinutes: null,
        checkOutTotalMinutes: null,
        maxCheckOutTotalMinutes,
        holidayName: workDay.holiday_name || "",
        hasWorkDayConfig: true,
      };
    }
    // use weekly hours (if provided), otherwise fallback to defaults for this DOW
    const schedule = weekly || { check_in: defaultTimeByDOW(dow).checkIn, check_out: defaultTimeByDOW(dow).checkOut, is_working_day: true };
    const inMin = parseTimeToMinutes(schedule.check_in);
    const outMin = parseTimeToMinutes(schedule.check_out);
    return {
      isWorkingDay: true,
      checkInTotalMinutes: inMin,
      checkOutTotalMinutes: outMin,
      maxCheckOutTotalMinutes,
      holidayName: "",
      hasWorkDayConfig: true,
    };
  }

  // No override:
  // If day flagged holiday or non-working
  if (workDay && (!workDay.is_working_day || workDay.is_holiday)) {
    return {
      isWorkingDay: false,
      checkInTotalMinutes: null,
      checkOutTotalMinutes: null,
      maxCheckOutTotalMinutes,
      holidayName: workDay.holiday_name || "",
      hasWorkDayConfig: true,
    };
  }

  // Use weekly rule
  const isWorkingWeekly = !!(weekly?.is_working_day && weekly?.check_in && weekly?.check_out);
  if (!isWorkingWeekly) {
    return {
      isWorkingDay: false,
      checkInTotalMinutes: null,
      checkOutTotalMinutes: null,
      maxCheckOutTotalMinutes,
      holidayName: "",
      hasWorkDayConfig: true,
    };
  }
  return {
    isWorkingDay: true,
    checkInTotalMinutes: parseTimeToMinutes(weekly.check_in),
    checkOutTotalMinutes: parseTimeToMinutes(weekly.check_out),
    maxCheckOutTotalMinutes,
    holidayName: "",
    hasWorkDayConfig: true,
  };
};

const isWorkingDay = async (date = new Date()) => {
  const cfg = await getResolvedWorkingConfig(date);
  return cfg.isWorkingDay;
};

/**
 * Validate check-in time based on working hours
 */
const validateCheckInTime = async (date = new Date()) => {
  const wib = getWIBDate(date);
  const hour = wib.getHours();
  const minute = wib.getMinutes();
  const totalMinutes = hour * 60 + minute;
  const cfg = await getResolvedWorkingConfig(wib);
  const startTotalMinutes = cfg.checkInTotalMinutes ?? 0;
  
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
const validateCheckOutTime = async (date = new Date()) => {
  const wib = getWIBDate(date);
  const hour = wib.getHours();
  const minute = wib.getMinutes();
  const totalMinutes = hour * 60 + minute;
  const cfg = await getResolvedWorkingConfig(wib);
  const endTotalMinutes = cfg.checkOutTotalMinutes ?? (16 * 60);
  
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
    const newPercentage = current + contrib;
    proj.percentage = newPercentage;
    
    // Auto-complete: if percentage reaches 100, set status to completed and end_date to today
    if (newPercentage >= 100 && proj.status !== "completed" && proj.status !== "cancelled") {
      proj.status = "completed";
      proj.end_date = new Date();
    }
    
    await proj.save();
  }
};

const normalizeDateKey = (date) => {
  const d = getWIBDate(new Date(date));
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
};

const deriveProjectsFromTaskIds = async (taskIds = []) => {
  const normalizedTaskIds = Array.isArray(taskIds)
    ? taskIds
        .filter((id) => id && id.toString?.())
        .map((id) => id.toString())
    : [];
  if (normalizedTaskIds.length === 0) return [];

  const tasks = await Task.find({ _id: { $in: normalizedTaskIds } })
    .select({ _id: 1, project_id: 1 })
    .lean();
  const taskMap = new Map(tasks.map((t) => [t._id.toString(), t]));

  const seenProjectIds = new Set();
  const derivedProjects = [];
  for (const taskId of normalizedTaskIds) {
    const task = taskMap.get(taskId);
    const projectId = task?.project_id?.toString?.() || task?.project_id;
    if (!projectId) continue;
    if (seenProjectIds.has(projectId)) continue;
    seenProjectIds.add(projectId);
    derivedProjects.push({ project_id: projectId });
  }

  return derivedProjects;
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

    const now = new Date(); // simpan timestamp asli untuk checkIn_at/checkOut_at
    const today = normalizeToDateOnly(now);

    // Validate working day via WorkDay/WeeklySchedule
    if (!(await isWorkingDay(now))) {
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
    // IMPORTANT:
    // pass raw `now` so conversion to WIB happens exactly once in validator.
    const checkInValidation = await validateCheckInTime(now);
    if (!checkInValidation.isValid) {
      const cfg = await getResolvedWorkingConfig(now);
      const startHour = Math.floor((cfg.checkInTotalMinutes ?? 480) / 60);
      const startMinute = (cfg.checkInTotalMinutes ?? 480) % 60;
      const err = new Error(
        `Check-in belum dibuka. Jam kerja dimulai: ${String(startHour).padStart(2, '0')}:${String(startMinute).padStart(2, '0')}`
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
      normalizedTaskIds = taskIds
        .filter((id) => id && id.toString?.())
        .map((id) => id.toString());
    }

    // Validate that all task IDs exist, are not already approved,
    // and that ongoing tasks cannot be selected if owned by someone else.
    if (normalizedTaskIds.length > 0) {
      const tasks = await Task.find({ _id: { $in: normalizedTaskIds } });
      if (tasks.length !== normalizedTaskIds.length) {
        const err = new Error(
          "One or more task IDs are invalid or do not belong to you"
        );
        err.code = "INVALID_TASK_IDS";
        err.status = 400;
        throw err;
      }

      const hasApproved = tasks.some((t) => t.status === "approved");
      if (hasApproved) {
        const err = new Error(
          "Approved tasks cannot be attached to a new attendance"
        );
        err.code = "APPROVED_TASK_FORBIDDEN";
        err.status = 400;
        throw err;
      }

      const hasOtherOngoing = tasks.some(
        (t) =>
          t.status === "ongoing" &&
          t.user_id &&
          t.user_id.toString() !== user._id.toString()
      );
      if (hasOtherOngoing) {
        const err = new Error(
          "Tidak bisa memilih task ongoing yang sedang dikerjakan orang lain"
        );
        err.code = "ONGOING_TASK_LOCKED";
        err.status = 400;
        throw err;
      }

      // Any planned or rejected task becomes ongoing once selected for today.
      const toOngoingIds = tasks
        .filter((t) => ["planned", "rejected"].includes(t.status))
        .map((t) => t._id);
      if (toOngoingIds.length > 0) {
        await Task.updateMany(
          { _id: { $in: toOngoingIds } },
          { $set: { status: "ongoing", user_id: user._id } }
        );
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
      projects: await deriveProjectsFromTaskIds(normalizedTaskIds),
      activities: [],
      note: "",
    });

    return attendance;
  }

  /**
   * Expose resolved working config for a given date (default today).
   * Useful for frontend to render rules.
   */
  async getWorkingConfig({ date } = {}) {
    const target = date ? new Date(date) : new Date();
    const cfg = await getResolvedWorkingConfig(target);
    return {
      is_working_day: cfg.isWorkingDay,
      has_workday_config: !!cfg.hasWorkDayConfig,
      holiday_name: cfg.holidayName || "",
      check_in: cfg.checkInTotalMinutes !== null
        ? `${String(Math.floor(cfg.checkInTotalMinutes / 60)).padStart(2, "0")}:${String(cfg.checkInTotalMinutes % 60).padStart(2, "0")}`
        : null,
      check_out: cfg.checkOutTotalMinutes !== null
        ? `${String(Math.floor(cfg.checkOutTotalMinutes / 60)).padStart(2, "0")}:${String(cfg.checkOutTotalMinutes % 60).padStart(2, "0")}`
        : null,
      max_checkout: `${String(Math.floor((cfg.maxCheckOutTotalMinutes ?? 1260) / 60)).padStart(2, "0")}:${String((cfg.maxCheckOutTotalMinutes ?? 1260) % 60).padStart(2, "0")}`,
    };
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

    // tasks_today - replace full list, not add-only. This enables dynamic add/remove after check-in.
    if (payload.tasks_today !== undefined) {
      if (!Array.isArray(payload.tasks_today)) {
        const err = new Error("tasks_today must be an array");
        err.code = "INVALID_TASK_IDS";
        err.status = 400;
        throw err;
      }
      const taskIds = payload.tasks_today
        .filter((id) => id && id.toString?.())
        .map((id) => id.toString());

      if (taskIds.length > 0) {
        const tasks = await Task.find({ _id: { $in: taskIds } });
        if (tasks.length !== taskIds.length) {
          const err = new Error("One or more task IDs are invalid");
          err.code = "INVALID_TASK_IDS";
          err.status = 400;
          throw err;
        }

        const hasApproved = tasks.some((t) => t.status === "approved");
        if (hasApproved) {
          const err = new Error("Approved tasks cannot be attached to attendance");
          err.code = "APPROVED_TASK_FORBIDDEN";
          err.status = 400;
          throw err;
        }

        const hasOtherOngoing = tasks.some(
          (t) =>
            t.status === "ongoing" &&
            t.user_id &&
            t.user_id.toString() !== user._id.toString()
        );
        if (hasOtherOngoing) {
          const err = new Error(
            "Tidak bisa memilih task ongoing yang sedang dikerjakan orang lain"
          );
          err.code = "ONGOING_TASK_LOCKED";
          err.status = 400;
          throw err;
        }

        // Any planned/rejected picked by user becomes ongoing and is assigned to the user.
        const toOngoingIds = tasks
          .filter((t) => ["planned", "rejected"].includes(t.status))
          .map((t) => t._id);
        if (toOngoingIds.length > 0) {
          await Task.updateMany(
            { _id: { $in: toOngoingIds } },
            { $set: { status: "ongoing", user_id: user._id } }
          );
        }
      }

      updateOps.$set = updateOps.$set || {};
      updateOps.$set.tasks_today = taskIds;
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

    if (updateOps.$set?.tasks_today !== undefined) {
      updateOps.$set.projects = await deriveProjectsFromTaskIds(
        updateOps.$set.tasks_today
      );
    }

    // note - simple overwrite
    if (typeof payload.note === "string") {
      updateOps.$set = {
        ...(updateOps.$set || {}),
        note: payload.note,
      };
    }

    if (
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
  async checkOut({ user, consentCheckOut, tasksPayload = [] }) {
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

    const now = new Date();         // UTC asli — untuk disimpan ke DB
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

    // Optionally update task statuses based on payload.
    const normalizedMap = new Map();
    if (Array.isArray(tasksPayload)) {
      for (const item of tasksPayload) {
        if (!item || !item.task_id) continue;
        const id = item.task_id.toString();
        if (!taskIds.some((tid) => tid.toString() === id)) continue;
        if (!["done", "ongoing"].includes(item.status)) continue;
        normalizedMap.set(id, item.status);
      }
    }

    if (normalizedMap.size > 0) {
      const updateIds = Array.from(normalizedMap.keys());
      const tasks = await Task.find({ _id: { $in: updateIds } });
      for (const t of tasks) {
        const desired = normalizedMap.get(t._id.toString());
        if (!desired) continue;
        if (t.status === "approved") continue;
        t.status = desired;
        await t.save();
      }
    }

    // Validate check-out time based on working hours
    // IMPORTANT:
    // pass raw `now` so conversion to WIB happens exactly once in validator/config resolver.
    const checkOutValidation = await validateCheckOutTime(now);
    const cfg = await getResolvedWorkingConfig(now);
    const endTotalMinutes = cfg.checkOutTotalMinutes ?? (16 * 60);
    
    // Allow check-out until MAX_CHECKOUT (grace period for late checkout)
    const maxCheckOutMinutes = cfg.maxCheckOutTotalMinutes ?? (21 * 60);
    if (checkOutValidation.totalMinutes > maxCheckOutMinutes) {
      const err = new Error(
        `Check-out sudah lewat dari jam maksimal (${DEFAULT_MAX_CHECKOUT}). Silakan hubungi HR untuk penanganan lebih lanjut.`
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
      .populate({
        path: "tasks_today",
        populate: { path: "project_id", model: "Project" },
      })
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
      .populate({
        path: "tasks_today",
        populate: { path: "project_id", model: "Project" },
      })
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

    if (!(await isWorkingDay(targetDate))) {
      const err = new Error("Tanggal yang dipilih bukan hari kerja");
      err.code = "NOT_WORKING_DAY";
      err.status = 400;
      throw err;
    }

    const absenceConflict = await AbsenceRequest.findOne({
      user_id: user._id,
      status: { $in: ["pending", "approved"] },
      start_date: { $lte: targetDate },
      end_date: { $gte: targetDate },
    }).lean();
    if (absenceConflict) {
      const err = new Error(
        "Tanggal ini memiliki konflik dengan pengajuan izin/cuti/sakit. Hubungi HR."
      );
      err.code = "ABSENCE_REQUEST_CONFLICT";
      err.status = 409;
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
      projects: await deriveProjectsFromTaskIds(tasksToday),
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
      .populate({
        path: "tasks_today",
        populate: { path: "project_id", model: "Project" },
      })
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

    if (payload.tasks_today !== undefined) {
      if (!Array.isArray(payload.tasks_today)) {
        const err = new Error("tasks_today must be an array");
        err.code = "INVALID_TASK_IDS";
        err.status = 400;
        throw err;
      }
      const taskIds = payload.tasks_today
        .filter((id) => id && id.toString?.())
        .map((id) => id.toString());

      if (taskIds.length > 0) {
        const tasks = await Task.find({ _id: { $in: taskIds } });
        if (tasks.length !== taskIds.length) {
          const err = new Error("One or more task IDs are invalid");
          err.code = "INVALID_TASK_IDS";
          err.status = 400;
          throw err;
        }

        const hasApproved = tasks.some((t) => t.status === "approved");
        if (hasApproved) {
          const err = new Error("Approved tasks cannot be attached to attendance");
          err.code = "APPROVED_TASK_FORBIDDEN";
          err.status = 400;
          throw err;
        }

        const hasOtherOngoing = tasks.some(
          (t) =>
            t.status === "ongoing" &&
            t.user_id &&
            t.user_id.toString() !== attendance.user_id.toString()
        );
        if (hasOtherOngoing) {
          const err = new Error(
            "Tidak bisa memilih task ongoing yang sedang dikerjakan orang lain"
          );
          err.code = "ONGOING_TASK_LOCKED";
          err.status = 400;
          throw err;
        }

        const toOngoingIds = tasks
          .filter((t) => ["planned", "rejected"].includes(t.status))
          .map((t) => t._id);
        if (toOngoingIds.length > 0) {
          await Task.updateMany(
            { _id: { $in: toOngoingIds } },
            { $set: { status: "ongoing", user_id: attendance.user_id } }
          );
        }
      }

      updateOps.$set = updateOps.$set || {};
      updateOps.$set.tasks_today = taskIds;
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

    if (updateOps.$set?.tasks_today !== undefined) {
      updateOps.$set.projects = await deriveProjectsFromTaskIds(
        updateOps.$set.tasks_today
      );
    }

    if (typeof payload.note === "string") {
      updateOps.$set = {
        ...(updateOps.$set || {}),
        note: payload.note,
      };
    }

    if (
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

  async getMyAttendanceCalendar({ user, month }) {
    if (!user?._id) {
      const err = new Error("User context is required");
      err.code = "MISSING_USER";
      err.status = 400;
      throw err;
    }

    const nowWib = getWIBDate(new Date());
    const monthMatch = typeof month === "string" ? month.match(/^(\d{4})-(\d{2})$/) : null;
    const year = monthMatch ? Number(monthMatch[1]) : nowWib.getFullYear();
    const monthIndex = monthMatch ? Number(monthMatch[2]) - 1 : nowWib.getMonth();
    if (monthIndex < 0 || monthIndex > 11) {
      const err = new Error("month must be in format YYYY-MM");
      err.code = "INVALID_MONTH";
      err.status = 400;
      throw err;
    }

    const startLocal = new Date(year, monthIndex, 1);
    const endLocal = new Date(year, monthIndex + 1, 0);
    const start = normalizeToDateOnly(startLocal);
    const end = normalizeToDateOnly(endLocal);

    const records = await Attendance.find({
      user_id: user._id,
      date: { $gte: start, $lte: end },
    })
      .sort({ date: 1 })
      .populate("tasks_today")
      .populate("projects.project_id")
      .populate("activities");

    const workDays = await WorkDay.find({
      date: { $gte: start, $lte: end },
    }).lean();
    const workDayMap = new Map((workDays || []).map((wd) => [normalizeDateKey(wd.date), wd]));

    const weekly = await WeeklySchedule.find({}).lean();
    const weeklyMap = new Map((weekly || []).map((w) => [w.day_of_week, w]));

    const map = new Map();
    for (const rec of records) {
      map.set(normalizeDateKey(rec.date), rec);
    }

    const days = [];
    const cursor = new Date(startLocal);
    const todayKey = normalizeDateKey(new Date());
    while (cursor <= endLocal) {
      const key = normalizeDateKey(cursor);
      const rec = map.get(key);
      const dow = getWIBDayOfWeek(cursor);
      const wd = workDayMap.get(key);
      const ws = weeklyMap.get(dow);

      let hasWorkDayConfig = !!wd;
      let isWorkingDay = false;
      let holidayName = "";

      if (!wd) {
        isWorkingDay = false;
        holidayName = "Tanggal belum diset HR";
      } else if (wd.is_override) {
        if (!wd.is_working_day || wd.is_holiday) {
          isWorkingDay = false;
          holidayName = wd.holiday_name || "";
        } else {
          isWorkingDay = !!(ws?.is_working_day && ws?.check_in && ws?.check_out);
          if (!isWorkingDay) {
            holidayName = "Jadwal mingguan belum diset";
          }
        }
      } else if (!wd.is_working_day || wd.is_holiday) {
        isWorkingDay = false;
        holidayName = wd.holiday_name || "";
      } else {
        isWorkingDay = !!(ws?.is_working_day && ws?.check_in && ws?.check_out);
        if (!isWorkingDay) {
          holidayName = "Jadwal mingguan belum diset";
        }
      }

      days.push({
        date: key,
        dayOfWeek: getWIBDayOfWeek(cursor),
        isSunday: isSunday(cursor),
        isToday: key === todayKey,
        has_workday_config: hasWorkDayConfig,
        is_working_day: isWorkingDay,
        is_holiday: !isWorkingDay && !!holidayName,
        holiday_name: holidayName,
        hasAttendance: !!rec,
        status: rec?.status || null,
        absence_type: rec?.absence_type || "none",
        checkIn_at: rec?.checkIn_at || null,
        checkOut_at: rec?.checkOut_at || null,
        total_tasks: Array.isArray(rec?.tasks_today) ? rec.tasks_today.length : 0,
        total_activities: Array.isArray(rec?.activities) ? rec.activities.length : 0,
        total_projects: Array.isArray(rec?.projects) ? rec.projects.length : 0,
      });
      cursor.setDate(cursor.getDate() + 1);
    }

    return {
      month: `${year}-${String(monthIndex + 1).padStart(2, "0")}`,
      days,
      records,
    };
  }
}

export default new AttendanceService();

