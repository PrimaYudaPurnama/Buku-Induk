import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  BarChart3, TrendingUp, Users, Target, Calendar, RefreshCw,
  Eye, CheckCircle2, Clock, X, Upload, FileSpreadsheet,
  AlertTriangle, Zap, ChevronRight, Activity, Award,
  ArrowUp, ArrowDown, Minus, Info, ListTodo, Hourglass,
  Timer, Hash, Building2, Mail, UserCheck, Flag, History,
  CalendarClock, CalendarX2, RotateCcw,
} from "lucide-react";
import {
  fetchProjectOverview,
  fetchProjectDetails,
  importProjectsExcel,
} from "../utils/api.jsx";
import { buildExcelPreview } from "../utils/excelPreview.js";
import toast from "react-hot-toast";

// ─── Constants ────────────────────────────────────────────────────────────────

const STATUS_COLORS = {
  planned:   { bg: "bg-sky-500/15",    text: "text-sky-300",    border: "border-sky-500/30",   dot: "bg-sky-400"    },
  ongoing:   { bg: "bg-amber-500/15",  text: "text-amber-300",  border: "border-amber-500/30", dot: "bg-amber-400"  },
  completed: { bg: "bg-emerald-500/15",text: "text-emerald-300",border: "border-emerald-500/30",dot: "bg-emerald-400"},
  cancelled: { bg: "bg-rose-500/15",   text: "text-rose-300",   border: "border-rose-500/30",  dot: "bg-rose-400"   },
};

const HEALTH_META = {
  on_track:    { label: "On Track",     icon: CheckCircle2,  color: "text-emerald-400", bg: "bg-emerald-500/15", border: "border-emerald-500/30" },
  // at_risk:     { label: "Berisiko",     icon: AlertTriangle, color: "text-amber-400",   bg: "bg-amber-500/15",   border: "border-amber-500/30"   },
  behind:      { label: "Terlambat",    icon: AlertTriangle, color: "text-rose-400",    bg: "bg-rose-500/15",    border: "border-rose-500/30"    },
  no_deadline: { label: "Tanpa Deadline", icon: Minus,       color: "text-slate-400",   bg: "bg-slate-500/15",   border: "border-slate-500/30"   },
  completed:   { label: "Selesai",      icon: CheckCircle2,  color: "text-emerald-400", bg: "bg-emerald-500/15", border: "border-emerald-500/30" },
  cancelled:   { label: "Dibatalkan",   icon: X,             color: "text-rose-400",    bg: "bg-rose-500/15",    border: "border-rose-500/30"    },
  no_target:   { label: "Tanpa Target", icon: Minus,         color: "text-slate-400",   bg: "bg-slate-500/15",   border: "border-slate-500/30"   },
};

const STATUS_LABELS    = { planned:"Direncanakan", ongoing:"Berjalan", completed:"Selesai", cancelled:"Dibatalkan" };
const WORK_TYPE_LABELS = { management:"Management", technic:"Teknis" };

const deriveWorkTypeFromCode = (code = "") => {
  const u = String(code).toUpperCase();
  if (u.startsWith("MAN"))  return "management";
  if (u.startsWith("PROJ")) return "technic";
  return "technic";
};

// ─── Tiny helpers ─────────────────────────────────────────────────────────────

const fmt = (date) => {
  if (!date) return "—";
  return new Date(date).toLocaleDateString("id-ID", { year:"numeric", month:"short", day:"numeric" });
};

const progressGradient = (pct) => {
  if (pct >= 80) return "from-emerald-500 to-teal-400";
  if (pct >= 50) return "from-amber-500 to-yellow-400";
  return "from-rose-500 to-red-400";
};

const stagger = (i) => ({
  initial:{ opacity:0, y:16 },
  animate:{ opacity:1, y:0 },
  transition:{ delay: i * 0.06, duration:0.4 },
});

// ─── Sub-components ──────────────────────────────────────────────────────────

function StatCard({ icon: Icon, color, value, label, sub }) {
  return (
    <motion.div
      whileHover={{ y:-3, scale:1.01 }}
      className="relative bg-slate-900/70 border border-slate-700/60 rounded-2xl p-5 overflow-hidden group"
    >
      <div className={`inline-flex p-2.5 rounded-xl mb-3 bg-gradient-to-br ${color} bg-opacity-20`}>
        <Icon className="w-5 h-5 text-white" />
      </div>
      <div className="text-3xl font-black text-white tracking-tight leading-none mb-1">{value}</div>
      <div className="text-slate-400 text-sm font-medium">{label}</div>
      {sub && <div className="text-slate-500 text-xs mt-1">{sub}</div>}
    </motion.div>
  );
}

function HealthBadge({ label }) {
  const meta = HEALTH_META[label] || HEALTH_META.no_deadline;
  const Icon = meta.icon;
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold ${meta.bg} ${meta.color} ${meta.border} border`}>
      <Icon className="w-3.5 h-3.5" />
      {meta.label}
    </span>
  );
}

function StatusBadge({ status }) {
  const c = STATUS_COLORS[status] || STATUS_COLORS.planned;
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold ${c.bg} ${c.text} ${c.border} border`}>
      <span className={`w-1.5 h-1.5 rounded-full ${c.dot}`} />
      {STATUS_LABELS[status] || status}
    </span>
  );
}

function ProgressBar({ pct, showLabel = false }) {
  return (
    <div className="space-y-1.5">
      {showLabel && (
        <div className="flex justify-between text-xs text-slate-400">
          <span>Progress</span>
          <span className="font-bold text-white">{pct}%</span>
        </div>
      )}
      <div className="h-2 bg-slate-800 rounded-full overflow-hidden">
        <motion.div
          initial={{ width:0 }}
          animate={{ width:`${pct}%` }}
          transition={{ duration:0.8, ease:"easeOut" }}
          className={`h-full rounded-full bg-gradient-to-r ${progressGradient(pct)}`}
        />
      </div>
    </div>
  );
}

function ContributorBar({ name, email, division, pct, hwTotal, taskCount, rank }) {
  const barColors = [
    "from-violet-500 to-purple-400","from-blue-500 to-cyan-400",
    "from-emerald-500 to-teal-400","from-amber-500 to-yellow-400",
    "from-rose-500 to-pink-400",
  ];
  const color = barColors[rank % barColors.length];
  return (
    <div className="flex items-center gap-3 py-2.5">
      <div className="w-6 text-center text-xs font-black text-slate-500">#{rank+1}</div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between mb-1">
          <div className="flex items-center gap-2 min-w-0">
            <div className="w-7 h-7 rounded-full bg-gradient-to-br from-slate-600 to-slate-700 flex items-center justify-center text-xs font-bold text-slate-200 shrink-0">
              {(name || "?")[0].toUpperCase()}
            </div>
            <div className="min-w-0">
              <div className="text-sm font-semibold text-white truncate">{name}</div>
              {division && <div className="text-xs text-slate-500 truncate">{division}</div>}
            </div>
          </div>
          <div className="text-right ml-3 shrink-0">
            <div className="text-sm font-black text-white">{pct}%</div>
            <div className="text-xs text-slate-500">{hwTotal}j • {taskCount} task</div>
          </div>
        </div>
        <div className="h-1.5 bg-slate-800 rounded-full overflow-hidden">
          <motion.div
            initial={{ width:0 }}
            animate={{ width:`${Math.min(pct, 100)}%` }}
            transition={{ duration:0.7, ease:"easeOut" }}
            className={`h-full rounded-full bg-gradient-to-r ${color}`}
          />
        </div>
      </div>
    </div>
  );
}

// ─── Target Info Block ────────────────────────────────────────────────────────
// Blok kecil untuk menampilkan target_end_date & riwayatnya

function TargetEndBlock({ project, health, compact = false }) {
  const [showHistory, setShowHistory] = useState(false);
  const hasTarget  = !!project?.target_end_date;
  const history    = project?.target_end_history ?? [];
  const revCount   = health?.target_revision_count ?? history.length;

  if (!hasTarget) {
    return (
      <div className={`flex items-center gap-2 ${compact ? "text-xs" : "text-sm"} text-slate-600`}>
        <Flag className="w-3.5 h-3.5 shrink-0" />
        <span>Belum ada target selesai</span>
      </div>
    );
  }

  const targetMeta  = HEALTH_META[health?.target_label] || HEALTH_META.no_target;
  const TargetIcon  = targetMeta.icon;

  return (
    <div className="space-y-1.5">
      {/* Row utama */}
      <div className="flex items-center gap-2 flex-wrap">
        <Flag className={`w-3.5 h-3.5 shrink-0 ${
          health?.days_target_overdue > 0 ? "text-rose-400" : "text-amber-400"
        }`} />
        <span className={compact ? "text-xs text-slate-400" : "text-sm text-slate-300"}>
          Target: <span className="font-semibold text-white">{fmt(project.target_end_date)}</span>
        </span>

        {/* Badge health target */}
        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-xs font-semibold border ${targetMeta.bg} ${targetMeta.color} ${targetMeta.border}`}>
          <TargetIcon className="w-3 h-3" />
          {targetMeta.label}
        </span>

        {/* Sisa hari / terlambat */}
        {health?.days_target_overdue > 0 ? (
          <span className="text-xs text-rose-400 font-semibold">
            {health.days_target_overdue} hari melewati target
          </span>
        ) : health?.days_to_target != null && health.days_to_target > 0 ? (
          <span className="text-xs text-sky-400">
            {health.days_to_target} hari ke target
          </span>
        ) : null}

        {/* Revisi count + toggle riwayat */}
        {revCount > 0 && (
          <button
            onClick={() => setShowHistory(!showHistory)}
            className="flex items-center gap-1 text-xs text-slate-500 hover:text-slate-300 transition-colors"
          >
            <RotateCcw className="w-3 h-3" />
            {revCount}× direvisi
          </button>
        )}
      </div>

      {/* Riwayat target (collapsible) */}
      <AnimatePresence>
        {showHistory && history.length > 0 && (
          <motion.div
            initial={{ height:0, opacity:0 }}
            animate={{ height:"auto", opacity:1 }}
            exit={{ height:0, opacity:0 }}
            className="overflow-hidden"
          >
            <div className="pl-5 pt-1 space-y-1">
              {history.map((d, i) => (
                <div key={i} className="flex items-center gap-2 text-xs text-slate-600">
                  <History className="w-3 h-3 shrink-0" />
                  <span>
                    #{i + 1} — {fmt(d)}
                    {i === history.length - 1 && (
                      <span className="ml-1 text-slate-500">(target saat ini)</span>
                    )}
                  </span>
                </div>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ─── Project Card (overview list) ─────────────────────────────────────────────

function ProjectCard({ projectData, onDetail, idx }) {
  const p        = projectData.project;
  const ts       = projectData.task_statistics;
  const att      = projectData.attendance_summary;
  const health   = projectData.health;
  const contribs = projectData.contributors || [];

  // FIX: hitung kontributor aktif dengan prioritas yang benar
  const activeUsers = att?.unique_active_users ?? contribs.length ?? 0;

  return (
    <motion.div
      {...stagger(idx)}
      whileHover={{ scale:1.005 }}
      className="bg-slate-900/60 border border-slate-700/50 hover:border-slate-500/70 rounded-2xl p-6 transition-colors duration-300"
    >
      {/* Header row */}
      <div className="flex items-start justify-between gap-4 mb-5">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2 mb-1.5">
            <h3 className="text-lg font-black text-white tracking-tight">{p.name}</h3>
            <StatusBadge status={p.status} />
            <HealthBadge label={health?.label} />
            <span className="px-2.5 py-1 rounded-lg text-xs font-semibold bg-slate-800 text-slate-300 border border-slate-700">
              {WORK_TYPE_LABELS[p.work_type] || p.work_type}
            </span>
          </div>

          {/* Timeline info */}
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-500">
            <span className="font-mono text-slate-400">{p.code}ppp</span>
            <span className="flex items-center gap-1">
              <Calendar className="w-3.5 h-3.5" />
              {fmt(p.start_date)} → {fmt(p.end_date)}
            </span>
            {health?.days_remaining != null && health.days_remaining > 0 && (
              <span className="flex items-center gap-1 text-sky-400">
                <Timer className="w-3.5 h-3.5" />{health.days_remaining} hari tersisa
              </span>
            )}
            {health?.days_overdue > 0 && (
              <span className="flex items-center gap-1 text-rose-400">
                <AlertTriangle className="w-3.5 h-3.5" />{health.days_overdue} hari terlambat
              </span>
            )}
          </div>

          {/* Target end date */}
          <div className="mt-2">
            <TargetEndBlock project={p} health={health} compact />
          </div>
        </div>

        <motion.button
          onClick={() => onDetail(p._id)}
          whileHover={{ scale:1.05 }} whileTap={{ scale:0.95 }}
          className="shrink-0 flex items-center gap-2 px-4 py-2.5 bg-blue-600/20 hover:bg-blue-600/40 border border-blue-500/30 text-blue-300 rounded-xl text-sm font-semibold transition-all"
        >
          <Eye className="w-4 h-4" /> Detail
        </motion.button>
      </div>

      {/* Progress bar with time comparison */}
      <div className="mb-5 space-y-2">
        <div className="flex items-center justify-between text-sm">
          <span className="text-slate-400">Progress Proyek</span>
          <span className="font-black text-white text-lg">{p.percentage}%</span>
        </div>
        <div className="relative h-3 bg-slate-800 rounded-full overflow-hidden">
          <motion.div
            initial={{ width:0 }}
            animate={{ width:`${p.percentage}%` }}
            transition={{ duration:0.9, ease:"easeOut" }}
            className={`absolute inset-y-0 left-0 rounded-full bg-gradient-to-r ${progressGradient(p.percentage)}`}
          />
          {/* Deadline marker */}
          {health?.time_elapsed_pct != null && (
            <div
              className="absolute top-0 bottom-0 w-0.5 bg-white/30"
              style={{ left:`${Math.min(health.time_elapsed_pct, 100)}%` }}
              title={`Waktu terpakai: ${health.time_elapsed_pct}%`}
            />
          )}
          {/* Target marker (kuning) */}
          {health?.target_time_elapsed_pct != null && (
            <div
              className="absolute top-0 bottom-0 w-0.5 bg-amber-400/60"
              style={{ left:`${Math.min(health.target_time_elapsed_pct, 100)}%` }}
              title={`Waktu ke target: ${health.target_time_elapsed_pct}%`}
            />
          )}
        </div>
        <div className="flex items-center justify-between text-xs text-slate-600 flex-wrap gap-1">
          {health?.time_elapsed_pct != null && (
            <span>
              Waktu terpakai: <span className="text-slate-400">{health.time_elapsed_pct}%</span>
            </span>
          )}
          {health?.estimated_end_date && (
            <span>
              Est. selesai: <span className="text-slate-400">{fmt(health.estimated_end_date)}</span>
            </span>
          )}
        </div>
        {/* Legenda marker */}
        {(health?.time_elapsed_pct != null || health?.target_time_elapsed_pct != null) && (
          <div className="flex gap-4 text-xs text-slate-600">
            {health?.time_elapsed_pct != null && (
              <span className="flex items-center gap-1.5">
                <span className="inline-block w-2.5 h-0.5 bg-white/30 rounded-full" />
                Deadline
              </span>
            )}
            {health?.target_time_elapsed_pct != null && (
              <span className="flex items-center gap-1.5">
                <span className="inline-block w-2.5 h-0.5 bg-amber-400/60 rounded-full" />
                Target
              </span>
            )}
          </div>
        )}
      </div>

      {/* Stats grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-5">
        {[
          { label:"Total Task",        val: ts?.total ?? 0,                             sub: null,                                   icon: ListTodo   },
          { label:"Task Approved",     val: ts?.approved ?? 0,                          sub: `${ts?.completion_rate_by_count ?? 0}% selesai`, icon: CheckCircle2 },
          { label:"Jam Approved",      val: `${ts?.total_hour_weight_approved ?? 0}j`,  sub: `dari ${ts?.total_hour_weight_all ?? 0}j total`, icon: Hourglass  },
          // FIX: pakai variabel activeUsers yang sudah dihitung di atas
          { label:"Kontributor Aktif", val: activeUsers,                                sub: `${att?.total_daily_records ?? 0} catatan presensi`, icon: Users },
        ].map((s, i) => (
          <div key={i} className="bg-slate-800/50 border border-slate-700/40 rounded-xl p-3">
            <div className="flex items-center gap-2 mb-1">
              <s.icon className="w-4 h-4 text-slate-500" />
              <span className="text-xs text-slate-500">{s.label}</span>
            </div>
            <div className="text-base font-black text-white">{s.val}</div>
            {s.sub && <div className="text-xs text-slate-600 mt-0.5">{s.sub}</div>}
          </div>
        ))}
      </div>

      {/* Task status mini-breakdown */}
      {ts && (
        <div className="flex gap-2 flex-wrap mb-5">
          {[
            { key:"planned",  label:"Planned",  color:"bg-sky-500/30 text-sky-300"        },
            { key:"ongoing",  label:"Ongoing",  color:"bg-amber-500/30 text-amber-300"    },
            { key:"done",     label:"Done",     color:"bg-violet-500/30 text-violet-300"  },
            { key:"approved", label:"Approved", color:"bg-emerald-500/30 text-emerald-300"},
            { key:"rejected", label:"Ditolak",  color:"bg-rose-500/30 text-rose-300"      },
          ].map(({ key, label, color }) => (
            <span key={key} className={`px-2.5 py-0.5 rounded-lg text-xs font-semibold ${color}`}>
              {ts[key] ?? 0} {label}
            </span>
          ))}
        </div>
      )}

      {/* Top contributors */}
      {contribs.length > 0 && (
        <div className="pt-4 border-t border-slate-800">
          <div className="text-xs font-semibold text-slate-500 uppercase tracking-widest mb-3">Top Kontributor</div>
          <div className="flex flex-wrap gap-2">
            {contribs.slice(0, 5).map((c, i) => (
              <div key={i} className="flex items-center gap-2 px-3 py-1.5 bg-slate-800/70 border border-slate-700/50 rounded-xl">
                <div className="w-5 h-5 rounded-full bg-gradient-to-br from-violet-600 to-blue-500 flex items-center justify-center text-[10px] font-bold text-white">
                  {(c.user_name || "?")[0]}
                </div>
                <span className="text-xs text-slate-300 font-medium">{c.user_name}</span>
                <span className="text-xs font-black text-white">{c.contribution_pct}%</span>
              </div>
            ))}
            {contribs.length > 5 && (
              <div className="flex items-center px-3 py-1.5 text-xs text-slate-500">
                +{contribs.length - 5} lainnya
              </div>
            )}
          </div>
        </div>
      )}
    </motion.div>
  );
}

// ─── Detail Modal ─────────────────────────────────────────────────────────────

function DetailModal({ projectDetails, onClose }) {
  const d      = projectDetails;
  const p      = d.project;
  const health = d.health;
  const ts     = d.task_statistics;
  const [activeTab, setActiveTab] = useState("overview");

  const pendingCount = d.pending_tasks?.length ?? 0;

  // FIX: hitung jumlah kontributor dari task (bukan attendance)
  const contributorCount = d.contributors?.length ?? 0;

  // FIX: hitung unique attendance users dari attendance_timeline jika ada,
  //      atau fallback ke contributor count
  const attendanceUserCount = (() => {
    if (!d.attendance_timeline || d.attendance_timeline.length === 0) return 0;
    const uids = new Set();
    for (const row of d.attendance_timeline) {
      for (const c of row.contributors ?? []) uids.add(c.user_id);
    }
    return uids.size;
  })();

  const tabs = [
    { id:"overview",     label:"Overview",      icon: Activity   },
    { id:"contributors", label:"Kontributor",   icon: Users      },
    { id:"tasks",        label:"Semua Task",    icon: ListTodo   },
    { id:"timeline",     label:"Timeline Task", icon: TrendingUp },
    { id:"attendance",   label:"Presensi",      icon: Calendar   },
  ];

  return (
    <motion.div
      initial={{ opacity:0 }} animate={{ opacity:1 }} exit={{ opacity:0 }}
      className="fixed inset-0 bg-black/70 backdrop-blur-md flex items-center justify-center z-50 p-4"
      onClick={onClose}
    >
      <motion.div
        initial={{ scale:0.93, y:24 }} animate={{ scale:1, y:0 }} exit={{ scale:0.93, y:24 }}
        transition={{ type:"spring", stiffness:300, damping:30 }}
        className="bg-slate-900 border border-slate-700/60 rounded-2xl shadow-2xl w-full max-w-5xl max-h-[92vh] flex flex-col overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal header */}
        <div className="shrink-0 border-b border-slate-800 px-6 pt-6 pb-0">
          <div className="flex items-start justify-between mb-4">
            <div className="min-w-0 flex-1 pr-4">
              <div className="flex flex-wrap items-center gap-2 mb-1">
                <h2 className="text-2xl font-black text-white tracking-tight">{p.name}</h2>
                <StatusBadge status={p.status} />
                <HealthBadge label={health?.label} />
              </div>
              <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-500 mb-1.5">
                <span className="font-mono text-slate-400">{p.code}</span>
                <span>{WORK_TYPE_LABELS[p.work_type]}</span>
                <span>{fmt(p.start_date)} → {fmt(p.end_date)}</span>
                {health?.days_remaining != null && health.days_remaining > 0 && (
                  <span className="text-sky-400 font-semibold">{health.days_remaining} hari tersisa</span>
                )}
                {health?.days_overdue > 0 && (
                  <span className="text-rose-400 font-semibold">{health.days_overdue} hari terlambat</span>
                )}
              </div>
              {/* Target info di header modal */}
              <TargetEndBlock project={p} health={health} compact />
            </div>
            <button onClick={onClose} className="p-2 hover:bg-slate-800 rounded-xl text-slate-500 hover:text-white transition-all">
              <X className="w-5 h-5" />
            </button>
          </div>
          {/* Tabs */}
          <div className="flex gap-1 overflow-x-auto pb-px">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-2 px-4 py-2.5 text-sm font-semibold whitespace-nowrap border-b-2 transition-all ${
                  activeTab === tab.id
                    ? "border-blue-500 text-blue-400"
                    : "border-transparent text-slate-500 hover:text-slate-300"
                }`}
              >
                <tab.icon className="w-4 h-4" />
                {tab.label}
                {tab.id === "tasks" && pendingCount > 0 && (
                  <span className="px-1.5 py-0.5 rounded-md bg-amber-500/20 text-amber-400 text-xs font-bold">{pendingCount}</span>
                )}
                {/* FIX: badge jumlah record presensi */}
                {tab.id === "attendance" && d.attendance_timeline?.length > 0 && (
                  <span className="px-1.5 py-0.5 rounded-md bg-slate-700 text-slate-300 text-xs font-bold">
                    {d.attendance_timeline.length}
                  </span>
                )}
              </button>
            ))}
          </div>
        </div>

        {/* Modal body */}
        <div className="flex-1 overflow-y-auto p-6">

          {/* ── OVERVIEW TAB ── */}
          {activeTab === "overview" && (
            <div className="space-y-6">
              {/* Progress + health */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Progress card */}
                <div className="bg-slate-800/40 border border-slate-700/40 rounded-2xl p-5">
                  <div className="text-xs font-semibold text-slate-500 uppercase tracking-widest mb-3">Progress Aktual vs Waktu</div>
                  <div className="flex items-end gap-4 mb-4">
                    <div>
                      <div className="text-4xl font-black text-white">{p.percentage}%</div>
                      <div className="text-xs text-slate-500">progress aktual</div>
                    </div>
                    {health?.time_elapsed_pct != null && (
                      <>
                        <div className="text-slate-700 text-2xl font-thin mb-1">|</div>
                        <div>
                          <div className="text-2xl font-black text-slate-400">{health.time_elapsed_pct}%</div>
                          <div className="text-xs text-slate-500">waktu deadline terpakai</div>
                        </div>
                      </>
                    )}
                    {health?.target_time_elapsed_pct != null && (
                      <>
                        <div className="text-slate-700 text-2xl font-thin mb-1">|</div>
                        <div>
                          <div className="text-2xl font-black text-amber-400">{health.target_time_elapsed_pct}%</div>
                          <div className="text-xs text-slate-500">waktu target terpakai</div>
                        </div>
                      </>
                    )}
                  </div>
                  <ProgressBar pct={p.percentage} />
                  {health?.estimated_end_date && (
                    <div className="mt-3 text-xs text-slate-500 flex items-center gap-1.5">
                      <Timer className="w-3.5 h-3.5 text-sky-500" />
                      Est. selesai: <span className="text-slate-300 font-semibold">{fmt(health.estimated_end_date)}</span>
                    </div>
                  )}
                </div>

                {/* Task stats card */}
                <div className="bg-slate-800/40 border border-slate-700/40 rounded-2xl p-5">
                  <div className="text-xs font-semibold text-slate-500 uppercase tracking-widest mb-3">Statistik Task</div>
                  <div className="space-y-2.5">
                    {[
                      { label:"Total Task",         val: ts?.total ?? 0                                },
                      { label:"Approved",           val: ts?.approved ?? 0, note: `${ts?.completion_rate_by_count ?? 0}% dari total` },
                      { label:"Menunggu Approval",  val: ts?.done ?? 0,     note: pendingCount > 0 ? "⚠ perlu tindakan" : null, warn: pendingCount > 0 },
                      { label:"Jam Approved",       val: `${ts?.total_hour_weight_approved ?? 0}j`, note:`${ts?.completion_rate_by_hours ?? 0}% dari total jam` },
                    ].map((row, i) => (
                      <div key={i} className="flex items-center justify-between py-2 border-b border-slate-800/80 last:border-0">
                        <span className="text-sm text-slate-400">{row.label}</span>
                        <div className="text-right">
                          <span className={`text-sm font-black ${row.warn ? "text-amber-400" : "text-white"}`}>{row.val}</span>
                          {row.note && <div className={`text-xs ${row.warn ? "text-amber-500" : "text-slate-600"}`}>{row.note}</div>}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* ── Target & Deadline Info ── */}
              <div className="bg-slate-800/40 border border-slate-700/40 rounded-2xl p-5">
                <div className="text-xs font-semibold text-slate-500 uppercase tracking-widest mb-4 flex items-center gap-2">
                  <Flag className="w-4 h-4" /> Target & Deadline
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {/* Deadline formal */}
                  <div className="space-y-3">
                    <div className="text-xs text-slate-500 font-semibold uppercase tracking-wider">Deadline Proyek</div>
                    {[
                      { label:"Mulai",        val: fmt(p.start_date) },
                      { label:"Deadline",     val: fmt(p.end_date)   },
                      { label:"Sisa hari",    val: health?.days_remaining != null ? `${health.days_remaining} hari` : "—", highlight: health?.days_remaining === 0 },
                      { label:"Terlambat",    val: health?.days_overdue > 0 ? `${health.days_overdue} hari` : "—", warn: health?.days_overdue > 0 },
                      { label:"Status health",val: null, badge: health?.label },
                    ].map((row, i) => (
                      <div key={i} className="flex items-center justify-between py-1.5 border-b border-slate-800/60 last:border-0">
                        <span className="text-xs text-slate-500">{row.label}</span>
                        {row.badge ? (
                          <HealthBadge label={row.badge} />
                        ) : (
                          <span className={`text-xs font-semibold ${row.warn ? "text-rose-400" : row.highlight ? "text-amber-400" : "text-slate-300"}`}>
                            {row.val}
                          </span>
                        )}
                      </div>
                    ))}
                  </div>

                  {/* Target manual */}
                  <div className="space-y-3">
                    <div className="text-xs text-slate-500 font-semibold uppercase tracking-wider">Target Selesai Manual</div>
                    {p.target_end_date ? (
                      <>
                        {[
                          { label:"Target saat ini",  val: fmt(p.target_end_date) },
                          { label:"Sisa ke target",   val: health?.days_to_target != null ? `${health.days_to_target} hari` : "—" },
                          { label:"Lewat target",     val: health?.days_target_overdue > 0 ? `${health.days_target_overdue} hari` : "—", warn: health?.days_target_overdue > 0 },
                          { label:"Health target",    val: null, badge: health?.target_label },
                          { label:"Jumlah revisi",    val: `${health?.target_revision_count ?? 0}×` },
                        ].map((row, i) => (
                          <div key={i} className="flex items-center justify-between py-1.5 border-b border-slate-800/60 last:border-0">
                            <span className="text-xs text-slate-500">{row.label}</span>
                            {row.badge ? (
                              <HealthBadge label={row.badge} />
                            ) : (
                              <span className={`text-xs font-semibold ${row.warn ? "text-rose-400" : "text-slate-300"}`}>
                                {row.val}
                              </span>
                            )}
                          </div>
                        ))}

                        {/* Riwayat revisi target */}
                        {(p.target_end_history?.length ?? 0) > 0 && (
                          <div className="pt-2">
                            <div className="text-xs text-slate-600 mb-2 flex items-center gap-1.5">
                              <History className="w-3.5 h-3.5" /> Riwayat target
                            </div>
                            <div className="space-y-1">
                              {p.target_end_history.map((d, i) => (
                                <div key={i} className="flex items-center gap-2 text-xs">
                                  <span className="text-slate-700 w-4">#{i+1}</span>
                                  <span className={i === p.target_end_history.length - 1 ? "text-amber-400 font-semibold" : "text-slate-500"}>
                                    {fmt(d)}
                                  </span>
                                  {i === p.target_end_history.length - 1 && (
                                    <span className="text-slate-600">(aktif)</span>
                                  )}
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                      </>
                    ) : (
                      <div className="py-6 text-center text-slate-600 text-sm">
                        <Flag className="w-5 h-5 mx-auto mb-2 opacity-40" />
                        Belum ada target selesai yang diset
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Task breakdown pills */}
              <div className="bg-slate-800/40 border border-slate-700/40 rounded-2xl p-5">
                <div className="text-xs font-semibold text-slate-500 uppercase tracking-widest mb-4">Breakdown Status Task</div>
                <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                  {[
                    { key:"planned",  label:"Planned",  color:"from-sky-600 to-sky-400"         },
                    { key:"ongoing",  label:"Ongoing",  color:"from-amber-600 to-amber-400"      },
                    { key:"done",     label:"Done",     color:"from-violet-600 to-violet-400"    },
                    { key:"approved", label:"Approved", color:"from-emerald-600 to-emerald-400"  },
                    { key:"rejected", label:"Ditolak",  color:"from-rose-600 to-rose-400"        },
                  ].map((s) => {
                    const count = ts?.[s.key] ?? 0;
                    const total = ts?.total || 1;
                    return (
                      <div key={s.key} className="bg-slate-800/60 border border-slate-700/40 rounded-xl p-3 text-center">
                        <div className={`text-2xl font-black bg-gradient-to-r ${s.color} bg-clip-text text-transparent`}>{count}</div>
                        <div className="text-xs text-slate-500 mt-0.5">{s.label}</div>
                        <div className="mt-2 h-1 bg-slate-700 rounded-full overflow-hidden">
                          <div className={`h-full rounded-full bg-gradient-to-r ${s.color}`} style={{ width:`${(count/total)*100}%` }} />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

          {/* ── CONTRIBUTORS TAB ── */}
          {activeTab === "contributors" && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="font-black text-white">{contributorCount} Kontributor</h3>
                <div className="text-xs text-slate-500">
                  Persentase = jam task <span className="text-slate-300 font-semibold">approved</span> / total jam task project
                </div>
              </div>
              {contributorCount === 0 ? (
                <div className="py-16 text-center">
                  <Users className="w-8 h-8 text-slate-700 mx-auto mb-3" />
                  <div className="text-slate-500 text-sm">Belum ada kontributor</div>
                  <div className="text-slate-600 text-xs mt-1">Kontributor muncul setelah ada task yang di-approved</div>
                </div>
              ) : (
                <div className="bg-slate-800/40 border border-slate-700/40 rounded-2xl divide-y divide-slate-800 overflow-hidden">
                  {d.contributors.map((c, i) => (
                    <div key={i} className="px-5 py-4 hover:bg-slate-800/60 transition-colors">
                      <ContributorBar
                        rank={i}
                        name={c.user_name}
                        email={c.user_email}
                        division={c.division}
                        pct={c.contribution_pct}
                        hwTotal={c.total_hour_weight}
                        taskCount={c.approved_task_count}
                      />
                      {c.task_titles?.length > 0 && (
                        <div className="mt-2 pl-9 flex flex-wrap gap-1.5">
                          {c.task_titles.slice(0, 5).map((t, ti) => (
                            <span key={ti} className="px-2 py-0.5 bg-slate-700/60 rounded text-xs text-slate-400">{t}</span>
                          ))}
                          {c.task_titles.length > 5 && (
                            <span className="text-xs text-slate-600">+{c.task_titles.length - 5} lainnya</span>
                          )}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* ── TASKS TAB ── */}
          {activeTab === "tasks" && (
            <div className="space-y-4">
              {pendingCount > 0 && (
                <div className="flex items-center gap-3 px-4 py-3 bg-amber-500/10 border border-amber-500/30 rounded-xl">
                  <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />
                  <span className="text-sm text-amber-300 font-semibold">{pendingCount} task menunggu approval</span>
                </div>
              )}
              {(!d.tasks || d.tasks.length === 0) ? (
                <div className="py-16 text-center">
                  <ListTodo className="w-8 h-8 text-slate-700 mx-auto mb-3" />
                  <div className="text-slate-500 text-sm">Belum ada task</div>
                </div>
              ) : (
                <div className="space-y-2">
                  {d.tasks.map((task, i) => {
                    const sc = {
                      planned:  "text-sky-400 bg-sky-500/10 border-sky-500/20",
                      ongoing:  "text-amber-400 bg-amber-500/10 border-amber-500/20",
                      done:     "text-violet-400 bg-violet-500/10 border-violet-500/20",
                      approved: "text-emerald-400 bg-emerald-500/10 border-emerald-500/20",
                      rejected: "text-rose-400 bg-rose-500/10 border-rose-500/20",
                    }[task.status] || "text-slate-400 bg-slate-700/30 border-slate-600/20";
                    return (
                      <div key={i} className="bg-slate-800/40 border border-slate-700/40 hover:border-slate-600/60 rounded-xl p-4 transition-colors">
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2 flex-wrap mb-1">
                              <span className={`px-2 py-0.5 rounded-lg text-xs font-semibold border ${sc}`}>{task.status}</span>
                              {task.tier && (
                                <span className={`px-2 py-0.5 rounded-lg text-[11px] font-semibold border ${
                                  task.tier === "critical"
                                    ? "bg-rose-500/20 text-rose-300 border-rose-500/30"
                                    : task.tier === "high"
                                      ? "bg-amber-500/20 text-amber-300 border-amber-500/30"
                                      : task.tier === "normal"
                                        ? "bg-sky-500/20 text-sky-300 border-sky-500/30"
                                        : "bg-slate-700/40 text-slate-300 border-slate-600/40"
                                }`}>
                                  tier: {task.tier}
                                </span>
                              )}
                              <span className="text-sm font-semibold text-white truncate">{task.title}</span>
                            </div>
                            {task.description && (
                              <div className="text-xs text-slate-500 truncate mb-2">{task.description}</div>
                            )}
                            {task.note && (
                              <div className="text-xs text-slate-400 mb-2 italic">
                                Catatan: {task.note}
                              </div>
                            )}
                            <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-600">
                              <span className="flex items-center gap-1"><UserCheck className="w-3.5 h-3.5" />{task.user?.user_name}</span>
                              {task.user?.division && (
                                <span className="flex items-center gap-1"><Building2 className="w-3.5 h-3.5" />{task.user.division}</span>
                              )}
                              <span className="flex items-center gap-1"><Calendar className="w-3.5 h-3.5" />{fmt(task.start_at)}</span>
                              {task.approved_at && (
                                <span className="flex items-center gap-1 text-emerald-600">
                                  <CheckCircle2 className="w-3.5 h-3.5" />Approved {fmt(task.approved_at)}
                                </span>
                              )}
                              {task.approved_by && (
                                <span className="text-slate-600">oleh {task.approved_by.user_name}</span>
                              )}
                            </div>
                          </div>
                          <div className="text-right shrink-0">
                            <div className="text-base font-black text-white">{task.hour_weight}j</div>
                            <div className="text-xs text-slate-600">jam bobot</div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* ── TIMELINE TASK TAB ── */}
          {activeTab === "timeline" && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="font-black text-white">Timeline Approved Tasks</h3>
                <div className="text-xs text-slate-500">
                  Kontribusi (%) berbasis total bobot jam task project (bukan hanya approved)
                </div>
              </div>
              {(!d.task_timeline || d.task_timeline.length === 0) ? (
                <div className="py-16 text-center">
                  <TrendingUp className="w-8 h-8 text-slate-700 mx-auto mb-3" />
                  <div className="text-slate-500 text-sm">Belum ada data timeline</div>
                  <div className="text-slate-600 text-xs mt-1">Timeline muncul setelah ada task yang di-approved</div>
                </div>
              ) : (
                <>
                  {/* Timeline table (lebih jelas) */}
                  <div className="bg-slate-800/40 border border-slate-700/40 rounded-2xl overflow-hidden">
                    <div className="px-5 py-4 border-b border-slate-700/40">
                      <div className="text-xs text-slate-500">
                        Kolom: bobot jam approved hari itu, kontribusi hari itu (%), dan kumulatif progress (%).
                      </div>
                    </div>
                    <div className="overflow-x-auto">
                      <table className="min-w-full text-sm">
                        <thead className="bg-slate-900/60">
                          <tr className="text-slate-400">
                            <th className="text-left py-3 px-4">Tanggal</th>
                            <th className="text-right py-3 px-4">Task</th>
                            <th className="text-right py-3 px-4">Jam Approved</th>
                            <th className="text-right py-3 px-4">Kontribusi</th>
                            <th className="text-right py-3 px-4">Kumulatif</th>
                          </tr>
                        </thead>
                        <tbody>
                          {d.task_timeline.map((item, i) => (
                            <tr key={i} className="border-t border-slate-800/80 hover:bg-slate-800/30">
                              <td className="py-3 px-4 text-white font-semibold">{item.date}</td>
                              <td className="py-3 px-4 text-right text-slate-300 tabular-nums">{item.task_count}</td>
                              <td className="py-3 px-4 text-right text-slate-200 tabular-nums">{Number(item.total_hour_weight || 0).toFixed(2)}j</td>
                              <td className="py-3 px-4 text-right text-slate-300 tabular-nums">+{Number(item.total_contribution_pct || 0).toFixed(2)}%</td>
                              <td className="py-3 px-4 text-right text-blue-400 font-black tabular-nums">∑ {Number(item.cumulative_pct || 0).toFixed(2)}%</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>

                  {/* Contributors per-day (optional) */}
                  <div className="space-y-2 max-h-80 overflow-y-auto pr-1">
                    {d.task_timeline
                      .filter((it) => (it.contributors || []).length > 0)
                      .slice()
                      .reverse()
                      .map((item, i) => (
                        <div key={`${item.date}-${i}`} className="bg-slate-800/30 border border-slate-700/30 rounded-xl p-4">
                          <div className="text-xs text-slate-400 mb-2 font-semibold">
                            {item.date} • kontributor hari itu
                          </div>
                          <div className="flex flex-wrap gap-1.5">
                            {item.contributors.map((c, ci) => (
                              <span key={ci} className="px-2 py-0.5 bg-slate-700/60 rounded text-xs text-slate-200">
                                {c.user_name}{" "}
                                <span className="text-slate-400">{Number(c.contribution_pct || 0).toFixed(2)}% • {Number(c.hour_weight || 0).toFixed(2)}j</span>
                              </span>
                            ))}
                          </div>
                        </div>
                      ))}
                  </div>
                </>
              )}
            </div>
          )}

          {/* ── ATTENDANCE TAB ── */}
          {activeTab === "attendance" && (
            <div className="space-y-4">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <h3 className="font-black text-white">Timeline Presensi Harian</h3>
                {attendanceUserCount > 0 && (
                  <span className="text-xs text-slate-400 bg-slate-800/60 border border-slate-700/50 px-3 py-1.5 rounded-xl">
                    {attendanceUserCount} anggota aktif
                  </span>
                )}
              </div>
              <div className="text-xs text-slate-500">
                Kontribusi harian dihitung dari bobot jam task <span className="text-slate-300 font-semibold">done/approved</span> pada hari itu ÷ total bobot jam task project
              </div>

              {/* FIX: empty state yang lebih informatif */}
              {(!d.attendance_timeline || d.attendance_timeline.length === 0) ? (
                <div className="py-16 text-center">
                  <Calendar className="w-8 h-8 text-slate-700 mx-auto mb-3" />
                  <div className="text-slate-500 text-sm">Belum ada data presensi terkait proyek ini</div>
                  <div className="text-slate-600 text-xs mt-1 max-w-xs mx-auto">
                    Data presensi muncul ketika anggota melakukan check-in dan proyek ini tercatat
                    di field <code className="bg-slate-800 px-1 rounded">Attendance.projects</code>
                  </div>
                </div>
              ) : (
                <div className="space-y-2 max-h-[480px] overflow-y-auto pr-1">
                  {d.attendance_timeline.map((item, i) => (
                    <div key={i} className="bg-slate-800/40 border border-slate-700/40 rounded-xl p-4">
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-3">
                          <Calendar className="w-4 h-4 text-slate-500" />
                          <span className="text-sm font-bold text-white">{item.date}</span>
                          <span className="text-xs text-slate-500">{item.attendance_count} presensi</span>
                        </div>
                        <div className="text-right">
                          <div className="text-sm font-black text-white">{item.total_daily_contribution}%</div>
                          <div className="text-xs text-slate-500">rata {item.avg_contribution}%/orang</div>
                        </div>
                      </div>
                      {item.contributors?.length > 0 && (
                        <div className="flex flex-wrap gap-1.5">
                          {item.contributors.map((c, ci) => (
                            <div key={ci} className="w-full bg-slate-900/40 border border-slate-700/30 rounded-lg px-3 py-2">
                              <div className="flex items-center justify-between gap-2">
                                <div className="min-w-0">
                                  <div className="text-xs text-slate-200 font-semibold truncate">{c.user_name}</div>
                                  {c.division && <div className="text-[11px] text-slate-500 truncate">{c.division}</div>}
                                </div>
                                <div className="text-xs text-slate-300 font-black tabular-nums">
                                  {Number(c.daily_contribution || 0).toFixed(2)}%
                                </div>
                              </div>
                              {(c.tasks_done || []).length > 0 && (
                                <div className="mt-2 flex flex-wrap gap-1.5">
                                  {c.tasks_done.slice(0, 6).map((t, ti) => (
                                    <span key={t.task_id || ti} className="px-2 py-0.5 bg-slate-800/70 border border-slate-700/40 rounded text-[11px] text-slate-300">
                                      {t.title || "Task"} <span className="text-slate-500">• {Number(t.hour_weight || 0).toFixed(2)}j</span>
                                    </span>
                                  ))}
                                  {c.tasks_done.length > 6 && (
                                    <span className="text-[11px] text-slate-500">+{c.tasks_done.length - 6} task</span>
                                  )}
                                </div>
                              )}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </motion.div>
    </motion.div>
  );
}

// ─── Import Panel ─────────────────────────────────────────────────────────────

// function ImportPanel() {
//   const [importFile, setImportFile]         = useState(null);
//   const [importPreview, setImportPreview]   = useState(null);
//   const [previewLoading, setPreviewLoading] = useState(false);
//   const [importing, setImporting]           = useState(false);
//   const [importResult, setImportResult]     = useState(null);
//   const [open, setOpen]                     = useState(false);

//   const reset = () => { setImportFile(null); setImportPreview(null); setImportResult(null); };

//   const onPickFile = async (file) => {
//     setImportFile(file || null); setImportResult(null); setImportPreview(null);
//     if (!file) return;
//     try {
//       setPreviewLoading(true);
//       setImportPreview(await buildExcelPreview(file, { maxRows:8, mode:"project" }));
//     } catch (e) {
//       toast.error(e.message || "Gagal preview Excel");
//     } finally {
//       setPreviewLoading(false);
//     }
//   };

//   const doImport = async () => {
//     if (!importFile) return toast.error("Pilih file Excel terlebih dahulu");
//     try {
//       setImporting(true); setImportResult(null);
//       const res = await importProjectsExcel(importFile);
//       setImportResult(res);
//       if ((res?.success_rows || 0) > 0) toast.success(`Import sukses: ${res.success_rows} baris`);
//       else toast.error("Tidak ada baris yang berhasil diimport");
//     } catch (e) {
//       toast.error(e.message || "Gagal import");
//       setImportResult({ error: e.message });
//     } finally {
//       setImporting(false);
//     }
//   };

//   return (
//     <div className="bg-slate-900/60 border border-slate-700/50 rounded-2xl overflow-hidden">
//       <button
//         onClick={() => setOpen(!open)}
//         className="w-full flex items-center justify-between px-5 py-4 hover:bg-slate-800/40 transition-colors"
//       >
//         <div className="flex items-center gap-3">
//           <div className="p-2 bg-indigo-500/20 rounded-xl"><FileSpreadsheet className="w-5 h-5 text-indigo-400" /></div>
//           <div className="text-left">
//             <div className="text-sm font-bold text-white">Import / Migrasi Proyek dari Excel</div>
//             <div className="text-xs text-slate-500">POST /import/projects • preview sebelum upload</div>
//           </div>
//         </div>
//         <ChevronRight className={`w-4 h-4 text-slate-500 transition-transform ${open ? "rotate-90" : ""}`} />
//       </button>

//       <AnimatePresence>
//         {open && (
//           <motion.div
//             initial={{ height:0, opacity:0 }} animate={{ height:"auto", opacity:1 }} exit={{ height:0, opacity:0 }}
//             className="overflow-hidden border-t border-slate-800"
//           >
//             <div className="px-5 py-4 space-y-4">
//               <div className="flex flex-col sm:flex-row gap-2">
//                 <input
//                   type="file" accept=".xlsx,.xls"
//                   onChange={(e) => onPickFile(e.target.files?.[0] || null)}
//                   className="flex-1 text-sm text-slate-400 file:mr-3 file:py-2 file:px-3 file:rounded-xl file:border-0 file:bg-slate-700 file:text-slate-200 hover:file:bg-slate-600 cursor-pointer"
//                 />
//                 <button onClick={reset} disabled={!importFile && !importResult}
//                   className="px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-sm disabled:opacity-40">
//                   Reset
//                 </button>
//                 <button onClick={doImport} disabled={!importFile || previewLoading || importing}
//                   className="px-4 py-2 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 text-white text-sm font-bold disabled:opacity-40 flex items-center gap-2">
//                   <Upload className="w-4 h-4" />{importing ? "Mengimport..." : "Import"}
//                 </button>
//               </div>

//               {previewLoading && <div className="text-xs text-slate-500">Membuat preview...</div>}

//               {!previewLoading && importPreview && importPreview.headers.length > 0 && (
//                 <div className="space-y-2">
//                   <div className="text-xs text-slate-500">
//                     Sheet: <span className="text-slate-300">{importPreview.sheetName}</span> •
//                     Total: <span className="text-slate-300">{importPreview.totalRows}</span> baris •
//                     Preview: <span className="text-slate-300">{importPreview.rows.length}</span> baris pertama
//                   </div>
//                   <div className="overflow-x-auto rounded-xl border border-slate-700">
//                     <table className="min-w-full text-xs">
//                       <thead className="bg-slate-900/80">
//                         <tr>
//                           {[...importPreview.displayHeaders, "work_type (auto)"].map((h) => (
//                             <th key={h} className="text-left py-2 px-3 text-slate-400 font-semibold whitespace-nowrap">{h}</th>
//                           ))}
//                         </tr>
//                       </thead>
//                       <tbody>
//                         {importPreview.rows.map((r, i) => {
//                           const codeHeader = importPreview.headers.find((h) =>
//                             /kode\s*pekerjaan|kode\s*proyek|project\s*code/i.test(String(h))
//                           ) ?? importPreview.displayHeaders[0];
//                           const wt = deriveWorkTypeFromCode(r?.[codeHeader] ?? "");
//                           return (
//                             <tr key={i} className="border-t border-slate-800 hover:bg-slate-800/40">
//                               {[...importPreview.displayHeaders, "work_type (auto)"].map((h) => (
//                                 <td key={h} className="py-2 px-3 text-slate-300 whitespace-nowrap">
//                                   {h === "work_type (auto)"
//                                     ? WORK_TYPE_LABELS[wt] || wt
//                                     : String(r?.[h] ?? "")}
//                                 </td>
//                               ))}
//                             </tr>
//                           );
//                         })}
//                       </tbody>
//                     </table>
//                   </div>
//                 </div>
//               )}

//               {importResult && (
//                 <div className="rounded-xl border border-slate-700 bg-slate-900/60 p-4">
//                   {importResult.error ? (
//                     <div className="text-sm text-rose-300">Error: {importResult.error}</div>
//                   ) : (
//                     <div className="space-y-2">
//                       <div className="flex flex-wrap gap-4 text-sm">
//                         {[
//                           ["Berhasil", importResult.success_rows||0, "text-emerald-400"],
//                           ["Inserted", importResult.inserted||0,     "text-blue-400"   ],
//                           ["Updated",  importResult.updated||0,      "text-sky-400"    ],
//                           ["Gagal",    importResult.failed_rows||0,  "text-rose-400"   ],
//                         ].map(([l, v, c]) => (
//                           <div key={l} className="text-slate-400">{l}: <span className={`font-black ${c}`}>{v}</span></div>
//                         ))}
//                       </div>
//                       {(importResult.failed_rows || 0) > 0 && Array.isArray(importResult.errors) && (
//                         <details className="text-xs">
//                           <summary className="cursor-pointer text-slate-400 hover:text-white">
//                             Lihat error ({importResult.errors.length})
//                           </summary>
//                           <div className="mt-2 max-h-40 overflow-y-auto space-y-1 pl-2">
//                             {importResult.errors.map((e, i) => (
//                               <div key={i} className="text-slate-400">
//                                 Row {e.rowNumber}{e.code ? ` • ${e.code}` : ""}: <span className="text-rose-400">{e.reason}</span>
//                               </div>
//                             ))}
//                           </div>
//                         </details>
//                       )}
//                     </div>
//                   )}
//                 </div>
//               )}
//             </div>
//           </motion.div>
//         )}
//       </AnimatePresence>
//     </div>
//   );
// }

// ─── Main Page ────────────────────────────────────────────────────────────────

const ProjectAnalytics = () => {
  const [overview,        setOverview]        = useState(null);
  const [selectedProject, setSelectedProject] = useState(null);
  const [projectDetails,  setProjectDetails]  = useState(null);
  const [loading,         setLoading]         = useState(false);
  const [detailsLoading,  setDetailsLoading]  = useState(false);
  const [filters,         setFilters]         = useState({ work_type:"", status:"" });

  useEffect(() => { loadOverview(); }, [filters]);

  const loadOverview = async () => {
    try {
      setLoading(true);
      const res = await fetchProjectOverview({
        work_type: filters.work_type || undefined,
        status:    filters.status    || undefined,
      });
      setOverview(res.data);
    } catch (e) {
      toast.error(e.message || "Gagal memuat overview");
    } finally {
      setLoading(false);
    }
  };

  const loadProjectDetails = async (id) => {
    try {
      setDetailsLoading(true);
      setSelectedProject(id);
      const res = await fetchProjectDetails(id);
      setProjectDetails(res.data);
    } catch (e) {
      toast.error(e.message || "Gagal memuat detail");
    } finally {
      setDetailsLoading(false);
    }
  };

  const closeDetail = () => { setSelectedProject(null); setProjectDetails(null); };

  const ov = overview?.overall;

  return (
    <div className="min-h-screen bg-[#0b0f1a] text-white" style={{ fontFamily:"'DM Sans','Instrument Sans',system-ui,sans-serif" }}>
      {/* Grid bg */}
      <div className="fixed inset-0 pointer-events-none" style={{
        backgroundImage:"linear-gradient(rgba(255,255,255,0.02) 1px,transparent 1px),linear-gradient(90deg,rgba(255,255,255,0.02) 1px,transparent 1px)",
        backgroundSize:"48px 48px",
      }} />

      <div className="relative max-w-7xl mx-auto px-4 py-8 lg:px-8 lg:py-12 space-y-8">

        {/* ── Header ── */}
        <motion.div initial={{ opacity:0, y:-16 }} animate={{ opacity:1, y:0 }}>
          <div className="flex items-center justify-between mb-6">
            <div>
              <h1 className="text-4xl font-black tracking-tight bg-gradient-to-r from-white via-slate-200 to-slate-400 bg-clip-text text-transparent">
                Analytics Proyek
              </h1>
              <p className="text-slate-500 mt-1 text-sm">Progress, kontribusi, dan kesehatan proyek secara real-time</p>
            </div>
            <motion.button
              onClick={loadOverview}
              whileHover={{ rotate:90 }} whileTap={{ scale:0.9 }}
              className="p-3 bg-slate-800/60 border border-slate-700/50 hover:bg-slate-700/60 rounded-xl text-slate-400 hover:text-white transition-all"
            >
              <RefreshCw className="w-5 h-5" />
            </motion.button>
          </div>

          {/* Filters */}
          <div className="flex gap-3 flex-wrap">
            {[
              { key:"work_type", opts: Object.entries(WORK_TYPE_LABELS), placeholder:"Semua Tipe"   },
              { key:"status",    opts: Object.entries(STATUS_LABELS),    placeholder:"Semua Status" },
            ].map(({ key, opts, placeholder }) => (
              <select
                key={key}
                value={filters[key]}
                onChange={(e) => setFilters(prev => ({ ...prev, [key]: e.target.value }))}
                className="px-4 py-2.5 bg-slate-800/60 border border-slate-700/50 rounded-xl text-sm text-slate-200 focus:ring-2 focus:ring-blue-500/50 outline-none appearance-none cursor-pointer"
              >
                <option value="">{placeholder}</option>
                {opts.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
              </select>
            ))}
          </div>
        </motion.div>

        {/* ── Import Panel ── */}
        {/* <ImportPanel /> */}

        {/* ── Loading ── */}
        {loading && (
          <div className="flex items-center justify-center py-24">
            <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
          </div>
        )}

        {!loading && overview && (
          <>
            {/* ── Overview stat cards ── */}
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
              <StatCard icon={Target}        color="from-blue-600 to-blue-400"     value={ov?.total_projects ?? 0}         label="Total Proyek"    />
              <StatCard icon={CheckCircle2}  color="from-emerald-600 to-teal-400"  value={ov?.by_status?.completed ?? 0}  label="Selesai"         />
              <StatCard icon={Clock}         color="from-amber-600 to-yellow-400"  value={ov?.by_status?.ongoing ?? 0}    label="Berjalan"        />
            </div>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
              <StatCard icon={TrendingUp}    color="from-violet-600 to-purple-400" value={`${ov?.average_progress ?? 0}%`} label="Rata-rata Progress" />
              <StatCard icon={AlertTriangle} color="from-rose-600 to-rose-400"     value={ov?.overdue_projects ?? 0}      label="Proyek Terlambat" />
              <StatCard icon={ListTodo}      color="from-indigo-600 to-blue-400"   value={ov?.total_approved_tasks ?? 0}  label="Task Approved"   sub={`dari ${ov?.total_tasks ?? 0} total task`} />
            </div>

            {/* ── Status + Health breakdown ── */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Status */}
              <div className="bg-slate-900/60 border border-slate-700/50 rounded-2xl p-5">
                <h2 className="text-sm font-bold text-slate-400 uppercase tracking-widest mb-4 flex items-center gap-2">
                  <BarChart3 className="w-4 h-4" /> Status Proyek
                </h2>
                <div className="space-y-3">
                  {Object.entries(STATUS_LABELS).map(([key, label]) => {
                    const count = ov?.by_status?.[key] ?? 0;
                    const total = ov?.total_projects || 1;
                    const pct   = (count / total) * 100;
                    const c     = STATUS_COLORS[key];
                    return (
                      <div key={key} className="flex items-center gap-3">
                        <div className={`w-2.5 h-2.5 rounded-full ${c.dot}`} />
                        <div className="w-24 text-sm text-slate-300">{label}</div>
                        <div className="flex-1 h-2 bg-slate-800 rounded-full overflow-hidden">
                          <div className={`h-full rounded-full ${c.dot}`} style={{ width:`${pct}%` }} />
                        </div>
                        <div className="w-8 text-right text-sm font-black text-white">{count}</div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Health */}
              <div className="bg-slate-900/60 border border-slate-700/50 rounded-2xl p-5">
                <h2 className="text-sm font-bold text-slate-400 uppercase tracking-widest mb-4 flex items-center gap-2">
                  <Activity className="w-4 h-4" /> Kesehatan Proyek
                </h2>
                <div className="space-y-3">
                  {(["on_track","behind","no_deadline","completed"] ).map((key) => {
                    const meta  = HEALTH_META[key];
                    const count = ov?.by_health?.[key] ?? 0;
                    const total = ov?.total_projects || 1;
                    const pct   = (count / total) * 100;
                    const Icon  = meta.icon;
                    const barColor = {
                      on_track:    "#10b981",
                      behind:      "#f43f5e",
                      no_deadline: "#64748b",
                      completed:   "#10b981",
                    }[key] || "#64748b";
                    return (
                      <div key={key} className="flex items-center gap-3">
                        <Icon className={`w-4 h-4 ${meta.color}`} />
                        <div className="w-28 text-sm text-slate-300">{meta.label}</div>
                        <div className="flex-1 h-2 bg-slate-800 rounded-full overflow-hidden">
                          <div className="h-full rounded-full" style={{ width:`${pct}%`, background: barColor }} />
                        </div>
                        <div className="w-8 text-right text-sm font-black text-white">{count}</div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* ── Project List ── */}
            <div>
              <h2 className="text-sm font-bold text-slate-400 uppercase tracking-widest mb-4 flex items-center gap-2">
                <Target className="w-4 h-4" /> Daftar Proyek ({overview.projects?.length ?? 0})
              </h2>
              <div className="space-y-4">
                {overview.projects?.map((pd, i) => (
                  <ProjectCard key={pd.project._id} projectData={pd} onDetail={loadProjectDetails} idx={i} />
                ))}
                {!overview.projects?.length && (
                  <div className="text-center py-16 text-slate-600">Tidak ada proyek ditemukan</div>
                )}
              </div>
            </div>
          </>
        )}
      </div>

      {/* ── Detail Modal ── */}
      <AnimatePresence>
        {selectedProject && (
          detailsLoading ? (
            <motion.div
              initial={{ opacity:0 }} animate={{ opacity:1 }} exit={{ opacity:0 }}
              className="fixed inset-0 bg-black/70 backdrop-blur-md z-50 flex items-center justify-center"
              onClick={closeDetail}
            >
              <div className="w-10 h-10 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
            </motion.div>
          ) : projectDetails ? (
            <DetailModal projectDetails={projectDetails} onClose={closeDetail} />
          ) : null
        )}
      </AnimatePresence>
    </div>
  );
};

export default ProjectAnalytics;