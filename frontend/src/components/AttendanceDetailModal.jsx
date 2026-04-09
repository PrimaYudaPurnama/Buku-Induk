// ============================================================
// PASTE komponen ini ke AttendanceAnalytics.jsx kamu
// ============================================================

// 1. Tambahkan import ini (merge dengan import lucide yang sudah ada):
// Briefcase, Activity, ListTodo, FileText, UserCheck, XCircle as X

// 2. Paste komponen AttendanceDetailModal di bawah STATUS_LABELS / sebelum SearchSelect

// 3. Tambahkan state + handler di dalam AttendanceAnalytics:
//    const [detailOpen, setDetailOpen] = useState(false);
//    const [selectedAttendance, setSelectedAttendance] = useState(null);
//    const openDetail = (attendance) => { setSelectedAttendance(attendance); setDetailOpen(true); };

// 4. Di dalam <tbody> tabel details, ubah <tr> jadi clickable:
//    <tr key={attendance._id} onClick={() => openDetail(attendance)} className="... cursor-pointer">

// 5. Tambahkan modal di bawah Drilldown Modal:
//    {detailOpen && selectedAttendance && (
//      <AttendanceDetailModal
//        attendance={selectedAttendance}
//        onClose={() => { setDetailOpen(false); setSelectedAttendance(null); }}
//      />
//    )}
// ============================================================

import { motion, AnimatePresence } from "framer-motion";
import {
  X,
  CheckCircle2,
  XCircle,
  Clock,
  Calendar,
  User,
  Briefcase,
  Activity,
  ListTodo,
  FileText,
  UserCheck,
  AlertTriangle,
  ChevronRight,
} from "lucide-react";

const LATE_REQUEST_STATUS_COLORS = {
  pending:  "bg-yellow-500/20 text-yellow-300 border-yellow-500/30",
  approved: "bg-green-500/20 text-green-300 border-green-500/30",
  rejected: "bg-red-500/20 text-red-300 border-red-500/30",
  filled:   "bg-blue-500/20 text-blue-300 border-blue-500/30",
};

const TASK_STATUS_COLORS = {
  planned: "bg-slate-500/20 text-slate-300 border-slate-500/30",
  ongoing: "bg-blue-500/20 text-blue-300 border-blue-500/30",
  done:    "bg-green-500/20 text-green-300 border-green-500/30",
  approved:"bg-emerald-500/20 text-emerald-300 border-emerald-500/30",
  rejected:"bg-red-500/20 text-red-300 border-red-500/30",
};

const PROJECT_STATUS_COLORS = {
  planned:   "bg-slate-500/20 text-slate-300 border-slate-500/30",
  ongoing:   "bg-blue-500/20 text-blue-300 border-blue-500/30",
  completed: "bg-green-500/20 text-green-300 border-green-500/30",
  cancelled: "bg-red-500/20 text-red-300 border-red-500/30",
};

const fmt = (d) => d ? new Date(d).toLocaleDateString("id-ID", { year: "numeric", month: "short", day: "numeric" }) : "-";
const fmtTime = (d) => d ? new Date(d).toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" }) : "-";
const fmtDateTime = (d) => d ? `${fmt(d)}, ${fmtTime(d)}` : "-";

// Progress bar mini
const ProgressBar = ({ value = 0, colorClass = "bg-blue-500" }) => (
  <div className="flex items-center gap-2">
    <div className="flex-1 h-1.5 bg-slate-700 rounded-full overflow-hidden">
      <div
        className={`h-full rounded-full transition-all ${colorClass}`}
        style={{ width: `${Math.min(100, Math.max(0, value))}%` }}
      />
    </div>
    <span className="text-xs tabular-nums text-slate-300 w-8 text-right">{value}%</span>
  </div>
);

// Section wrapper
const Section = ({ icon: Icon, title, children, accent = "blue" }) => {
  const accents = {
    blue:   "from-blue-500/20 to-transparent border-blue-500/30 text-blue-400",
    green:  "from-green-500/20 to-transparent border-green-500/30 text-green-400",
    purple: "from-purple-500/20 to-transparent border-purple-500/30 text-purple-400",
    orange: "from-orange-500/20 to-transparent border-orange-500/30 text-orange-400",
    red:    "from-red-500/20 to-transparent border-red-500/30 text-red-400",
    indigo: "from-indigo-500/20 to-transparent border-indigo-500/30 text-indigo-400",
  };
  return (
    <div className={`rounded-xl border bg-gradient-to-r p-4 ${accents[accent]}`}>
      <div className="flex items-center gap-2 mb-3">
        <Icon className="w-4 h-4" />
        <span className="text-sm font-semibold tracking-wide uppercase">{title}</span>
      </div>
      {children}
    </div>
  );
};

const AttendanceDetailModal = ({ attendance, onClose }) => {
  if (!attendance) return null;

  const {
    user_id,
    date,
    checkIn_at,
    checkOut_at,
    status,
    late_reason,
    late_request_id,
    absence_type,
    leave_request_id,
    approved_by,
    approved_at,
    user_consent,
    tasks_today = [],
    projects = [],
    activities = [],
    note,
  } = attendance;

  const statusLabel = {
    normal:         "Normal",
    late:           "Terlambat Keduanya",
    late_checkin:   "Berangkat Telat",
    early_checkout: "Pulang Cepat",
    manual:         "Manual",
    forget:         "Lupa Presensi",
  }[status] || status;

  const statusColorMap = {
    normal:         "bg-green-500/20 text-green-300 border-green-500/30",
    late:           "bg-red-500/20 text-red-300 border-red-500/30",
    late_checkin:   "bg-orange-500/20 text-orange-300 border-orange-500/30",
    early_checkout: "bg-yellow-500/20 text-yellow-300 border-yellow-500/30",
    manual:         "bg-blue-500/20 text-blue-300 border-blue-500/30",
    forget:         "bg-purple-500/20 text-purple-300 border-purple-500/30",
  };

  const isLate = ["late", "late_checkin", "early_checkout"].includes(status);
  const doneTasks = tasks_today.filter((t) => t?.status === "done").length;
  const approvedTasks = tasks_today.filter((t) => t?.status === "approved").length;
  const totalTasks = tasks_today.length;
  const absenceTypeLabel = {
    none: "Tidak Absen",
    sick: "Sakit",
    leave: "Cuti",
    permission: "Izin",
  }[absence_type || "none"];

  return (
    <AnimatePresence>
      <div
        className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4"
        onClick={onClose}
      >
        <motion.div
          initial={{ opacity: 0, scale: 0.94, y: 16 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.94, y: 16 }}
          transition={{ type: "spring", damping: 22, stiffness: 300 }}
          className="w-full max-w-2xl bg-slate-900 border border-slate-700/80 rounded-2xl shadow-2xl overflow-hidden max-h-[90vh] flex flex-col"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="flex items-start justify-between p-5 border-b border-slate-700/80 bg-slate-800/60 shrink-0">
            <div className="flex items-start gap-3">
              <div className="p-2 bg-slate-700/60 rounded-xl mt-0.5">
                <User className="w-5 h-5 text-slate-300" />
              </div>
              <div>
                <div className="text-white font-bold text-lg leading-tight">
                  {user_id?.full_name || "-"}
                </div>
                <div className="text-xs text-slate-400 mt-0.5">
                  {user_id?.employee_code || user_id?.email || "-"}
                  {user_id?.division_id?.name && (
                    <span className="ml-2 text-slate-500">• {user_id.division_id.name}</span>
                  )}
                </div>
                <div className="flex items-center gap-2 mt-2">
                  <span className={`px-2.5 py-0.5 rounded-full text-xs font-semibold border ${statusColorMap[status] || "bg-slate-600"}`}>
                    {statusLabel}
                  </span>
                  <span className="text-xs text-slate-400 flex items-center gap-1">
                    <Calendar className="w-3 h-3" />
                    {fmt(date)}
                  </span>
                </div>
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-2 rounded-xl hover:bg-slate-700/70 text-slate-400 hover:text-white transition-all"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Scrollable body */}
          <div className="overflow-y-auto flex-1 p-5 space-y-4">

            {/* Check-in / Check-out */}
            <Section icon={Clock} title="Waktu Presensi" accent="blue">
              <div className="grid grid-cols-2 gap-3">
                <div className="bg-slate-800/60 rounded-lg p-3">
                  <div className="text-xs text-slate-400 mb-1 flex items-center gap-1">
                    <ChevronRight className="w-3 h-3 text-green-400" /> Check-in
                  </div>
                  <div className="text-white font-semibold">{fmtTime(checkIn_at)}</div>
                  <div className="text-xs text-slate-500 mt-0.5">{fmt(checkIn_at)}</div>
                  <div className="mt-2 flex items-center gap-1.5">
                    {user_consent?.checkIn
                      ? <><CheckCircle2 className="w-3 h-3 text-green-400" /><span className="text-xs text-green-400">Consent diberikan</span></>
                      : <><XCircle className="w-3 h-3 text-red-400" /><span className="text-xs text-red-400">Tanpa consent</span></>
                    }
                  </div>
                </div>
                <div className="bg-slate-800/60 rounded-lg p-3">
                  <div className="text-xs text-slate-400 mb-1 flex items-center gap-1">
                    <ChevronRight className="w-3 h-3 text-orange-400" /> Check-out
                  </div>
                  <div className={`font-semibold ${checkOut_at ? "text-white" : "text-slate-500"}`}>
                    {checkOut_at ? fmtTime(checkOut_at) : "Belum checkout"}
                  </div>
                  {checkOut_at && <div className="text-xs text-slate-500 mt-0.5">{fmt(checkOut_at)}</div>}
                  <div className="mt-2 flex items-center gap-1.5">
                    {user_consent?.checkOut
                      ? <><CheckCircle2 className="w-3 h-3 text-green-400" /><span className="text-xs text-green-400">Consent diberikan</span></>
                      : <><XCircle className="w-3 h-3 text-red-400" /><span className="text-xs text-red-400">Tanpa consent</span></>
                    }
                  </div>
                </div>
              </div>

              {/* Approval info */}
              {approved_by && (
                <div className="mt-3 flex items-center gap-2 text-xs text-slate-400 bg-slate-800/40 rounded-lg px-3 py-2">
                  <UserCheck className="w-3.5 h-3.5 text-green-400 shrink-0" />
                  <span>Disetujui oleh <span className="text-green-300 font-medium">{approved_by?.full_name || "-"}</span>
                  {approved_at && <span className="text-slate-500"> pada {fmtDateTime(approved_at)}</span>}
                  </span>
                </div>
              )}
            </Section>

            {/* Late Reason & Late Request */}
            {isLate && (
              <Section icon={AlertTriangle} title="Info Keterlambatan" accent="red">
                {late_reason && (
                  <div className="mb-3 bg-slate-800/60 rounded-lg p-3">
                    <div className="text-xs text-slate-400 mb-1">Alasan terlambat</div>
                    <div className="text-slate-200 text-sm">{late_reason}</div>
                  </div>
                )}

                {late_request_id ? (
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-slate-400">Status pengajuan</span>
                      <span className={`px-2 py-0.5 rounded-full text-xs font-semibold border ${LATE_REQUEST_STATUS_COLORS[late_request_id.status] || "bg-slate-600"}`}>
                        {late_request_id.status?.toUpperCase()}
                      </span>
                    </div>
                    {late_request_id.late_reason && late_request_id.late_reason !== late_reason && (
                      <div className="bg-slate-800/60 rounded-lg p-3">
                        <div className="text-xs text-slate-400 mb-1">Alasan pengajuan</div>
                        <div className="text-slate-200 text-sm">{late_request_id.late_reason}</div>
                      </div>
                    )}
                    {late_request_id.status === "approved" && late_request_id.approved_by && (
                      <div className="flex items-center gap-2 text-xs text-slate-400 bg-green-500/10 rounded-lg px-3 py-2 border border-green-500/20">
                        <CheckCircle2 className="w-3.5 h-3.5 text-green-400 shrink-0" />
                        <span>Disetujui oleh <span className="text-green-300 font-medium">{late_request_id.approved_by?.full_name || "-"}</span>
                        {late_request_id.approved_at && <span className="text-slate-500"> pada {fmtDateTime(late_request_id.approved_at)}</span>}
                        </span>
                      </div>
                    )}
                    {late_request_id.status === "rejected" && (
                      <div className="bg-red-500/10 rounded-lg px-3 py-2 border border-red-500/20 space-y-1">
                        <div className="flex items-center gap-2 text-xs text-red-300">
                          <XCircle className="w-3.5 h-3.5 shrink-0" />
                          <span>Ditolak oleh <span className="font-medium">{late_request_id.rejected_by?.full_name || "-"}</span>
                          {late_request_id.rejected_at && <span className="text-red-400/70"> pada {fmtDateTime(late_request_id.rejected_at)}</span>}
                          </span>
                        </div>
                        {late_request_id.rejected_reason && (
                          <div className="text-xs text-red-300/80 pl-5">"{late_request_id.rejected_reason}"</div>
                        )}
                      </div>
                    )}
                  </div>
                ) : (
                  !late_reason && (
                    <div className="text-sm text-slate-500 italic">Tidak ada pengajuan keterlambatan terkait.</div>
                  )
                )}
              </Section>
            )}

            {absence_type && absence_type !== "none" && (
              <Section icon={FileText} title="Info Ketidakhadiran" accent="orange">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs text-slate-400">Tipe</span>
                  <span className="px-2 py-0.5 rounded-full text-xs font-semibold border bg-orange-500/20 text-orange-300 border-orange-500/30">
                    {absenceTypeLabel}
                  </span>
                </div>
                {leave_request_id ? (
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-slate-400">Status Pengajuan</span>
                      <span className={`px-2 py-0.5 rounded-full text-xs font-semibold border ${
                        leave_request_id.status === "approved"
                          ? "bg-green-500/20 text-green-300 border-green-500/30"
                          : leave_request_id.status === "rejected"
                            ? "bg-red-500/20 text-red-300 border-red-500/30"
                            : "bg-yellow-500/20 text-yellow-300 border-yellow-500/30"
                      }`}>
                        {(leave_request_id.status || "-").toUpperCase()}
                      </span>
                    </div>
                    <div className="text-xs text-slate-400">
                      Periode: <span className="text-slate-200">{fmt(leave_request_id.start_date)} - {fmt(leave_request_id.end_date)}</span>
                    </div>
                    {leave_request_id.reason && (
                      <div className="bg-slate-800/60 rounded-lg p-3">
                        <div className="text-xs text-slate-400 mb-1">Alasan</div>
                        <div className="text-slate-200 text-sm">{leave_request_id.reason}</div>
                      </div>
                    )}
                    {leave_request_id.status === "approved" && leave_request_id.approved_by && (
                      <div className="text-xs text-green-300 bg-green-500/10 border border-green-500/20 rounded-lg px-3 py-2">
                        Disetujui oleh {leave_request_id.approved_by.full_name || "-"} pada {fmtDateTime(leave_request_id.approved_at)}
                      </div>
                    )}
                    {leave_request_id.status === "rejected" && (
                      <div className="text-xs text-red-300 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">
                        Ditolak oleh {leave_request_id.rejected_by?.full_name || "-"} pada {fmtDateTime(leave_request_id.rejected_at)}
                        {leave_request_id.rejected_reason ? ` • Alasan: ${leave_request_id.rejected_reason}` : ""}
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="text-sm text-slate-500 italic">Tidak ada data pengajuan yang terhubung.</div>
                )}
              </Section>
            )}

            {/* Activities */}
            <Section icon={Activity} title="Aktivitas" accent="indigo">
              {activities.length === 0 ? (
                <div className="text-sm text-slate-500 italic">Tidak ada aktivitas dicatat.</div>
              ) : (
                <div className="flex flex-wrap gap-2">
                  {activities.map((a, i) => (
                    <span key={a?._id || i} className="px-3 py-1 rounded-full bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 text-sm">
                      {a?.name_activity || "-"}
                    </span>
                  ))}
                </div>
              )}
            </Section>

            {/* Tasks */}
            <Section icon={ListTodo} title={`Tasks Hari Ini (${totalTasks})`} accent="purple">
              {totalTasks === 0 ? (
                <div className="text-sm text-slate-500 italic">Tidak ada task dicatat.</div>
              ) : (
                <>
                  {/* Summary bar */}
                  <div className="grid grid-cols-3 gap-2 mb-3">
                    <div className="bg-slate-800/60 rounded-lg p-2 text-center">
                      <div className="text-lg font-bold text-white">{totalTasks}</div>
                      <div className="text-[10px] text-slate-400">Total</div>
                    </div>
                    <div className="bg-green-500/10 rounded-lg p-2 text-center border border-green-500/20">
                      <div className="text-lg font-bold text-green-300">{doneTasks}</div>
                      <div className="text-[10px] text-green-400">Selesai</div>
                    </div>
                    <div className="bg-slate-800/60 rounded-lg p-2 text-center">
                      <div className="text-lg font-bold text-white">{approvedTasks}</div>
                      <div className="text-[10px] text-slate-400">Approved</div>
                    </div>
                  </div>
                  <div className="mt-3 space-y-2">
                    {tasks_today.map((task, i) => (
                      <div key={task?._id || i} className="bg-slate-800/60 rounded-lg p-3 flex items-start gap-3">
                        <div className="mt-0.5">
                          {["done", "approved"].includes(task?.status) ? (
                            <CheckCircle2 className="w-4 h-4 text-green-400" />
                          ) : task?.status === "rejected" ? (
                            <XCircle className="w-4 h-4 text-red-400" />
                          ) : (
                            <Clock className="w-4 h-4 text-blue-400" />
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-start justify-between gap-2">
                            <div className="text-sm text-white font-medium truncate">{task?.title || "-"}</div>
                            <span className={`shrink-0 px-2 py-0.5 rounded-full text-[10px] font-semibold border ${TASK_STATUS_COLORS[task?.status] || "bg-slate-600"}`}>
                              {task?.status === "planned"
                                ? "Planned"
                                : task?.status === "ongoing"
                                  ? "Ongoing"
                                  : task?.status === "done"
                                    ? "Done"
                                    : task?.status === "approved"
                                      ? "Approved"
                                      : task?.status === "rejected"
                                        ? "Rejected"
                                        : task?.status || "-"}
                            </span>
                          </div>
                          {typeof task?.hour_weight !== "undefined" && (
                            <div className="text-[11px] text-slate-400 mt-1">
                              Bobot jam: {Number(task?.hour_weight || 0).toFixed(1)}
                            </div>
                          )}
                          {task?.description && (
                            <div className="text-xs text-slate-400 mt-0.5 line-clamp-2">{task.description}</div>
                          )}
                          {task?.status === "approved" && task?.approved_at && (
                            <div className="text-[10px] text-green-400/70 mt-1">
                              Di-approve: {fmtDateTime(task.approved_at)}
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </>
              )}
            </Section>

            {/* Projects */}
            <Section icon={Briefcase} title={`Projects (${projects.length})`} accent="orange">
              {projects.length === 0 ? (
                <div className="text-sm text-slate-500 italic">Tidak ada project dicatat.</div>
              ) : (
                <div className="space-y-2">
                  {projects.map((p, i) => {
                    const proj = p?.project_id || p; // handle both populated & fallback
                    const contrib = p?.contribution_percentage;
                    return (
                        <div key={proj?._id || i} className="bg-slate-800/60 rounded-lg p-3">
                        <div className="flex items-start justify-between gap-2 mb-2">
                            <div>
                            <div className="text-sm text-white font-semibold">{proj?.name || "-"}</div>
                            <div className="text-xs text-slate-400">
                                {proj?.code && <span className="font-mono mr-2">{proj.code}</span>}
                                {proj?.work_type && <span className="capitalize">{proj.work_type}</span>}
                            </div>
                            </div>
                            <div className="flex items-center gap-2 shrink-0">
                            {contrib !== undefined && (
                                <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-orange-500/20 text-orange-300 border border-orange-500/30">
                                Kontribusi {contrib}%
                                </span>
                            )}
                            <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold border ${PROJECT_STATUS_COLORS[proj?.status] || "bg-slate-600"}`}>
                                {proj?.status}
                            </span>
                            </div>
                        </div>
                        <ProgressBar
                            value={proj?.percentage || 0}
                            colorClass={
                            proj?.status === "completed" ? "bg-green-500"
                            : proj?.status === "cancelled" ? "bg-red-500"
                            : "bg-orange-500"
                            }
                        />
                        {(proj?.start_date || proj?.end_date) && (
                            <div className="flex gap-3 mt-2 text-[10px] text-slate-500">
                            {proj.start_date && <span>Mulai: {fmt(proj.start_date)}</span>}
                            {proj.end_date && <span>Selesai: {fmt(proj.end_date)}</span>}
                            </div>
                        )}
                        </div>
                    );
                    })}
                </div>
              )}
            </Section>

            {/* Note */}
            {note && (
              <Section icon={FileText} title="Catatan" accent="green">
                <div className="text-sm text-slate-200 bg-slate-800/60 rounded-lg p-3">{note}</div>
              </Section>
            )}
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};

export default AttendanceDetailModal;