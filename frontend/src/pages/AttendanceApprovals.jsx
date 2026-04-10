import React, { useEffect, useState } from "react";
import {
  listPendingLateAttendanceRequests,
  approveLateAttendance,
  rejectLateAttendance,
  listPendingAbsenceRequests,
  approveAbsenceRequest,
  rejectAbsenceRequestWithReason,
  fetchWorkDaysRange,
} from "../utils/api.jsx";
import toast, { Toaster } from "react-hot-toast";
import { motion, AnimatePresence } from "framer-motion";
import {
  CheckCircle,
  XCircle,
  Clock,
  User,
  Sparkles,
  FileText,
  ChevronDown,
  Paperclip,
  Timer,
  CalendarDays,
  AlarmClock,
  Stethoscope,
  UmbrellaOff,
  BadgeAlert,
} from "lucide-react";

// ─── Motion Variants ────────────────────────────────────────────
const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { delayChildren: 0.2, staggerChildren: 0.08 },
  },
};

const itemVariants = {
  hidden: { y: 16, opacity: 0 },
  visible: { y: 0, opacity: 1, transition: { type: "spring", stiffness: 120 } },
};

// ─── Badge Config per request type ──────────────────────────────
const BADGE_CONFIG = {
  late: {
    label: "Late Attendance",
    icon: AlarmClock,
    className: "bg-amber-900/40 border-amber-700/50 text-amber-300",
    dot: "bg-amber-400",
  },
  "absence:izin": {
    label: "Izin",
    icon: UmbrellaOff,
    className: "bg-blue-900/40 border-blue-700/50 text-blue-300",
    dot: "bg-blue-400",
  },
  "absence:cuti": {
    label: "Cuti",
    icon: CalendarDays,
    className: "bg-indigo-900/40 border-indigo-700/50 text-indigo-300",
    dot: "bg-indigo-400",
  },
  "absence:sakit": {
    label: "Sakit",
    icon: Stethoscope,
    className: "bg-emerald-900/40 border-emerald-700/50 text-emerald-300",
    dot: "bg-emerald-400",
  },
};

const getBadgeConfig = (request) => {
  if (request.request_kind === "late") return BADGE_CONFIG["late"];
  const key = `absence:${request.type}`;
  return BADGE_CONFIG[key] || BADGE_CONFIG["absence:izin"];
};

const getDurationDays = (start, end) => {
  const diff = new Date(end) - new Date(start);
  return Math.round(diff / (1000 * 60 * 60 * 24)) + 1;
};

// ─── Component ───────────────────────────────────────────────────
const AttendanceApprovals = () => {
  const API_BASE =
    import.meta.env.VITE_API_BASE_URL || "http://localhost:3000/api/v1";
  const [loading, setLoading] = useState(true);
  const [items, setItems] = useState([]);
  const [rejectReasonById, setRejectReasonById] = useState({});
  const [rejectModal, setRejectModal] = useState({
    open: false,
    id: null,
    requestKind: null,
  });
  const [durationById, setDurationById] = useState({});

  const resolveAttachmentUrl = (request) => {
    if (request?.attachment_document_id) {
      return `${API_BASE}/documents/${request.attachment_document_id}/view`;
    }
    return request?.attachment_url || "";
  };

  const isPdfAttachment = (url = "") => {
    const cleanUrl = String(url || "").split("?")[0].toLowerCase();
    return cleanUrl.endsWith(".pdf") || cleanUrl.includes("/raw/upload/");
  };

  // ── Fetch ──────────────────────────────────────────────────────
  const load = async () => {
    try {
      setLoading(true);
      const [lateRes, absenceRes] = await Promise.all([
        listPendingLateAttendanceRequests(),
        listPendingAbsenceRequests(),
      ]);
      const lateItems = (lateRes.data || []).map((item) => ({
        ...item,
        request_kind: "late",
      }));
      const absenceItems = (absenceRes.data || []).map((item) => ({
        ...item,
        request_kind: "absence",
      }));
      const merged = [...lateItems, ...absenceItems].sort(
        (a, b) =>
          new Date(b.createdAt || b.created_at || 0) -
          new Date(a.createdAt || a.created_at || 0)
      );
      setItems(merged);

      // Precompute duration (hari kerja) untuk absence
      const absences = merged.filter((i) => i.request_kind === "absence");
      if (absences.length > 0) {
        const updates = {};
        await Promise.all(
          absences.map(async (r) => {
            try {
              const from = String(r.start_date || "").split("T")[0];
              const to = String(r.end_date || "").split("T")[0];
              if (!from || !to) return;
              const data = await fetchWorkDaysRange({ from, to });
              const list = Array.isArray(data) ? data : [];
              const working = list.filter((d) => d?.is_working_day && !d?.is_holiday).length;
              updates[r._id] = working;
            } catch (_e) {
              // fallback ke durasi kalender biasa
              updates[r._id] = getDurationDays(r.start_date, r.end_date);
            }
          })
        );
        setDurationById((prev) => ({ ...prev, ...updates }));
      } else {
        setDurationById({});
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  // ── Actions ────────────────────────────────────────────────────
  const onApprove = async (id, requestKind) => {
    try {
      if (requestKind === "absence") {
        await approveAbsenceRequest(id);
      } else {
        await approveLateAttendance(id);
      }
      toast.success("Request approved");
      await load();
    } catch (e) {
      console.error(e);
    }
  };

  const onReject = async (id, requestKind) => {
    const reason = (rejectReasonById[id] || "").trim();
    if (requestKind === "late" && reason.length < 3) {
      toast.error("Alasan penolakan minimal 3 karakter");
      return;
    }
    try {
      if (requestKind === "absence") {
        await rejectAbsenceRequestWithReason(id, reason);
      } else {
        await rejectLateAttendance(id, reason);
      }
      toast.success("Request rejected");
      setRejectModal({ open: false, id: null, requestKind: null });
      await load();
    } catch (e) {
      console.error(e);
    }
  };

  // ── Render ─────────────────────────────────────────────────────
  return (
    <>
      <Toaster position="top-center" />

      {/* ── Reject Modal ────────────────────────────────────────── */}
      <AnimatePresence>
        {rejectModal.open && (
          <motion.div
            key="reject-modal"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4"
          >
            <div
              className="absolute inset-0 bg-black/60"
              onClick={() => setRejectModal({ open: false, id: null, requestKind: null })}
            />
            <motion.div
              initial={{ y: 16, opacity: 0, scale: 0.98 }}
              animate={{ y: 0, opacity: 1, scale: 1 }}
              exit={{ y: 16, opacity: 0, scale: 0.98 }}
              transition={{ type: "spring", stiffness: 220, damping: 22 }}
              className="relative w-full max-w-lg bg-slate-900/95 backdrop-blur-2xl rounded-2xl border border-red-900/40 shadow-2xl overflow-hidden"
            >
              <div className="p-5 border-b border-slate-700/40">
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2 text-white font-semibold">
                    <XCircle className="w-5 h-5 text-red-400" />
                    Tolak Permintaan
                  </div>
                  <button
                    onClick={() => setRejectModal({ open: false, id: null, requestKind: null })}
                    className="text-slate-400 hover:text-slate-200 text-sm"
                  >
                    Tutup
                  </button>
                </div>
              </div>

              <div className="p-5">
                <label className="flex items-center gap-2 text-sm font-medium text-slate-300 mb-2">
                  <FileText className="w-4 h-4 text-red-400" />
                  Alasan Penolakan{" "}
                  {rejectModal.requestKind === "late" && (
                    <span className="text-red-400">*</span>
                  )}
                </label>
                <textarea
                  value={rejectReasonById[rejectModal.id] || ""}
                  onChange={(e) =>
                    setRejectReasonById((prev) => ({
                      ...prev,
                      [rejectModal.id]: e.target.value,
                    }))
                  }
                  rows={3}
                  placeholder={
                    rejectModal.requestKind === "absence"
                      ? "Opsional"
                      : "Tuliskan alasan penolakan (min. 3 karakter)..."
                  }
                  className="w-full px-4 py-3 bg-slate-800/50 border border-slate-700 rounded-xl text-white text-sm placeholder-slate-500 focus:ring-2 focus:ring-red-500 focus:border-transparent transition-all backdrop-blur-sm resize-none"
                />
                <div className="flex gap-3 mt-4 justify-end">
                  <motion.button
                    onClick={() => setRejectModal({ open: false, id: null, requestKind: null })}
                    className="px-5 py-2 bg-slate-800/70 border border-slate-700 rounded-xl text-slate-300 hover:bg-slate-700/70 text-sm font-semibold transition-all"
                    whileHover={{ scale: 1.02 }}
                  >
                    Batalkan
                  </motion.button>
                  <motion.button
                    onClick={() => onReject(rejectModal.id, rejectModal.requestKind)}
                    className="flex items-center gap-2 px-5 py-2 bg-gradient-to-r from-red-600 to-rose-600 hover:from-red-700 hover:to-rose-700 text-white rounded-xl text-sm font-semibold shadow-lg relative overflow-hidden group transition-all"
                    whileHover={{ scale: 1.04 }}
                    whileTap={{ scale: 0.96 }}
                  >
                    <motion.div
                      className="absolute inset-0 bg-gradient-to-r from-transparent via-white to-transparent opacity-0 group-hover:opacity-20"
                      animate={{ x: ["-100%", "100%"] }}
                      transition={{ duration: 1.5, repeat: Infinity, ease: "linear" }}
                    />
                    <XCircle className="w-4 h-4 relative z-10" />
                    <span className="relative z-10">Konfirmasi Penolakan</span>
                  </motion.button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="min-h-screen bg-gradient-to-br from-slate-950 via-blue-950 to-slate-900 p-6 relative overflow-hidden">
        {/* ── Animated Background Blobs ──────────────────────────── */}
        <div className="absolute inset-0 overflow-hidden">
          <motion.div
            animate={{ scale: [1, 1.2, 1], x: [0, 50, 0], y: [0, 30, 0] }}
            transition={{ duration: 8, repeat: Infinity, ease: "easeInOut" }}
          />
          <motion.div
            className="absolute bottom-20 right-20 w-96 h-96 bg-indigo-600 rounded-full mix-blend-multiply filter blur-3xl opacity-20"
            animate={{ scale: [1, 1.3, 1], x: [0, -50, 0], y: [0, -30, 0] }}
            transition={{ duration: 10, repeat: Infinity, ease: "easeInOut" }}
          />
        </div>

        {/* ── Main Content ──────────────────────────────────────────── */}
        <motion.div
          className=" mx-auto relative z-10"
          variants={containerVariants}
          initial="hidden"
          animate="visible"
        >
          {/* Header */}
          <motion.div variants={itemVariants} className="mb-8">
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-3xl font-bold bg-gradient-to-r from-blue-400 to-indigo-400 bg-clip-text text-transparent flex items-center gap-3">
                  <Clock className="w-8 h-8 text-blue-400" />
                  Persetujuan Absensi Khusus
                </h1>
                <p className="text-slate-400 mt-1 text-base flex items-center gap-2">
                  <Sparkles className="w-4 h-4" />
                  Tinjau dan proses pengajuan late attendance maupun izin/cuti/sakit
                </p>
              </div>
              {/* Summary counter badges */}
              {!loading && (
                <div className="flex items-center gap-2 flex-shrink-0">
                  <span className="px-3 py-1.5 rounded-full bg-slate-800/80 border border-slate-700/50 text-sm font-medium text-slate-300">
                    {items.length} menunggu
                  </span>
                </div>
              )}
            </div>

            {/* Type legend pills */}
            {!loading && items.length > 0 && (
              <div className="flex flex-wrap gap-2 mt-4">
                {Object.entries(BADGE_CONFIG).map(([key, cfg]) => {
                  const count =
                    key === "late"
                      ? items.filter((i) => i.request_kind === "late").length
                      : items.filter(
                          (i) =>
                            i.request_kind === "absence" &&
                            i.type === key.replace("absence:", "")
                        ).length;
                  if (count === 0) return null;
                  const Icon = cfg.icon;
                  return (
                    <span
                      key={key}
                      className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-xs font-medium ${cfg.className}`}
                    >
                      <span className={`w-1.5 h-1.5 rounded-full ${cfg.dot}`} />
                      <Icon className="w-3 h-3" />
                      {cfg.label}: {count}
                    </span>
                  );
                })}
              </div>
            )}
          </motion.div>

          {/* ── States: Loading / Empty / List ─────────────────────── */}
          {loading ? (
            <div className="flex justify-center py-32">
              <motion.div
                animate={{ rotate: 360 }}
                transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                className="w-16 h-16 border-4 border-blue-500 border-t-transparent rounded-full"
              />
            </div>
          ) : items.length === 0 ? (
            <motion.div className="text-center py-32" variants={itemVariants}>
              <CheckCircle className="w-20 h-20 text-slate-600 mx-auto mb-4" />
              <p className="text-xl text-slate-400">Tidak ada permintaan saat ini</p>
              <p className="text-slate-500 mt-2">Semua tugas Anda sudah selesai! 🎉</p>
            </motion.div>
          ) : (
            <motion.div
              className="space-y-4"
              variants={containerVariants}
              initial="hidden"
              animate="visible"
            >
              {items.map((r) => {
                const badge = getBadgeConfig(r);
                const BadgeIcon = badge.icon;
                const attachmentUrl = resolveAttachmentUrl(r);
                const initials = (r.user_id?.full_name || "?")
                  .split(" ")
                  .slice(0, 2)
                  .map((w) => w[0])
                  .join("")
                  .toUpperCase();

                return (
                  <motion.div key={r._id} variants={itemVariants}>
                    <div className="bg-slate-900/90 backdrop-blur-2xl rounded-2xl border border-blue-900/50 shadow-xl overflow-hidden">

                      {/* ── Card Body ─────────────────────────────── */}
                      <div className="p-5">
                        {/* Row 1: Avatar + Name + Badge + Approve btn */}
                        <div className="flex items-start gap-4">
                          {/* Avatar */}
                          <div className="w-10 h-10 rounded-full bg-slate-800 border border-blue-800/60 flex items-center justify-center text-sm font-semibold text-blue-300 flex-shrink-0">
                            {initials}
                          </div>

                          {/* User info + badge */}
                          <div className="flex-1 min-w-0">
                            <div className="flex flex-wrap items-center gap-2">
                              <p className="text-base font-semibold text-white leading-tight">
                                {r.user_id?.full_name || "Unknown User"}
                              </p>
                              {/* Request type badge */}
                              <span
                                className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full border text-xs font-semibold ${badge.className}`}
                              >
                                <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${badge.dot}`} />
                                <BadgeIcon className="w-3 h-3" />
                                {badge.label}
                              </span>
                            </div>
                            <p className="text-xs text-slate-400 mt-0.5">
                              {r.user_id?.email || "-"}
                            </p>
                          </div>

                          {/* Approve button */}
                          <motion.button
                            onClick={() => onApprove(r._id, r.request_kind)}
                            className="flex items-center gap-1.5 px-4 py-2 bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700 text-white rounded-xl text-sm font-semibold shadow-lg transition-all flex-shrink-0"
                            whileHover={{ scale: 1.04 }}
                            whileTap={{ scale: 0.96 }}
                          >
                            <CheckCircle className="w-4 h-4" />
                            Setujui
                          </motion.button>
                        </div>

                        {/* Row 2: Meta info grid */}
                        <div className="mt-4 grid grid-cols-2 sm:grid-cols-4 gap-2">
                          {/* Tanggal */}
                          <div className="bg-slate-800/60 rounded-xl p-3 border border-slate-700/40 col-span-2">
                            <p className="text-xs text-slate-500 uppercase tracking-wide mb-1">
                              {r.request_kind === "absence" ? "Rentang Tanggal" : "Tanggal"}
                            </p>
                            <p className="text-sm font-medium text-slate-100 flex items-center gap-1.5">
                              <CalendarDays className="w-3.5 h-3.5 text-blue-400 flex-shrink-0" />
                              {r.request_kind === "absence"
                                ? `${new Date(r.start_date).toLocaleDateString("id-ID", {
                                    day: "numeric",
                                    month: "short",
                                    year: "numeric",
                                  })} – ${new Date(r.end_date).toLocaleDateString("id-ID", {
                                    day: "numeric",
                                    month: "short",
                                    year: "numeric",
                                  })}`
                                : new Date(r.date).toLocaleDateString("id-ID", {
                                    day: "numeric",
                                    month: "long",
                                    year: "numeric",
                                  })}
                            </p>
                          </div>

                          {/* Durasi (absence only) / Status (late) */}
                          {r.request_kind === "absence" ? (
                            <div className="bg-slate-800/60 rounded-xl p-3 border border-slate-700/40">
                              <p className="text-xs text-slate-500 uppercase tracking-wide mb-1">Durasi</p>
                              <p className="text-sm font-medium text-slate-100 flex items-center gap-1.5">
                                <Timer className="w-3.5 h-3.5 text-indigo-400 flex-shrink-0" />
                                {(durationById[r._id] ?? getDurationDays(r.start_date, r.end_date))} hari
                              </p>
                            </div>
                          ) : (
                            <div className="bg-slate-800/60 rounded-xl p-3 border border-slate-700/40">
                              <p className="text-xs text-slate-500 uppercase tracking-wide mb-1">Status</p>
                              <p className="text-sm font-medium text-amber-300 capitalize">
                                {r.status || "pending"}
                              </p>
                            </div>
                          )}

                          {/* Tipe (absence) / kosong (late) */}
                          {r.request_kind === "absence" ? (
                            <div className="bg-slate-800/60 rounded-xl p-3 border border-slate-700/40">
                              <p className="text-xs text-slate-500 uppercase tracking-wide mb-1">Tipe</p>
                              <p className="text-sm font-medium text-slate-100 capitalize">{r.type || "-"}</p>
                            </div>
                          ) : (
                            <div className="bg-slate-800/60 rounded-xl p-3 border border-slate-700/40">
                              <p className="text-xs text-slate-500 uppercase tracking-wide mb-1">Status</p>
                              <p className="text-sm font-medium text-amber-300 capitalize">
                                {r.status || "pending"}
                              </p>
                            </div>
                          )}

                          {/* Alasan — full width */}
                          <div className="bg-slate-800/60 rounded-xl p-3 border border-slate-700/40 col-span-2 sm:col-span-4">
                            <p className="text-xs text-slate-500 uppercase tracking-wide mb-1">
                              {r.request_kind === "absence" ? "Alasan" : "Alasan Keterlambatan"}
                            </p>
                            <p className="text-sm text-slate-300 leading-relaxed">
                              {r.request_kind === "absence"
                                ? r.reason || "-"
                                : r.late_reason || "-"}
                            </p>
                          </div>
                        </div>

                        {/* Lampiran (absence only) */}
                        {r.request_kind === "absence" && attachmentUrl && (
                          <div className="mt-2 flex items-center gap-2 px-3 py-2 bg-slate-800/40 rounded-xl border border-slate-700/30">
                            <Paperclip className="w-3.5 h-3.5 text-blue-400 flex-shrink-0" />
                            {!isPdfAttachment(attachmentUrl) && (
                              <img
                                src={attachmentUrl}
                                alt="Lampiran"
                                className="h-8 w-12 rounded object-cover border border-slate-700"
                                onError={(e) => { e.currentTarget.style.display = "none"; }}
                              />
                            )}
                            <a
                              href={attachmentUrl}
                              target="_blank"
                              rel="noreferrer"
                              className="text-xs text-blue-400 hover:text-blue-300 underline"
                            >
                              Lihat / Unduh Lampiran
                            </a>
                          </div>
                        )}

                        {/* Reject toggle */}
                        <div className="mt-4 pt-3 border-t border-slate-700/40">
                          <motion.button
                            onClick={() =>
                              setRejectModal({
                                open: true,
                                id: r._id,
                                requestKind: r.request_kind,
                              })
                            }
                            className="flex items-center gap-1.5 text-xs text-slate-500 hover:text-red-400 transition-colors"
                            whileHover={{ x: 3 }}
                          >
                            <XCircle className="w-3.5 h-3.5" />
                            Tolak Permintaan
                            <ChevronDown className="w-3.5 h-3.5" />
                          </motion.button>
                        </div>
                      </div>
                    </div>
                  </motion.div>
                );
              })}
            </motion.div>
          )}
        </motion.div>
      </div>
    </>
  );
};

export default AttendanceApprovals;