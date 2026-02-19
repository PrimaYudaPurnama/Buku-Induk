import React, { useState, useEffect } from "react";
import {
  checkIn,
  checkOut,
  getTodayAttendance,
  updateDailyWork,
  requestLateAttendance,
  listMyLateAttendanceRequests,
  createLateAttendance,
  submitLateAttendance,
  fetchActivities,
  fetchProjects,
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
  AlertTriangle
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

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
const isWorkingDay = (date = new Date()) => {
  const dayOfWeek = getWIBDayOfWeek(date);
  return dayOfWeek >= 1 && dayOfWeek <= 6; // Monday (1) to Saturday (6)
};

/**
 * Get working hours for a specific date
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
 * Check if current time is past check-in deadline (16:00)
 */
const isPastCheckInDeadline = () => {
  const now = getWIBDate();
  const hour = now.getHours();
  const minute = now.getMinutes();
  const totalMinutes = hour * 60 + minute;
  const checkInDeadline = 16 * 60; // 16:00
  return totalMinutes >= checkInDeadline;
};

const Attendance = () => {
  const [attendance, setAttendance] = useState(null);
  const [loading, setLoading] = useState(true);
  const [checkingIn, setCheckingIn] = useState(false);
  const [checkingOut, setCheckingOut] = useState(false);
  const [updating, setUpdating] = useState(false);

  // View state: 'main' | 'checked-in'
  const [viewMode, setViewMode] = useState('main');

  // Late attendance requests
  const [lateRequests, setLateRequests] = useState([]);
  const [loadingLateRequests, setLoadingLateRequests] = useState(true);

  // Modal state for late attendance form
  const [showLateModal, setShowLateModal] = useState(false);
  const [editingLateRequest, setEditingLateRequest] = useState(null);
  const [submittingLateAttendance, setSubmittingLateAttendance] = useState(false);

  // Work log form state (for today's attendance only)
  const [dailyDoneItems, setDailyDoneItems] = useState([false]);
  const [selectedActivities, setSelectedActivities] = useState([]);
  const [selectedProjects, setSelectedProjects] = useState([]);
  const [note, setNote] = useState("");
  const [projectContributions, setProjectContributions] = useState({});

  // Dynamic daily target list (editable before check-in)
  const [dailyTargets, setDailyTargets] = useState([]);
  const [newTargetInput, setNewTargetInput] = useState("");

  // Late attendance form state
  const [showLateForm, setShowLateForm] = useState(false);
  const [lateDate, setLateDate] = useState("");
  const [lateReason, setLateReason] = useState("");
  const [submittingLate, setSubmittingLate] = useState(false);

  // Late attendance creation form (for modal)
  const [lateCheckInTime, setLateCheckInTime] = useState("08:00");
  const [lateCheckOutTime, setLateCheckOutTime] = useState("17:00");
  const [lateDailyDone, setLateDailyDone] = useState([""]);
  const [lateSelectedActivities, setLateSelectedActivities] = useState([]);
  const [lateSelectedProjects, setLateSelectedProjects] = useState([]);
  const [lateProjectContributions, setLateProjectContributions] = useState({});
  const [lateNote, setLateNote] = useState("");

  // Master data
  const [activities, setActivities] = useState([]);
  const [projects, setProjects] = useState([]);
  const [loadingMasterData, setLoadingMasterData] = useState(true);

  // Load today's attendance and master data
  useEffect(() => {
    loadTodayAttendance();
    loadMasterData();
    loadMyLateRequests();
  }, []);

  // Sync form state with attendance data (TODAY ONLY)
  useEffect(() => {
    if (attendance) {
      const targets = attendance.daily_target || [];
      const done = attendance.daily_done || [];
      setDailyDoneItems(targets.map((target) => done.includes(target)));
      
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
      
      if (attendance.daily_target && attendance.daily_target.length > 0) {
        setDailyTargets(attendance.daily_target);
      }
    } else {
      setDailyDoneItems([false]);
      setSelectedActivities([]);
      setSelectedProjects([]);
      setNote("");
      setProjectContributions({});
    }
  }, [attendance]);

  const loadTodayAttendance = async () => {
    try {
      setLoading(true);
      const result = await getTodayAttendance();
      setAttendance(result.data || null);
    } catch (error) {
      console.error("Failed to load attendance:", error);
      setAttendance(null);
    } finally {
      setLoading(false);
    }
  };

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

  const handleCheckIn = async () => {
    try {
      setCheckingIn(true);
      await checkIn(dailyTargets);
      toast.success("Check-in berhasil!");
      await loadTodayAttendance();
      setViewMode('checked-in');
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
      await checkOut();
      toast.success("Check-out berhasil!");
      await loadTodayAttendance();
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

      const payload = {};
      const currentTargets = attendance?.daily_target || [];
      
      const newDailyDone = currentTargets.filter((_, index) => dailyDoneItems[index]);
      if (newDailyDone.length > 0) {
        payload.daily_done = newDailyDone;
      }

      if (selectedProjects.length > 0) {
        payload.projects = selectedProjects.map((id) => ({
          project_id: id,
          contribution_percentage: Number(projectContributions[id] ?? 0),
        }));
      }

      if (selectedActivities.length > 0) {
        payload.activities = selectedActivities;
      }

      payload.note = note;

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

  const handleSubmitLateAttendance = async () => {
    if (!lateDate || !lateReason || lateReason.trim().length < 10) {
      toast.error("Tanggal dan alasan (min 10 karakter) wajib diisi");
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
      toast.error("Gagal mengajukan presensi terlambat");
    } finally {
      setSubmittingLate(false);
    }
  };

  const handleOpenLateModal = (request) => {
    setEditingLateRequest(request);
    
    // Reset form
    setLateCheckInTime("08:00");
    setLateCheckOutTime("17:00");
    setLateDailyDone([""]);
    setLateSelectedActivities([]);
    setLateSelectedProjects([]);
    setLateProjectContributions({});
    setLateNote("");
    
    setShowLateModal(true);
  };

  const handleSubmitLateAttendanceFromModal = async () => {
    if (!editingLateRequest) return;
    
    // Validasi: minimal 1 pekerjaan yang terisi
    const validDailyDone = lateDailyDone.filter(item => item.trim().length > 0);
    if (validDailyDone.length === 0) {
      toast.error("Minimal 1 pekerjaan yang diselesaikan harus diisi");
      return;
    }
  
    try {
      setSubmittingLateAttendance(true);
      
      // Normalize date dari request (handle timezone issues)
      const requestDateRaw = editingLateRequest.date;
      let requestDate;
      
      if (typeof requestDateRaw === 'string') {
        const dateParts = requestDateRaw.split('T')[0].split('-');
        requestDate = new Date(parseInt(dateParts[0]), parseInt(dateParts[1]) - 1, parseInt(dateParts[2]));
      } else {
        requestDate = new Date(requestDateRaw);
      }
      
      if (isNaN(requestDate.getTime())) {
        toast.error("Tanggal tidak valid");
        setSubmittingLateAttendance(false);
        return;
      }
      
      const year = requestDate.getFullYear();
      const month = String(requestDate.getMonth() + 1).padStart(2, '0');
      const day = String(requestDate.getDate()).padStart(2, '0');
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
  
      const payload = {
        checkIn_at: checkInDateTime.toISOString(),
        checkOut_at: checkOutDateTime.toISOString(),
        daily_target: validDailyDone,
        daily_done: validDailyDone,
      };
  
      if (lateNote.trim()) {
        payload.note = lateNote.trim();
      }
  
      if (lateSelectedActivities.length > 0) {
        payload.activities = lateSelectedActivities;
      }
  
      if (lateSelectedProjects.length > 0) {
        payload.projects = lateSelectedProjects.map((id) => ({
          project_id: id,
          contribution_percentage: Number(lateProjectContributions[id] ?? 0),
        }));
      }
  
      const createRes = await createLateAttendance(editingLateRequest._id, payload);
      
      if (!createRes.data || !createRes.data._id) {
        throw new Error("Failed to create late attendance");
      }
      
      toast.success("Presensi terlambat berhasil dibuat dan disubmit!");
      setShowLateModal(false);
      setEditingLateRequest(null);
      
      // Reset form
      setLateCheckInTime("08:00");
      setLateCheckOutTime("17:00");
      setLateDailyDone([""]);
      setLateSelectedActivities([]);
      setLateSelectedProjects([]);
      setLateProjectContributions({});
      setLateNote("");
      
      await loadMyLateRequests();
    } catch (e) {
      console.error("Submit late attendance error:", e);
      toast.error("Gagal membuat presensi terlambat");
    } finally {
      setSubmittingLateAttendance(false);
    }
  };

  const addDailyTarget = () => {
    if (newTargetInput.trim().length === 0) {
      toast.error("Target tidak boleh kosong");
      return;
    }
    if (dailyTargets.includes(newTargetInput.trim())) {
      toast.error("Target sudah ada");
      return;
    }
    setDailyTargets([...dailyTargets, newTargetInput.trim()]);
    setNewTargetInput("");
    toast.success("Target berhasil ditambahkan");
  };

  const removeDailyTarget = (index) => {
    if (dailyTargets.length > 1) {
      setDailyTargets(dailyTargets.filter((_, i) => i !== index));
    } else {
      toast.error("Minimal harus ada 1 target");
    }
  };

  const toggleDailyDoneItem = (index) => {
    const updated = [...dailyDoneItems];
    updated[index] = !updated[index];
    setDailyDoneItems(updated);
  };

  const addLateDailyDone = () => {
    setLateDailyDone([...lateDailyDone, ""]);
  };

  const removeLateDailyDone = (index) => {
    if (lateDailyDone.length > 1) {
      setLateDailyDone(lateDailyDone.filter((_, i) => i !== index));
    } else {
      toast.error("Minimal harus ada 1 pekerjaan");
    }
  };

  const updateLateDailyDone = (index, value) => {
    const updated = [...lateDailyDone];
    updated[index] = value;
    setLateDailyDone(updated);
  };

  // Enhanced status helpers with new 'late' status
  const getAttendanceStatus = (checkInTime, checkOutTime) => {
    const checkInHour = new Date(checkInTime).getHours();
    const checkInMinute = new Date(checkInTime).getMinutes();
    const checkInTotalMinutes = checkInHour * 60 + checkInMinute;
    const eightAM = 8 * 60;
    
    const checkOutHour = new Date(checkOutTime).getHours();
    const checkOutMinute = new Date(checkOutTime).getMinutes();
    const checkOutTotalMinutes = checkOutHour * 60 + checkOutMinute;
    const fourPM = 16 * 60;
    
    const isLateCheckIn = checkInTotalMinutes > eightAM;
    const isEarlyCheckOut = checkOutTotalMinutes < fourPM;
    
    if (isLateCheckIn && isEarlyCheckOut) {
      return { 
        status: 'late', 
        color: 'text-red-600', 
        // bgColor: 'bg-red-50', 
        borderColor: 'border-red-200', 
        label: 'Terlambat & Pulang Cepat' 
      };
    } else if (isLateCheckIn) {
      return { 
        status: 'late_checkin', 
        color: 'text-orange-600', 
        // bgColor: 'bg-orange-50', 
        borderColor: 'border-orange-200', 
        label: 'Terlambat Check-in' 
      };
    } else if (isEarlyCheckOut) {
      return { 
        status: 'early_checkout', 
        color: 'text-yellow-600', 
        // bgColor: 'bg-yellow-50', 
        borderColor: 'border-yellow-200', 
        label: 'Pulang Cepat' 
      };
    } else {
      return { 
        status: 'normal', 
        color: 'text-green-600', 
        // bgColor: 'bg-green-50', 
        borderColor: 'border-green-200', 
        label: 'Normal' 
      };
    }
  };

  const getCheckInStatus = (checkInTime) => {
    const hour = new Date(checkInTime).getHours();
    const minute = new Date(checkInTime).getMinutes();
    const totalMinutes = hour * 60 + minute;
    const eightAM = 8 * 60;
    
    if (totalMinutes <= eightAM) {
      return { status: 'ontime', color: 'text-green-600', bgColor: 'bg-green-50', borderColor: 'border-green-200', label: 'Tepat Waktu' };
    } else {
      return { status: 'late', color: 'text-red-600', bgColor: 'bg-red-50', borderColor: 'border-red-200', label: 'Terlambat' };
    }
  };

  const getCheckOutStatus = (checkOutTime) => {
    const hour = new Date(checkOutTime).getHours();
    const minute = new Date(checkOutTime).getMinutes();
    const totalMinutes = hour * 60 + minute;
    const fourPM = 16 * 60;
    const ninePM = 21 * 60;
    
    if (totalMinutes >= fourPM && totalMinutes <= ninePM) {
      return { status: 'normal', color: 'text-green-600', bgColor: 'bg-green-50', borderColor: 'border-green-200', label: 'Normal' };
    } else if (totalMinutes < fourPM) {
      return { status: 'early', color: 'text-yellow-600', bgColor: 'bg-yellow-50', borderColor: 'border-yellow-200', label: 'Pulang Cepat' };
    } else {
      return { status: 'toolate', color: 'text-red-600', bgColor: 'bg-red-50', borderColor: 'border-red-200', label: 'Checkout Terlalu Malam' };
    }
  };

  const canCheckOutNow = () => {
    const now = new Date();
    const hour = now.getHours();
    return hour <= 21;
  };

  const isLocked = attendance?.checkOut_at;
  const canCheckOut = attendance && !attendance.checkOut_at && dailyDoneItems.some((checked) => checked) && canCheckOutNow();
  const hasAttendance = attendance !== null;

  // Calculate max date for late attendance (yesterday in WIB)
  // IMPORTANT: We must derive the date string from the WIB Date object's own
  // getFullYear/getMonth/getDate — NOT from .toISOString(), which converts to
  // UTC and would shift the date back for WIB (UTC+7).
  // FIX: Allow selecting past dates up to 90 days ago, not just yesterday
  // This fixes the bug where user can't select date 29 after selecting date 30
  const wibToday = getWIBDate(new Date());
  const wibYesterday = new Date(wibToday);
  wibYesterday.setDate(wibYesterday.getDate() - 1);
  const maxLateDate = `${wibYesterday.getFullYear()}-${String(wibYesterday.getMonth() + 1).padStart(2, '0')}-${String(wibYesterday.getDate()).padStart(2, '0')}`;
  
  // Calculate min date for late attendance (90 days ago, to prevent selecting too old dates)
  const wibMinDate = new Date(wibToday);
  wibMinDate.setDate(wibMinDate.getDate() - 90);
  const minLateDate = `${wibMinDate.getFullYear()}-${String(wibMinDate.getMonth() + 1).padStart(2, '0')}-${String(wibMinDate.getDate()).padStart(2, '0')}`;

  // Check if late request already exists for a date (using WIB, same as backend)
  const hasLateRequestForDate = (date) => {
    if (!date) return false;
    return lateRequests.some((req) => {
      if (!req?.date) return false;
      // Backend menyimpan tanggal sudah dinormalisasi ke WIB (normalizeToDateOnly + getWIBDate)
      // Di frontend kita juga harus konversi ke WIB, JANGAN pakai toISOString (UTC) karena bisa geser 1 hari.
      const wibReqDate = getWIBDate(new Date(req.date));
      const year = wibReqDate.getFullYear();
      const month = String(wibReqDate.getMonth() + 1).padStart(2, "0");
      const day = String(wibReqDate.getDate()).padStart(2, "0");
      const reqDateStr = `${year}-${month}-${day}`;
      return reqDateStr === date;
    });
  };

  const shouldHideLateForm = lateDate && hasLateRequestForDate(lateDate);

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
            {formatWIBDate(new Date())}
          </p>
          {isSunday(new Date()) && (
            <div className="mt-4 p-4 bg-red-500/20 border border-red-500/30 rounded-xl">
              <p className="text-red-400 font-medium flex items-center gap-2">
                <AlertCircle className="w-5 h-5" />
                Hari ini adalah hari Minggu (libur). Presensi tidak dapat dilakukan.
              </p>
            </div>
          )}
        </motion.div>

        {/* Back to Main View Button (if in checked-in view) */}
        {hasAttendance && viewMode === 'checked-in' && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-6"
          >
            <button
              onClick={() => setViewMode('main')}
              className="flex items-center gap-2 text-blue-400 hover:text-blue-300 font-medium transition-colors"
            >
              <ArrowLeft className="w-5 h-5" />
              Kembali ke Pengajuan Late Attendance
            </button>
          </motion.div>
        )}

        {/* Status Card - shown in checked-in view */}
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
                    {attendance.checkOut_at &&
                      ` • Check-out: ${formatWIBTime(attendance.checkOut_at)}`}
                  </p>
                  {attendance.status === "forget" && (
                    <div className="mt-2">
                      <span
                        className={`inline-flex items-center gap-1 px-3 py-1 rounded-full text-sm font-medium ${
                          attendance.approved_at
                            ? "bg-green-100 text-green-800"
                            : "bg-yellow-100 text-yellow-800"
                        }`}
                      >
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

            {/* Working hours info */}
            <div className="mt-4 pt-4 border-t border-slate-700/50">
              <div className="flex flex-wrap gap-4 text-sm">
                <div className="flex items-center gap-2">
                  <Clock className="w-4 h-4 text-slate-400" />
                  <span className="text-slate-300">
                    Jam Kerja: {isSaturday(new Date()) ? "08:00 - 12:00 (Setengah Hari)" : "08:00 - 16:00"}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 text-yellow-400" />
                  <span className="text-slate-300">Check-out maksimal: 21:00</span>
                </div>
              </div>
            </div>
          </motion.div>
        )}

        {/* Check-in Section - shown in main view when not checked in */}
        {!hasAttendance && viewMode === 'main' && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-6"
          >
            {/* Working hours info banner */}
            <div className="mb-6 p-6 bg-slate-900/80 backdrop-blur-xl rounded-3xl shadow-2xl border border-blue-900/50">
              <div className="flex items-start gap-3">
                <AlertCircle className="w-5 h-5 text-blue-400 mt-0.5" />
                <div className="text-sm text-slate-300">
                  <p className="font-medium text-blue-400 mb-2">Informasi Jam Kerja:</p>
                  <ul className="list-disc list-inside space-y-1 text-slate-300">
                    <li>Check-in maksimal: <span className="font-semibold text-white">08:00</span> (lewat dari jam ini = terlambat)</li>
                    <li>Check-in deadline: <span className="font-semibold text-white">16:00</span> (setelah jam ini tidak bisa check-in)</li>
                    <li>Check-out minimal: <span className="font-semibold text-white">16:00</span> (jam kerja standar)</li>
                    <li>Check-out maksimal: <span className="font-semibold text-white">21:00</span> (antisipasi lupa checkout)</li>
                  </ul>
                </div>
              </div>
            </div>

            {/* Check-in deadline warning */}
            {isPastCheckInDeadline() && (
              <div className="mb-6 p-6 bg-red-500/20 backdrop-blur-xl rounded-3xl border border-red-500/30">
                <div className="flex items-start gap-3">
                  <AlertTriangle className="w-5 h-5 text-red-400 mt-0.5" />
                  <div className="text-sm text-red-300">
                    <p className="font-medium mb-1 text-red-400">⚠️ Waktu check-in sudah lewat!</p>
                    <p>Check-in hanya dapat dilakukan sebelum jam 16:00. Silakan ajukan presensi terlambat di bawah ini.</p>
                  </div>
                </div>
              </div>
            )}

            {/* Daily Target Management */}
            <div className="mb-6 bg-slate-900/80 backdrop-blur-xl rounded-3xl shadow-2xl border border-blue-900/50 p-6">
              <h3 className="font-semibold text-white mb-2 text-lg">
                Daily Target (Rencana Hari Ini)
              </h3>
              <p className="text-xs text-slate-400 mb-4">
                Atur target harian Anda. Nanti bisa dicentang sebagai Daily Done setelah check-in.
              </p>
              
              {/* Target List */}
              <div className="space-y-2 mb-4">
                {dailyTargets.map((target, index) => (
                  <div
                    key={index}
                    className="flex items-center justify-between gap-2 p-3 bg-slate-800/50 rounded-xl border border-slate-700"
                  >
                    <span className="text-sm text-slate-200 flex-1">{target}</span>
                    <button
                      onClick={() => removeDailyTarget(index)}
                      className="p-1 text-red-400 hover:text-red-300 hover:bg-red-500/20 rounded transition-all"
                      disabled={dailyTargets.length <= 1}
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>

              {/* Add New Target */}
              <div className="flex gap-2">
                <input
                  type="text"
                  value={newTargetInput}
                  onChange={(e) => setNewTargetInput(e.target.value)}
                  onKeyPress={(e) => {
                    if (e.key === "Enter") {
                      addDailyTarget();
                    }
                  }}
                  placeholder="Tambah target baru..."
                  className="flex-1 px-4 py-3 bg-slate-800/50 border border-slate-700 rounded-2xl text-white placeholder-slate-500 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm backdrop-blur-sm"
                />
                <motion.button
                  onClick={addDailyTarget}
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  className="px-4 py-3 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white rounded-2xl transition-all flex items-center gap-1 text-sm shadow-lg"
                >
                  <Plus className="w-4 h-4" />
                  Tambah
                </motion.button>
              </div>
            </div>

            <motion.button
              onClick={handleCheckIn}
              disabled={checkingIn || dailyTargets.length === 0 || isSunday(new Date()) || isPastCheckInDeadline()}
              whileHover={{ scale: checkingIn || dailyTargets.length === 0 || isSunday(new Date()) || isPastCheckInDeadline() ? 1 : 1.02 }}
              whileTap={{ scale: checkingIn || dailyTargets.length === 0 || isSunday(new Date()) || isPastCheckInDeadline() ? 1 : 0.98 }}
              className="w-full bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 disabled:from-slate-700 disabled:to-slate-800 text-white font-semibold py-4 px-6 rounded-2xl transition-all flex items-center justify-center gap-2 shadow-lg"
            >
              <Clock className="w-5 h-5" />
              {isSunday(new Date()) 
                ? "Hari Minggu (Libur)" 
                : isPastCheckInDeadline()
                ? "Check-in Tidak Tersedia (Lewat Jam 16:00)"
                : checkingIn 
                ? "Memproses..." 
                : "Check-in"}
            </motion.button>

            {/* Late Attendance Request Form */}
            <div className="mt-6 p-6 bg-slate-900/80 backdrop-blur-xl rounded-3xl shadow-2xl border border-yellow-500/30">
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
                    <label className="block text-sm font-medium text-slate-300 mb-2">
                      Tanggal
                    </label>
                    <input
                      type="date"
                      value={lateDate}
                      onChange={(e) => setLateDate(e.target.value)}
                      max={maxLateDate}
                      min={minLateDate}
                      className="w-full px-4 py-3 bg-slate-800/50 border border-slate-700 rounded-2xl text-white focus:ring-2 focus:ring-yellow-500 focus:border-yellow-500 backdrop-blur-sm"
                    />
                    {shouldHideLateForm && (
                      <p className="text-xs text-red-400 mt-2">
                        Pengajuan untuk tanggal ini sudah ada
                      </p>
                    )}
                  </div>
                  
                  {!shouldHideLateForm && (
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
                          onClick={() => {
                            setShowLateForm(false);
                            setLateDate("");
                            setLateReason("");
                          }}
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
                      onClick={() => {
                        setShowLateForm(false);
                        setLateDate("");
                        setLateReason("");
                      }}
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

            {/* My Late Requests List */}
            <div className="mt-6 bg-slate-900/80 backdrop-blur-xl rounded-3xl shadow-2xl border border-blue-900/50 p-6">
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
                          <span className="text-xs text-green-400 font-medium">
                            ✓ Selesai
                          </span>
                        )}
                      </div>
                    </motion.div>
                  ))}
                </div>
              )}
            </div>
          </motion.div>
        )}

        {/* Main view when already checked in (shows late requests + button to see today's attendance) */}
        {hasAttendance && viewMode === 'main' && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-6"
          >
            <motion.button
              onClick={() => setViewMode('checked-in')}
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              className="w-full bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white font-semibold py-4 px-6 mb-6 rounded-2xl transition-all shadow-lg"
            >
              Lihat Presensi Hari Ini
            </motion.button>
            {/* Late Attendance Request Form */}
            <div className="mb-6 p-6 bg-slate-900/80 backdrop-blur-xl rounded-3xl shadow-2xl border border-yellow-500/30">
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
                    <label className="block text-sm font-medium text-slate-300 mb-2">
                      Tanggal
                    </label>
                    <input
                      type="date"
                      value={lateDate}
                      onChange={(e) => setLateDate(e.target.value)}
                      max={maxLateDate}
                      min={minLateDate}
                      className="w-full px-4 py-3 bg-slate-800/50 border border-slate-700 rounded-2xl text-white focus:ring-2 focus:ring-yellow-500 focus:border-yellow-500 backdrop-blur-sm"
                    />
                    {shouldHideLateForm && (
                      <p className="text-xs text-red-400 mt-2">
                        Pengajuan untuk tanggal ini sudah ada
                      </p>
                    )}
                  </div>
                  
                  {!shouldHideLateForm && (
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
                          onClick={() => {
                            setShowLateForm(false);
                            setLateDate("");
                            setLateReason("");
                          }}
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
                      onClick={() => {
                        setShowLateForm(false);
                        setLateDate("");
                        setLateReason("");
                      }}
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

            {/* My Late Requests List */}
            <div className="bg-slate-900/80 backdrop-blur-xl rounded-3xl shadow-2xl border border-blue-900/50 p-6 mb-6">
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
                          <span className="text-xs text-green-400 font-medium">
                            ✓ Selesai
                          </span>
                        )}
                      </div>
                    </motion.div>
                  ))}
                </div>
              )}
            </div>

          </motion.div>
        )}

        {/* Work Log Form - ONLY for today's attendance when checked in and not locked */}
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

            {/* Daily Done Items */}
            <div className="mb-6">
              <label className="block text-sm font-medium text-slate-300 mb-3">
                Pekerjaan yang Diselesaikan *
              </label>
              <div className="space-y-2">
                {(attendance?.daily_target || []).map((target, index) => (
                  <label
                    key={index}
                    className="flex items-center gap-3 p-3 border border-slate-700 rounded-xl hover:bg-slate-800/50 cursor-pointer transition-colors"
                  >
                    <input
                      type="checkbox"
                      checked={dailyDoneItems[index] || false}
                      onChange={() => toggleDailyDoneItem(index)}
                      className="w-5 h-5 rounded border-slate-600 bg-slate-800/50 text-blue-600 focus:ring-blue-500"
                    />
                    <span className="text-sm text-slate-200">{target}</span>
                  </label>
                ))}
              </div>
            </div>

            {/* Activities Multi-select */}
            <div className="mb-6">
              <label className="block text-sm font-medium text-slate-300 mb-3">
                Aktivitas
              </label>
              {loadingMasterData ? (
                <div className="text-sm text-slate-400">Memuat aktivitas...</div>
              ) : (
                <div className="grid grid-cols-2 gap-2 max-h-40 overflow-y-auto border border-slate-700 rounded-xl p-3 bg-slate-800/30">
                  {activities.map((activity) => (
                    <label
                      key={activity._id}
                      className="flex items-center gap-2 p-2 hover:bg-slate-700/50 rounded-lg cursor-pointer transition-colors"
                    >
                      <input
                        type="checkbox"
                        checked={selectedActivities.includes(activity._id)}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setSelectedActivities([...selectedActivities, activity._id]);
                          } else {
                            setSelectedActivities(
                              selectedActivities.filter((id) => id !== activity._id)
                            );
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

            {/* Projects with contribution - select + chips UI */}
            <div className="mb-6">
              <label className="block text-sm font-medium text-slate-300 mb-3">
                Proyek & Kontribusi Hari Ini (%)
              </label>
              {loadingMasterData ? (
                <div className="text-sm text-slate-400">Memuat proyek...</div>
              ) : (
                <div className="border border-slate-700 rounded-xl p-4 space-y-3 bg-slate-800/30">
                  {/* Selected project chips */}
                  {selectedProjects.length > 0 && (
                    <div className="flex flex-wrap gap-2">
                      {selectedProjects.map((id) => {
                        const proj = projects.find((p) => p._id === id);
                        if (!proj) return null;
                        return (
                          <div
                            key={id}
                            className="flex items-center gap-2 bg-green-500/20 border border-green-500/30 rounded-xl px-3 py-2"
                          >
                            <span className="text-sm text-green-400 font-medium">{proj.name}</span>
                            <div className="flex items-center gap-1">
                              <input
                                type="number"
                                min={0}
                                max={100}
                                value={projectContributions[id] ?? ""}
                                onChange={(e) => {
                                  const raw = e.target.value;
                                  const num = raw === "" ? "" : Math.max(0, Math.min(100, Number(raw)));
                                  setProjectContributions((prev) => ({ ...prev, [id]: num }));
                                }}
                                className="w-16 px-2 py-1 border border-green-500/50 rounded-lg text-xs text-right bg-slate-800/50 text-white focus:ring-1 focus:ring-green-500 focus:border-green-500"
                                placeholder="%"
                              />
                              <span className="text-xs text-green-400">%</span>
                            </div>
                            <button
                              onClick={() => {
                                setSelectedProjects(selectedProjects.filter((pid) => pid !== id));
                                setProjectContributions((prev) => {
                                  const next = { ...prev };
                                  delete next[id];
                                  return next;
                                });
                              }}
                              className="ml-1 p-1 text-green-400 hover:text-red-400 hover:bg-red-500/20 rounded transition-colors"
                            >
                              <X className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  )}

                  {/* Add-project row: dropdown + button */}
                  {selectedProjects.length < projects.length && (
                    <div className="flex gap-2">
                      <select
                        id="normal-project-select"
                        defaultValue=""
                        className="flex-1 px-4 py-3 border border-slate-700 rounded-2xl text-sm text-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-slate-800/50 backdrop-blur-sm"
                        onChange={() => {}} // controlled via button click
                      >
                        <option value="" disabled>Pilih proyek...</option>
                        {projects
                          .filter((p) => !selectedProjects.includes(p._id))
                          .map((p) => (
                            <option key={p._id} value={p._id}>{p.name}</option>
                          ))}
                      </select>
                      <motion.button
                        onClick={() => {
                          const sel = document.getElementById("normal-project-select");
                          if (sel && sel.value) {
                            setSelectedProjects([...selectedProjects, sel.value]);
                            setProjectContributions((prev) => ({ ...prev, [sel.value]: 0 }));
                            sel.value = "";
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
                  )}

                  {projects.length === 0 && (
                    <p className="text-sm text-slate-400">Tidak ada proyek tersedia</p>
                  )}
                </div>
              )}
            </div>

            {/* Note */}
            <div className="mb-6">
              <label className="block text-sm font-medium text-slate-300 mb-3">
                Catatan
              </label>
              <textarea
                value={note}
                onChange={(e) => setNote(e.target.value)}
                rows={3}
                placeholder="Catatan tambahan..."
                className="w-full px-4 py-3 bg-slate-800/50 border border-slate-700 rounded-2xl text-white placeholder-slate-500 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 backdrop-blur-sm"
              />
            </div>

            {/* Update Button */}
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
            <div className="space-y-6">
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-3">
                  Pekerjaan yang Diselesaikan
                </label>
                {attendance.daily_done?.length > 0 ? (
                  <ul className="list-disc list-inside space-y-2">
                    {attendance.daily_done.map((item, index) => (
                      <li key={index} className="text-slate-200">{item}</li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-sm text-slate-400">Tidak ada pekerjaan yang dicatat</p>
                )}
              </div>
              {attendance.activities?.length > 0 && (
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-3">Aktivitas</label>
                  <div className="flex flex-wrap gap-2">
                    {attendance.activities.map((activity) => (
                      <span
                        key={activity._id || activity}
                        className="px-3 py-1.5 bg-blue-500/20 text-blue-400 border border-blue-500/30 rounded-full text-sm font-medium"
                      >
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
                        <span
                          key={proj._id || proj}
                          className="px-3 py-1.5 bg-green-500/20 text-green-400 border border-green-500/30 rounded-full text-sm font-medium"
                        >
                          {(proj.name || proj) +
                            (typeof p.contribution_percentage === "number"
                              ? ` (+${p.contribution_percentage}%)`
                              : "")}
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
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-6"
          >
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
              {checkingOut
                ? "Memproses..."
                : !canCheckOutNow()
                ? "Check-out Tidak Tersedia (Lewat Jam 21:00)"
                : canCheckOut
                ? "Check-out"
                : "Check-out (centang minimal 1 pekerjaan yang diselesaikan)"}
            </motion.button>
          </motion.div>
        )}
      </div>

      {/* Late Attendance Creation Modal */}
      <AnimatePresence>
        {showLateModal && editingLateRequest && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4"
            onClick={() => {
              if (!submittingLateAttendance) {
                setShowLateModal(false);
                setEditingLateRequest(null);
              }
            }}
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
                  onClick={() => {
                    if (!submittingLateAttendance) {
                      setShowLateModal(false);
                      setEditingLateRequest(null);
                    }
                  }}
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
                    <label className="block text-sm font-medium text-slate-300 mb-2">
                      Waktu Check-in *
                    </label>
                    <input
                      type="time"
                      value={lateCheckInTime}
                      onChange={(e) => setLateCheckInTime(e.target.value)}
                      className="w-full px-4 py-3 bg-slate-800/50 border border-slate-700 rounded-2xl text-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500 backdrop-blur-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-300 mb-2">
                      Waktu Check-out *
                    </label>
                    <input
                      type="time"
                      value={lateCheckOutTime}
                      onChange={(e) => setLateCheckOutTime(e.target.value)}
                      className="w-full px-4 py-3 bg-slate-800/50 border border-slate-700 rounded-2xl text-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500 backdrop-blur-sm"
                    />
                  </div>
                </div>

                {/* Working hours reminder */}
                <div className="p-4 bg-blue-500/20 border border-blue-500/30 rounded-xl">
                  <div className="flex items-start gap-2">
                    <AlertCircle className="w-4 h-4 text-blue-400 mt-0.5" />
                    <div className="text-xs text-slate-300">
                      <p className="font-medium text-blue-400 mb-1">Jam Kerja:</p>
                      {isSaturday(new Date(editingLateRequest.date)) ? (
                        <p>Sabtu (Setengah Hari): Check-in: 08:00 | Check-out: 12:00 - 21:00</p>
                      ) : (
                        <p>Senin-Jumat: Check-in: 08:00 | Check-out: 16:00 - 21:00</p>
                      )}
                    </div>
                  </div>
                </div>

                {/* Daily Done Items */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Pekerjaan yang Diselesaikan * (akan otomatis tercentang)
                  </label>
                  <div className="space-y-2 mb-3">
                    {lateDailyDone.map((item, index) => (
                      <div key={index} className="flex items-center gap-2">
                        <input
                          type="checkbox"
                          checked={true}
                          disabled
                          className="w-5 h-5 rounded border-gray-300 text-blue-600"
                        />
                        <input
                          type="text"
                          value={item}
                          onChange={(e) => updateLateDailyDone(index, e.target.value)}
                          placeholder={`Pekerjaan ${index + 1}...`}
                          className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                        />
                        {lateDailyDone.length > 1 && (
                          <button
                            onClick={() => removeLateDailyDone(index)}
                            className="p-2 text-red-600 hover:bg-red-50 rounded transition-all"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                  <button
                    onClick={addLateDailyDone}
                    className="w-full py-2 border-2 border-dashed border-gray-300 rounded-lg text-sm text-gray-600 hover:border-blue-400 hover:text-blue-600 transition-all flex items-center justify-center gap-2"
                  >
                    <Plus className="w-4 h-4" />
                    Tambah Pekerjaan
                  </button>
                </div>

                {/* Activities Multi-select */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Aktivitas (Opsional)
                  </label>
                  {loadingMasterData ? (
                    <div className="text-sm text-gray-500">Memuat aktivitas...</div>
                  ) : (
                    <div className="grid grid-cols-2 gap-2 max-h-40 overflow-y-auto border border-gray-200 rounded-lg p-2">
                      {activities.map((activity) => (
                        <label
                          key={activity._id}
                          className="flex items-center gap-2 p-2 hover:bg-gray-50 rounded cursor-pointer"
                        >
                          <input
                            type="checkbox"
                            checked={lateSelectedActivities.includes(activity._id)}
                            onChange={(e) => {
                              if (e.target.checked) {
                                setLateSelectedActivities([...lateSelectedActivities, activity._id]);
                              } else {
                                setLateSelectedActivities(
                                  lateSelectedActivities.filter((id) => id !== activity._id)
                                );
                              }
                            }}
                            className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                          />
                          <span className="text-sm text-gray-700">{activity.name_activity}</span>
                        </label>
                      ))}
                    </div>
                  )}
                </div>

                {/* Projects with contribution - select + chips UI (late modal) */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Proyek & Kontribusi (%) (Opsional)
                  </label>
                  {loadingMasterData ? (
                    <div className="text-sm text-gray-500">Memuat proyek...</div>
                  ) : (
                    <div className="border border-gray-200 rounded-lg p-3 space-y-3">
                      {/* Selected project chips */}
                      {lateSelectedProjects.length > 0 && (
                        <div className="flex flex-wrap gap-2">
                          {lateSelectedProjects.map((id) => {
                            const proj = projects.find((p) => p._id === id);
                            if (!proj) return null;
                            return (
                              <div
                                key={id}
                                className="flex items-center gap-2 bg-green-50 border border-green-200 rounded-lg px-3 py-1.5"
                              >
                                <span className="text-sm text-green-800 font-medium">{proj.name}</span>
                                <div className="flex items-center gap-1">
                                  <input
                                    type="number"
                                    min={0}
                                    max={100}
                                    value={lateProjectContributions[id] ?? ""}
                                    onChange={(e) => {
                                      const raw = e.target.value;
                                      const num = raw === "" ? "" : Math.max(0, Math.min(100, Number(raw)));
                                      setLateProjectContributions((prev) => ({ ...prev, [id]: num }));
                                    }}
                                    className="w-16 px-2 py-0.5 border border-green-300 rounded text-xs text-right focus:ring-1 focus:ring-green-500 focus:border-green-500"
                                    placeholder="%"
                                  />
                                  <span className="text-xs text-green-600">%</span>
                                </div>
                                <button
                                  onClick={() => {
                                    setLateSelectedProjects(lateSelectedProjects.filter((pid) => pid !== id));
                                    setLateProjectContributions((prev) => {
                                      const next = { ...prev };
                                      delete next[id];
                                      return next;
                                    });
                                  }}
                                  className="ml-1 p-0.5 text-green-600 hover:text-red-600 hover:bg-red-50 rounded transition-colors"
                                >
                                  <X className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            );
                          })}
                        </div>
                      )}

                      {/* Add-project row: dropdown + button */}
                      {lateSelectedProjects.length < projects.length && (
                        <div className="flex gap-2">
                          <select
                            id="late-project-select"
                            defaultValue=""
                            className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-700 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white"
                            onChange={() => {}}
                          >
                            <option value="" disabled>Pilih proyek...</option>
                            {projects
                              .filter((p) => !lateSelectedProjects.includes(p._id))
                              .map((p) => (
                                <option key={p._id} value={p._id}>{p.name}</option>
                              ))}
                          </select>
                          <button
                            onClick={() => {
                              const sel = document.getElementById("late-project-select");
                              if (sel && sel.value) {
                                setLateSelectedProjects([...lateSelectedProjects, sel.value]);
                                setLateProjectContributions((prev) => ({ ...prev, [sel.value]: 0 }));
                                sel.value = "";
                              }
                            }}
                            className="px-3 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-all flex items-center gap-1 text-sm"
                          >
                            <Plus className="w-4 h-4" />
                            Tambah
                          </button>
                        </div>
                      )}

                      {projects.length === 0 && (
                        <p className="text-sm text-gray-500">Tidak ada proyek tersedia</p>
                      )}
                    </div>
                  )}
                </div>

                {/* Note */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Catatan (Opsional)
                  </label>
                  <textarea
                    value={lateNote}
                    onChange={(e) => setLateNote(e.target.value)}
                    rows={3}
                    placeholder="Catatan tambahan..."
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>

                {/* Info Note */}
                <div className="p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
                  <p className="text-sm text-gray-700">
                    <span className="font-medium">Catatan:</span> Data akan langsung tersimpan dan terkunci setelah submit. Pastikan semua informasi sudah benar.
                  </p>
                </div>
              </div>

              {/* Modal Footer */}
              <div className="sticky bottom-0 bg-gray-50 border-t border-gray-200 px-6 py-4 flex gap-3 z-10">
                <button
                  onClick={() => {
                    if (!submittingLateAttendance) {
                      setShowLateModal(false);
                      setEditingLateRequest(null);
                    }
                  }}
                  disabled={submittingLateAttendance}
                  className="flex-1 px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-100 transition-all disabled:opacity-50"
                >
                  Batal
                </button>
                <button
                  onClick={handleSubmitLateAttendanceFromModal}
                  disabled={submittingLateAttendance}
                  className="flex-1 px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white font-semibold rounded-lg transition-all"
                >
                  {submittingLateAttendance ? "Memproses..." : "Submit Presensi"}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default Attendance;