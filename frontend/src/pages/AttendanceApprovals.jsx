import React, { useEffect, useState } from "react";
import {
  listPendingLateAttendanceRequests,
  approveLateAttendance,
  rejectLateAttendance,
  listPendingAbsenceRequests,
  approveAbsenceRequest,
  rejectAbsenceRequestWithReason,
} from "../utils/api.jsx";
import toast, { Toaster } from "react-hot-toast";
import { motion } from "framer-motion";
import {
  CheckCircle,
  XCircle,
  Clock,
  User,
  AlertCircle,
  Sparkles,
  FileText,
  ChevronDown,
  ChevronUp,
} from "lucide-react";

// ─── Motion Variants ────────────────────────────────────────────
const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { delayChildren: 0.3, staggerChildren: 0.1 },
  },
};

const itemVariants = {
  hidden: { y: 20, opacity: 0 },
  visible: { y: 0, opacity: 1, transition: { type: "spring", stiffness: 100 } },
};

// ─── Component ───────────────────────────────────────────────────
const AttendanceApprovals = () => {
  const API_BASE =
    import.meta.env.VITE_API_BASE_URL || "http://localhost:3000/api/v1";
  const [loading, setLoading] = useState(true);
  const [items, setItems] = useState([]);
  const [rejectReasonById, setRejectReasonById] = useState({});
  const [expandedId, setExpandedId] = useState(null); // buka/tutup reject area

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
      setExpandedId(null);
      await load();
    } catch (e) {
      console.error(e);
    }
  };

  // ── Render ─────────────────────────────────────────────────────
  return (
    <>
      <Toaster position="top-center" />

      <div className="min-h-screen bg-gradient-to-br from-slate-950 via-blue-950 to-slate-900 p-6 relative overflow-hidden">
        {/* ── Animated Background Blobs ──────────────────────────── */}
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

        {/* ── Main Content ──────────────────────────────────────────── */}
        <motion.div
          className="max-w-7xl mx-auto relative z-10"
          variants={containerVariants}
          initial="hidden"
          animate="visible"
        >
          {/* Header */}
          <motion.div variants={itemVariants} className="mb-10">
            <h1 className="text-4xl font-bold bg-gradient-to-r from-blue-400 to-indigo-400 bg-clip-text text-transparent flex items-center gap-5">
              <Clock className="w-10 h-10 text-blue-400" />
              Persetujuan Absensi Khusus
            </h1>
            <p className="text-slate-400 mt-2 text-xl flex items-center gap-3">
              <Sparkles className="w-4 h-4" />
              Tinjau dan proses pengajuan late attendance maupun izin/cuti/sakit
            </p>
            <motion.p
              className="text-xl font-medium text-blue-300 mt-2"
              initial={{ scale: 0.9 }}
              animate={{ scale: 1 }}
            >
              {items.length} permintaan menunggu tindakan
            </motion.p>
          </motion.div>

          {/* ── States: Loading / Empty / List ─────────────────────── */}
          {loading ? (
            <div className="flex justify-center py-32">
              <motion.div
                animate={{ rotate: 360 }}
                transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                className="w-20 h-20 border-4 border-blue-500 border-t-transparent rounded-full"
              />
            </div>
          ) : items.length === 0 ? (
            <motion.div className="text-center py-32" variants={itemVariants}>
              <CheckCircle className="w-24 h-24 text-slate-600 mx-auto mb-6" />
              <p className="text-2xl text-slate-400">
                Tidak ada permintaan saat ini
              </p>
              <p className="text-slate-500 mt-4">
                Semua tugas Anda sudah selesai! 🎉
              </p>
            </motion.div>
          ) : (
            <motion.div
              className="space-y-6"
              variants={containerVariants}
              initial="hidden"
              animate="visible"
            >
              {items.map((r) => {
                const isExpanded = expandedId === r._id;

                return (
                  <motion.div key={r._id} variants={itemVariants}>
                    <div className="bg-slate-900/90 backdrop-blur-2xl rounded-3xl border border-blue-900/50 shadow-2xl overflow-hidden">
                      {/* ── Card Body ─────────────────────────────── */}
                      <div className="p-8">
                        {/* Top row: user info + approve btn */}
                        <div className="flex items-start justify-between gap-6">
                          {/* Left – info grid */}
                          <div className="flex-1 space-y-4">
                            {/* User name + email */}
                            <div className="flex items-center gap-3">
                              <div className="w-11 h-11 rounded-full bg-slate-800 border border-blue-800/60 flex items-center justify-center">
                                <User className="w-6 h-6 text-blue-400" />
                              </div>
                              <div>
                                <p className="text-lg font-semibold text-white">
                                  {r.user_id?.full_name || "Unknown User"}
                                </p>
                                <p className="text-sm text-slate-400">
                                  {r.user_id?.email || "-"}
                                </p>
                              </div>
                            </div>

                            {/* Detail grid */}
                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mt-2">
                              {/* Tanggal */}
                              <div className="bg-slate-800/70 backdrop-blur-sm rounded-2xl p-4 border border-slate-700/50">
                                <p className="text-xs text-slate-400 uppercase tracking-wide mb-1">
                                  {r.request_kind === "absence" ? "Rentang Tanggal" : "Tanggal Absensi"}
                                </p>
                                <p className="text-base font-semibold text-slate-100 flex items-center gap-2">
                                  <Clock className="w-4 h-4 text-blue-400" />
                                  {r.request_kind === "absence"
                                    ? `${new Date(r.start_date).toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric" })} - ${new Date(r.end_date).toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric" })}`
                                    : new Date(r.date).toLocaleDateString("id-ID", {
                                        day: "numeric",
                                        month: "long",
                                        year: "numeric",
                                      })}
                                </p>
                              </div>

                              {/* Alasan */}
                              <div className="bg-slate-800/70 backdrop-blur-sm rounded-2xl p-4 border border-slate-700/50 sm:col-span-2">
                                <p className="text-xs text-slate-400 uppercase tracking-wide mb-1">
                                  {r.request_kind === "absence" ? "Alasan Izin/Cuti/Sakit" : "Alasan Keterlambatan"}
                                </p>
                                <p className="text-base text-slate-200">
                                  {r.request_kind === "absence" ? (r.reason || "-") : (r.late_reason || "-")}
                                </p>
                              </div>
                            </div>

                            {r.request_kind === "absence" && resolveAttachmentUrl(r) && (
                              <div className="mt-3 p-3 bg-slate-800/50 border border-slate-700 rounded-xl">
                                <p className="text-xs text-slate-400 uppercase tracking-wide mb-2">
                                  Lampiran
                                </p>
                                <div className="flex flex-col gap-2">
                                  {!isPdfAttachment(resolveAttachmentUrl(r)) && (
                                    <img
                                      src={resolveAttachmentUrl(r)}
                                      alt="Lampiran absence"
                                      className="max-h-56 rounded-lg border border-slate-700 object-contain"
                                      onError={(e) => {
                                        e.currentTarget.style.display = "none";
                                      }}
                                    />
                                  )}
                                  <a
                                    href={resolveAttachmentUrl(r)}
                                    target="_blank"
                                    rel="noreferrer"
                                    className="text-sm text-blue-400 hover:text-blue-300 underline"
                                  >
                                    Lihat / Unduh Lampiran
                                  </a>
                                </div>
                              </div>
                            )}

                            {/* Status badge */}
                            <div className="flex items-center gap-2 mt-1">
                              <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-amber-900/40 border border-amber-700/50 rounded-full">
                                <AlertCircle className="w-4 h-4 text-amber-400" />
                                <span className="text-xs font-medium text-amber-300 capitalize">
                                  {r.request_kind === "absence"
                                    ? `absence:${r.type} • ${r.status}`
                                    : `late • ${r.status}`}
                                </span>
                              </span>
                            </div>
                          </div>

                          {/* Right – Approve button */}
                          <motion.button
                            onClick={() => onApprove(r._id, r.request_kind)}
                            className="flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700 text-white rounded-2xl font-semibold shadow-lg transition-all whitespace-nowrap"
                            whileHover={{ scale: 1.05 }}
                            whileTap={{ scale: 0.97 }}
                          >
                            <CheckCircle className="w-5 h-5" />
                            Setujui
                          </motion.button>
                        </div>

                        {/* ── Reject Toggle Button ──────────────────── */}
                        <div className="mt-6 pt-5 border-t border-slate-700/50">
                          <motion.button
                            onClick={() =>
                              setExpandedId(isExpanded ? null : r._id)
                            }
                            className="flex items-center gap-2 text-sm text-slate-400 hover:text-red-400 transition-colors"
                            whileHover={{ x: 4 }}
                          >
                            <XCircle className="w-4 h-4" />
                            Tolak Permintaan
                            {isExpanded ? (
                              <ChevronUp className="w-4 h-4" />
                            ) : (
                              <ChevronDown className="w-4 h-4" />
                            )}
                          </motion.button>
                        </div>
                      </div>

                      {/* ── Reject Panel (collapsible) ──────────────── */}
                      {isExpanded && (
                        <motion.div
                          initial={{ height: 0, opacity: 0 }}
                          animate={{ height: "auto", opacity: 1 }}
                          exit={{ height: 0, opacity: 0 }}
                          transition={{ duration: 0.3, ease: "easeInOut" }}
                          className="border-t border-red-900/40 bg-slate-900/60 p-8"
                        >
                          <label className="flex items-center gap-3 text-base font-medium text-slate-300 mb-3">
                            <FileText className="w-5 h-5 text-red-400" />
                            Alasan Penolakan {r.request_kind === "late" && <span className="text-red-400">*</span>}
                          </label>
                          <textarea
                            value={rejectReasonById[r._id] || ""}
                            onChange={(e) =>
                              setRejectReasonById((prev) => ({
                                ...prev,
                                [r._id]: e.target.value,
                              }))
                            }
                            rows={3}
                            placeholder={
                              r.request_kind === "absence"
                                ? "Opsional (rejection absence tidak menyimpan alasan)"
                                : "Tuliskan alasan penolakan (min. 3 karakter)..."
                            }
                            className="w-full px-5 py-4 bg-slate-800/50 border border-slate-700 rounded-2xl text-white placeholder-slate-500 focus:ring-2 focus:ring-red-500 focus:border-transparent transition-all backdrop-blur-sm resize-none"
                          />

                          <div className="flex gap-4 mt-4">
                            <motion.button
                              onClick={() => setExpandedId(null)}
                              className="px-6 py-3 bg-slate-800/70 border border-slate-700 rounded-2xl text-slate-300 hover:bg-slate-700/70 font-semibold transition-all"
                              whileHover={{ scale: 1.03 }}
                            >
                              Batalkan
                            </motion.button>

                            <motion.button
                              onClick={() => onReject(r._id, r.request_kind)}
                              className="flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-red-600 to-rose-600 hover:from-red-700 hover:to-rose-700 text-white rounded-2xl font-semibold shadow-lg relative overflow-hidden group transition-all"
                              whileHover={{ scale: 1.05 }}
                              whileTap={{ scale: 0.97 }}
                            >
                              <motion.div
                                className="absolute inset-0 bg-gradient-to-r from-transparent via-white to-transparent opacity-0 group-hover:opacity-20"
                                animate={{ x: ["-100%", "100%"] }}
                                transition={{
                                  duration: 1.5,
                                  repeat: Infinity,
                                  ease: "linear",
                                }}
                              />
                              <XCircle className="w-5 h-5 relative z-10" />
                              <span className="relative z-10">
                                Konfirmasi Penolakan
                              </span>
                            </motion.button>
                          </div>
                        </motion.div>
                      )}
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