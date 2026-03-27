import { useState, useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "framer-motion";
import {
  BarChart3,
  TrendingUp,
  Clock,
  CheckCircle2,
  XCircle,
  AlertCircle,
  Calendar,
  RefreshCw,
  Users,
  CalendarCheck,
  Timer,
  Upload,
  FileSpreadsheet,
  X,
  User,
  Briefcase,
  Activity,
  ListTodo,
  FileText,
  UserCheck,
  AlertTriangle,
  ChevronRight,
  Layers,
  BarChart2,
} from "lucide-react";
import {
  fetchAttendanceOverview,
  fetchAttendanceDetails,
  fetchUsers,
  fetchDivisions,
  fetchAttendanceDrilldown,
  importAttendanceExcel,
} from "../utils/api.jsx";
import { buildExcelPreview } from "../utils/excelPreview.js";
import toast from "react-hot-toast";
import AttendanceDetailModal from "../components/AttendanceDetailModal.jsx";
import SearchSelect from "../components/SearchSelect.jsx";

const STATUS_COLORS = {
  normal: "bg-green-500/20 text-green-400 border-green-500/30",
  late: "bg-red-500/20 text-red-400 border-red-500/30",
  late_checkin: "bg-orange-500/20 text-orange-400 border-orange-500/30",
  early_checkout: "bg-yellow-500/20 text-yellow-400 border-yellow-500/30",
  manual: "bg-blue-500/20 text-blue-400 border-blue-500/30",
  forget: "bg-purple-500/20 text-purple-400 border-purple-500/30",
};

const STATUS_LABELS = {
  normal: "Normal",
  late: "Terlambat Keduanya",
  late_checkin: "Berangkat Telat",
  early_checkout: "Pulang Cepat",
  manual: "Manual",
  forget: "Lupa Presensi",
};

const LATE_REQUEST_METRICS = {
  total: { metric: "late_request_status", value: "all", label: "Semua Pengajuan" },
  pending: { metric: "late_request_status", value: "pending", label: "Pending" },
  approved: { metric: "late_request_status", value: "approved", label: "Approved" },
  rejected: { metric: "late_request_status", value: "rejected", label: "Rejected" },
  filled: { metric: "late_request_status", value: "filled", label: "Filled" },
};

// ─────────────────────────────────────────────────────────────
// WorkloadUserModal — extracted component for clarity
// ─────────────────────────────────────────────────────────────
const MODAL_TABS = [
  { id: "summary", label: "Ringkasan", icon: BarChart2 },
  { id: "timeline", label: "Timeline", icon: Calendar },
  { id: "projects", label: "Project & Task", icon: Briefcase },
  { id: "activities", label: "Aktivitas", icon: Activity },
  { id: "daily", label: "Detail Harian", icon: ListTodo },
];

const WorkloadUserModal = ({
  user,
  allRows,
  filters,
  granularity,
  setGranularity,
  onClose,
  formatDate,
  formatTime,
  diffHours,
}) => {
  const [activeTab, setActiveTab] = useState("summary");

  const userId = user.user_id;
  const modalRows = allRows
    .filter((r) => (r.user_id?._id || r.user_id) === userId)
    .slice()
    .sort((a, b) => new Date(b.date || "").getTime() - new Date(a.date || "").getTime());

  const timelineObj =
    granularity === "day"
      ? user.by_day
      : granularity === "week"
      ? user.by_week
      : user.by_month;

  const timelineEntries = Object.entries(timelineObj || {})
    .sort(([a], [b]) => (a < b ? -1 : 1))
    .slice(-60);

  const topProjects = user.projects_ranked?.slice(0, 10) || [];
  const topTasksByProject = user.tasks_by_project_ranked?.slice(0, 8) || [];
  const topTasks = user.tasks_ranked?.slice(0, 15) || [];
  const topActivities = user.activities_ranked?.slice(0, 12) || [];

  const maxTimelineVal = Math.max(...timelineEntries.map(([, v]) => v), 1);

  return (
    <div
      className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4"
      onClick={onClose}
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.96, y: 16 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.96, y: 16 }}
        transition={{ duration: 0.18 }}
        className="w-full max-w-5xl bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl overflow-hidden flex flex-col"
        style={{ maxHeight: "90vh" }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* ── Modal Header ── */}
        <div className="shrink-0 px-6 py-4 border-b border-slate-700 bg-slate-800/60">
          <div className="flex items-start justify-between gap-4">
            {/* User info */}
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-10 h-10 rounded-full bg-indigo-500/20 flex items-center justify-center shrink-0">
                <User className="w-5 h-5 text-indigo-300" />
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-white font-bold text-base leading-tight">
                    {user.user_name}
                  </span>
                  <span className="text-xs text-slate-400 bg-slate-700/60 px-2 py-0.5 rounded-full font-mono">
                    {user.employee_code}
                  </span>
                </div>
                <div className="text-xs text-slate-400 mt-0.5">
                  {user.division_name} &nbsp;·&nbsp;
                  <span className="text-slate-300">
                    {filters.start_date || "–"} s/d {filters.end_date || "–"}
                  </span>
                </div>
              </div>
            </div>

            {/* Quick stats pills */}
            <div className="hidden lg:flex items-center gap-2 shrink-0">
              <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-700/50 text-sm">
                <Clock className="w-3.5 h-3.5 text-blue-400" />
                <span className="text-white font-semibold">{user.total_worked_hours.toFixed(1)}</span>
                <span className="text-slate-400 text-xs">jam</span>
              </div>
              <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-700/50 text-sm">
                <Layers className="w-3.5 h-3.5 text-indigo-400" />
                <span className="text-white font-semibold">{user.total_hour_weight.toFixed(1)}</span>
                <span className="text-slate-400 text-xs">bobot</span>
              </div>
              <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-700/50 text-sm">
                <CalendarCheck className="w-3.5 h-3.5 text-green-400" />
                <span className="text-white font-semibold">{user.attendances}</span>
                <span className="text-slate-400 text-xs">presensi</span>
              </div>
            </div>

            {/* Granularity + Close */}
            <div className="flex items-center gap-2 shrink-0">
              <select
                value={granularity}
                onChange={(e) => setGranularity(e.target.value)}
                className="px-3 py-1.5 bg-slate-800 border border-slate-700 rounded-lg text-white text-sm"
              >
                <option value="day">Harian</option>
                <option value="week">Mingguan</option>
                <option value="month">Bulanan</option>
              </select>
              <button
                onClick={onClose}
                className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition-colors"
                type="button"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Internal Tab Navigation */}
          <div className="flex gap-1 mt-4 overflow-x-auto pb-0.5">
            {MODAL_TABS.map((tab) => {
              const Icon = tab.icon;
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setActiveTab(tab.id)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm whitespace-nowrap transition-all ${
                    activeTab === tab.id
                      ? "bg-indigo-600/80 text-white font-medium"
                      : "text-slate-400 hover:text-white hover:bg-slate-700/50"
                  }`}
                >
                  <Icon className="w-3.5 h-3.5" />
                  {tab.label}
                </button>
              );
            })}
          </div>
        </div>

        {/* ── Modal Body (scrollable per tab) ── */}
        <div className="flex-1 overflow-y-auto">
          {/* ── TAB: Ringkasan ── */}
          {activeTab === "summary" && (
            <div className="p-6 space-y-6">
              {/* Metric cards */}
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                {[
                  {
                    label: "Jam Dikerjakan",
                    value: `${user.total_worked_hours.toFixed(2)} jam`,
                    icon: Clock,
                    color: "text-blue-400",
                    bg: "bg-blue-500/10",
                  },
                  {
                    label: "Bobot Task",
                    value: user.total_hour_weight.toFixed(1),
                    icon: Layers,
                    color: "text-indigo-400",
                    bg: "bg-indigo-500/10",
                  },
                  {
                    label: "Total Presensi",
                    value: user.attendances,
                    icon: CalendarCheck,
                    color: "text-green-400",
                    bg: "bg-green-500/10",
                  },
                  {
                    label: "Rata-rata / Hari",
                    value: `${user.avg_hours_per_attendance.toFixed(2)} jam`,
                    icon: Timer,
                    color: "text-amber-400",
                    bg: "bg-amber-500/10",
                  },
                ].map((m) => {
                  const Icon = m.icon;
                  return (
                    <div
                      key={m.label}
                      className="bg-slate-800/50 rounded-xl border border-slate-700/60 p-4"
                    >
                      <div className={`inline-flex p-2 rounded-lg mb-3 ${m.bg}`}>
                        <Icon className={`w-4 h-4 ${m.color}`} />
                      </div>
                      <div className="text-xl font-bold text-white">{m.value}</div>
                      <div className="text-xs text-slate-400 mt-1">{m.label}</div>
                    </div>
                  );
                })}
              </div>

              {/* Project summary */}
              {topProjects.length > 0 && (
                <div className="bg-slate-800/50 rounded-xl border border-slate-700/60 p-4">
                  <h3 className="text-white font-semibold mb-3 flex items-center gap-2">
                    <Briefcase className="w-4 h-4 text-emerald-400" />
                    Top Project
                  </h3>
                  <div className="space-y-2">
                    {topProjects.slice(0, 5).map((p) => (
                      <div key={p.project_id} className="flex items-center gap-3">
                        <div className="flex-1 min-w-0">
                          <div className="text-sm text-slate-100 truncate">{p.project_name}</div>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          <div className="w-24 h-1.5 bg-slate-700 rounded-full overflow-hidden">
                            <div
                              className="h-full bg-emerald-500 rounded-full"
                              style={{ width: `${p.percentage}%` }}
                            />
                          </div>
                          <span className="text-xs text-emerald-400 font-semibold w-10 text-right">
                            {p.percentage}%
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Activity summary */}
              {topActivities.length > 0 && (
                <div className="bg-slate-800/50 rounded-xl border border-slate-700/60 p-4">
                  <h3 className="text-white font-semibold mb-3 flex items-center gap-2">
                    <Activity className="w-4 h-4 text-sky-400" />
                    Top Aktivitas
                  </h3>
                  <div className="flex flex-wrap gap-2">
                    {topActivities.slice(0, 6).map((a) => (
                      <span
                        key={a.name}
                        className="px-3 py-1 bg-sky-500/15 text-sky-300 border border-sky-500/25 rounded-full text-xs"
                      >
                        {a.name} &nbsp;·&nbsp; {a.count}x
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ── TAB: Timeline ── */}
          {activeTab === "timeline" && (
            <div className="p-6">
              <div className="bg-slate-800/50 rounded-xl border border-slate-700/60 p-4">
                <h3 className="text-white font-semibold mb-4 flex items-center gap-2">
                  <Calendar className="w-4 h-4 text-blue-400" />
                  Timeline Rekap Jam Kerja
                  <span className="ml-auto text-xs text-slate-400 font-normal">
                    {timelineEntries.length} periode
                  </span>
                </h3>
                {timelineEntries.length === 0 ? (
                  <div className="text-sm text-slate-400 py-6 text-center">
                    Tidak ada data timeline untuk periode ini.
                  </div>
                ) : (
                  <div className="space-y-2">
                    {timelineEntries.map(([key, val]) => {
                      const pct = Math.round((val / maxTimelineVal) * 100);
                      return (
                        <div key={key} className="flex items-center gap-3 group">
                          <div className="w-24 shrink-0 text-xs text-slate-400 text-right font-mono">
                            {key}
                          </div>
                          <div className="flex-1 h-6 bg-slate-700/50 rounded overflow-hidden">
                            <div
                              className="h-full bg-blue-500/70 rounded transition-all"
                              style={{ width: `${pct}%` }}
                            />
                          </div>
                          <div className="w-20 shrink-0 text-sm text-white font-semibold tabular-nums text-right">
                            {Number(val).toFixed(2)} jam
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ── TAB: Project & Task ── */}
          {activeTab === "projects" && (
            <div className="p-6 space-y-5">
              {/* Projects */}
              <div className="bg-slate-800/50 rounded-xl border border-slate-700/60 p-4">
                <h3 className="text-white font-semibold mb-4 flex items-center gap-2">
                  <Briefcase className="w-4 h-4 text-emerald-400" />
                  Rekap Project (Akumulasi Kontribusi)
                </h3>
                {topProjects.length === 0 ? (
                  <div className="text-sm text-slate-400 py-4 text-center">
                    Belum ada project tercatat.
                  </div>
                ) : (
                  <div className="divide-y divide-slate-700/50">
                    {topProjects.map((p, idx) => (
                      <div
                        key={p.project_id}
                        className="flex items-center gap-3 py-2.5 first:pt-0 last:pb-0"
                      >
                        <div className="w-6 text-xs text-slate-500 text-center tabular-nums">
                          {idx + 1}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="text-sm text-slate-100 font-medium truncate">
                            {p.project_name}
                          </div>
                          <div className="text-xs text-slate-500 mt-0.5">
                            Kontribusi: {p.contribution_sum.toFixed(1)} · {p.records} kemunculan
                          </div>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          <div className="w-20 h-1.5 bg-slate-700 rounded-full overflow-hidden">
                            <div
                              className="h-full bg-emerald-500 rounded-full"
                              style={{ width: `${p.percentage}%` }}
                            />
                          </div>
                          <span className="text-sm text-emerald-400 font-bold w-12 text-right tabular-nums">
                            {p.percentage}%
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Tasks by Project */}
              {topTasksByProject.length > 0 && (
                <div className="bg-slate-800/50 rounded-xl border border-slate-700/60 p-4">
                  <h3 className="text-white font-semibold mb-4 flex items-center gap-2">
                    <BarChart2 className="w-4 h-4 text-indigo-400" />
                    Bobot Task per Project
                  </h3>
                  <div className="divide-y divide-slate-700/50">
                    {topTasksByProject.map((p, idx) => (
                      <div
                        key={p.project_id}
                        className="flex items-center gap-3 py-2.5 first:pt-0 last:pb-0"
                      >
                        <div className="flex-1 min-w-0">
                          <div className="text-sm text-slate-100 truncate">{p.project_name}</div>
                          <div className="text-xs text-slate-500 mt-0.5">
                            {p.records} task
                          </div>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          <div className="w-20 h-1.5 bg-slate-700 rounded-full overflow-hidden">
                            <div
                              className="h-full bg-indigo-500 rounded-full"
                              style={{ width: `${p.percentage}%` }}
                            />
                          </div>
                          <span className="text-sm text-indigo-300 font-semibold w-16 text-right tabular-nums">
                            {p.total_hour_weight.toFixed(1)} ({p.percentage}%)
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Task list */}
              <div className="bg-slate-800/50 rounded-xl border border-slate-700/60 p-4">
                <h3 className="text-white font-semibold mb-4 flex items-center gap-2">
                  <ListTodo className="w-4 h-4 text-amber-400" />
                  Daftar Task (Bobot Jam)
                </h3>
                {topTasks.length === 0 ? (
                  <div className="text-sm text-slate-400 py-4 text-center">
                    Tidak ada task dengan bobot jam.
                  </div>
                ) : (
                  <div className="divide-y divide-slate-700/50">
                    {topTasks.map((t, idx) => (
                      <div
                        key={t.task_id}
                        className="flex items-center gap-3 py-2.5 first:pt-0 last:pb-0"
                      >
                        <div className="w-5 text-xs text-slate-500 text-center tabular-nums shrink-0">
                          {idx + 1}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="text-sm text-slate-100 font-medium truncate">{t.title}</div>
                          <div className="text-xs text-slate-500 mt-0.5 truncate">
                            {t.project_name || "–"}
                          </div>
                        </div>
                        <div className="shrink-0 text-right">
                          <div className="text-sm text-white font-semibold tabular-nums">
                            {t.total_hour_weight.toFixed(1)}
                          </div>
                          <div className="text-xs text-amber-400 tabular-nums">{t.percentage}%</div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ── TAB: Aktivitas ── */}
          {activeTab === "activities" && (
            <div className="p-6">
              <div className="bg-slate-800/50 rounded-xl border border-slate-700/60 p-4">
                <h3 className="text-white font-semibold mb-4 flex items-center gap-2">
                  <Activity className="w-4 h-4 text-sky-400" />
                  Rekap Aktivitas
                </h3>
                {topActivities.length === 0 ? (
                  <div className="text-sm text-slate-400 py-6 text-center">
                    Belum ada aktivitas tercatat.
                  </div>
                ) : (
                  <div className="divide-y divide-slate-700/50">
                    {topActivities.map((a, idx) => {
                      const maxCount = topActivities[0].count || 1;
                      return (
                        <div
                          key={a.name}
                          className="flex items-center gap-3 py-2.5 first:pt-0 last:pb-0"
                        >
                          <div className="w-5 text-xs text-slate-500 text-center tabular-nums shrink-0">
                            {idx + 1}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="text-sm text-slate-100">{a.name}</div>
                            <div className="mt-1 h-1.5 w-full bg-slate-700 rounded-full overflow-hidden">
                              <div
                                className="h-full bg-sky-500/70 rounded-full"
                                style={{ width: `${(a.count / maxCount) * 100}%` }}
                              />
                            </div>
                          </div>
                          <div className="shrink-0 text-right">
                            <div className="text-sm text-white font-semibold tabular-nums">
                              {a.count}x
                            </div>
                            <div className="text-xs text-slate-400">{a.percentage}%</div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ── TAB: Detail Harian ── */}
          {activeTab === "daily" && (
            <div className="p-6">
              <div className="bg-slate-800/50 rounded-xl border border-slate-700/60 p-4">
                <h3 className="text-white font-semibold mb-4 flex items-center gap-2">
                  <ListTodo className="w-4 h-4 text-violet-400" />
                  Detail Attendance per Hari
                  <span className="ml-auto text-xs text-slate-400 font-normal">
                    {modalRows.length} record
                  </span>
                </h3>
                {modalRows.length === 0 ? (
                  <div className="text-sm text-slate-400 py-6 text-center">
                    Tidak ada attendance pada periode ini.
                  </div>
                ) : (
                  <div className="space-y-3">
                    {modalRows.map((row, idx) => {
                      const worked = diffHours(row.checkIn_at, row.checkOut_at);
                      const tasksAll = Array.isArray(row.tasks_today) ? row.tasks_today : [];
                      const tasksApproved = tasksAll.filter((t) => t?.status === "approved");
                      const doneTaskProjectIds = new Set(
                        tasksApproved.map((t) => t?.project_id?._id || t?.project_id).filter(Boolean)
                      );
                      const projectsAll = Array.isArray(row.projects) ? row.projects : [];
                      const projectsToShow =
                        doneTaskProjectIds.size > 0
                          ? projectsAll.filter((p) => doneTaskProjectIds.has(p?.project_id?._id || p?.project_id))
                          : [];
                      return (
                        <div
                          key={row._id || row.date || idx}
                          className="bg-slate-900/40 border border-slate-700/60 rounded-xl overflow-hidden"
                        >
                          {/* Row header */}
                          <div className="flex items-center justify-between px-4 py-3 border-b border-slate-700/40">
                            <div className="flex items-center gap-3">
                              <Calendar className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                              <span className="text-white font-medium text-sm">
                                {formatDate(row.date)}
                              </span>
                              <span className="text-xs text-slate-400">
                                {row.checkIn_at ? formatTime(row.checkIn_at) : "–"} →{" "}
                                {row.checkOut_at ? formatTime(row.checkOut_at) : "–"}
                              </span>
                            </div>
                            <div className="flex items-center gap-2">
                              <span className="text-xs text-slate-400 tabular-nums">
                                {worked.toFixed(2)} jam
                              </span>
                              <span
                                className={`px-2.5 py-1 rounded-full text-xs font-medium border ${
                                  STATUS_COLORS[row.status] || "bg-slate-600 text-slate-200 border-slate-500"
                                }`}
                              >
                                {STATUS_LABELS[row.status] || row.status || "–"}
                              </span>
                            </div>
                          </div>

                          {/* Projects + Tasks */}
                          <div className="px-4 py-3 grid grid-cols-1 lg:grid-cols-2 gap-3">
                            {/* Projects */}
                            <div>
                              <div className="text-xs text-slate-500 mb-1.5 font-medium uppercase tracking-wide">
                                Project
                              </div>
                              {projectsToShow.length === 0 ? (
                                <div className="text-xs text-slate-600">–</div>
                              ) : (
                                <div className="flex flex-wrap gap-1.5">
                                  {projectsToShow.slice(0, 5).map((p, pIdx) => (
                                    <span
                                      key={p.project_id?._id || p.project_id || pIdx}
                                      className="px-2.5 py-1 bg-emerald-500/15 text-emerald-300 border border-emerald-500/25 rounded-full text-xs font-medium"
                                    >
                                      {p.project_id?.name || p.project_id?.code || "Proyek"}
                                      {p.contribution_percentage > 0 && (
                                        <span className="ml-1 opacity-75">
                                          +{Number(p.contribution_percentage || 0)}%
                                        </span>
                                      )}
                                    </span>
                                  ))}
                                  {projectsToShow.length > 5 && (
                                    <span className="px-2.5 py-1 bg-slate-700/40 text-slate-400 border border-slate-600/40 rounded-full text-xs">
                                      +{projectsToShow.length - 5} lagi
                                    </span>
                                  )}
                                </div>
                              )}
                            </div>

                            {/* Tasks */}
                            <div>
                              <div className="text-xs text-slate-500 mb-1.5 font-medium uppercase tracking-wide">
                                Task
                              </div>
                              {tasksApproved.length === 0 ? (
                                <div className="text-xs text-slate-600">–</div>
                              ) : (
                                <div className="flex flex-wrap gap-1.5">
                                  {tasksApproved.slice(0, 5).map((t, tIdx) => (
                                    <span
                                      key={t._id || `${t.title || t.name || "task"}-${tIdx}`}
                                      className="px-2.5 py-1 bg-indigo-500/15 text-indigo-200 border border-indigo-500/25 rounded-full text-xs font-medium"
                                    >
                                      {t.title || t.name || "Task"}
                                      {Number(t.hour_weight || 0) > 0 && (
                                        <span className="ml-1 opacity-75">
                                          {Number(t.hour_weight || 0).toFixed(1)}
                                        </span>
                                      )}
                                    </span>
                                  ))}
                                  {tasksApproved.length > 5 && (
                                    <span className="px-2.5 py-1 bg-slate-700/40 text-slate-400 border border-slate-600/40 rounded-full text-xs">
                                      +{tasksApproved.length - 5} lagi
                                    </span>
                                  )}
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </motion.div>
    </div>
  );
};

// ─────────────────────────────────────────────────────────────
// Main Component
// ─────────────────────────────────────────────────────────────
const AttendanceAnalytics = () => {
  const [activeTab, setActiveTab] = useState("overview");
  const [overview, setOverview] = useState(null);
  const [details, setDetails] = useState(null);
  const [loading, setLoading] = useState(false);
  const [drillOpen, setDrillOpen] = useState(false);
  const [drillLoading, setDrillLoading] = useState(false);
  const [drillTitle, setDrillTitle] = useState("");
  const [drillMetric, setDrillMetric] = useState(null);
  const [drillValue, setDrillValue] = useState(null);
  const [drillRows, setDrillRows] = useState([]);
  const [drillPagination, setDrillPagination] = useState(null);
  const [filters, setFilters] = useState({
    start_date: "",
    end_date: "",
    user_id: "",
    division_id: "",
    status: "",
    page: 1,
    limit: 20,
  });
  const [users, setUsers] = useState([]);
  const [divisions, setDivisions] = useState([]);
  const [workloadLoading, setWorkloadLoading] = useState(false);
  const [workloadRows, setWorkloadRows] = useState([]);
  const [workloadSummary, setWorkloadSummary] = useState([]);
  const [workloadPreset, setWorkloadPreset] = useState("month");
  const [workloadGranularity, setWorkloadGranularity] = useState("day");
  const [workloadUserQuery, setWorkloadUserQuery] = useState("");
  const [workloadModalOpen, setWorkloadModalOpen] = useState(false);
  const [workloadSelectedUserId, setWorkloadSelectedUserId] = useState(null);

  const [detailOpen, setDetailOpen] = useState(false);
  const [selectedAttendance, setSelectedAttendance] = useState(null);

  const [importFile, setImportFile] = useState(null);
  const [importPreview, setImportPreview] = useState(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState(null);

  const openDetail = (att) => { setSelectedAttendance(att); setDetailOpen(true); };

  const resetImportState = () => {
    setImportFile(null);
    setImportPreview(null);
    setImportResult(null);
    setPreviewLoading(false);
    setImporting(false);
  };

  const onPickImportFile = async (file) => {
    setImportFile(file || null);
    setImportResult(null);
    setImportPreview(null);
    if (!file) return;
    try {
      setPreviewLoading(true);
      const preview = await buildExcelPreview(file, { maxRows: 8, mode: "attendance" });
      setImportPreview(preview);
    } catch (e) {
      toast.error(e.message || "Gagal membuat preview Excel");
      setImportPreview(null);
    } finally {
      setPreviewLoading(false);
    }
  };

  const doImportAttendance = async () => {
    if (!importFile) return toast.error("Pilih file Excel terlebih dahulu");
    try {
      setImporting(true);
      setImportResult(null);
      const res = await importAttendanceExcel(importFile);
      setImportResult(res);
      if ((res?.success_rows || 0) > 0) {
        toast.success(`Import sukses: ${res.success_rows} baris`);
        await loadOverview();
        if (activeTab === "details") await loadDetails();
      } else {
        toast.error("Tidak ada baris yang berhasil diimport");
      }
    } catch (e) {
      toast.error(e.message || "Gagal import presensi");
      setImportResult({ error: e.message || "Gagal import presensi" });
    } finally {
      setImporting(false);
    }
  };

  const openDrilldown = async ({ title, metric, value }) => {
    try {
      setDrillOpen(true);
      setDrillTitle(title);
      setDrillMetric(metric);
      setDrillValue(value);
      setDrillLoading(true);
      const res = await fetchAttendanceDrilldown({
        metric,
        value,
        page: 1,
        limit: 20,
        start_date: filters.start_date || undefined,
        end_date: filters.end_date || undefined,
        user_id: filters.user_id || undefined,
        division_id: filters.division_id || undefined,
      });
      setDrillRows(res.data || []);
      setDrillPagination(res.pagination || null);
    } catch (error) {
      toast.error(error.message || "Gagal memuat drilldown");
    } finally {
      setDrillLoading(false);
    }
  };

  const loadMoreDrilldown = async (newPage) => {
    if (!drillMetric || !drillValue) return;
    try {
      setDrillLoading(true);
      const res = await fetchAttendanceDrilldown({
        metric: drillMetric,
        value: drillValue,
        page: newPage,
        limit: drillPagination?.limit || 20,
        start_date: filters.start_date || undefined,
        end_date: filters.end_date || undefined,
        user_id: filters.user_id || undefined,
        division_id: filters.division_id || undefined,
      });
      setDrillRows(res.data || []);
      setDrillPagination(res.pagination || null);
    } catch (error) {
      toast.error(error.message || "Gagal memuat drilldown");
    } finally {
      setDrillLoading(false);
    }
  };

  useEffect(() => {
    loadOverview();
    loadUsers();
    loadDivisions();
  }, []);

  useEffect(() => {
    if (activeTab === "details") loadDetails();
    if (activeTab === "workload") loadWorkload();
  }, [activeTab, filters]);

  useEffect(() => {
    if (activeTab !== "workload") {
      setWorkloadModalOpen(false);
      setWorkloadSelectedUserId(null);
    }
  }, [activeTab]);

  const loadOverview = async () => {
    try {
      setLoading(true);
      const response = await fetchAttendanceOverview({
        start_date: filters.start_date || undefined,
        end_date: filters.end_date || undefined,
        user_id: filters.user_id || undefined,
        division_id: filters.division_id || undefined,
      });
      setOverview(response.data);
    } catch (error) {
      toast.error(error.message || "Gagal memuat overview presensi");
    } finally {
      setLoading(false);
    }
  };

  const loadDetails = async () => {
    try {
      setLoading(true);
      const response = await fetchAttendanceDetails({
        page: filters.page,
        limit: filters.limit,
        start_date: filters.start_date || undefined,
        end_date: filters.end_date || undefined,
        user_id: filters.user_id || undefined,
        division_id: filters.division_id || undefined,
        status: filters.status || undefined,
      });
      setDetails(response);
    } catch (error) {
      toast.error(error.message || "Gagal memuat detail presensi");
    } finally {
      setLoading(false);
    }
  };

  const loadUsers = async () => {
    try {
      const response = await fetchUsers({ page: 1, pageSize: 1000 });
      setUsers(response.data || []);
    } catch (error) {
      console.error("Failed to load users:", error);
    }
  };

  const loadDivisions = async () => {
    try {
      const response = await fetchDivisions();
      setDivisions(response.data || []);
    } catch (error) {
      console.error("Failed to load divisions:", error);
    }
  };

  const formatDate = (date) => {
    if (!date) return "-";
    return new Date(date).toLocaleDateString("id-ID", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  };

  const formatTime = (date) => {
    if (!date) return "-";
    return new Date(date).toLocaleTimeString("id-ID", {
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const handleFilterChange = (key, value) => {
    setFilters((prev) => ({ ...prev, [key]: value, page: 1 }));
  };

  const handlePageChange = (newPage) => {
    setFilters((prev) => ({ ...prev, page: newPage }));
  };

  const getLocalDateString = (date) => {
    const d = new Date(date);
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return `${y}-${m}-${day}`;
  };

  const applyWorkloadPreset = (preset) => {
    const now = new Date();
    const today = getLocalDateString(now);
    let start = today;
    let end = today;

    if (preset === "week") {
      const day = now.getDay();
      const diffToMonday = day === 0 ? 6 : day - 1;
      const monday = new Date(now);
      monday.setDate(now.getDate() - diffToMonday);
      const sunday = new Date(monday);
      sunday.setDate(monday.getDate() + 6);
      start = getLocalDateString(monday);
      end = getLocalDateString(sunday);
    } else if (preset === "month") {
      const first = new Date(now.getFullYear(), now.getMonth(), 1);
      const last = new Date(now.getFullYear(), now.getMonth() + 1, 0);
      start = getLocalDateString(first);
      end = getLocalDateString(last);
    }

    setWorkloadPreset(preset);
    setFilters((prev) => ({ ...prev, start_date: start, end_date: end, page: 1 }));
  };

  const diffHours = (start, end) => {
    if (!start || !end) return 0;
    const s = new Date(start).getTime();
    const e = new Date(end).getTime();
    if (!Number.isFinite(s) || !Number.isFinite(e)) return 0;
    // Hanya hitung durasi positif (end harus > start).
    if (e <= s) return 0;
    return (e - s) / 3600000;
  };

  const getWeekLabel = (rawDate) => {
    const d = new Date(rawDate);
    if (Number.isNaN(d.getTime())) return "-";
    const date = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
    const dayNum = date.getUTCDay() || 7;
    date.setUTCDate(date.getUTCDate() + 4 - dayNum);
    const yearStart = new Date(Date.UTC(date.getUTCFullYear(), 0, 1));
    const weekNo = Math.ceil((((date - yearStart) / 86400000) + 1) / 7);
    return `${date.getUTCFullYear()}-W${String(weekNo).padStart(2, "0")}`;
  };

  const aggregateWorkload = (rows) => {
    const map = new Map();
    rows.forEach((row) => {
      const userObj = row.user_id || {};
      const userId = userObj._id || "unknown";
      const userName = userObj.full_name || "Tanpa Nama";
      const employeeCode = userObj.employee_code || userObj.email || "-";
      const divisionName = userObj?.division?.name || "-";

      if (!map.has(userId)) {
        map.set(userId, {
          user_id: userId,
          user_name: userName,
          employee_code: employeeCode,
          division_name: divisionName,
          total_worked_hours: 0,
          worked_attendances: 0,
          total_hour_weight: 0,
          attendances: 0,
          by_day: {},
          by_week: {},
          by_month: {},
          activities: {},
          projects: {},
          tasks: {},
          tasks_by_project: {},
        });
      }

      const target = map.get(userId);
      const dayKey = row.date ? String(row.date).slice(0, 10) : "-";
      const weekKey = getWeekLabel(row.date);
      const monthKey = row.date ? String(row.date).slice(0, 7) : "-";
      const worked = diffHours(row.checkIn_at, row.checkOut_at);
      const tasks = Array.isArray(row.tasks_today) ? row.tasks_today : [];
      const projects = Array.isArray(row.projects) ? row.projects : [];
      const activities = Array.isArray(row.activities) ? row.activities : [];
      const tasksApproved = tasks.filter((t) => t?.status === "approved");

      target.attendances += 1;
      target.total_worked_hours += worked;
      if (row.checkIn_at && row.checkOut_at && worked > 0) {
        target.worked_attendances += 1;
      }
      target.by_day[dayKey] = (target.by_day[dayKey] || 0) + worked;
      target.by_week[weekKey] = (target.by_week[weekKey] || 0) + worked;
      target.by_month[monthKey] = (target.by_month[monthKey] || 0) + worked;

      // Bobot task hanya untuk task yang sudah di-approve (approved)
      tasksApproved.forEach((t) => {
        const hw = Number(t?.hour_weight) || 0;
        target.total_hour_weight += hw;
        const taskId =
          t?._id ||
          t?.task_id ||
          `${t?.title || t?.name || "task"}-${String(t?.project_id?._id || t?.project_id || "unknown_project")}`;
        const title = t?.title || t?.name || t?.task_title || "Task";
        const pid = t?.project_id?._id || t?.project_id || "unknown_project";
        const pname = t?.project_id?.name || t?.project_id?.code || t?.project_name || "Proyek";

        if (!target.tasks[taskId]) {
          target.tasks[taskId] = { task_id: taskId, title, project_id: pid, project_name: pname, total_hour_weight: 0, records: 0 };
        }
        target.tasks[taskId].total_hour_weight += hw;
        target.tasks[taskId].records += 1;

        if (!target.tasks_by_project[pid]) {
          target.tasks_by_project[pid] = { project_id: pid, project_name: pname, total_hour_weight: 0, records: 0 };
        }
        target.tasks_by_project[pid].total_hour_weight += hw;
        target.tasks_by_project[pid].records += 1;
      });

      // Jika ada task approved, project yang dihitung untuk kontribusi sebaiknya project yang memang terhubung ke task approved.
      const doneTaskProjectIds = new Set(
        tasksApproved
          .map((t) => t?.project_id?._id || t?.project_id)
          .filter(Boolean)
      );

      activities.forEach((a) => {
        const name = a?.name_activity || a?.name || String(a || "Aktivitas Lain");
        target.activities[name] = (target.activities[name] || 0) + 1;
      });

      const projectsToCount =
        doneTaskProjectIds.size > 0
          ? projects.filter((p) => doneTaskProjectIds.has(p?.project_id?._id || p?.project_id))
          : [];

      projectsToCount.forEach((p) => {
        const pid = p?.project_id?._id || p?.project_id || "unknown_project";
        const pname = p?.project_id?.name || p?.project_id?.code || p?.project_name || "Proyek";
        const contribution = Number(p?.contribution_percentage) || 0;
        if (!target.projects[pid]) {
          target.projects[pid] = { project_id: pid, project_name: pname, contribution_sum: 0, records: 0 };
        }
        target.projects[pid].records += 1;
        target.projects[pid].contribution_sum += contribution;
      });
    });

    return Array.from(map.values()).map((u) => {
      const activityTotal = Object.values(u.activities).reduce((s, n) => s + n, 0);
      const projectRaw = Object.values(u.projects);
      const projectTotalContribution = projectRaw.reduce((s, p) => s + p.contribution_sum, 0);
      const taskTotalHourWeight = u.total_hour_weight || 0;
      const taskRaw = Object.values(u.tasks);
      return {
        ...u,
        total_worked_hours: Number(u.total_worked_hours.toFixed(2)),
        avg_hours_per_attendance: Number((u.total_worked_hours / (u.worked_attendances || 1)).toFixed(2)),
        activities_ranked: Object.entries(u.activities)
          .map(([name, count]) => ({
            name,
            count,
            percentage: activityTotal > 0 ? Number(((count / activityTotal) * 100).toFixed(1)) : 0,
          }))
          .sort((a, b) => b.count - a.count),
        projects_ranked: projectRaw
          .map((p) => ({
            ...p,
            percentage: projectTotalContribution > 0 ? Number(((p.contribution_sum / projectTotalContribution) * 100).toFixed(1)) : 0,
          }))
          .sort((a, b) => b.contribution_sum - a.contribution_sum),
        tasks_ranked: taskRaw
          .map((t) => ({
            ...t,
            percentage: taskTotalHourWeight > 0 ? Number(((t.total_hour_weight / taskTotalHourWeight) * 100).toFixed(1)) : 0,
          }))
          .sort((a, b) => b.total_hour_weight - a.total_hour_weight),
        tasks_by_project_ranked: Object.values(u.tasks_by_project)
          .map((p) => ({
            ...p,
            percentage: taskTotalHourWeight > 0 ? Number(((p.total_hour_weight / taskTotalHourWeight) * 100).toFixed(1)) : 0,
          }))
          .sort((a, b) => b.total_hour_weight - a.total_hour_weight),
      };
    }).sort((a, b) => b.total_worked_hours - a.total_worked_hours);
  };

  const loadWorkload = async () => {
    try {
      setWorkloadLoading(true);
      const all = [];
      const maxPages = 30;
      const limit = 200;
      for (let page = 1; page <= maxPages; page += 1) {
        const response = await fetchAttendanceDetails({
          page,
          limit,
          start_date: filters.start_date || undefined,
          end_date: filters.end_date || undefined,
          user_id: undefined,
          division_id: filters.division_id || undefined,
          // Untuk tab workload, status tidak dipakai (status filter hanya muncul di tab "details")
          status: undefined,
        });
        const rows = response?.data || [];
        all.push(...rows);
        const pages = response?.pagination?.pages || 1;
        if (page >= pages || rows.length === 0) break;
      }
      setWorkloadRows(all);
      setWorkloadSummary(aggregateWorkload(all));
    } catch (error) {
      toast.error(error.message || "Gagal memuat analytics bobot kerja");
    } finally {
      setWorkloadLoading(false);
    }
  };

  const lateRequestCards = [
    { key: "total", label: "Total", colorClass: "bg-slate-700/30", textClass: "text-white", subTextClass: "text-slate-400" },
    { key: "pending", label: "Pending", colorClass: "bg-yellow-500/20 border border-yellow-500/30", textClass: "text-yellow-400", subTextClass: "text-yellow-400/80" },
    { key: "approved", label: "Approved", colorClass: "bg-green-500/20 border border-green-500/30", textClass: "text-green-400", subTextClass: "text-green-400/80" },
    { key: "rejected", label: "Rejected", colorClass: "bg-red-500/20 border border-red-500/30", textClass: "text-red-400", subTextClass: "text-red-400/80" },
    { key: "filled", label: "Filled", colorClass: "bg-blue-500/20 border border-blue-500/30", textClass: "text-blue-400", subTextClass: "text-blue-400/80" },
  ];

  const selectedWorkloadUser = workloadSelectedUserId
    ? workloadSummary.find((u) => u.user_id === workloadSelectedUserId) || null
    : null;

  const workloadUsersFiltered = (() => {
    const q = workloadUserQuery.trim().toLowerCase();
    if (!q) return workloadSummary;
    return workloadSummary.filter((u) => {
      const name = (u.user_name || "").toLowerCase();
      const code = (u.employee_code || "").toLowerCase();
      const div = (u.division_name || "").toLowerCase();
      return name.includes(q) || code.includes(q) || div.includes(q);
    });
  })();

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 p-4 lg:p-8">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} className="mb-8">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h1 className="text-4xl font-bold bg-gradient-to-r from-blue-400 to-indigo-400 bg-clip-text text-transparent mb-2">
                Analytics Presensi
              </h1>
              <p className="text-slate-400">Analisis kehadiran dan statistik presensi karyawan</p>
            </div>
            <motion.button
              onClick={() => { loadOverview(); if (activeTab === "details") loadDetails(); }}
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              className="p-3 bg-slate-800/50 hover:bg-slate-700/70 rounded-xl text-slate-300 hover:text-white transition-all"
            >
              <RefreshCw className="w-5 h-5" />
            </motion.button>
          </div>

          <div className="flex gap-2 bg-slate-800/50 p-1 rounded-xl">
            {[
              { id: "overview", label: "Overview", icon: BarChart3 },
              { id: "details", label: "Detail Presensi", icon: TrendingUp },
              { id: "workload", label: "Bobot Kerja", icon: Activity },
            ].map((tab) => {
              const Icon = tab.icon;
              return (
                <motion.button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  className={`flex items-center gap-2 px-6 py-3 rounded-lg transition-all ${
                    activeTab === tab.id
                      ? "bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-lg"
                      : "text-slate-400 hover:text-white hover:bg-slate-700/50"
                  }`}
                >
                  <Icon className="w-5 h-5" />
                  {tab.label}
                </motion.button>
              );
            })}
          </div>
        </motion.div>

        {/* Filters */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-6 bg-slate-800/50 backdrop-blur-xl rounded-xl p-4 border border-slate-700/50"
        >
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">Tanggal Mulai</label>
              <input
                type="date"
                value={filters.start_date}
                onChange={(e) => handleFilterChange("start_date", e.target.value)}
                className="w-full px-3 py-2 bg-slate-700/50 border border-slate-600 rounded-lg text-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">Tanggal Akhir</label>
              <input
                type="date"
                value={filters.end_date}
                onChange={(e) => handleFilterChange("end_date", e.target.value)}
                className="w-full px-3 py-2 bg-slate-700/50 border border-slate-600 rounded-lg text-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">Divisi</label>
              <SearchSelect
                value={filters.division_id}
                onChange={(val) => handleFilterChange("division_id", val)}
                options={divisions.map((d) => ({ value: d._id, label: d.name }))}
                placeholder="Cari divisi..."
                allLabel="Semua Divisi"
              />
            </div>
            {activeTab !== "workload" && (
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">Karyawan</label>
                <SearchSelect
                  value={filters.user_id}
                  onChange={(val) => handleFilterChange("user_id", val)}
                  options={users.map((u) => ({ value: u._id, label: u.full_name, subLabel: `${u.employee_code || u.email}` }))}
                  placeholder="Cari karyawan..."
                  allLabel="Semua Karyawan"
                />
              </div>
            )}
            {activeTab === "details" && (
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">Status</label>
                <select
                  value={filters.status}
                  onChange={(e) => handleFilterChange("status", e.target.value)}
                  className="w-full px-3 py-2 bg-slate-700/50 border border-slate-600 rounded-lg text-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                >
                  <option value="">Semua Status</option>
                  {Object.entries(STATUS_LABELS).map(([key, label]) => (
                    <option key={key} value={key}>{label}</option>
                  ))}
                </select>
              </div>
            )}
          </div>
        </motion.div>

        {/* Import Excel */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-6 bg-slate-800/50 backdrop-blur-xl rounded-xl p-4 border border-slate-700/50"
        >
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-indigo-500/20 rounded-lg">
                <FileSpreadsheet className="w-5 h-5 text-indigo-300" />
              </div>
              <div>
                <div className="text-white font-semibold">Import / Migrasi Presensi (Excel)</div>
                <div className="text-xs text-slate-400">
                  Preview dulu sebelum upload. File akan diproses via API{" "}
                  <span className="text-slate-300">POST /import/attendance</span>.
                </div>
              </div>
            </div>
            <div className="flex flex-col sm:flex-row gap-2 sm:items-center">
              <input
                type="file"
                accept=".xlsx,.xls"
                onChange={(e) => onPickImportFile(e.target.files?.[0] || null)}
                className="block w-full sm:w-[320px] text-sm text-slate-300 file:mr-3 file:py-2 file:px-3 file:rounded-lg file:border-0 file:bg-slate-700/60 file:text-slate-200 hover:file:bg-slate-700"
              />
              <button
                type="button"
                onClick={resetImportState}
                disabled={!importFile && !importResult && !importPreview}
                className="px-3 py-2 rounded-lg bg-slate-700/40 hover:bg-slate-700 text-slate-200 text-sm disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Reset
              </button>
              <button
                type="button"
                onClick={doImportAttendance}
                disabled={!importFile || previewLoading || importing}
                className="px-4 py-2 rounded-lg bg-gradient-to-r from-blue-600 to-indigo-600 text-white text-sm font-semibold disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 justify-center"
              >
                <Upload className="w-4 h-4" />
                {importing ? "Mengimport..." : "Import"}
              </button>
            </div>
          </div>

          <div className="mt-4">
            {previewLoading && <div className="text-sm text-slate-400">Membuat preview...</div>}
            {!previewLoading && importPreview && (
              <div className="space-y-3">
                <div className="text-xs text-slate-400">
                  Sheet: <span className="text-slate-200">{importPreview.sheetName}</span> · Total baris data:{" "}
                  <span className="text-slate-200">{importPreview.totalRows}</span> · Preview:{" "}
                  <span className="text-slate-200">{importPreview.rows.length}</span> baris pertama
                </div>
                {importPreview.headers.length > 0 ? (
                  <div className="overflow-x-auto rounded-lg border border-slate-700">
                    <table className="min-w-full text-sm">
                      <thead className="bg-slate-900/60">
                        <tr>
                          {importPreview.displayHeaders.map((h) => (
                            <th key={h} className="text-left py-2 px-3 text-slate-300 font-medium whitespace-nowrap">{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {importPreview.rows.map((r, idx) => (
                          <tr key={idx} className="border-t border-slate-800">
                            {importPreview.displayHeaders.map((h) => (
                              <td key={h} className="py-2 px-3 text-slate-200 whitespace-nowrap">{String(r?.[h] ?? "")}</td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <div className="text-sm text-slate-400">Tidak ada header/kolom yang terbaca.</div>
                )}
                <div className="text-[11px] text-slate-500">
                  Catatan: preview hanya untuk memastikan format file benar—import tetap mengikuti parser backend.
                </div>
              </div>
            )}
          </div>

          {importResult && (
            <div className="mt-4 rounded-lg border border-slate-700 bg-slate-900/40 p-3">
              {importResult.error ? (
                <div className="text-sm text-red-300">Error: {importResult.error}</div>
              ) : (
                <div className="space-y-2">
                  <div className="flex flex-wrap gap-3 text-sm">
                    <span className="text-slate-200">Berhasil: <span className="font-bold text-white">{importResult.success_rows || 0}</span></span>
                    <span className="text-slate-200">Gagal: <span className="font-bold text-white">{importResult.failed_rows || 0}</span></span>
                  </div>
                  {(importResult.failed_rows || 0) > 0 && Array.isArray(importResult.errors) && (
                    <details className="text-sm">
                      <summary className="cursor-pointer text-slate-300 hover:text-white">
                        Lihat detail error ({importResult.errors.length})
                      </summary>
                      <div className="mt-2 max-h-56 overflow-y-auto space-y-1">
                        {importResult.errors.map((e, i) => (
                          <div key={i} className="text-xs text-slate-300">
                            <span className="text-slate-400">Row {e.rowNumber}:</span> {e.reason}
                          </div>
                        ))}
                      </div>
                    </details>
                  )}
                </div>
              )}
            </div>
          )}
        </motion.div>

        {/* Content */}
        {loading && <div className="text-center py-12 text-slate-400">Memuat data...</div>}

        {/* ── Overview Tab ── */}
        {!loading && activeTab === "overview" && overview && (
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              {[
                { icon: CalendarCheck, bg: "bg-blue-500/20", color: "text-blue-400", value: overview.total_attendances, label: "Total Presensi" },
                { icon: CheckCircle2, bg: "bg-green-500/20", color: "text-green-400", value: overview.by_status?.normal || 0, label: "Presensi Normal" },
                { icon: AlertCircle, bg: "bg-red-500/20", color: "text-red-400", value: (overview.by_status?.late || 0) + (overview.by_status?.late_checkin || 0), label: "Terlambat" },
                { icon: Timer, bg: "bg-purple-500/20", color: "text-purple-400", value: `${overview.attendance_rate?.toFixed(1) || 0}%`, label: "Tingkat Kehadiran" },
              ].map(({ icon: Icon, bg, color, value, label }) => (
                <motion.div key={label} whileHover={{ scale: 1.02 }} className="bg-slate-800/50 backdrop-blur-xl rounded-xl p-6 border border-slate-700/50">
                  <div className="flex items-center justify-between mb-4">
                    <div className={`p-3 ${bg} rounded-lg`}>
                      <Icon className={`w-6 h-6 ${color}`} />
                    </div>
                  </div>
                  <h3 className="text-2xl font-bold text-white mb-1">{value}</h3>
                  <p className="text-slate-400 text-sm">{label}</p>
                </motion.div>
              ))}
            </div>

            <div className="bg-slate-800/50 backdrop-blur-xl rounded-xl p-6 border border-slate-700/50">
              <h2 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
                <BarChart3 className="w-5 h-5" />
                Breakdown Status Presensi
              </h2>
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
                {Object.entries(STATUS_LABELS).map(([key, label]) => {
                  const count = overview.by_status?.[key] || 0;
                  const total = overview.total_attendances || 1;
                  const percentage = (count / total) * 100;
                  return (
                    <button
                      key={key}
                      type="button"
                      onClick={() => openDrilldown({ title: `Drilldown: ${label}`, metric: "status", value: key })}
                      className={`p-4 rounded-lg border cursor-pointer hover:opacity-80 transition-opacity ${STATUS_COLORS[key] || "bg-slate-700/50"}`}
                    >
                      <div className="text-2xl font-bold mb-1">{count}</div>
                      <div className="text-sm opacity-80">{label}</div>
                      <div className="mt-2 h-2 bg-slate-700/50 rounded-full overflow-hidden">
                        <div className="h-full bg-current opacity-50 rounded-full" style={{ width: `${percentage}%` }} />
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="bg-slate-800/50 backdrop-blur-xl rounded-xl p-6 border border-slate-700/50">
              <h2 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
                <AlertCircle className="w-5 h-5" />
                Pengajuan Presensi Terlambat
              </h2>
              <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                {lateRequestCards.map(({ key, label, colorClass, textClass, subTextClass }) => {
                  const lrMeta = LATE_REQUEST_METRICS[key];
                  return (
                    <button
                      key={key}
                      type="button"
                      onClick={() => openDrilldown({ title: `Drilldown Pengajuan: ${label}`, metric: lrMeta.metric, value: lrMeta.value })}
                      className={`p-4 rounded-lg text-left cursor-pointer hover:opacity-80 transition-opacity ${colorClass}`}
                    >
                      <div className={`text-2xl font-bold mb-1 ${textClass}`}>{overview.late_requests?.[key] || 0}</div>
                      <div className={`text-sm ${subTextClass}`}>{label}</div>
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="bg-slate-800/50 backdrop-blur-xl rounded-xl p-6 border border-slate-700/50">
              <h2 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
                <Clock className="w-5 h-5" />
                Breakdown Aktivitas (Activity)
              </h2>
              {(!overview.by_activity || overview.by_activity.length === 0) ? (
                <div className="text-sm text-slate-400">Belum ada aktivitas tercatat pada filter ini.</div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {overview.by_activity.map((a) => (
                    <button
                      key={a.activity_id}
                      type="button"
                      onClick={() => openDrilldown({ title: `Drilldown: Aktivitas • ${a.name_activity || "Unknown"}`, metric: "activity", value: a.activity_id })}
                      className="p-4 rounded-lg border bg-slate-700/30 border-slate-600 hover:bg-slate-700/50 transition-all text-left"
                    >
                      <div className="text-sm text-slate-300 font-semibold mb-1">{a.name_activity || "Unknown Activity"}</div>
                      <div className="text-2xl font-bold text-white">{a.count || 0}</div>
                      <div className="text-xs text-slate-400 mt-1">Jumlah kemunculan activity di presensi</div>
                    </button>
                  ))}
                </div>
              )}
            </div>

            {overview.by_date && overview.by_date.length > 0 && (
              <div className="bg-slate-800/50 backdrop-blur-xl rounded-xl p-6 border border-slate-700/50">
                <h2 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
                  <TrendingUp className="w-5 h-5" />
                  Tren Harian (30 Hari Terakhir)
                </h2>
                <div className="space-y-2 max-h-96 overflow-y-auto">
                  {overview.by_date.map((item, index) => (
                    <div key={index} className="flex items-center justify-between p-3 bg-slate-700/30 rounded-lg">
                      <div className="flex items-center gap-3">
                        <Calendar className="w-4 h-4 text-slate-400" />
                        <span className="text-white font-medium">{formatDate(item.date)}</span>
                      </div>
                      <div className="flex items-center gap-4">
                        <span className="text-slate-400 text-sm">{item.count} presensi</span>
                        <div className="flex gap-2">
                          {Object.entries(item.statuses || {}).map(([status, count]) => (
                            <span key={status} className={`px-2 py-1 rounded text-xs ${STATUS_COLORS[status] || "bg-slate-600"}`}>
                              {STATUS_LABELS[status]}: {count}
                            </span>
                          ))}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </motion.div>
        )}

        {/* ── Details Tab ── */}
        {!loading && activeTab === "details" && details && (
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
            <div className="bg-slate-800/50 backdrop-blur-xl rounded-xl p-6 border border-slate-700/50">
              <h2 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
                <Users className="w-5 h-5" />
                Detail Presensi
              </h2>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-slate-700">
                      <th className="text-left py-3 px-4 text-slate-300 font-medium">Tanggal</th>
                      <th className="text-left py-3 px-4 text-slate-300 font-medium">Karyawan</th>
                      <th className="text-left py-3 px-4 text-slate-300 font-medium">Check-in</th>
                      <th className="text-left py-3 px-4 text-slate-300 font-medium">Check-out</th>
                      <th className="text-left py-3 px-4 text-slate-300 font-medium">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {details.data?.map((attendance) => (
                      <tr
                        key={attendance._id}
                        onClick={() => openDetail(attendance)}
                        className="border-b border-slate-700/50 hover:bg-slate-700/20 cursor-pointer transition-colors"
                      >
                        <td className="py-3 px-4 text-white">{formatDate(attendance.date)}</td>
                        <td className="py-3 px-4 text-white">
                          <div>
                            <div className="font-medium">{attendance.user_id?.full_name || "-"}</div>
                            <div className="text-sm text-slate-400">{attendance.user_id?.employee_code || attendance.user_id?.email || "-"}</div>
                          </div>
                        </td>
                        <td className="py-3 px-4 text-white">{formatTime(attendance.checkIn_at)}</td>
                        <td className="py-3 px-4 text-white">{attendance.checkOut_at ? formatTime(attendance.checkOut_at) : "-"}</td>
                        <td className="py-3 px-4">
                          <span className={`px-3 py-1 rounded-full text-xs font-medium ${STATUS_COLORS[attendance.status] || "bg-slate-600"}`}>
                            {STATUS_LABELS[attendance.status] || attendance.status}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {details.pagination && (
                <div className="flex items-center justify-between mt-4">
                  <div className="text-slate-400 text-sm">
                    Menampilkan {((details.pagination.page - 1) * details.pagination.limit) + 1} –{" "}
                    {Math.min(details.pagination.page * details.pagination.limit, details.pagination.total)} dari{" "}
                    {details.pagination.total} presensi
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => handlePageChange(details.pagination.page - 1)}
                      disabled={details.pagination.page === 1}
                      className="px-4 py-2 bg-slate-700/50 hover:bg-slate-700 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg text-white transition-all"
                    >
                      Sebelumnya
                    </button>
                    <span className="px-4 py-2 text-slate-300">
                      Halaman {details.pagination.page} dari {details.pagination.pages}
                    </span>
                    <button
                      onClick={() => handlePageChange(details.pagination.page + 1)}
                      disabled={details.pagination.page >= details.pagination.pages}
                      className="px-4 py-2 bg-slate-700/50 hover:bg-slate-700 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg text-white transition-all"
                    >
                      Selanjutnya
                    </button>
                  </div>
                </div>
              )}
            </div>
          </motion.div>
        )}

        {/* ── Workload Tab ── */}
        {activeTab === "workload" && (
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
            <div className="bg-slate-800/50 backdrop-blur-xl rounded-xl p-6 border border-slate-700/50">
              <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
                <div>
                  <h2 className="text-xl font-bold text-white mb-1">Rekap Bobot Jam Kerja per User</h2>
                  <p className="text-sm text-slate-400">
                    Klik baris user untuk membuka rekap lengkap (attendance, project, task, aktivitas).
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  {["today", "week", "month"].map((preset) => (
                    <button
                      key={preset}
                      type="button"
                      onClick={() => applyWorkloadPreset(preset)}
                      className={`px-3 py-2 rounded-lg text-sm transition-colors ${
                        workloadPreset === preset ? "bg-blue-600 text-white" : "bg-slate-700/50 text-slate-200 hover:bg-slate-700"
                      }`}
                    >
                      {preset === "today" ? "Hari Ini" : preset === "week" ? "Minggu Ini" : "Bulan Ini"}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div className="bg-slate-800/50 backdrop-blur-xl rounded-xl p-6 border border-slate-700/50">
              <div className="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-4 mb-4">
                <div className="w-full lg:max-w-md">
                  <label className="block text-sm font-medium text-slate-300 mb-2">Cari user rekap</label>
                  <input
                    type="text"
                    value={workloadUserQuery}
                    onChange={(e) => setWorkloadUserQuery(e.target.value)}
                    placeholder="Ketik nama / kode karyawan..."
                    className="w-full px-3 py-2 bg-slate-700/50 border border-slate-600 rounded-lg text-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>
                <div className="text-xs text-slate-400">
                  {workloadLoading
                    ? "Memuat data..."
                    : workloadUsersFiltered.length
                    ? `${workloadUsersFiltered.length} user`
                    : "Tidak ada user"}
                </div>
              </div>

              {workloadLoading ? (
                <div className="text-slate-400 text-sm py-6">Memuat rekap bobot kerja...</div>
              ) : workloadUsersFiltered.length === 0 ? (
                <div className="text-slate-400 text-sm py-6">Tidak ada data untuk filter yang dipilih.</div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-slate-700 text-slate-300">
                        <th className="text-left py-2 px-3">User</th>
                        <th className="text-right py-2 px-3">Jam Dikerjakan</th>
                        <th className="text-right py-2 px-3">Bobot Task</th>
                        <th className="text-right py-2 px-3">Presensi</th>
                        <th className="text-right py-2 px-3">Rata-rata/hari</th>
                        <th className="text-left py-2 px-3"></th>
                      </tr>
                    </thead>
                    <tbody>
                      {workloadUsersFiltered.map((u) => (
                        <tr
                          key={u.user_id}
                          className="border-b border-slate-800 hover:bg-slate-700/20 cursor-pointer transition-colors"
                          onClick={() => { setWorkloadSelectedUserId(u.user_id); setWorkloadModalOpen(true); }}
                        >
                          <td className="py-2.5 px-3 text-white">
                            <div className="font-medium">{u.user_name}</div>
                            <div className="text-xs text-slate-400">{u.employee_code} · {u.division_name}</div>
                          </td>
                          <td className="py-2.5 px-3 text-right text-white font-semibold tabular-nums">
                            {u.total_worked_hours.toFixed(2)} jam
                          </td>
                          <td className="py-2.5 px-3 text-right text-indigo-300 font-semibold tabular-nums">
                            {u.total_hour_weight.toFixed(1)}
                          </td>
                          <td className="py-2.5 px-3 text-right text-slate-200 tabular-nums">{u.attendances}</td>
                          <td className="py-2.5 px-3 text-right text-slate-400 tabular-nums text-xs">
                            {u.avg_hours_per_attendance.toFixed(2)} jam
                          </td>
                          <td className="py-2.5 px-3 text-left">
                            <span className="text-blue-400 text-xs flex items-center gap-1">
                              Lihat Rekap <ChevronRight className="w-3 h-3" />
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </div>

      {/* ── Workload User Modal ── */}
      <AnimatePresence>
        {workloadModalOpen && selectedWorkloadUser && (
          <WorkloadUserModal
            user={selectedWorkloadUser}
            allRows={workloadRows}
            filters={filters}
            granularity={workloadGranularity}
            setGranularity={setWorkloadGranularity}
            onClose={() => { setWorkloadModalOpen(false); setWorkloadSelectedUserId(null); }}
            formatDate={formatDate}
            formatTime={formatTime}
            diffHours={diffHours}
          />
        )}
      </AnimatePresence>

      {/* ── Drilldown Modal ── */}
      {drillOpen && (
        <div
          className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4"
          onClick={() => { setDrillOpen(false); setDrillRows([]); setDrillPagination(null); }}
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            className="w-full max-w-3xl bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-4 border-b border-slate-700 flex items-center justify-between">
              <div>
                <div className="text-white font-bold">{drillTitle}</div>
                <div className="text-xs text-slate-400">
                  Menampilkan user + total kemunculan sesuai filter tanggal/divisi/karyawan
                </div>
              </div>
              <button
                className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-sm"
                onClick={() => { setDrillOpen(false); setDrillRows([]); setDrillPagination(null); }}
              >
                Tutup
              </button>
            </div>

            <div className="p-4">
              {drillLoading ? (
                <div className="text-slate-400 text-sm">Memuat...</div>
              ) : drillRows.length === 0 ? (
                <div className="text-slate-400 text-sm">Tidak ada data.</div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b border-slate-700 text-slate-300 text-sm">
                        <th className="text-left py-2 px-2">User</th>
                        <th className="text-left py-2 px-2">Divisi</th>
                        <th className="text-right py-2 px-2">Total</th>
                      </tr>
                    </thead>
                    <tbody>
                      {drillRows.map((r, idx) => (
                        <tr key={idx} className="border-b border-slate-800 text-sm">
                          <td className="py-2 px-2 text-white">
                            <div className="font-medium">{r.user?.full_name || "-"}</div>
                            <div className="text-xs text-slate-400">{r.user?.employee_code || r.user?.email || "-"}</div>
                          </td>
                          <td className="py-2 px-2 text-slate-200">{r.user?.division?.name || "-"}</td>
                          <td className="py-2 px-2 text-right text-white font-bold tabular-nums">{r.count || 0}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              {drillPagination && drillPagination.pages > 1 && (
                <div className="mt-4 flex items-center justify-between">
                  <div className="text-xs text-slate-400">
                    Halaman {drillPagination.page} / {drillPagination.pages} · Total {drillPagination.total}
                  </div>
                  <div className="flex gap-2">
                    <button
                      className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-sm disabled:opacity-50"
                      disabled={drillLoading || drillPagination.page <= 1}
                      onClick={() => loadMoreDrilldown(drillPagination.page - 1)}
                    >
                      Prev
                    </button>
                    <button
                      className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-sm disabled:opacity-50"
                      disabled={drillLoading || drillPagination.page >= drillPagination.pages}
                      onClick={() => loadMoreDrilldown(drillPagination.page + 1)}
                    >
                      Next
                    </button>
                  </div>
                </div>
              )}
            </div>
          </motion.div>
        </div>
      )}

      {/* ── Attendance Detail Modal ── */}
      {detailOpen && selectedAttendance && (
        <AttendanceDetailModal
          attendance={selectedAttendance}
          onClose={() => { setDetailOpen(false); setSelectedAttendance(null); }}
        />
      )}
    </div>
  );
};

export default AttendanceAnalytics;