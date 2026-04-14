import React, { useState, useEffect, useRef } from "react";
import {
  checkIn,
  checkOut,
  getTodayAttendance,
  createTask,
  updateTask,
  updateDailyWork,
  requestLateAttendance,
  listMyLateAttendanceRequests,
  requestAbsence,
  listMyAbsenceRequests,
  uploadAbsenceDocument,
  createLateAttendance,
  submitLateAttendance,
  fetchActivities,
  fetchProjects,
  getMyAttendanceCalendar,
  fetchProjectTasks,
  getWorkingConfig as getWorkingConfigApi,
} from "../utils/api.jsx";
import toast from "react-hot-toast";
import { 
  Clock, 
  CheckCircle2, 
  XCircle, 
  Plus, 
  Trash2, 
  Calendar, 
  AlertCircle,
  ArrowLeft,
  X,
  AlertTriangle,
  ClipboardCopy
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import SearchSelect from "../components/SearchSelect.jsx";
import { useAuthStore } from "../stores/useAuthStore";

function AttendanceScroller({ monthlyDays, getCalendarDayStyle, formatWIBDate }) {
  const scrollRef = useRef(null);
  const sliderRef = useRef(null);

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollLeft = scrollRef.current.scrollWidth;
    if (sliderRef.current) {
      sliderRef.current.value = 100;
      sliderRef.current.style.setProperty("--val", "100%");
    }
  }, [monthlyDays]);

  return (
    <>
      <style>{`
        .att-scroll::-webkit-scrollbar { display: none; }
        .att-slider { appearance: none; width: 100%; height: 3px; border-radius: 9999px; outline: none; cursor: pointer; }
        .att-slider::-webkit-slider-thumb { appearance: none; width: 56px; height: 13px; border-radius: 9999px; background: #3b82f6; border: 2px solid #1d4ed8; box-shadow: 0 0 8px #3b82f660; cursor: pointer; }
        .att-slider::-moz-range-thumb { width: 16px; height: 16px; border-radius: 9999px; background: #3b82f6; border: 2px solid #1d4ed8; cursor: pointer; }
      `}</style>

      <div
        ref={scrollRef}
        className="att-scroll overflow-x-auto"
        style={{ scrollbarWidth: "none", msOverflowStyle: "none" }}
        onScroll={(e) => {
          const el = e.currentTarget;
          const max = el.scrollWidth - el.clientWidth;
          if (sliderRef.current && max > 0) {
            const val = (el.scrollLeft / max) * 100;
            sliderRef.current.value = val;
            sliderRef.current.style.setProperty("--val", `${val}%`);
          }
        }}
      >
        <div className="flex gap-1.5 " style={{ width: "max-content", paddingBottom: 4 }}>
          <div className="ml-2 mr-2 flex gap-1.5">

          {monthlyDays.map((day) => {
            const style = getCalendarDayStyle(day);
            const d = new Date(day.jsDate);
            const dayName = d.toLocaleDateString("id-ID", { weekday: "short" });
            const isToday =
              formatWIBDate(new Date()).split(",")[1]?.trim() ===
              d.toLocaleDateString("id-ID", { year: "numeric", month: "long", day: "numeric" });

            return (
              <div
                key={day.date}
                className={`relative flex flex-col items-center justify-center gap-0.5 rounded-xl border ${style.bg} ${style.border} ${isToday ? "ring-1 ring-blue-500/70" : ""}`}
                style={{ width: 40, height: 50, flexShrink: 0 }}
                title={`${d.toLocaleDateString("id-ID")} • ${style.label}`}
              >
                <span className="text-[9px] text-slate-500 uppercase leading-none">{dayName}</span>
                <span className={`text-sm font-bold leading-none ${style.text}`}>
                  {d.getDate().toString().padStart(2, "0")}
                </span>
                {isToday && (
                  <span className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full bg-blue-400" />
                )}
              </div>
            );
          })}
          </div>
        </div>
      </div>

      <div className="mt-3 px-0.5">
        <input
          ref={sliderRef}
          type="range"
          min="0"
          max="100"
          defaultValue="100"
          className="att-slider"
          style={{ "--val": "100%" }}
          onInput={(e) => {
            if (scrollRef.current) {
              const max = scrollRef.current.scrollWidth - scrollRef.current.clientWidth;
              scrollRef.current.scrollLeft = (e.target.value / 100) * max;
              e.target.style.setProperty("--val", `${e.target.value}%`);
            }
          }}
        />
        <div className="flex justify-between text-[10px] text-slate-600 mt-0.5">
          <span>30 hari lalu</span>
          <span>Hari ini</span>
        </div>
      </div>
    </>
  );
}

/**
 * Get current time in WIB (Waktu Indonesia Barat, UTC+7)
 */
const getWIBDate = (date = new Date()) => {
  const utc = date.getTime() + (date.getTimezoneOffset() * 60000);
  const wib = new Date(utc + (7 * 3600000)); // UTC+7
  return wib;
};

/**
 * Format date to WIB timezone string
 */
const formatWIBDate = (date) => {
  if (!date) return "";
  const wib = getWIBDate(new Date(date));
  return wib.toLocaleDateString("id-ID", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });
};

/**
 * Format time to WIB timezone string
 */
const formatWIBTime = (date) => {
  if (!date) return "";
  const wib = getWIBDate(new Date(date));
  return wib.toLocaleTimeString("id-ID", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Asia/Jakarta",
  });
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
 * Check if date is Saturday
 */
const isSaturday = (date = new Date()) => {
  return getWIBDayOfWeek(date) === 6;
};

/**
 * Check if date is a working day (Monday-Saturday, Sunday is off)
 */
const isWorkingDayDefault = (date = new Date()) => {
  const dayOfWeek = getWIBDayOfWeek(date);
  return dayOfWeek >= 1 && dayOfWeek <= 6; // Monday (1) to Saturday (6)
};

/**
 * Get working hours for a specific date
 */
const getWorkingHoursDefault = (date = new Date()) => {
  if (isSaturday(date)) {
    return { startHour: 8, startMinute: 0, endHour: 12, endMinute: 0 };
  }
  return { startHour: 8, startMinute: 0, endHour: 16, endMinute: 0 };
};

/**
 * Check if current time is past check-in deadline (16:00)
 */
const toMinutes = (hhmm) => {
  if (!hhmm) return null;
  const [h, m] = hhmm.split(":").map((v) => Number(v));
  if (Number.isNaN(h) || Number.isNaN(m)) return null;
  return h * 60 + m;
};

const getDefaultTimeRangeForDate = (date = new Date()) => {
  const hours = getWorkingHoursDefault(date);
  const toHHMM = (h, m) => `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
  return {
    checkIn: toHHMM(hours.startHour, hours.startMinute),
    checkOut: toHHMM(hours.endHour, hours.endMinute),
  };
};

const Attendance = () => {
  const { user } = useAuthStore();
  const currentUserId = user?._id || null;

  // ===== Task tier helpers (sorting + badge) =====
  const TASK_TIER_OPTIONS = [
    { value: "low", label: "Low" },
    { value: "normal", label: "Normal" },
    { value: "high", label: "High" },
    { value: "critical", label: "Critical" },
  ];
  const tierOrder = { critical: 0, high: 1, normal: 2, low: 3 };
  const tierLabel = (tier) => {
    if (tier === "critical") return "CRITICAL";
    if (tier === "high") return "HIGH";
    if (tier === "low") return "LOW";
    return "NORMAL";
  };
  const tierBadgeClass = (tier) => {
    if (tier === "critical") return "bg-fuchsia-500/20 text-fuchsia-300 border border-fuchsia-500/30";
    if (tier === "high") return "bg-red-500/20 text-red-300 border border-red-500/30";
    if (tier === "low") return "bg-slate-700/60 text-slate-300 border border-slate-600/60";
    return "bg-blue-500/15 text-blue-300 border border-blue-500/25";
  };
  const sortTasksByTier = (tasks = []) => {
    const copy = Array.isArray(tasks) ? [...tasks] : [];
    copy.sort((a, b) => {
      const ta = tierOrder[a?.tier] ?? tierOrder.normal;
      const tb = tierOrder[b?.tier] ?? tierOrder.normal;
      if (ta !== tb) return ta - tb;
      // secondary: ongoing first, then title
      const sa = a?.status === "ongoing" ? 0 : 1;
      const sb = b?.status === "ongoing" ? 0 : 1;
      if (sa !== sb) return sa - sb;
      return String(a?.title || "").localeCompare(String(b?.title || ""));
    });
    return copy;
  };
  const [attendance, setAttendance] = useState(null);
  const [nowTick, setNowTick] = useState(() => new Date());
  const [loading, setLoading] = useState(true);
  const [checkingIn, setCheckingIn] = useState(false);
  const [checkingOut, setCheckingOut] = useState(false);
  const [updating, setUpdating] = useState(false);

  // View state: 'main' | 'checked-in'
  const [viewMode, setViewMode] = useState('main');

  // Late attendance requests
  const [lateRequests, setLateRequests] = useState([]);
  const [loadingLateRequests, setLoadingLateRequests] = useState(true);
  const [absenceRequests, setAbsenceRequests] = useState([]);
  const [loadingAbsenceRequests, setLoadingAbsenceRequests] = useState(true);

  // Modal state for late attendance form
  const [showLateModal, setShowLateModal] = useState(false);
  const [editingLateRequest, setEditingLateRequest] = useState(null);
  const [submittingLateAttendance, setSubmittingLateAttendance] = useState(false);

  // Work log form state (for today's attendance only)
  const [selectedActivities, setSelectedActivities] = useState([]);
  const [selectedProjects, setSelectedProjects] = useState([]);
  const [note, setNote] = useState("");
  const [projectContributions, setProjectContributions] = useState({});

  // Perencanaan sebelum check-in: pilih proyek & task per proyek
  const [selectedProjectsForToday, setSelectedProjectsForToday] = useState([]);
  const [projectPickerValue, setProjectPickerValue] = useState("");
  const [projectTasksMap, setProjectTasksMap] = useState({});
  const [selectedTasksToday, setSelectedTasksToday] = useState([]);
  const [newTaskTitleByProject, setNewTaskTitleByProject] = useState({});
  const [newTaskHourByProject, setNewTaskHourByProject] = useState({});
  const [newTaskTierByProject, setNewTaskTierByProject] = useState({});
  const [newTaskNoteByProject, setNewTaskNoteByProject] = useState({});
  const [creatingTaskProjectId, setCreatingTaskProjectId] = useState(null);
  const [savingPlanAfterCheckIn, setSavingPlanAfterCheckIn] = useState(false);
  const [showCheckoutSummaryModal, setShowCheckoutSummaryModal] = useState(false);
  const [checkoutSummaryText, setCheckoutSummaryText] = useState("");

  // Status lokal task saat checkout (done/ongoing)
  const [checkoutTaskStatuses, setCheckoutTaskStatuses] = useState({});

  // Late attendance form state (request pengajuan)
  const [showLateForm, setShowLateForm] = useState(false);
  const [lateDate, setLateDate] = useState("");
  const [lateReason, setLateReason] = useState("");
  const [submittingLate, setSubmittingLate] = useState(false);
  const [showAbsenceForm, setShowAbsenceForm] = useState(false);
  const [absenceType, setAbsenceType] = useState("permission");
  const [absenceStartDate, setAbsenceStartDate] = useState("");
  const [absenceEndDate, setAbsenceEndDate] = useState("");
  const [absenceReason, setAbsenceReason] = useState("");
  const [absenceAttachmentFile, setAbsenceAttachmentFile] = useState(null);
  const [absenceAttachmentPreview, setAbsenceAttachmentPreview] = useState("");
  const [uploadingAbsenceAttachment, setUploadingAbsenceAttachment] = useState(false);
  const [submittingAbsence, setSubmittingAbsence] = useState(false);

  useEffect(() => {
    return () => {
      if (absenceAttachmentPreview?.startsWith("blob:")) {
        URL.revokeObjectURL(absenceAttachmentPreview);
      }
    };
  }, [absenceAttachmentPreview]);

  useEffect(() => {
    const id = setInterval(() => setNowTick(new Date()), 30_000);
    return () => clearInterval(id);
  }, []);

  // ─── Late attendance MODAL state (aligned with regular attendance flow) ───
  const [lateCheckInTime, setLateCheckInTime] = useState(() => getDefaultTimeRangeForDate(new Date()).checkIn);
  const [lateCheckOutTime, setLateCheckOutTime] = useState(() => getDefaultTimeRangeForDate(new Date()).checkOut);
  const [lateSelectedActivities, setLateSelectedActivities] = useState([]);
  const [lateNote, setLateNote] = useState("");

  // Project + task picker untuk modal (sama persis dengan alur attendance biasa)
  const [lateSelectedProjects, setLateSelectedProjects] = useState([]);   // array of projectId
  const [lateProjectPickerValue, setLateProjectPickerValue] = useState("");
  const [lateProjectTasksMap, setLateProjectTasksMap] = useState({});     // projectId -> tasks[]
  const [lateSelectedTasks, setLateSelectedTasks] = useState([]);         // array of taskId
  const [lateNewTaskTitleByProject, setLateNewTaskTitleByProject] = useState({});
  const [lateNewTaskHourByProject, setLateNewTaskHourByProject] = useState({});
  const [lateNewTaskTierByProject, setLateNewTaskTierByProject] = useState({});
  const [lateNewTaskNoteByProject, setLateNewTaskNoteByProject] = useState({});
  const [lateCreatingTaskProjectId, setLateCreatingTaskProjectId] = useState(null);
  // Status task saat "checkout" late (done/ongoing) — sama dengan alur checkout biasa
  const [lateTaskStatuses, setLateTaskStatuses] = useState({});

  // Master data
  const [activities, setActivities] = useState([]);
  const [projects, setProjects] = useState([]);
  const [loadingMasterData, setLoadingMasterData] = useState(true);

  // Monthly attendance overview (last 30 days)
  const [monthlyDays, setMonthlyDays] = useState([]);
  const [loadingMonthlyDays, setLoadingMonthlyDays] = useState(false);
  const [lateEligibleDates, setLateEligibleDates] = useState(new Set());

  // Dynamic working config (from backend)
  const [workingConfig, setWorkingConfig] = useState(null);
  const todayDefaultRange = getDefaultTimeRangeForDate(new Date());
  const effectiveCheckIn = workingConfig?.check_in || todayDefaultRange.checkIn;
  const effectiveCheckOut = workingConfig?.check_out || todayDefaultRange.checkOut;
  const effectiveMaxCheckOut = workingConfig?.max_checkout || "21:00";
  const effectiveCheckOutMinutes = toMinutes(effectiveCheckOut) ?? 16 * 60;

  // Helper: check if now is past check-in deadline based on workingConfig
  const isPastCheckInDeadline = () => {
    const now = getWIBDate();
    const minsNow = now.getHours() * 60 + now.getMinutes();
    return minsNow >= effectiveCheckOutMinutes;
  };

  // Load today's attendance, master data, dan overview
  useEffect(() => {
    loadTodayAttendance();
    loadMasterData();
    loadMyLateRequests();
    loadMyAbsenceRequests();
    loadMonthlyOverview();
    loadWorkingConfig();
    loadLateEligibleDates();
  }, []);

  const loadWorkingConfig = async () => {
    try {
      const payload = await getWorkingConfigApi();
      if (payload?.success && payload?.data) {
        setWorkingConfig(payload.data);
      } else {
        setWorkingConfig(null);
      }
    } catch (_e) {
      setWorkingConfig(null);
    }
  };

  // Sync form state with attendance data (TODAY ONLY)
  useEffect(() => {
    if (attendance) {
      setSelectedActivities(attendance.activities?.map((a) => a._id || a) || []);
      setSelectedProjects(
        attendance.projects?.map((p) => p.project_id?._id || p.project_id || p) || []
      );
      setProjectContributions(
        attendance.projects?.reduce((acc, p) => {
          const id = p.project_id?._id || p.project_id;
          if (!id) return acc;
          acc[id] = p.contribution_percentage ?? 0;
          return acc;
        }, {}) || {}
      );
      setNote(attendance.note || "");
      const initialStatuses = {};
      (attendance.tasks_today || []).forEach((t) => {
        initialStatuses[t._id] = t.status === "done" ? "done" : "ongoing";
      });
      setCheckoutTaskStatuses(initialStatuses);

      // Setelah check-in: sinkronkan proyek & task hari ini agar UI konsisten.
      const taskObjs = Array.isArray(attendance.tasks_today)
        ? attendance.tasks_today.filter((t) => typeof t === "object" && t?._id)
        : [];
      const taskIds = taskObjs.map((t) => t._id);
      const projIds = Array.from(
        new Set(
          taskObjs
            .map((t) => t.project_id?._id || t.project_id)
            .filter(Boolean)
            .map(String)
        )
      );
      setSelectedProjectsForToday(projIds);
      setSelectedTasksToday(taskIds);
      projIds.forEach((pid) => {
        loadProjectTasksFor(pid);
      });
    } else {
      setSelectedActivities([]);
      setSelectedProjects([]);
      setNote("");
      setProjectContributions({});
      setCheckoutTaskStatuses({});
      setSelectedProjectsForToday([]);
      setSelectedTasksToday([]);
      setProjectTasksMap({});
    }
  }, [attendance]);

  const loadTodayAttendance = async () => {
    try {
      setLoading(true);
      const result = await getTodayAttendance();
      const nextAttendance = result.data || null;
      setAttendance(nextAttendance);
      return nextAttendance;
    } catch (error) {
      console.error("Failed to load attendance:", error);
      setAttendance(null);
      return null;
    } finally {
      setLoading(false);
    }
  };

  const buildAttendanceProofText = (att) => {
    if (!att) return "";
    const dateText = formatWIBDate(att.date || new Date());
    const checkInText = att.checkIn_at ? formatWIBTime(att.checkIn_at) : "-";
    const checkOutText = att.checkOut_at ? formatWIBTime(att.checkOut_at) : "-";

    // Kelompokkan task berdasarkan project parent (task.project_id)
    const projectMap = new Map();
    (att.tasks_today || []).forEach((task) => {
      const proj = task?.project_id;
      const projId =
        proj?._id?.toString?.() || proj?._id || proj?.toString?.() || "no-project";

      if (!projectMap.has(projId)) {
        const name = proj?.name || proj?.project_id?.name || (projId === "no-project" ? "Tanpa Proyek" : "-");
        const code = proj?.code || proj?.project_code || (projId === "no-project" ? "-" : "-");
        projectMap.set(projId, {
          name,
          code,
          tasks: [],
        });
      }

      const bucket = projectMap.get(projId);
      const status = checkoutTaskStatuses[task._id] || task.status || "-";
      const tier = task.tier || "normal";
      const weight = Number(task.hour_weight) || 0;
      const noteText = task.note ? ` | note: ${task.note}` : "";
      bucket.tasks.push(
        `  - ${task.title} | status: ${status} | tier: ${tier} | ${weight} jam${noteText}`
      );
    });

    const groupedTaskLines = [];
    let projIndex = 1;
    for (const [, proj] of projectMap.entries()) {
      groupedTaskLines.push(
        `${projIndex}. ${proj.name}${proj.code && proj.code !== "-" ? ` (${proj.code})` : ""}`
      );
      if (proj.tasks.length === 0) {
        groupedTaskLines.push("  - (tidak ada task)");
      } else {
        groupedTaskLines.push(...proj.tasks);
      }
      projIndex += 1;
    }

    const activityLines = (att.activities || []).map(
      (a, idx) => `${idx + 1}. ${a.name_activity || a.name || a}`
    );
    const noteText = att.note ? `Catatan: ${att.note}` : "Catatan: -";

    return [
      "BUKTI PRESENSI HARIAN",
      `Nama: ${user?.full_name || user?.email || "-"}`,
      `Tanggal: ${dateText}`,
      `Check-in: ${checkInText}`,
      `Check-out: ${checkOutText}`,
      "",
      "Task hari ini (dikelompokkan per proyek):",
      ...(groupedTaskLines.length ? groupedTaskLines : ["-"]),
      "",
      "Aktivitas:",
      ...(activityLines.length ? activityLines : ["-"]),
      "",
      noteText,
    ].join("\n");
  };

  const loadProjectTasksFor = async (projectId) => {
    if (!projectId) return;
    try {
      const res = await fetchProjectTasks(projectId);
      const tasks = res.data || [];
      setProjectTasksMap((prev) => ({ ...prev, [projectId]: tasks }));
      const ongoingOwned = tasks
        .filter(
          (t) =>
            t.status === "ongoing" &&
            (t.user_id?._id || t.user_id) &&
            String(t.user_id?._id || t.user_id) === String(currentUserId)
        )
        .map((t) => t._id);
      if (ongoingOwned.length > 0) {
        setSelectedTasksToday((prev) => Array.from(new Set([...prev, ...ongoingOwned])));
      }
    } catch (error) {
      console.error("Failed to load project tasks:", error);
      toast.error("Gagal memuat task proyek");
    }
  };

  // ─── Late modal: load tasks per proyek (sama seperti attendance biasa) ───
  const loadLateProjectTasksFor = async (projectId) => {
    if (!projectId) return;
    try {
      const res = await fetchProjectTasks(projectId);
      const tasks = res.data || [];
      setLateProjectTasksMap((prev) => ({ ...prev, [projectId]: tasks }));
      // Auto-select ongoing tasks milik sendiri
      const ongoingOwned = tasks
        .filter(
          (t) =>
            t.status === "ongoing" &&
            String(t.user_id?._id || t.user_id || "") === String(currentUserId)
        )
        .map((t) => t._id);
      if (ongoingOwned.length > 0) {
        setLateSelectedTasks((prev) => Array.from(new Set([...prev, ...ongoingOwned])));
      }
    } catch (error) {
      console.error("Failed to load late project tasks:", error);
      toast.error("Gagal memuat task proyek");
    }
  };

  const attendanceUserId = attendance?.user_id?._id || attendance?.user_id || null;

  const loadMasterData = async () => {
    try {
      setLoadingMasterData(true);
      const [activitiesRes, projectsRes] = await Promise.all([
        fetchActivities(),
        fetchProjects(),
      ]);
      setActivities(activitiesRes.data || []);
      setProjects(projectsRes.data || []);
    } catch (error) {
      console.error("Failed to load master data:", error);
      toast.error("Gagal memuat data aktivitas dan proyek");
    } finally {
      setLoadingMasterData(false);
    }
  };

  const loadMyLateRequests = async () => {
    try {
      setLoadingLateRequests(true);
      const res = await listMyLateAttendanceRequests();
      setLateRequests(res.data || []);
    } catch (e) {
      console.error("Failed to load late requests:", e);
    } finally {
      setLoadingLateRequests(false);
    }
  };

  const loadMyAbsenceRequests = async () => {
    try {
      setLoadingAbsenceRequests(true);
      const res = await listMyAbsenceRequests();
      setAbsenceRequests(res.data || []);
    } catch (e) {
      console.error("Failed to load absence requests:", e);
    } finally {
      setLoadingAbsenceRequests(false);
    }
  };

  const loadMonthlyOverview = async () => {
    try {
      setLoadingMonthlyDays(true);

      const todayWIB = getWIBDate(new Date());
      const end = new Date(todayWIB);
      const start = new Date(todayWIB);
      start.setDate(start.getDate() - 29);

      const toStr = `${end.getFullYear()}-${String(end.getMonth() + 1).padStart(2, "0")}-${String(
        end.getDate()
      ).padStart(2, "0")}`;
      const fromStr = `${start.getFullYear()}-${String(start.getMonth() + 1).padStart(
        2,
        "0"
      )}-${String(start.getDate()).padStart(2, "0")}`;

      const monthNow = `${end.getFullYear()}-${String(end.getMonth() + 1).padStart(2, "0")}`;
      const monthStart = `${start.getFullYear()}-${String(start.getMonth() + 1).padStart(2, "0")}`;
      const [calNow, calStart] = await Promise.all([
        getMyAttendanceCalendar({ month: monthNow }),
        monthNow === monthStart ? Promise.resolve(null) : getMyAttendanceCalendar({ month: monthStart }),
      ]);
      const dayMeta = new Map();
      const records = [];
      const pushCalendar = (calRes) => {
        if (!calRes?.data) return;
        const days = calRes.data.days || [];
        const recs = calRes.data.records || [];
        days.forEach((d) => dayMeta.set(d.date, d));
        records.push(...recs);
      };
      pushCalendar(calNow);
      pushCalendar(calStart);
      const mapByDate = new Map();
      records.forEach((att) => {
        if (!att?.date) return;
        const d = getWIBDate(new Date(att.date));
        const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
        if (!mapByDate.has(key)) mapByDate.set(key, att);
      });

      const days = [];
      const cursor = new Date(start);
      while (cursor <= end) {
        const y = cursor.getFullYear();
        const m = String(cursor.getMonth() + 1).padStart(2, "0");
        const d = String(cursor.getDate()).padStart(2, "0");
        const key = `${y}-${m}-${d}`;
        const meta = dayMeta.get(key);
        days.push({
          date: key,
          jsDate: new Date(cursor),
          attendance: mapByDate.get(key) || null,
          isSunday: meta ? meta.dayOfWeek === 0 : isSunday(cursor),
          isHoliday: !!meta?.is_holiday,
          holidayName: meta?.holiday_name || "",
          hasWorkDayConfig: meta?.has_workday_config ?? false,
          isWorkingDay: meta?.is_working_day ?? false,
        });
        cursor.setDate(cursor.getDate() + 1);
      }

      setMonthlyDays(days);
    } catch (error) {
      console.error("Failed to load monthly overview:", error);
    } finally {
      setLoadingMonthlyDays(false);
    }
  };

  const loadLateEligibleDates = async () => {
    try {
      const today = getWIBDate(new Date());
      const end = new Date(today);
      end.setDate(end.getDate() - 1);
      const start = new Date(today);
      start.setDate(start.getDate() - 90);

      const monthKeys = new Set();
      const cur = new Date(start);
      while (cur <= end) {
        monthKeys.add(`${cur.getFullYear()}-${String(cur.getMonth() + 1).padStart(2, "0")}`);
        cur.setMonth(cur.getMonth() + 1, 1);
      }

      const calendars = await Promise.all(Array.from(monthKeys).map((m) => getMyAttendanceCalendar({ month: m })));
      const eligible = new Set();
      calendars.forEach((res) => {
        (res?.data?.days || []).forEach((d) => {
          if (d?.has_workday_config && d?.is_working_day && !d?.is_holiday) {
            eligible.add(d.date);
          }
        });
      });
      setLateEligibleDates(eligible);
    } catch (_e) {
      setLateEligibleDates(new Set());
    }
  };

  const handleCheckIn = async () => {
    try {
      setCheckingIn(true);
      const taskIds = selectedTasksToday.filter(Boolean);
      if (taskIds.length === 0) {
        toast.error("Pilih minimal satu task sebelum check-in");
        setCheckingIn(false);
        return;
      }
      await checkIn(taskIds);
      toast.success("Check-in berhasil!");
      await loadTodayAttendance();
      setViewMode("checked-in");
    } catch (error) {
      console.error("Check-in error:", error);
      toast.error("Gagal check-in");
    } finally {
      setCheckingIn(false);
    }
  };

  const handleCheckOut = async () => {
    try {
      setCheckingOut(true);
      const tasksPayload = (attendance?.tasks_today || []).map((t) => ({
        task_id: t._id,
        status: checkoutTaskStatuses[t._id] || "ongoing",
      }));
      await checkOut(tasksPayload);
      toast.success("Check-out berhasil!");
      const refreshedAttendance = await loadTodayAttendance();
      const proof = buildAttendanceProofText(refreshedAttendance);
      if (proof) {
        setCheckoutSummaryText(proof);
        setShowCheckoutSummaryModal(true);
      }
    } catch (error) {
      console.error("Check-out error:", error); 
      toast.error("Gagal check-out");
    } finally {
      setCheckingOut(false);
    }
  };

  const handleUpdateWork = async () => {
    try {
      setUpdating(true);
      const payload = {
        activities: selectedActivities,
        note: note,
      };
      await updateDailyWork(payload);
      toast.success("Pekerjaan harian berhasil diupdate!");
      await loadTodayAttendance();
    } catch (error) {
      console.error("Update work error:", error);
      toast.error("Gagal update pekerjaan harian");
    } finally {
      setUpdating(false);
    }
  };

  const handleToggleTaskStatusForCheckout = (taskId) => {
    setCheckoutTaskStatuses((prev) => {
      const current = prev[taskId] || "ongoing";
      const nextStatus = current === "done" ? "ongoing" : "done";
      updateTask(taskId, { status: nextStatus }).catch((e) => {
        console.error("Gagal update status task:", e);
        toast.error("Gagal menyimpan status task");
      });
      return { ...prev, [taskId]: nextStatus };
    });
  };

  const handleSelectProjectForToday = async (projectId) => {
    if (!projectId) return;
    if (selectedProjectsForToday.includes(projectId)) return;
    const next = [...selectedProjectsForToday, projectId];
    setSelectedProjectsForToday(next);
    await loadProjectTasksFor(projectId);
  };

  const handleRemoveProjectForToday = (projectId) => {
    setSelectedProjectsForToday((prev) => prev.filter((id) => id !== projectId));
    setSelectedTasksToday((prev) =>
      prev.filter((taskId) => {
        const tasks = projectTasksMap[projectId] || [];
        return !tasks.some((t) => t._id === taskId);
      })
    );
  };

  const handleToggleTaskForToday = (taskId) => {
    setSelectedTasksToday((prev) =>
      prev.includes(taskId)
        ? prev.filter((id) => id !== taskId)
        : [...prev, taskId]
    );
  };

  const handleNewTaskTitleChange = (projectId, value) => {
    setNewTaskTitleByProject((prev) => ({ ...prev, [projectId]: value }));
  };

  const handleNewTaskHourChange = (projectId, value) => {
    setNewTaskHourByProject((prev) => ({
      ...prev,
      [projectId]: Number(value) || 1,
    }));
  };

  const handleNewTaskTierChange = (projectId, value) => {
    setNewTaskTierByProject((prev) => ({ ...prev, [projectId]: value }));
  };

  const handleNewTaskNoteChange = (projectId, value) => {
    setNewTaskNoteByProject((prev) => ({ ...prev, [projectId]: value }));
  };

  const handleAddProjectTask = async (projectId) => {
    const title = (newTaskTitleByProject[projectId] || "").trim();
    if (!title) {
      toast.error("Judul task tidak boleh kosong");
      return;
    }
    try {
      setCreatingTaskProjectId(projectId);
      const res = await createTask({
        title,
        project_id: projectId,
        hour_weight: Number((newTaskHourByProject[projectId] ?? 1)) || 1,
        tier: newTaskTierByProject[projectId] || "normal",
        note: String(newTaskNoteByProject[projectId] || "").trim(),
      });
      const newTask = res.data;
      setProjectTasksMap((prev) => {
        const list = prev[projectId] || [];
        return { ...prev, [projectId]: [...list, newTask] };
      });
      setSelectedTasksToday((prev) => [...prev, newTask._id]);
      setNewTaskTitleByProject((prev) => ({ ...prev, [projectId]: "" }));
      setNewTaskTierByProject((prev) => ({ ...prev, [projectId]: "normal" }));
      setNewTaskNoteByProject((prev) => ({ ...prev, [projectId]: "" }));
      if (attendance && !attendance.checkOut_at) {
        try {
          await updateDailyWork({ tasks_today: [newTask._id] });
          await loadTodayAttendance();
        } catch (err) {
          console.error("Failed to attach task to today:", err);
        }
      }
      toast.success("Task berhasil ditambahkan");
    } catch (e) {
      console.error("Create task error:", e);
      toast.error("Gagal menambah task");
    } finally {
      setCreatingTaskProjectId(null);
    }
  };

  const handleSavePlanAfterCheckIn = async () => {
    try {
      setSavingPlanAfterCheckIn(true);
      const uniqueTaskIds = Array.from(new Set(selectedTasksToday.filter(Boolean)));
      if (uniqueTaskIds.length === 0) {
        toast.error("Minimal satu task harus dipilih");
        return;
      }
      await updateDailyWork({ tasks_today: uniqueTaskIds });
      toast.success("Project & task hari ini berhasil diperbarui");
      await loadTodayAttendance();
    } catch (error) {
      console.error("Failed to save tasks_today after check-in:", error);
      toast.error(error?.message || "Gagal menyimpan project dan task");
    } finally {
      setSavingPlanAfterCheckIn(false);
    }
  };

  const handleSubmitLateAttendance = async () => {
    if (!lateDate || !lateReason || lateReason.trim().length < 10) {
      toast.error("Tanggal dan alasan (min 10 karakter) wajib diisi");
      return;
    }
    if (!isLateDateAllowed(lateDate)) {
      toast.error("Tanggal tidak tersedia untuk pengajuan late attendance. Hubungi HR.");
      return;
    }
    try {
      setSubmittingLate(true);
      await requestLateAttendance({
        date: lateDate,
        reason: lateReason.trim(),
      });
      toast.success("Pengajuan presensi terlambat berhasil! Menunggu persetujuan HR.");
      setShowLateForm(false);
      setLateDate("");
      setLateReason("");
      await loadMyLateRequests();
    } catch (error) {
      console.error("Late attendance request error:", error);
      if (error?.message) {
        toast.error(error.message);
      } else {
        toast.error("Gagal mengajukan presensi terlambat");
      }
    } finally {
      setSubmittingLate(false);
    }
  };

  // ─── Late modal: open → reset semua state modal ───
  const handleOpenLateModal = async (request) => {
    setEditingLateRequest(request);

    const targetDate = request?.date ? new Date(request.date) : new Date();
    const defaultTimeRange = getDefaultTimeRangeForDate(targetDate);

    // Reset semua state modal
    setLateCheckInTime(defaultTimeRange.checkIn);
    setLateCheckOutTime(defaultTimeRange.checkOut);
    setLateSelectedActivities([]);
    setLateNote("");
    setLateSelectedProjects([]);
    setLateProjectPickerValue("");
    setLateProjectTasksMap({});
    setLateSelectedTasks([]);
    setLateNewTaskTitleByProject({});
    setLateNewTaskHourByProject({});
    setLateCreatingTaskProjectId(null);
    setLateTaskStatuses({});

    setShowLateModal(true);

    // Ambil jam kerja berdasarkan hari/tanggal request (sumber weekly/workday config backend).
    try {
      const payload = await getWorkingConfigApi({
        date: request?.date,
      });
      const cfg = payload?.success && payload?.data ? payload.data : null;
      if (cfg?.check_in) setLateCheckInTime(cfg.check_in);
      if (cfg?.check_out) setLateCheckOutTime(cfg.check_out);
    } catch (_e) {
      // Keep fallback default by day if API fails.
    }
  };

  // ─── Late modal: tambah proyek (sama alur dengan attendance biasa) ───
  const handleLateSelectProject = async (projectId) => {
    if (!projectId) return;
    if (lateSelectedProjects.includes(projectId)) return;
    setLateSelectedProjects((prev) => [...prev, projectId]);
    await loadLateProjectTasksFor(projectId);
  };

  const handleLateRemoveProject = (projectId) => {
    setLateSelectedProjects((prev) => prev.filter((id) => id !== projectId));
    setLateSelectedTasks((prev) => {
      const tasks = lateProjectTasksMap[projectId] || [];
      return prev.filter((tid) => !tasks.some((t) => t._id === tid));
    });
    setLateProjectTasksMap((prev) => {
      const next = { ...prev };
      delete next[projectId];
      return next;
    });
  };

  const handleLateToggleTask = (taskId) => {
    setLateSelectedTasks((prev) =>
      prev.includes(taskId)
        ? prev.filter((id) => id !== taskId)
        : [...prev, taskId]
    );
  };

  const handleLateNewTaskTitleChange = (projectId, value) => {
    setLateNewTaskTitleByProject((prev) => ({ ...prev, [projectId]: value }));
  };

  const handleLateNewTaskHourChange = (projectId, value) => {
    setLateNewTaskHourByProject((prev) => ({
      ...prev,
      [projectId]: Number(value) || 1,
    }));
  };

  const handleLateNewTaskTierChange = (projectId, value) => {
    setLateNewTaskTierByProject((prev) => ({ ...prev, [projectId]: value }));
  };

  const handleLateNewTaskNoteChange = (projectId, value) => {
    setLateNewTaskNoteByProject((prev) => ({ ...prev, [projectId]: value }));
  };

  const handleLateAddProjectTask = async (projectId) => {
    const title = (lateNewTaskTitleByProject[projectId] || "").trim();
    if (!title) {
      toast.error("Judul task tidak boleh kosong");
      return;
    }
    try {
      setLateCreatingTaskProjectId(projectId);
      const res = await createTask({
        title,
        project_id: projectId,
        hour_weight: Number(lateNewTaskHourByProject[projectId] ?? 1) || 1,
        tier: lateNewTaskTierByProject[projectId] || "normal",
        note: String(lateNewTaskNoteByProject[projectId] || "").trim(),
      });
      const newTask = res.data;
      setLateProjectTasksMap((prev) => ({
        ...prev,
        [projectId]: [...(prev[projectId] || []), newTask],
      }));
      setLateSelectedTasks((prev) => [...prev, newTask._id]);
      setLateTaskStatuses((prev) => ({ ...prev, [newTask._id]: "done" }));
      setLateNewTaskTitleByProject((prev) => ({ ...prev, [projectId]: "" }));
      setLateNewTaskTierByProject((prev) => ({ ...prev, [projectId]: "normal" }));
      setLateNewTaskNoteByProject((prev) => ({ ...prev, [projectId]: "" }));
      toast.success("Task berhasil ditambahkan");
    } catch (e) {
      console.error("Create late task error:", e);
      toast.error("Gagal menambah task");
    } finally {
      setLateCreatingTaskProjectId(null);
    }
  };

  // ─── Late modal: toggle status task done/ongoing (sama dengan checkout biasa) ───
  const handleLateToggleTaskStatus = (taskId) => {
    setLateTaskStatuses((prev) => {
      const current = prev[taskId] ?? "done";
      return { ...prev, [taskId]: current === "done" ? "ongoing" : "done" };
    });
  };

  // ─── Late modal: submit (aligned with regular attendance flow) ───
  const handleSubmitLateAttendanceFromModal = async () => {
    if (!editingLateRequest) return;

    const selectedTaskIds = lateSelectedTasks.filter(Boolean);
    if (selectedTaskIds.length === 0) {
      toast.error("Pilih minimal satu task sebelum submit presensi");
      return;
    }

    // const hasDoneTask = selectedTaskIds.some(
    //   (id) => (lateTaskStatuses[id] ?? "done") === "done"
    // );
    // if (!hasDoneTask) {
    //   toast.error("Minimal 1 task harus ditandai selesai (done) agar presensi terlambat valid");
    //   return;
    // }

    try {
      setSubmittingLateAttendance(true);

      // Parse tanggal request (WIB-safe)
      const requestDateRaw = editingLateRequest.date;
      let requestDate;
      if (typeof requestDateRaw === "string") {
        const dateParts = requestDateRaw.split("T")[0].split("-");
        requestDate = new Date(
          parseInt(dateParts[0]),
          parseInt(dateParts[1]) - 1,
          parseInt(dateParts[2])
        );
      } else {
        requestDate = new Date(requestDateRaw);
      }

      if (isNaN(requestDate.getTime())) {
        toast.error("Tanggal tidak valid");
        setSubmittingLateAttendance(false);
        return;
      }

      const year = requestDate.getFullYear();
      const month = String(requestDate.getMonth() + 1).padStart(2, "0");
      const day = String(requestDate.getDate()).padStart(2, "0");
      const dateStr = `${year}-${month}-${day}`;

      const checkInDateTime = new Date(`${dateStr}T${lateCheckInTime}:00`);
      const checkOutDateTime = new Date(`${dateStr}T${lateCheckOutTime}:00`);

      const today = new Date();
      today.setHours(23, 59, 59, 999);
      if (checkInDateTime > today) {
        toast.error("Tanggal tidak boleh di masa depan");
        setSubmittingLateAttendance(false);
        return;
      }

      if (checkOutDateTime <= checkInDateTime) {
        toast.error("Waktu check-out harus setelah check-in");
        setSubmittingLateAttendance(false);
        return;
      }

      // Update status masing-masing task sesuai pilihan user (done/ongoing)
      await Promise.all(
        selectedTaskIds.map(async (taskId) => {
          const status = lateTaskStatuses[taskId] ?? "done";
          try {
            await updateTask(taskId, { status });
          } catch (err) {
            console.error(`Gagal update status task ${taskId}:`, err);
          }
        })
      );

      // Derive projects dari task yang dipilih (otomatis, tidak perlu input manual)
      const involvedProjectIds = Array.from(
        new Set(
          selectedTaskIds
            .map((tid) => {
              for (const [pid, tasks] of Object.entries(lateProjectTasksMap)) {
                if (tasks.some((t) => t._id === tid)) return pid;
              }
              return null;
            })
            .filter(Boolean)
        )
      );

      const payload = {
        checkIn_at: checkInDateTime.toISOString(),
        checkOut_at: checkOutDateTime.toISOString(),
        tasks_today: selectedTaskIds,
      };

      if (lateNote.trim()) payload.note = lateNote.trim();
      if (lateSelectedActivities.length > 0) payload.activities = lateSelectedActivities;

      // Projects dikirim tanpa kontribusi manual (sama seperti attendance biasa)
      if (involvedProjectIds.length > 0) {
        payload.projects = involvedProjectIds.map((id) => ({
          project_id: id,
          contribution_percentage: 0, // dihitung otomatis dari backend
        }));
      }

      const createRes = await createLateAttendance(editingLateRequest._id, payload);

      if (!createRes.data || !createRes.data._id) {
        throw new Error("Failed to create late attendance");
      }

      toast.success("Presensi terlambat berhasil dibuat!");
      setShowLateModal(false);
      setEditingLateRequest(null);
      await loadMyLateRequests();
    } catch (e) {
      console.error("Submit late attendance error:", e);
      toast.error(e?.message || "Gagal membuat presensi terlambat");
    } finally {
      setSubmittingLateAttendance(false);
    }
  };

  // Enhanced status helpers
  const getAttendanceStatus = (checkInTime, checkOutTime) => {
    const targetDate = new Date(checkInTime || checkOutTime || Date.now());
    const defaultRange = getDefaultTimeRangeForDate(targetDate);
    const cfgStart = toMinutes(workingConfig?.check_in) ?? toMinutes(defaultRange.checkIn) ?? 8 * 60;
    const cfgEnd = toMinutes(workingConfig?.check_out) ?? toMinutes(defaultRange.checkOut) ?? 16 * 60;
    const checkInHour = new Date(checkInTime).getHours();
    const checkInMinute = new Date(checkInTime).getMinutes();
    const checkInTotalMinutes = checkInHour * 60 + checkInMinute;

    const checkOutHour = new Date(checkOutTime).getHours();
    const checkOutMinute = new Date(checkOutTime).getMinutes();
    const checkOutTotalMinutes = checkOutHour * 60 + checkOutMinute;

    const isLateCheckIn = checkInTotalMinutes > cfgStart;
    const isEarlyCheckOut = checkOutTotalMinutes < cfgEnd;

    if (isLateCheckIn && isEarlyCheckOut) {
      return {
        status: "late",
        color: "text-red-400",
        bgColor: "bg-red-500/10",
        borderColor: "border-red-500/40",
        label: "Terlambat & Pulang Cepat",
      };
    } else if (isLateCheckIn) {
      return {
        status: "late_checkin",
        color: "text-orange-400",
        bgColor: "bg-orange-500/10",
        borderColor: "border-orange-500/40",
        label: "Terlambat Check-in",
      };
    } else if (isEarlyCheckOut) {
      return {
        status: "early_checkout",
        color: "text-yellow-400",
        bgColor: "bg-yellow-500/10",
        borderColor: "border-yellow-500/40",
        label: "Pulang Cepat",
      };
    } else {
      return {
        status: "normal",
        color: "text-green-400",
        bgColor: "bg-emerald-500/10",
        borderColor: "border-emerald-500/40",
        label: "Normal",
      };
    }
  };

  const getCheckInStatus = (checkInTime) => {
    const hour = new Date(checkInTime).getHours();
    const minute = new Date(checkInTime).getMinutes();
    const totalMinutes = hour * 60 + minute;
    const defaultRange = getDefaultTimeRangeForDate(new Date(checkInTime));
    const cfgStart = toMinutes(workingConfig?.check_in) ?? toMinutes(defaultRange.checkIn) ?? 8 * 60;

    if (totalMinutes <= cfgStart) {
      return {
        status: "ontime",
        color: "text-green-400",
        bgColor: "bg-slate-900",
        borderColor: "border-emerald-500/40",
        label: "Tepat Waktu",
      };
    } else {
      return {
        status: "late",
        color: "text-red-400",
        bgColor: "bg-slate-900",
        borderColor: "border-red-500/40",
        label: "Terlambat",
      };
    }
  };

  const getCheckOutStatus = (checkOutTime) => {
    const hour = new Date(checkOutTime).getHours();
    const minute = new Date(checkOutTime).getMinutes();
    const totalMinutes = hour * 60 + minute;
    const defaultRange = getDefaultTimeRangeForDate(new Date(checkOutTime));
    const defaultEnd = toMinutes(defaultRange.checkOut) ?? 16 * 60;
    const ninePM = 21 * 60;
    const cfgEnd = toMinutes(workingConfig?.check_out) ?? defaultEnd;

    if (totalMinutes >= cfgEnd && totalMinutes <= ninePM) {
      return {
        status: "normal",
        color: "text-green-400",
        bgColor: "bg-emerald-500/10",
        borderColor: "border-emerald-500/40",
        label: "Normal",
      };
    } else if (totalMinutes < cfgEnd) {
      return {
        status: "early",
        color: "text-yellow-400",
        bgColor: "bg-yellow-500/10",
        borderColor: "border-yellow-500/40",
        label: "Pulang Cepat",
      };
    } else {
      return {
        status: "toolate",
        color: "text-red-400",
        bgColor: "bg-red-500/10",
        borderColor: "border-red-500/40",
        label: "Checkout Terlalu Malam",
      };
    }
  };

  const canCheckOutNow = () => {
    const now = new Date();
    const total = now.getHours() * 60 + now.getMinutes();
    const max = toMinutes(workingConfig?.max_checkout) ?? (21 * 60);
    return total <= max;
  };

  const isLocked = attendance?.checkOut_at;
  const tasksToday = attendance?.tasks_today || [];
  const canCheckOut =
    attendance &&
    !attendance.checkOut_at &&
    tasksToday.length > 0 &&
    canCheckOutNow();
  const hasAttendance = attendance !== null;

  const wibToday = getWIBDate(new Date());
  const wibYesterday = new Date(wibToday);
  wibYesterday.setDate(wibYesterday.getDate() - 1);
  const maxLateDate = `${wibYesterday.getFullYear()}-${String(wibYesterday.getMonth() + 1).padStart(2, '0')}-${String(wibYesterday.getDate()).padStart(2, '0')}`;

  const wibMinDate = new Date(wibToday);
  wibMinDate.setDate(wibMinDate.getDate() - 90);
  const minLateDate = `${wibMinDate.getFullYear()}-${String(wibMinDate.getMonth() + 1).padStart(2, '0')}-${String(wibMinDate.getDate()).padStart(2, '0')}`;

  const todayWibKey = `${wibToday.getFullYear()}-${String(wibToday.getMonth() + 1).padStart(2, "0")}-${String(wibToday.getDate()).padStart(2, "0")}`;
  const attendanceIsToday = !!attendance?.date
    ? (() => {
        const d = getWIBDate(new Date(attendance.date));
        const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
        return key === todayWibKey;
      })()
    : false;

  const hasLateRequestForDate = (date) => {
    if (!date) return false;
    return lateRequests.some((req) => {
      if (!req?.date) return false;
      const wibReqDate = getWIBDate(new Date(req.date));
      const year = wibReqDate.getFullYear();
      const month = String(wibReqDate.getMonth() + 1).padStart(2, "0");
      const day = String(wibReqDate.getDate()).padStart(2, "0");
      const reqDateStr = `${year}-${month}-${day}`;
      return reqDateStr === date;
    });
  };
  const isLateDateAllowed = (date) => {
    if (!date) return false;
    return lateEligibleDates.has(date);
  };
  const hasAttendanceForDate = (date) => {
    if (!date) return false;
    return monthlyDays.some((d) => d.date === date && !!d.attendance);
  };
  const hasAbsenceRequestForDate = (date) => {
    if (!date) return false;
    return absenceRequests.some((req) => {
      if (!req?.start_date || !req?.end_date) return false;
      const start = getWIBDate(new Date(req.start_date));
      const end = getWIBDate(new Date(req.end_date));
      const s = `${start.getFullYear()}-${String(start.getMonth() + 1).padStart(2, "0")}-${String(start.getDate()).padStart(2, "0")}`;
      const e = `${end.getFullYear()}-${String(end.getMonth() + 1).padStart(2, "0")}-${String(end.getDate()).padStart(2, "0")}`;
      return date >= s && date <= e && req.status !== "rejected";
    });
  };

  const shouldHideLateForm = lateDate && hasLateRequestForDate(lateDate);
  const lateDateInvalid =
    !!lateDate &&
    (!isLateDateAllowed(lateDate) ||
      hasAbsenceRequestForDate(lateDate) ||
      hasAttendanceForDate(lateDate));

  const handleSubmitAbsenceRequest = async () => {
    if (!absenceStartDate || !absenceEndDate || !absenceReason.trim()) {
      toast.error("Tanggal awal, tanggal akhir, dan alasan wajib diisi");
      return;
    }
    if (absenceEndDate < absenceStartDate) {
      toast.error("Tanggal akhir harus sama/lebih besar dari tanggal awal");
      return;
    }

    const normalizeDateKey = (d) => {
      const y = d.getFullYear();
      const m = String(d.getMonth() + 1).padStart(2, "0");
      const day = String(d.getDate()).padStart(2, "0");
      return `${y}-${m}-${day}`;
    };
    const parseLocalDateKey = (key) => new Date(`${key}T00:00:00`);

    // Ambil metadata workday dari backend (sama seperti yang dipakai calendar view)
    // untuk konflik cek hanya di hari kerja (libur/minggu tidak dihitung konflik).
    const startD = parseLocalDateKey(absenceStartDate);
    const endD = parseLocalDateKey(absenceEndDate);
    const monthKeys = new Set();
    const curMonth = new Date(startD);
    curMonth.setDate(1);
    while (curMonth <= endD) {
      monthKeys.add(`${curMonth.getFullYear()}-${String(curMonth.getMonth() + 1).padStart(2, "0")}`);
      curMonth.setMonth(curMonth.getMonth() + 1, 1);
    }

    const workMetaByDate = new Map();
    try {
      const calendars = await Promise.all(
        Array.from(monthKeys).map((m) => getMyAttendanceCalendar({ month: m }))
      );
      calendars.forEach((res) => {
        (res?.data?.days || []).forEach((d) => {
          if (!d?.date) return;
          workMetaByDate.set(d.date, d);
        });
      });
    } catch (_e) {
      // Kalau gagal fetch meta, tetap lanjut dengan fallback "tidak ada hari kerja"
      // agar tidak mengirim request yang berpotensi ditolak backend.
    }

    const conflicts = [];
    const workingKeys = [];
    let cursor = new Date(startD);
    while (cursor <= endD) {
      const key = normalizeDateKey(cursor);
      const meta = workMetaByDate.get(key);
      const isWorking =
        !!meta?.has_workday_config && !!meta?.is_working_day && !meta?.is_holiday;
      if (isWorking) {
        workingKeys.push(key);
        if (hasLateRequestForDate(key)) conflicts.push(`${key} (late request)`);
        if (hasAbsenceRequestForDate(key)) conflicts.push(`${key} (absence request)`);
        if (hasAttendanceForDate(key)) conflicts.push(`${key} (attendance)`);
      }
      cursor.setDate(cursor.getDate() + 1);
    }

    if (workingKeys.length === 0) {
      toast.error("Rentang tanggal tidak memiliki hari kerja (atau belum diset HR)");
      return;
    }
    if (conflicts.length > 0) {
      toast.error(
        `Konflik tanggal: ${conflicts.slice(0, 5).join(", ")}${
          conflicts.length > 5 ? " ..." : ""
        }`
      );
      return;
    }

    try {
      setSubmittingAbsence(true);
      let attachmentUrl = null;
      let attachmentDocumentId = null;
      if (absenceAttachmentFile) {
        setUploadingAbsenceAttachment(true);
        const uploadRes = await uploadAbsenceDocument({
          userId: currentUserId,
          file: absenceAttachmentFile,
          description: `Lampiran ${absenceType} ${absenceStartDate} - ${absenceEndDate}`,
        });
        attachmentUrl = uploadRes?.data?.file_url || uploadRes?.data?.url || null;
        attachmentDocumentId = uploadRes?.data?._id || null;
      }
      await requestAbsence({
        type: absenceType,
        start_date: absenceStartDate,
        end_date: absenceEndDate,
        reason: absenceReason.trim(),
        attachment_url: attachmentUrl,
        attachment_document_id: attachmentDocumentId,
      });
      toast.success("Pengajuan izin/cuti/sakit berhasil dikirim");
      setShowAbsenceForm(false);
      setAbsenceType("permission");
      setAbsenceStartDate("");
      setAbsenceEndDate("");
      setAbsenceReason("");
      setAbsenceAttachmentFile(null);
      setAbsenceAttachmentPreview("");
      await loadMyAbsenceRequests();
    } catch (error) {
      console.error("Absence request error:", error);
    } finally {
      setUploadingAbsenceAttachment(false);
      setSubmittingAbsence(false);
    }
  };

  const getCalendarDayStyle = (day) => {
    const attendanceRecord = day.attendance;
    if (!attendanceRecord) {
      if (!day.hasWorkDayConfig) {
        return {
          bg: "bg-slate-950/60",
          border: "border-slate-700",
          text: "text-slate-500",
          label: "Belum Diset HR",
        };
      }
      if (day.isHoliday || !day.isWorkingDay) {
        return {
          bg: "bg-red-500/12",
          border: "border-red-500/40",
          text: "text-red-300",
          label: day.holidayName || "Libur",
        };
      }
      return {
        bg: "bg-slate-800/60",
        border: "border-slate-700",
        text: "text-slate-400",
        label: "Belum Presensi",
      };
    }

    const status = attendanceRecord.status;
    if (status === "normal") {
      return {
        bg: "bg-emerald-500/15",
        border: "border-emerald-500/60",
        text: "text-emerald-300",
        label: "Normal",
      };
    }
    if (status === "late_checkin" || status === "early_checkout") {
      return {
        bg: "bg-yellow-500/15",
        border: "border-yellow-500/60",
        text: "text-yellow-300",
        label: status === "late_checkin" ? "Late In" : "Early Out",
      };
    }
    if (status === "late") {
      return {
        bg: "bg-red-500/15",
        border: "border-red-500/60",
        text: "text-red-300",
        label: "Late",
      };
    }
    if (status === "manual") {
      return {
        bg: "bg-blue-500/15",
        border: "border-blue-500/60",
        text: "text-blue-300",
        label: "Manual",
      };
    }
    if (status === "forget") {
      return {
        bg: "bg-purple-500/15",
        border: "border-purple-500/60",
        text: "text-purple-300",
        label: "Lupa",
      };
    }

    return {
      bg: "bg-slate-800/60",
      border: "border-slate-700",
      text: "text-slate-400",
      label: status || "Presensi",
    };
  };

  // ─── Reusable: Late Attendance Request Form (dipakai di 2 tempat) ───
  // Penting: dibuat sebagai helper render function (bukan React component terpisah)
  // supaya tidak di-remount setiap kali state berubah (yang bisa membuat textarea kehilangan fokus).
  const renderLateRequestForm = () => (
    <div className="p-6 bg-slate-900/80 backdrop-blur-xl rounded-3xl shadow-2xl border border-yellow-500/30">
      <p className="text-sm text-slate-300 mb-4">
        Lupa melakukan presensi hari sebelumnya? Ajukan presensi terlambat.
      </p>
      {!showLateForm ? (
        <motion.button
          onClick={() => setShowLateForm(true)}
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          className="text-sm text-yellow-400 hover:text-yellow-300 font-medium underline transition-colors"
        >
          Ajukan Presensi Terlambat
        </motion.button>
      ) : (
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-2">Tanggal</label>
            <input
              type="date"
              value={lateDate}
              onChange={(e) => setLateDate(e.target.value)}
              max={maxLateDate}
              min={minLateDate}
              className="w-full px-4 py-3 bg-slate-800/50 border border-slate-700 rounded-2xl text-white focus:ring-2 focus:ring-yellow-500 focus:border-yellow-500 backdrop-blur-sm"
            />
            {lateDateInvalid && (
              <p className="text-xs text-red-400 mt-2">
                Tanggal ini belum tersedia di jadwal HR (WorkDay), jadi belum bisa diajukan.
              </p>
            )}
            {shouldHideLateForm && (
              <p className="text-xs text-red-400 mt-2">Pengajuan untuk tanggal ini sudah ada</p>
            )}
          </div>

          {!shouldHideLateForm && !lateDateInvalid && (
            <>
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">
                  Alasan (min 10 karakter)
                </label>
                <textarea
                  value={lateReason}
                  onChange={(e) => setLateReason(e.target.value)}
                  rows={3}
                  placeholder="Jelaskan alasan terlambat melakukan presensi..."
                  className="w-full px-4 py-3 bg-slate-800/50 border border-slate-700 rounded-2xl text-white placeholder-slate-500 focus:ring-2 focus:ring-yellow-500 focus:border-yellow-500 backdrop-blur-sm"
                />
                {lateReason.length > 0 && lateReason.length < 10 && (
                  <p className="text-xs text-red-400 mt-2">
                    Minimal 10 karakter ({lateReason.length}/10)
                  </p>
                )}
              </div>
              <div className="flex gap-3">
                <motion.button
                  onClick={handleSubmitLateAttendance}
                  disabled={submittingLate || !lateDate || lateReason.trim().length < 10}
                  whileHover={{ scale: submittingLate || !lateDate || lateReason.trim().length < 10 ? 1 : 1.05 }}
                  whileTap={{ scale: submittingLate || !lateDate || lateReason.trim().length < 10 ? 1 : 0.95 }}
                  className="flex-1 bg-gradient-to-r from-yellow-600 to-yellow-700 hover:from-yellow-700 hover:to-yellow-800 disabled:from-slate-700 disabled:to-slate-800 text-white font-semibold py-3 px-4 rounded-2xl transition-all text-sm shadow-lg"
                >
                  {submittingLate ? "Mengirim..." : "Ajukan"}
                </motion.button>
                <motion.button
                  onClick={() => { setShowLateForm(false); setLateDate(""); setLateReason(""); }}
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  className="px-4 py-3 bg-slate-800/50 border border-slate-700 rounded-2xl text-sm text-slate-300 hover:bg-slate-700/70 transition-all"
                >
                  Batal
                </motion.button>
              </div>
            </>
          )}

          {shouldHideLateForm && (
            <motion.button
              onClick={() => { setShowLateForm(false); setLateDate(""); setLateReason(""); }}
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              className="w-full px-4 py-3 bg-slate-800/50 border border-slate-700 rounded-2xl text-sm text-slate-300 hover:bg-slate-700/70 transition-all"
            >
              Batal
            </motion.button>
          )}
        </div>
      )}
    </div>
  );

  const renderAbsenceRequestForm = () => (
    <div className="p-6 bg-slate-900/80 backdrop-blur-xl rounded-3xl shadow-2xl border border-indigo-500/30">
      <p className="text-sm text-slate-300 mb-4">
        Ajukan izin, cuti, atau sakit untuk rentang tanggal tertentu. Approval Manager HR akan otomatis membuat data presensi.
      </p>
      {!showAbsenceForm ? (
        <motion.button
          onClick={() => setShowAbsenceForm(true)}
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          className="text-sm text-indigo-400 hover:text-indigo-300 font-medium underline transition-colors"
        >
          Ajukan Izin / Cuti / Sakit
        </motion.button>
      ) : (
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-2">Jenis</label>
            <select
              value={absenceType}
              onChange={(e) => setAbsenceType(e.target.value)}
              className="w-full px-4 py-3 bg-slate-800/50 border border-slate-700 rounded-2xl text-white focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
            >
              <option value="permission">Izin</option>
              <option value="leave">Cuti</option>
              <option value="sick">Sakit</option>
            </select>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">Tanggal Mulai</label>
              <input
                type="date"
                value={absenceStartDate}
                onChange={(e) => setAbsenceStartDate(e.target.value)}
                className="w-full px-4 py-3 bg-slate-800/50 border border-slate-700 rounded-2xl text-white"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">Tanggal Akhir</label>
              <input
                type="date"
                value={absenceEndDate}
                onChange={(e) => setAbsenceEndDate(e.target.value)}
                className="w-full px-4 py-3 bg-slate-800/50 border border-slate-700 rounded-2xl text-white"
              />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-2">Alasan</label>
            <textarea
              value={absenceReason}
              onChange={(e) => setAbsenceReason(e.target.value)}
              rows={3}
              className="w-full px-4 py-3 bg-slate-800/50 border border-slate-700 rounded-2xl text-white placeholder-slate-500"
              placeholder="Jelaskan alasan izin/cuti/sakit..."
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-2">Lampiran (opsional - gambar/pdf)</label>
            <input
              type="file"
              accept="image/*,application/pdf"
              onChange={(e) => {
                const file = e.target.files?.[0] || null;
                if (!file) {
                  setAbsenceAttachmentFile(null);
                  setAbsenceAttachmentPreview("");
                  return;
                }
                if (file.size > 5 * 1024 * 1024) {
                  toast.error("Ukuran file maksimal 5MB");
                  e.target.value = "";
                  return;
                }
                setAbsenceAttachmentFile(file);
                if (file.type.startsWith("image/")) {
                  setAbsenceAttachmentPreview(URL.createObjectURL(file));
                } else {
                  setAbsenceAttachmentPreview("");
                }
              }}
              className="w-full px-4 py-3 bg-slate-800/50 border border-slate-700 rounded-2xl text-white file:mr-3 file:px-3 file:py-1.5 file:rounded-lg file:border-0 file:bg-indigo-600 file:text-white"
            />
            {absenceAttachmentFile && (
              <p className="text-xs text-slate-400 mt-2">
                File: {absenceAttachmentFile.name} ({Math.round(absenceAttachmentFile.size / 1024)} KB)
              </p>
            )}
            {absenceAttachmentPreview && (
              <img
                src={absenceAttachmentPreview}
                alt="Preview lampiran absence"
                className="mt-3 max-h-48 rounded-xl border border-slate-700 object-contain"
              />
            )}
          </div>
          <div className="flex gap-3">
            <motion.button
              onClick={handleSubmitAbsenceRequest}
              disabled={submittingAbsence || uploadingAbsenceAttachment}
              whileHover={{ scale: submittingAbsence || uploadingAbsenceAttachment ? 1 : 1.05 }}
              whileTap={{ scale: submittingAbsence || uploadingAbsenceAttachment ? 1 : 0.95 }}
              className="flex-1 bg-gradient-to-r from-indigo-600 to-purple-700 hover:from-indigo-700 hover:to-purple-800 disabled:from-slate-700 disabled:to-slate-800 text-white font-semibold py-3 px-4 rounded-2xl transition-all text-sm shadow-lg"
            >
              {uploadingAbsenceAttachment ? "Upload lampiran..." : submittingAbsence ? "Mengirim..." : "Ajukan"}
            </motion.button>
            <motion.button
              onClick={() => {
                setShowAbsenceForm(false);
                setAbsenceType("permission");
                setAbsenceStartDate("");
                setAbsenceEndDate("");
                setAbsenceReason("");
                setAbsenceAttachmentFile(null);
                setAbsenceAttachmentPreview("");
              }}
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              className="px-4 py-3 bg-slate-800/50 border border-slate-700 rounded-2xl text-sm text-slate-300 hover:bg-slate-700/70 transition-all"
            >
              Batal
            </motion.button>
          </div>
        </div>
      )}
    </div>
  );

  // ─── Reusable: My Late Requests List ───
  const LateRequestsList = () => (
    <div className="bg-slate-900/80 backdrop-blur-xl rounded-3xl shadow-2xl border border-blue-900/50 p-6">
      <h3 className="font-semibold text-white mb-4 text-lg">Pengajuan Presensi Terlambat Saya</h3>
      {loadingLateRequests ? (
        <div className="text-sm text-slate-400">Memuat...</div>
      ) : lateRequests.length === 0 ? (
        <div className="text-sm text-slate-400">Belum ada pengajuan.</div>
      ) : (
        <div className="space-y-3">
          {lateRequests.map((r) => (
            <motion.div
              key={r._id}
              whileHover={{ x: 5 }}
              className="flex items-center justify-between gap-3 p-4 bg-slate-800/50 border border-slate-700 rounded-xl"
            >
              <div className="flex-1">
                <div className="text-sm font-medium text-white">
                  {new Date(r.date).toLocaleDateString("id-ID")}
                </div>
                <div className="text-xs text-slate-400 mt-1">Alasan: {r.late_reason}</div>
              </div>
              <div className="flex items-center gap-2">
                <span
                  className={`text-xs px-3 py-1 rounded-full whitespace-nowrap font-medium ${
                    r.status === "filled"
                      ? "bg-blue-500/20 text-blue-400 border border-blue-500/30"
                      : r.status === "approved"
                      ? "bg-green-500/20 text-green-400 border border-green-500/30"
                      : r.status === "rejected"
                      ? "bg-red-500/20 text-red-400 border border-red-500/30"
                      : "bg-yellow-500/20 text-yellow-400 border border-yellow-500/30"
                  }`}
                >
                  {r.status === "filled"
                    ? "Filled"
                    : r.status === "approved"
                    ? "Approved"
                    : r.status === "rejected"
                    ? "Rejected"
                    : "Pending"}
                </span>

                {r.status === "approved" && (
                  <motion.button
                    onClick={() => handleOpenLateModal(r)}
                    disabled={submittingLateAttendance}
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    className="text-xs bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 disabled:from-slate-700 disabled:to-slate-800 text-white px-3 py-1.5 rounded-lg whitespace-nowrap shadow-lg transition-all"
                  >
                    Buat Presensi
                  </motion.button>
                )}

                {r.status === "filled" && (
                  <span className="text-xs text-green-400 font-medium">✓ Selesai</span>
                )}
              </div>
            </motion.div>
          ))}
        </div>
      )}
    </div>
  );

  const AbsenceRequestsList = () => (
    <div className="bg-slate-900/80 backdrop-blur-xl rounded-3xl shadow-2xl border border-indigo-900/50 p-6">
      <h3 className="font-semibold text-white mb-4 text-lg">Pengajuan Izin/Cuti/Sakit Saya</h3>
      {loadingAbsenceRequests ? (
        <div className="text-sm text-slate-400">Memuat...</div>
      ) : absenceRequests.length === 0 ? (
        <div className="text-sm text-slate-400">Belum ada pengajuan.</div>
      ) : (
        <div className="space-y-3">
          {absenceRequests.map((r) => (
            <div key={r._id} className="p-4 bg-slate-800/50 border border-slate-700 rounded-xl">
              <div className="text-sm font-medium text-white">
                {(r.type || "-").toUpperCase()} • {new Date(r.start_date).toLocaleDateString("id-ID")} - {new Date(r.end_date).toLocaleDateString("id-ID")}
              </div>
              <div className="text-xs text-slate-400 mt-1">Alasan: {r.reason || "-"}</div>
              {r.status === "rejected" && r.rejected_reason && (
                <div className="text-xs text-red-400 mt-1">Alasan Penolakan: {r.rejected_reason}</div>
              )}
              <div className="mt-2">
                <span className={`text-xs px-3 py-1 rounded-full whitespace-nowrap font-medium ${
                  r.status === "approved"
                    ? "bg-green-500/20 text-green-400 border border-green-500/30"
                    : r.status === "rejected"
                    ? "bg-red-500/20 text-red-400 border border-red-500/30"
                    : "bg-yellow-500/20 text-yellow-400 border border-yellow-500/30"
                }`}>
                  {r.status}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-950 via-blue-950 to-slate-900">
        <div className="text-slate-400">Memuat data presensi...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-blue-950 to-slate-900 p-6 relative overflow-hidden">
      {/* Animated Background */}
      <div className="absolute inset-0 overflow-hidden">
        <motion.div
          className="absolute top-20 left-20 w-72 h-72 bg-blue-600 rounded-full mix-blend-multiply filter blur-3xl opacity-20"
          animate={{ scale: [1, 1.2, 1], x: [0, 50, 0], y: [0, 30, 0] }}
          transition={{ duration: 8, repeat: Infinity, ease: "easeInOut" }}
        />
        <motion.div
          className="absolute bottom-20 right-20 w-96 h-96 bg-indigo-600 rounded-full mix-blend-multiply filter blur-3xl opacity-20"
          animate={{ scale: [1, 1.3, 1], x: [0, -50, 0], y: [0, -30, 0] }}
          transition={{ duration: 10, repeat: Infinity, ease: "easeInOut" }}
        />
      </div>

      <div className="max-w-4xl mx-auto relative z-10">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-8"
        >
          <h1 className="text-4xl font-bold bg-gradient-to-r from-blue-400 to-indigo-400 bg-clip-text text-transparent mb-2">
            Presensi Harian
          </h1>
          <p className="text-slate-400 flex items-center gap-2">
            <Calendar className="w-5 h-5" />
            <span>{formatWIBDate(nowTick)} • {formatWIBTime(nowTick)} WIB</span>
          </p>
          {workingConfig?.is_working_day === false && (
            <div className="mt-4 p-4 bg-red-500/20 border border-red-500/30 rounded-xl">
              <p className="text-red-400 font-medium flex items-center gap-2">
                <AlertCircle className="w-5 h-5" />
                Hari ini libur{workingConfig?.holiday_name ? `: ${workingConfig.holiday_name}` : ""}. Presensi tidak dapat dilakukan.
              </p>
            </div>
          )}
        </motion.div>

        {/* Monthly attendance overview */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-6 p-4 rounded-3xl bg-slate-900/70 border border-slate-800/80 backdrop-blur-xl"
        >
          <div className="flex items-center justify-between mb-3">
            <div>
              <h2 className="text-sm font-semibold text-slate-100 flex items-center gap-2">
                <Calendar className="w-4 h-4 text-blue-400" />
                Ringkasan Presensi 30 Hari Terakhir
              </h2>
              <p className="text-[11px] text-slate-500">
                Hijau: normal • Abu-abu: belum presensi • Kuning: late check-in / early check-out •
                Merah: terlambat/libur • Biru: manual • Ungu: lupa • Gelap: belum diset HR
              </p>
            </div>
          </div>
          {loadingMonthlyDays ? (
            <div className="text-xs text-slate-400 py-2">Memuat ringkasan...</div>
          ) : (
            <AttendanceScroller
              monthlyDays={monthlyDays}
              getCalendarDayStyle={getCalendarDayStyle}
              formatWIBDate={formatWIBDate}
            />
          )}
        </motion.div>

        {/* Back button (checked-in view) */}
        {hasAttendance && viewMode === 'checked-in' && (
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="mb-6">
            <button
              onClick={() => setViewMode('main')}
              className="flex items-center gap-2 text-blue-400 hover:text-blue-300 font-medium transition-colors"
            >
              <ArrowLeft className="w-5 h-5" />
              Kembali ke Pengajuan Late Attendance
            </button>
          </motion.div>
        )}

        {/* Status Card */}
        {hasAttendance && viewMode === 'checked-in' && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className={`mb-6 p-6 rounded-3xl backdrop-blur-xl shadow-2xl border-2 ${
              attendance.checkOut_at
                ? getAttendanceStatus(attendance.checkIn_at, attendance.checkOut_at).bgColor + ' ' + getAttendanceStatus(attendance.checkIn_at, attendance.checkOut_at).borderColor
                : getCheckInStatus(attendance.checkIn_at).bgColor + ' ' + getCheckInStatus(attendance.checkIn_at).borderColor
            } bg-opacity-80`}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                {attendance.checkOut_at ? (
                  <CheckCircle2 className={`w-8 h-8 ${getAttendanceStatus(attendance.checkIn_at, attendance.checkOut_at).color}`} />
                ) : (
                  <Clock className={`w-8 h-8 ${getCheckInStatus(attendance.checkIn_at).color}`} />
                )}
                <div>
                  <h3 className="font-semibold text-white flex items-center gap-2">
                    {attendance.checkOut_at ? "Sudah Check-out" : "Sudah Check-in"}
                    <span className={`text-sm px-3 py-1 rounded-full font-medium ${
                      attendance.checkOut_at
                        ? getAttendanceStatus(attendance.checkIn_at, attendance.checkOut_at).bgColor + ' ' + getAttendanceStatus(attendance.checkIn_at, attendance.checkOut_at).color
                        : getCheckInStatus(attendance.checkIn_at).bgColor + ' ' + getCheckInStatus(attendance.checkIn_at).color
                    }`}>
                      {attendance.checkOut_at
                        ? getAttendanceStatus(attendance.checkIn_at, attendance.checkOut_at).label
                        : getCheckInStatus(attendance.checkIn_at).label}
                    </span>
                  </h3>
                  <p className="text-sm text-slate-300 mt-1">
                    Check-in: {formatWIBTime(attendance.checkIn_at)}
                    {attendance.checkOut_at && ` • Check-out: ${formatWIBTime(attendance.checkOut_at)}`}
                  </p>
                  {attendance.status === "forget" && (
                    <div className="mt-2">
                      <span className={`inline-flex items-center gap-1 px-3 py-1 rounded-full text-sm font-medium ${attendance.approved_at ? "bg-green-100 text-green-800" : "bg-yellow-100 text-yellow-800"}`}>
                        <AlertCircle className="w-4 h-4" />
                        {attendance.approved_at ? "Disetujui" : "Menunggu Persetujuan"}
                      </span>
                      {attendance.late_reason && (
                        <p className="text-sm text-gray-600 mt-1">Alasan: {attendance.late_reason}</p>
                      )}
                    </div>
                  )}
                </div>
              </div>
              {isLocked && (
                <div className="text-sm text-slate-300 bg-slate-800/50 px-3 py-1 rounded-full border border-slate-700">
                  Terkunci
                </div>
              )}
            </div>
            <div className="mt-4 pt-4 border-t border-slate-700/50">
              <div className="flex flex-wrap gap-4 text-sm">
                <div className="flex items-center gap-2">
                  <Clock className="w-4 h-4 text-slate-400" />
                  <span className="text-slate-300">
                    Jam Kerja: {workingConfig?.check_in || "--:--"} - {workingConfig?.check_out || "--:--"}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 text-yellow-400" />
                  <span className="text-slate-300">Check-out maksimal: {workingConfig?.max_checkout || "21:00"}</span>
                </div>
              </div>
            </div>
          </motion.div>
        )}

        {/* Check-in Section */}
        {!hasAttendance && viewMode === 'main' && (
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="mb-6">
            {/* Working hours info banner */}
            <div className="mb-6 p-6 bg-slate-900/80 backdrop-blur-xl rounded-3xl shadow-2xl border border-blue-900/50">
              <div className="flex items-start gap-3">
                <AlertCircle className="w-5 h-5 text-blue-400 mt-0.5" />
                <div className="text-sm text-slate-300">
                  <p className="font-medium text-blue-400 mb-2">Informasi Jam Kerja:</p>
                  <ul className="list-disc list-inside space-y-1 text-slate-300">
                    <li>Jam mulai: <span className="font-semibold text-white">{effectiveCheckIn}</span></li>
                    <li>Jam selesai standar: <span className="font-semibold text-white">{effectiveCheckOut}</span></li>
                    <li>Check-out maksimal: <span className="font-semibold text-white">{effectiveMaxCheckOut}</span></li>
                  </ul>
                </div>
              </div>
            </div>

            {/* Check-in deadline warning */}
            {(() => {
              const now = getWIBDate();
              const minsNow = now.getHours() * 60 + now.getMinutes();
              return minsNow >= effectiveCheckOutMinutes;
            })() && (
              <div className="mb-6 p-6 bg-red-500/20 backdrop-blur-xl rounded-3xl border border-red-500/30">
                <div className="flex items-start gap-3">
                  <AlertTriangle className="w-5 h-5 text-red-400 mt-0.5" />
                  <div className="text-sm text-red-300">
                    <p className="font-medium mb-1 text-red-400">⚠️ Waktu check-in sudah lewat!</p>
                    <p>Check-in hanya dapat dilakukan sebelum jam {effectiveCheckOut}. Silakan ajukan presensi terlambat di bawah ini.</p>
                  </div>
                </div>
              </div>
            )}

            {/* Daily Task Planner */}
            <div className="mb-6 bg-slate-900/80 backdrop-blur-xl rounded-3xl shadow-2xl border border-blue-900/50 p-6">
              <h3 className="font-semibold text-white mb-2 text-lg">Daily Task (Rencana Hari Ini)</h3>
              <p className="text-xs text-slate-400 mb-4">
                Pilih proyek yang akan dikerjakan hari ini, kemudian pilih atau tambah task
                per proyek. Minimal satu task harus dipilih sebelum check-in.
              </p>

              {loadingMasterData ? (
                <div className="text-sm text-slate-400 py-4">Memuat proyek...</div>
              ) : (
                <>
                  <div className="mb-4">
                    <label className="block text-xs font-medium text-slate-300 mb-2">Pilih Proyek</label>
                    <div className="flex gap-2">
                      <div className="flex-1">
                        <SearchSelect
                          value={projectPickerValue}
                          onChange={(v) => setProjectPickerValue(v)}
                          options={projects
                            .filter((p) => !selectedProjectsForToday.includes(p._id) && p.status === "ongoing")
                            .map((p) => ({ value: p._id, label: p.name, subLabel: `${p.code} • ${p.percentage}%` }))}
                          placeholder="Cari proyek..."
                          allLabel="Pilih proyek..."
                        />
                      </div>
                      <motion.button
                        onClick={() => {
                          if (projectPickerValue) {
                            handleSelectProjectForToday(projectPickerValue);
                            setProjectPickerValue("");
                          }
                        }}
                        whileHover={{ scale: 1.05 }}
                        whileTap={{ scale: 0.95 }}
                        className="px-4 py-3 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white rounded-2xl transition-all flex items-center gap-1 text-sm shadow-lg"
                      >
                        <Plus className="w-4 h-4" />
                        Tambah
                      </motion.button>
                    </div>
                  </div>

                  {selectedProjectsForToday.length === 0 ? (
                    <p className="text-xs text-slate-500">Belum ada proyek yang dipilih.</p>
                  ) : (
                    <div className="space-y-4">
                      {selectedProjectsForToday.map((projectId) => {
                        const proj = projects.find((p) => p._id === projectId);
                        const tasks = sortTasksByTier(projectTasksMap[projectId] || []);
                        const newTitle = newTaskTitleByProject[projectId] || "";
                        return (
                          <div key={projectId} className="border border-slate-700 rounded-2xl p-4 bg-slate-900/60">
                            <div className="flex items-center justify-between mb-2">
                              <div>
                                <div className="text-sm font-semibold text-white">{proj?.name || "Proyek"}</div>
                                <div className="text-[11px] text-slate-400">{proj?.code} • Progress: {proj?.percentage ?? 0}%</div>
                              </div>
                              <button onClick={() => handleRemoveProjectForToday(projectId)} className="text-slate-400 hover:text-red-400 text-xs flex items-center gap-1">
                                <X className="w-3 h-3" /> Hapus
                              </button>
                            </div>
                            <div className="space-y-2 mb-3">
                              {tasks.length === 0 ? (
                                <p className="text-xs text-slate-500">Belum ada task untuk proyek ini.</p>
                              ) : (
                                tasks.map((task) => {
                                  const checked = selectedTasksToday.includes(task._id);
                                  const status = task.status;
                                  const tier = task.tier || "normal";
                                  const workerName = task.user_id?.full_name || task.user_id?.email || "";
                                  const isOngoingOwned =
                                    status === "ongoing" &&
                                    String(task.user_id?._id || task.user_id || "") === String(currentUserId);
                                  const isSelectable =
                                    status === "planned" || status === "rejected" || isOngoingOwned;
                                  const isAuto = isOngoingOwned;
                                  const isRejected = status === "rejected";
                                  const blockedReason =
                                    status === "ongoing" && !isOngoingOwned
                                      ? `Sedang dikerjakan ${workerName || "orang lain"}`
                                      : status === "done"
                                      ? `Sudah selesai${workerName ? ` oleh ${workerName}` : ""}`
                                      : status === "approved"
                                      ? `Sudah disetujui${workerName ? ` (${workerName})` : ""}`
                                      : "";
                                  return (
                                    <label
                                      key={task._id}
                                      className={`flex items-center justify-between gap-2 p-2 rounded-xl border cursor-pointer ${
                                        status === "planned" ? "bg-slate-800/60 border-slate-700"
                                        : status === "ongoing" ? "bg-yellow-500/10 border-yellow-500/30"
                                        : status === "rejected" ? "bg-red-500/10 border-red-500/30"
                                        : "bg-slate-800/60 border-slate-700"
                                      }`}
                                    >
                                      <div className="flex items-center gap-2">
                                        <input
                                          type="checkbox"
                                          checked={checked}
                                          disabled={!isSelectable && !isAuto}
                                          onChange={() => { if (!isSelectable) return; handleToggleTaskForToday(task._id); }}
                                          className="rounded border-slate-600 bg-slate-900 text-blue-500 focus:ring-blue-500"
                                        />
                                        <div>
                                          <div className="text-xs text-slate-200 font-medium flex items-center gap-2 flex-wrap">
                                            <span>{task.title}</span>
                                            <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${tierBadgeClass(tier)}`}>
                                              {tierLabel(tier)}
                                            </span>
                                          </div>
                                          <div className="text-[10px] text-slate-500">
                                            Bobot jam: {task.hour_weight} • Status: {status}
                                            {isRejected && workerName ? ` • Ditolak dari: ${workerName}` : ""}
                                            {isAuto ? " • (Auto)" : ""}
                                            {blockedReason ? ` • ${blockedReason}` : ""}
                                            {task.note ? ` • Note: ${task.note}` : ""}
                                          </div>
                                        </div>
                                      </div>
                                    </label>
                                  );
                                })
                              )}
                            </div>
                            <div className="flex flex-col md:flex-row gap-2">
                              <input
                                type="text"
                                value={newTitle}
                                onChange={(e) => handleNewTaskTitleChange(projectId, e.target.value)}
                                onKeyDown={(e) => { if (e.key === "Enter") handleAddProjectTask(projectId); }}
                                placeholder="Tambah task baru untuk proyek ini..."
                                className="flex-1 px-3 py-2 bg-slate-800/60 border border-slate-700 rounded-xl text-xs text-white placeholder-slate-500 focus:ring-2 focus:ring-blue-500"
                              />
                              <input
                                type="number" min={0.25} step={0.25}
                                value={newTaskHourByProject[projectId] ?? 1}
                                onChange={(e) => handleNewTaskHourChange(projectId, e.target.value)}
                                className="w-20 px-2 py-2 bg-slate-800/60 border border-slate-700 rounded-xl text-xs text-white focus:ring-2 focus:ring-blue-500"
                              />
                              <select
                                value={newTaskTierByProject[projectId] || "normal"}
                                onChange={(e) => handleNewTaskTierChange(projectId, e.target.value)}
                                className="w-28 px-2 py-2 bg-slate-800/60 border border-slate-700 rounded-xl text-xs text-white focus:ring-2 focus:ring-blue-500"
                              >
                                {TASK_TIER_OPTIONS.map((opt) => (
                                  <option key={opt.value} value={opt.value}>
                                    {opt.label}
                                  </option>
                                ))}
                              </select>
                              <input
                                type="text"
                                value={newTaskNoteByProject[projectId] || ""}
                                onChange={(e) => handleNewTaskNoteChange(projectId, e.target.value)}
                                placeholder="Note (opsional)"
                                className="flex-1 px-3 py-2 bg-slate-800/60 border border-slate-700 rounded-xl text-xs text-white placeholder-slate-500 focus:ring-2 focus:ring-blue-500"
                              />
                              <motion.button
                                onClick={() => handleAddProjectTask(projectId)}
                                disabled={creatingTaskProjectId === projectId || !newTitle.trim()}
                                whileHover={{ scale: 1.02 }}
                                whileTap={{ scale: 0.98 }}
                                className="px-3 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-slate-700 text-white rounded-xl text-xs flex items-center gap-1"
                              >
                                <Plus className="w-3 h-3" />
                                {creatingTaskProjectId === projectId ? "..." : "Tambah"}
                              </motion.button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </>
              )}
            </div>

            {workingConfig?.is_working_day !== false && (
              <motion.button
                onClick={handleCheckIn}
                disabled={
                  checkingIn ||
                  selectedTasksToday.length === 0 ||
                  isPastCheckInDeadline()
                }
                whileHover={{ scale: checkingIn || selectedTasksToday.length === 0 || isPastCheckInDeadline() ? 1 : 1.02 }}
                whileTap={{ scale: checkingIn || selectedTasksToday.length === 0 || isPastCheckInDeadline() ? 1 : 0.98 }}
                className="w-full bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 disabled:from-slate-700 disabled:to-slate-800 text-white font-semibold py-4 px-6 rounded-2xl transition-all flex items-center justify-center gap-2 shadow-lg"
              >
                <Clock className="w-5 h-5" />
                {isPastCheckInDeadline() ? `Check-in Tidak Tersedia (Lewat Jam ${effectiveCheckOut})`
                  : checkingIn ? "Memproses..."
                  : selectedTasksToday.length === 0 ? "Pilih minimal 1 task untuk check-in"
                  : "Check-in"}
              </motion.button>
            )}

            <div className="mt-6">{renderLateRequestForm()}</div>
            <div className="mt-6"><LateRequestsList /></div>
            <div className="mt-6">{renderAbsenceRequestForm()}</div>
            <div className="mt-6"><AbsenceRequestsList /></div>
          </motion.div>
        )}

        {/* Main view when already checked in */}
        {hasAttendance && viewMode === 'main' && (
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="mb-6">
            <motion.button
              onClick={() => setViewMode('checked-in')}
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              className="w-full bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white font-semibold py-4 px-6 mb-6 rounded-2xl transition-all shadow-lg"
            >
              Lihat Presensi Hari Ini
            </motion.button>
            {attendance.checkOut_at && attendanceIsToday && (
              <motion.button
                onClick={() => {
                  setCheckoutSummaryText(buildAttendanceProofText(attendance));
                  setShowCheckoutSummaryModal(true);
                }}
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                className="w-full bg-slate-800/70 hover:bg-slate-700/70 text-white font-semibold py-3 px-6 mb-6 rounded-2xl transition-all shadow-lg border border-slate-700"
              >
                Buka Bukti Presensi Hari Ini
              </motion.button>
            )}
            <div className="mb-6">{renderLateRequestForm()}</div>
            <LateRequestsList />
            <div className="mt-6">{renderAbsenceRequestForm()}</div>
            <div className="mt-6"><AbsenceRequestsList /></div>
          </motion.div>
        )}

        {/* Work Log Form (checked-in, not locked) */}
        {hasAttendance && viewMode === 'checked-in' && !isLocked && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-slate-900/80 backdrop-blur-xl rounded-3xl shadow-2xl border border-blue-900/50 p-6 mb-6"
          >
            <h2 className="text-xl font-semibold text-white mb-6 flex items-center gap-2">
              <Calendar className="w-6 h-6 text-blue-400" />
              Catatan Pekerjaan Harian
            </h2>

            {/* Atur Ulang Project & Task */}
            <div className="mb-6 border border-slate-700 rounded-2xl p-4 bg-slate-900/60">
              <h3 className="font-semibold text-white mb-2">Atur Ulang Project & Task Hari Ini</h3>
              <p className="text-xs text-slate-400 mb-4">
                Setelah check-in, Anda tetap bisa menambah/mengurangi project dan task untuk hari ini.
              </p>
              {loadingMasterData ? (
                <div className="text-sm text-slate-400 py-2">Memuat proyek...</div>
              ) : (
                <>
                  <div className="mb-4">
                    <label className="block text-xs font-medium text-slate-300 mb-2">Tambah Proyek</label>
                    <div className="flex gap-2">
                      <div className="flex-1">
                        <SearchSelect
                          value={projectPickerValue}
                          onChange={(v) => setProjectPickerValue(v)}
                          options={projects
                            .filter((p) => !selectedProjectsForToday.includes(p._id) && p.status === "ongoing")
                            .map((p) => ({ value: p._id, label: p.name, subLabel: `${p.code} • ${p.percentage}%` }))}
                          placeholder="Cari proyek..."
                          allLabel="Pilih proyek..."
                        />
                      </div>
                      <button
                        onClick={() => { if (projectPickerValue) { handleSelectProjectForToday(projectPickerValue); setProjectPickerValue(""); } }}
                        className="px-4 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-2xl transition-all text-sm"
                      >
                        Tambah
                      </button>
                    </div>
                  </div>

                  {selectedProjectsForToday.length === 0 ? (
                    <p className="text-xs text-slate-500">Belum ada proyek dipilih.</p>
                  ) : (
                    <div className="space-y-4">
                      {selectedProjectsForToday.map((projectId) => {
                        const proj = projects.find((p) => p._id === projectId);
                        const tasks = sortTasksByTier(projectTasksMap[projectId] || []);
                        const newTitle = newTaskTitleByProject[projectId] || "";
                        return (
                          <div key={projectId} className="border border-slate-700 rounded-2xl p-4 bg-slate-900/60">
                            <div className="flex items-center justify-between mb-2">
                              <div>
                                <div className="text-sm font-semibold text-white">{proj?.name || "Proyek"}</div>
                                <div className="text-[11px] text-slate-400">{proj?.code} • Progress: {proj?.percentage ?? 0}%</div>
                              </div>
                              <button onClick={() => handleRemoveProjectForToday(projectId)} className="text-slate-400 hover:text-red-400 text-xs flex items-center gap-1">
                                <X className="w-3 h-3" /> Hapus
                              </button>
                            </div>
                            <div className="space-y-2 mb-3">
                              {tasks.length === 0 ? (
                                <p className="text-xs text-slate-500">Belum ada task.</p>
                              ) : (
                                tasks.map((task) => {
                                  const checked = selectedTasksToday.includes(task._id);
                                  const status = task.status;
                                  const tier = task.tier || "normal";
                                  const workerName = task.user_id?.full_name || task.user_id?.email || "";
                                  const isRejected = status === "rejected";
                                  const isOngoingOwned = status === "ongoing" && String(task.user_id?._id || task.user_id || "") === String(currentUserId);
                                  const isSelectable = status === "planned" || status === "rejected" || isOngoingOwned;
                                  const blockedReason =
                                    status === "ongoing" && !isOngoingOwned
                                      ? `Sedang dikerjakan ${workerName || "orang lain"}`
                                      : status === "done"
                                      ? `Sudah selesai${workerName ? ` oleh ${workerName}` : ""}`
                                      : status === "approved"
                                      ? `Sudah disetujui${workerName ? ` (${workerName})` : ""}`
                                      : "";
                                  return (
                                    <label
                                      key={task._id}
                                      className={`flex items-center justify-between gap-2 p-2 rounded-xl border ${
                                        status === "planned" ? "bg-slate-800/60 border-slate-700"
                                        : status === "ongoing" ? "bg-yellow-500/10 border-yellow-500/30"
                                        : status === "rejected" ? "bg-red-500/10 border-red-500/30"
                                        : "bg-slate-800/60 border-slate-700"
                                      }`}
                                    >
                                      <div className="flex items-center gap-2">
                                        <input
                                          type="checkbox"
                                          checked={checked}
                                          disabled={!isSelectable}
                                          onChange={() => { if (!isSelectable) return; handleToggleTaskForToday(task._id); }}
                                          className="rounded border-slate-600 bg-slate-900 text-blue-500 focus:ring-blue-500"
                                        />
                                        <div>
                                          <div className="text-xs text-slate-200 font-medium flex items-center gap-2 flex-wrap">
                                            <span>{task.title}</span>
                                            <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${tierBadgeClass(tier)}`}>
                                              {tierLabel(tier)}
                                            </span>
                                          </div>
                                          <div className="text-[10px] text-slate-500">
                                            Bobot jam: {task.hour_weight} • Status: {status}
                                            {isRejected && workerName ? ` • Ditolak dari: ${workerName}` : ""}
                                            {blockedReason ? ` • ${blockedReason}` : ""}
                                            {task.note ? ` • Note: ${task.note}` : ""}
                                          </div>
                                        </div>
                                      </div>
                                    </label>
                                  );
                                })
                              )}
                            </div>
                            <div className="flex flex-col md:flex-row gap-2">
                              <input
                                type="text" value={newTitle}
                                onChange={(e) => handleNewTaskTitleChange(projectId, e.target.value)}
                                onKeyDown={(e) => { if (e.key === "Enter") handleAddProjectTask(projectId); }}
                                placeholder="Tambah task baru..."
                                className="flex-1 px-3 py-2 bg-slate-800/60 border border-slate-700 rounded-xl text-xs text-white placeholder-slate-500 focus:ring-2 focus:ring-blue-500"
                              />
                              <input
                                type="number" min={0.25} step={0.25}
                                value={newTaskHourByProject[projectId] ?? 1}
                                onChange={(e) => handleNewTaskHourChange(projectId, e.target.value)}
                                className="w-20 px-2 py-2 bg-slate-800/60 border border-slate-700 rounded-xl text-xs text-white focus:ring-2 focus:ring-blue-500"
                              />
                              <select
                                value={newTaskTierByProject[projectId] || "normal"}
                                onChange={(e) => handleNewTaskTierChange(projectId, e.target.value)}
                                className="w-28 px-2 py-2 bg-slate-800/60 border border-slate-700 rounded-xl text-xs text-white focus:ring-2 focus:ring-blue-500"
                              >
                                {TASK_TIER_OPTIONS.map((opt) => (
                                  <option key={opt.value} value={opt.value}>
                                    {opt.label}
                                  </option>
                                ))}
                              </select>
                              <input
                                type="text"
                                value={newTaskNoteByProject[projectId] || ""}
                                onChange={(e) => handleNewTaskNoteChange(projectId, e.target.value)}
                                placeholder="Note (opsional)"
                                className="flex-1 px-3 py-2 bg-slate-800/60 border border-slate-700 rounded-xl text-xs text-white placeholder-slate-500 focus:ring-2 focus:ring-blue-500"
                              />
                              <button
                                onClick={() => handleAddProjectTask(projectId)}
                                disabled={creatingTaskProjectId === projectId || !newTitle.trim()}
                                className="px-3 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-slate-700 text-white rounded-xl text-xs"
                              >
                                {creatingTaskProjectId === projectId ? "..." : "Tambah"}
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}

                  <button
                    onClick={handleSavePlanAfterCheckIn}
                    disabled={savingPlanAfterCheckIn || selectedTasksToday.length === 0}
                    className="mt-4 w-full bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-700 text-white font-medium py-3 rounded-xl"
                  >
                    {savingPlanAfterCheckIn ? "Menyimpan..." : "Simpan Perubahan Project & Task"}
                  </button>
                </>
              )}
            </div>

            {/* Tasks Today - centang done/ongoing */}
            <div className="mb-6">
              <label className="block text-sm font-medium text-slate-300 mb-3">
                Task Hari Ini (centang jika sudah selesai)
              </label>
              <div className="space-y-4">
                {(attendance?.tasks_today || []).map((task) => {
                  const status = checkoutTaskStatuses[task._id] || task.status || "ongoing";
                  const done = status === "done";
                  return (
                    <div key={task._id} className="p-4 bg-slate-800/50 rounded-xl border border-slate-700">
                      <div className="flex items-center justify-between gap-2 mb-2">
                        <div className="flex items-center gap-2">
                          <input
                            type="checkbox"
                            checked={done}
                            onChange={() => handleToggleTaskStatusForCheckout(task._id)}
                            className="rounded border-slate-600 bg-slate-900 text-blue-500 focus:ring-blue-500"
                          />
                          <div>
                            <div className="text-sm font-medium text-slate-200">{task.title}</div>
                            {task.note && (
                              <div className="text-[11px] text-slate-400 mt-0.5">
                                Note: {task.note}
                              </div>
                            )}
                          </div>
                        </div>
                        <span className="text-xs text-slate-400 tabular-nums">
                          {done ? "Done" : "On-going"}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Activities */}
            <div className="mb-6">
              <label className="block text-sm font-medium text-slate-300 mb-3">Aktivitas</label>
              {loadingMasterData ? (
                <div className="text-sm text-slate-400">Memuat aktivitas...</div>
              ) : (
                <div className="grid grid-cols-2 gap-2 max-h-40 overflow-y-auto border border-slate-700 rounded-xl p-3 bg-slate-800/30">
                  {activities.map((activity) => (
                    <label key={activity._id} className="flex items-center gap-2 p-2 hover:bg-slate-700/50 rounded-lg cursor-pointer transition-colors">
                      <input
                        type="checkbox"
                        checked={selectedActivities.includes(activity._id)}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setSelectedActivities([...selectedActivities, activity._id]);
                          } else {
                            setSelectedActivities(selectedActivities.filter((id) => id !== activity._id));
                          }
                        }}
                        className="rounded border-slate-600 bg-slate-800/50 text-blue-600 focus:ring-blue-500"
                      />
                      <span className="text-sm text-slate-200">{activity.name_activity}</span>
                    </label>
                  ))}
                </div>
              )}
            </div>

            {/* Proyek (otomatis dari task) */}
            <div className="mb-6">
              <label className="block text-sm font-medium text-slate-300 mb-3">Proyek Hari Ini</label>
              <div className="border border-slate-700 rounded-xl p-4 space-y-2 bg-slate-800/30">
                {selectedProjectsForToday.length === 0 ? (
                  <p className="text-sm text-slate-400">Belum ada proyek terpilih</p>
                ) : (
                  <div className="flex flex-wrap gap-2">
                    {selectedProjectsForToday.map((id) => {
                      const proj = projects.find((p) => p._id === id);
                      if (!proj) return null;
                      return (
                        <span key={id} className="px-3 py-1.5 bg-green-500/20 text-green-400 border border-green-500/30 rounded-full text-sm font-medium">
                          {proj.name} ({proj.percentage}%)
                        </span>
                      );
                    })}
                  </div>
                )}
                <p className="text-[11px] text-slate-500">
                  Progress proyek dihitung otomatis dari akumulasi bobot jam task yang disetujui.
                </p>
              </div>
            </div>

            {/* Note */}
            <div className="mb-6">
              <label className="block text-sm font-medium text-slate-300 mb-3">Catatan</label>
              <textarea
                value={note}
                onChange={(e) => setNote(e.target.value)}
                rows={3}
                placeholder="Catatan tambahan..."
                className="w-full px-4 py-3 bg-slate-800/50 border border-slate-700 rounded-2xl text-white placeholder-slate-500 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 backdrop-blur-sm"
              />
            </div>

            <motion.button
              onClick={handleUpdateWork}
              disabled={updating}
              whileHover={{ scale: updating ? 1 : 1.02 }}
              whileTap={{ scale: updating ? 1 : 0.98 }}
              className="w-full bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 disabled:from-slate-700 disabled:to-slate-800 text-white font-semibold py-4 px-6 rounded-2xl transition-all shadow-lg"
            >
              {updating ? "Menyimpan..." : "Simpan Perubahan"}
            </motion.button>
          </motion.div>
        )}

        {/* Locked View (Read-only) */}
        {hasAttendance && isLocked && viewMode === 'checked-in' && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-slate-900/80 backdrop-blur-xl rounded-3xl shadow-2xl border border-blue-900/50 p-6 mb-6"
          >
            <h2 className="text-xl font-semibold text-white mb-6 flex items-center gap-2">
              <Calendar className="w-6 h-6 text-blue-400" />
              Catatan Pekerjaan Harian
            </h2>
            {attendance.checkOut_at && attendanceIsToday && (
              <div className="mb-4">
                <motion.button
                  onClick={() => {
                    setCheckoutSummaryText(buildAttendanceProofText(attendance));
                    setShowCheckoutSummaryModal(true);
                  }}
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-semibold py-3 px-4 rounded-2xl transition-all flex items-center justify-center gap-2 shadow-lg"
                >
                  Lihat Bukti Presensi Hari Ini
                </motion.button>
              </div>
            )}
            <div className="space-y-6">
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-3">Task Hari Ini</label>
                {attendance.tasks_today?.length > 0 ? (
                  <ul className="space-y-2">
                    {attendance.tasks_today.map((task) => (
                      <li key={task._id || task} className="flex items-center justify-between p-3 bg-slate-800/50 rounded-xl border border-slate-700">
                        <span className="text-slate-200">{typeof task === "object" ? task.title : task}</span>
                        <span className="text-slate-400 text-sm tabular-nums">
                          {typeof task === "object" ? (task.status ?? "tidak ada status") : "tidak ada status"}
                        </span>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-sm text-slate-400">Tidak ada task</p>
                )}
              </div>
              {attendance.activities?.length > 0 && (
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-3">Aktivitas</label>
                  <div className="flex flex-wrap gap-2">
                    {attendance.activities.map((activity) => (
                      <span key={activity._id || activity} className="px-3 py-1.5 bg-blue-500/20 text-blue-400 border border-blue-500/30 rounded-full text-sm font-medium">
                        {activity.name_activity || activity}
                      </span>
                    ))}
                  </div>
                </div>
              )}
              {attendance.projects?.length > 0 && (
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-3">Proyek</label>
                  <div className="flex flex-wrap gap-2">
                    {attendance.projects.map((p) => {
                      const proj = p.project_id || p;
                      return (
                        <span key={proj._id || proj} className="px-3 py-1.5 bg-green-500/20 text-green-400 border border-green-500/30 rounded-full text-sm font-medium">
                          {(proj.name || proj) + (typeof p.contribution_percentage === "number" ? ` (+${p.contribution_percentage}%)` : "")}
                        </span>
                      );
                    })}
                  </div>
                </div>
              )}
              {attendance.note && (
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-3">Catatan</label>
                  <p className="text-slate-200 whitespace-pre-wrap bg-slate-800/50 p-4 rounded-xl border border-slate-700">{attendance.note}</p>
                </div>
              )}
            </div>
          </motion.div>
        )}

        {/* Check-out Button */}
        {hasAttendance && !attendance.checkOut_at && viewMode === 'checked-in' && (
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="mb-6">
            {!canCheckOutNow() && (
              <div className="mb-4 p-4 bg-red-500/20 backdrop-blur-xl border border-red-500/30 rounded-3xl flex items-start gap-3">
                <AlertTriangle className="w-5 h-5 text-red-400 mt-0.5" />
                <p className="text-sm text-red-300">
                  Waktu checkout sudah lewat dari jam 21:00. Silakan hubungi HR untuk penanganan lebih lanjut.
                </p>
              </div>
            )}
            <motion.button
              onClick={handleCheckOut}
              disabled={!canCheckOut || checkingOut || isLocked}
              whileHover={{ scale: (!canCheckOut || checkingOut || isLocked) ? 1 : 1.02 }}
              whileTap={{ scale: (!canCheckOut || checkingOut || isLocked) ? 1 : 0.98 }}
              className={`w-full font-semibold py-4 px-6 rounded-2xl transition-all flex items-center justify-center gap-2 shadow-lg ${
                canCheckOut && !isLocked
                  ? "bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700 text-white"
                  : "bg-slate-700 text-slate-500 cursor-not-allowed"
              }`}
            >
              <XCircle className="w-5 h-5" />
              {checkingOut ? "Memproses..."
                : !canCheckOutNow() ? "Check-out Tidak Tersedia (Lewat Jam 21:00)"
                : canCheckOut ? "Check-out"
                : "Check-out (selesaikan minimal 1 task untuk bisa check-out)"}
            </motion.button>
          </motion.div>
        )}
      </div>

      {/* ═══════════════════════════════════════════════════════════════════
          Late Attendance Creation Modal — ALIGNED WITH REGULAR ATTENDANCE
          Alur: Pilih proyek → load task per proyek → pilih/tambah task →
                tandai done/ongoing → isi aktivitas → catatan → submit
      ═══════════════════════════════════════════════════════════════════ */}
      <AnimatePresence>
        {showCheckoutSummaryModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4"
            onClick={() => setShowCheckoutSummaryModal(false)}
          >
            <motion.div
              initial={{ scale: 0.95, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.95, y: 20 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-slate-900/95 border border-blue-900/50 rounded-3xl shadow-2xl max-w-2xl w-full"
            >
              <div className="p-6 border-b border-slate-700 flex items-center justify-between">
                <h3 className="text-xl font-bold text-white">Bukti Presensi Hari Ini</h3>
                <button
                  className="p-2 rounded-lg hover:bg-slate-800 text-slate-300"
                  onClick={() => setShowCheckoutSummaryModal(false)}
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
              <div className="p-6">
                <pre className="whitespace-pre-wrap text-xs text-slate-200 bg-slate-950/60 border border-slate-800 rounded-2xl p-4 max-h-[50vh] overflow-auto">
                  {checkoutSummaryText}
                </pre>
                <div className="mt-4 flex gap-3">
                  <button
                    onClick={async () => {
                      try {
                        await navigator.clipboard.writeText(checkoutSummaryText);
                        toast.success("Bukti presensi berhasil disalin");
                      } catch (_e) {
                        toast.error("Gagal menyalin bukti presensi");
                      }
                    }}
                    className="flex-1 px-4 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-2xl text-sm font-semibold flex items-center justify-center gap-2"
                  >
                    <ClipboardCopy className="w-4 h-4" />
                    Copy ke Clipboard
                  </button>
                  <button
                    onClick={() => setShowCheckoutSummaryModal(false)}
                    className="px-4 py-3 border border-slate-700 text-slate-300 hover:bg-slate-800 rounded-2xl text-sm"
                  >
                    Tutup
                  </button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
        {showLateModal && editingLateRequest && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4"
            onClick={() => { if (!submittingLateAttendance) { setShowLateModal(false); setEditingLateRequest(null); } }}
          >
            <motion.div
              initial={{ scale: 0.9, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.9, y: 20 }}
              className="bg-slate-900/95 backdrop-blur-2xl rounded-3xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto border border-blue-900/50"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Modal Header */}
              <div className="sticky top-0 bg-slate-900/95 backdrop-blur-xl border-b border-slate-700 px-6 py-4 flex items-center justify-between z-10">
                <div>
                  <h2 className="text-xl font-bold text-white">Buat Presensi Terlambat</h2>
                  <p className="text-sm text-slate-400 mt-1">
                    Tanggal: {new Date(editingLateRequest.date).toLocaleDateString("id-ID")}
                  </p>
                </div>
                <button
                  onClick={() => { if (!submittingLateAttendance) { setShowLateModal(false); setEditingLateRequest(null); } }}
                  disabled={submittingLateAttendance}
                  className="p-2 hover:bg-slate-800 rounded-lg transition-colors disabled:opacity-50 text-slate-400 hover:text-white"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Modal Body */}
              <div className="p-6 space-y-6">
                {/* Check-in & Check-out Time */}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-300 mb-2">Waktu Check-in *</label>
                    <input
                      type="time"
                      value={lateCheckInTime}
                      onChange={(e) => setLateCheckInTime(e.target.value)}
                      className="w-full px-4 py-3 bg-slate-800/50 border border-slate-700 rounded-2xl text-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-300 mb-2">Waktu Check-out *</label>
                    <input
                      type="time"
                      value={lateCheckOutTime}
                      onChange={(e) => setLateCheckOutTime(e.target.value)}
                      className="w-full px-4 py-3 bg-slate-800/50 border border-slate-700 rounded-2xl text-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    />
                  </div>
                </div>

                {/* Working hours reminder */}
                <div className="p-4 bg-blue-500/10 border border-blue-500/30 rounded-xl">
                  <div className="flex items-start gap-2">
                    <AlertCircle className="w-4 h-4 text-blue-400 mt-0.5 flex-shrink-0" />
                    <div className="text-xs text-slate-300">
                      <p className="font-medium text-blue-400 mb-1">Jam Kerja:</p>
                      <p>Check-in: {lateCheckInTime} | Check-out standar: {lateCheckOutTime} | Maksimal: {effectiveMaxCheckOut}</p>
                    </div>
                  </div>
                </div>

                {/* ── Project & Task Picker (sama dengan attendance biasa) ── */}
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-2">
                    Project & Task yang Dikerjakan *
                  </label>
                  <p className="text-xs text-slate-400 mb-3">
                    Pilih proyek lalu pilih atau tambah task yang dikerjakan pada hari tersebut.
                    Minimal satu task harus ditandai selesai (done).
                  </p>

                  {/* Picker proyek */}
                  <div className="flex gap-2 mb-3">
                    <div className="flex-1">
                      <SearchSelect
                        value={lateProjectPickerValue}
                        onChange={(v) => setLateProjectPickerValue(v)}
                        options={projects
                          .filter((p) => !lateSelectedProjects.includes(p._id) && p.status === "ongoing")
                          .map((p) => ({ value: p._id, label: p.name, subLabel: `${p.code} • ${p.percentage}%` }))}
                        placeholder="Cari proyek..."
                        allLabel="Pilih proyek..."
                      />
                    </div>
                    <motion.button
                      onClick={() => {
                        if (lateProjectPickerValue) {
                          handleLateSelectProject(lateProjectPickerValue);
                          setLateProjectPickerValue("");
                        }
                      }}
                      whileHover={{ scale: 1.05 }}
                      whileTap={{ scale: 0.95 }}
                      className="px-4 py-3 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white rounded-2xl transition-all flex items-center gap-1 text-sm shadow-lg"
                    >
                      <Plus className="w-4 h-4" />
                      Tambah
                    </motion.button>
                  </div>

                  {lateSelectedProjects.length === 0 ? (
                    <p className="text-xs text-slate-500 py-2">
                      Belum ada proyek dipilih. Pilih minimal satu proyek untuk mulai mengatur task.
                    </p>
                  ) : (
                    <div className="space-y-4">
                      {lateSelectedProjects.map((projectId) => {
                        const proj = projects.find((p) => p._id === projectId);
                        const tasks = sortTasksByTier(lateProjectTasksMap[projectId] || []);
                        const newTitle = lateNewTaskTitleByProject[projectId] || "";
                        return (
                          <div key={projectId} className="border border-slate-700 rounded-2xl p-4 bg-slate-900/60">
                            <div className="flex items-center justify-between mb-2">
                              <div>
                                <div className="text-sm font-semibold text-white">{proj?.name || "Proyek"}</div>
                                <div className="text-[11px] text-slate-400">{proj?.code} • Progress: {proj?.percentage ?? 0}%</div>
                              </div>
                              <button onClick={() => handleLateRemoveProject(projectId)} className="text-slate-400 hover:text-red-400 text-xs flex items-center gap-1">
                                <X className="w-3 h-3" /> Hapus
                              </button>
                            </div>

                            {/* Task list dengan toggle done/ongoing */}
                            <div className="space-y-2 mb-3">
                              {tasks.length === 0 ? (
                                <p className="text-xs text-slate-500">Belum ada task untuk proyek ini.</p>
                              ) : (
                                tasks.map((task) => {
                                  const selected = lateSelectedTasks.includes(task._id);
                                  const status = task.status;
                                  const tier = task.tier || "normal";
                                  const workerName = task.user_id?.full_name || task.user_id?.email || "";
                                  const isRejected = status === "rejected";
                                  const isOngoingOwned = status === "ongoing" && String(task.user_id?._id || task.user_id || "") === String(currentUserId);
                                  const isSelectable = status === "planned" || status === "rejected" || isOngoingOwned;
                                  const taskDone = (lateTaskStatuses[task._id] ?? "done") === "done";
                                  const blockedReason =
                                    status === "ongoing" && !isOngoingOwned
                                      ? `Sedang dikerjakan ${workerName || "orang lain"}`
                                      : status === "done"
                                      ? `Sudah selesai${workerName ? ` oleh ${workerName}` : ""}`
                                      : status === "approved"
                                      ? `Sudah disetujui${workerName ? ` (${workerName})` : ""}`
                                      : "";

                                  return (
                                    <div
                                      key={task._id}
                                      className={`p-3 rounded-xl border ${
                                        status === "planned" ? "bg-slate-800/60 border-slate-700"
                                        : status === "ongoing" ? "bg-yellow-500/10 border-yellow-500/30"
                                        : status === "rejected" ? "bg-red-500/10 border-red-500/30"
                                        : "bg-slate-800/60 border-slate-700"
                                      }`}
                                    >
                                      <div className="flex items-center justify-between gap-2">
                                        {/* Checkbox pilih task */}
                                        <label className="flex items-center gap-2 flex-1 cursor-pointer">
                                          <input
                                            type="checkbox"
                                            checked={selected}
                                            disabled={!isSelectable}
                                            onChange={() => { if (isSelectable) handleLateToggleTask(task._id); }}
                                            className="rounded border-slate-600 bg-slate-900 text-blue-500 focus:ring-blue-500"
                                          />
                                          <div>
                                            <div className="text-xs text-slate-200 font-medium flex items-center gap-2 flex-wrap">
                                              <span>{task.title}</span>
                                              <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${tierBadgeClass(tier)}`}>
                                                {tierLabel(tier)}
                                              </span>
                                            </div>
                                            <div className="text-[10px] text-slate-500">
                                              Bobot jam: {task.hour_weight} • Status: {status}
                                              {isRejected && workerName ? ` • Ditolak dari: ${workerName}` : ""}
                                              {isOngoingOwned ? " • (Milikmu)" : ""}
                                              {blockedReason ? ` • ${blockedReason}` : ""}
                                              {task.note ? ` • Note: ${task.note}` : ""}
                                            </div>
                                          </div>
                                        </label>

                                        {/* Toggle done/ongoing — hanya tampil jika task dipilih */}
                                        {selected && (
                                          <button
                                            onClick={() => handleLateToggleTaskStatus(task._id)}
                                            className={`flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-medium transition-all ${
                                              taskDone
                                                ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 hover:bg-emerald-500/30"
                                                : "bg-slate-700/60 text-slate-400 border border-slate-600 hover:bg-slate-700"
                                            }`}
                                          >
                                            {taskDone ? (
                                              <><CheckCircle2 className="w-3 h-3" /> Done</>
                                            ) : (
                                              <><Clock className="w-3 h-3" /> On-going</>
                                            )}
                                          </button>
                                        )}
                                      </div>
                                    </div>
                                  );
                                })
                              )}
                            </div>

                            {/* Tambah task baru */}
                            <div className="flex flex-col md:flex-row gap-2">
                              <input
                                type="text"
                                value={newTitle}
                                onChange={(e) => handleLateNewTaskTitleChange(projectId, e.target.value)}
                                onKeyDown={(e) => { if (e.key === "Enter") handleLateAddProjectTask(projectId); }}
                                placeholder="Tambah task baru untuk proyek ini..."
                                className="flex-1 px-3 py-2 bg-slate-800/60 border border-slate-700 rounded-xl text-xs text-white placeholder-slate-500 focus:ring-2 focus:ring-blue-500"
                              />
                              <input
                                type="number" min={0.25} step={0.25}
                                value={lateNewTaskHourByProject[projectId] ?? 1}
                                onChange={(e) => handleLateNewTaskHourChange(projectId, e.target.value)}
                                className="w-10 px-2 py-2 bg-slate-800/60 border border-slate-700 rounded-xl text-xs text-white focus:ring-2 focus:ring-blue-500"
                              />
                              <select
                                value={lateNewTaskTierByProject[projectId] || "normal"}
                                onChange={(e) => handleLateNewTaskTierChange(projectId, e.target.value)}
                                className="w-28 px-2 py-2 bg-slate-800/60 border border-slate-700 rounded-xl text-xs text-white focus:ring-2 focus:ring-blue-500"
                              >
                                {TASK_TIER_OPTIONS.map((opt) => (
                                  <option key={opt.value} value={opt.value}>
                                    {opt.label}
                                  </option>
                                ))}
                              </select>
                              <input
                                type="text"
                                value={lateNewTaskNoteByProject[projectId] || ""}
                                onChange={(e) => handleLateNewTaskNoteChange(projectId, e.target.value)}
                                placeholder="Note (opsional)"
                                className="flex-1 px-2 py-2 bg-slate-800/60 border border-slate-700 rounded-xl text-xs text-white placeholder-slate-500 focus:ring-2 focus:ring-blue-500"
                              />
                              <motion.button
                                onClick={() => handleLateAddProjectTask(projectId)}
                                disabled={lateCreatingTaskProjectId === projectId || !newTitle.trim()}
                                whileHover={{ scale: 1.02 }}
                                whileTap={{ scale: 0.98 }}
                                className="px-3 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-slate-700 text-white rounded-xl text-xs flex items-center gap-1"
                              >
                                <Plus className="w-3 h-3" />
                                {lateCreatingTaskProjectId === projectId ? "..." : "Tambah"}
                              </motion.button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}

                  {/* Summary: proyek yang terlibat (otomatis) */}
                  {lateSelectedProjects.length > 0 && (
                    <div className="mt-3 p-3 bg-slate-800/40 border border-slate-700 rounded-xl">
                      <p className="text-[11px] text-slate-400 mb-2 font-medium">Proyek yang terlibat (otomatis dari task):</p>
                      <div className="flex flex-wrap gap-2">
                        {lateSelectedProjects.map((id) => {
                          const proj = projects.find((p) => p._id === id);
                          if (!proj) return null;
                          return (
                            <span key={id} className="px-3 py-1 bg-green-500/20 text-green-400 border border-green-500/30 rounded-full text-xs font-medium">
                              {proj.name} ({proj.percentage}%)
                            </span>
                          );
                        })}
                      </div>
                      <p className="text-[10px] text-slate-500 mt-2">
                        Progress dihitung otomatis dari bobot jam task yang disetujui.
                      </p>
                    </div>
                  )}
                </div>

                {/* Aktivitas */}
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-2">Aktivitas (Opsional)</label>
                  {loadingMasterData ? (
                    <div className="text-sm text-slate-400">Memuat aktivitas...</div>
                  ) : (
                    <div className="grid grid-cols-2 gap-2 max-h-40 overflow-y-auto border border-slate-700 rounded-xl p-3 bg-slate-800/30">
                      {activities.map((activity) => (
                        <label key={activity._id} className="flex items-center gap-2 p-2 hover:bg-slate-700/50 rounded-lg cursor-pointer transition-colors">
                          <input
                            type="checkbox"
                            checked={lateSelectedActivities.includes(activity._id)}
                            onChange={(e) => {
                              if (e.target.checked) {
                                setLateSelectedActivities([...lateSelectedActivities, activity._id]);
                              } else {
                                setLateSelectedActivities(lateSelectedActivities.filter((id) => id !== activity._id));
                              }
                            }}
                            className="rounded border-slate-600 bg-slate-800/50 text-blue-600 focus:ring-blue-500"
                          />
                          <span className="text-sm text-slate-200">{activity.name_activity}</span>
                        </label>
                      ))}
                    </div>
                  )}
                </div>

                {/* Note */}
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-2">Catatan (Opsional)</label>
                  <textarea
                    value={lateNote}
                    onChange={(e) => setLateNote(e.target.value)}
                    rows={3}
                    placeholder="Catatan tambahan..."
                    className="w-full px-4 py-3 bg-slate-800/50 border border-slate-700 rounded-2xl text-white placeholder-slate-500 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>

                {/* Info note */}
                <div className="p-4 bg-yellow-500/10 border border-yellow-500/30 rounded-xl">
                  <div className="flex items-start gap-2">
                    <AlertTriangle className="w-4 h-4 text-yellow-400 mt-0.5 flex-shrink-0" />
                    <p className="text-xs text-slate-300">
                      Data akan langsung tersimpan dan terkunci setelah submit. Pastikan semua informasi sudah benar.
                    </p>
                  </div>
                </div>
              </div>

              {/* Modal Footer */}
              <div className="sticky bottom-0 bg-slate-900/95 backdrop-blur-xl border-t border-slate-700 px-6 py-4 flex gap-3 z-10">
                <button
                  onClick={() => { if (!submittingLateAttendance) { setShowLateModal(false); setEditingLateRequest(null); } }}
                  disabled={submittingLateAttendance}
                  className="flex-1 px-4 py-3 border border-slate-700 rounded-2xl text-slate-300 hover:bg-slate-800 transition-all disabled:opacity-50 text-sm"
                >
                  Batal
                </button>
                <motion.button
                  onClick={handleSubmitLateAttendanceFromModal}
                  // disabled={submittingLateAttendance || lateSelectedTasks.length === 0}
                  whileHover={{ scale: submittingLateAttendance || lateSelectedTasks.length === 0 ? 1 : 1.02 }}
                  whileTap={{ scale: submittingLateAttendance || lateSelectedTasks.length === 0 ? 1 : 0.98 }}
                  className="flex-1 px-4 py-3 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 disabled:from-slate-700 disabled:to-slate-800 text-white font-semibold rounded-2xl transition-all text-sm shadow-lg"
                >
                  {submittingLateAttendance ? "Memproses..." : lateSelectedTasks.length === 0 ? "Pilih minimal 1 task" : "Submit Presensi"}
                </motion.button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default Attendance;