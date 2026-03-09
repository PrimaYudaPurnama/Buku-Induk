import { useState, useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { motion } from "framer-motion";
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
} from "lucide-react";
import {
  fetchAttendanceOverview,
  fetchAttendanceDetails,
  fetchUsers,
  fetchDivisions,
  fetchAttendanceDrilldown,
} from "../utils/api.jsx";
import toast from "react-hot-toast";

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

// Late request metric → drilldown value mapping
const LATE_REQUEST_METRICS = {
  total: { metric: "late_request_status", value: "all", label: "Semua Pengajuan" },
  pending: { metric: "late_request_status", value: "pending", label: "Pending" },
  approved: { metric: "late_request_status", value: "approved", label: "Approved" },
  rejected: { metric: "late_request_status", value: "rejected", label: "Rejected" },
  filled: { metric: "late_request_status", value: "filled", label: "Filled" },
};

// SearchSelect with portal-based dropdown to fix z-index/overflow issues
const SearchSelect = ({
  value,
  onChange,
  options,
  placeholder = "Pilih...",
  allLabel = "Semua",
}) => {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const [dropdownStyle, setDropdownStyle] = useState({});
  const buttonRef = useRef(null);

  const selected = options.find((o) => o.value === value);
  const filtered = options.filter((o) => {
    const hay = `${o.label} ${o.subLabel || ""}`.toLowerCase();
    return hay.includes(q.toLowerCase());
  });

  const openDropdown = () => {
    if (buttonRef.current) {
      const rect = buttonRef.current.getBoundingClientRect();
      const spaceBelow = window.innerHeight - rect.bottom;
      const dropdownHeight = 280;

      if (spaceBelow < dropdownHeight) {
        // open upward
        setDropdownStyle({
          position: "fixed",
          bottom: window.innerHeight - rect.top + 4,
          left: rect.left,
          width: rect.width,
          zIndex: 9999,
        });
      } else {
        setDropdownStyle({
          position: "fixed",
          top: rect.bottom + 4,
          left: rect.left,
          width: rect.width,
          zIndex: 9999,
        });
      }
    }
    setOpen(true);
  };

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    const handler = (e) => {
      if (buttonRef.current && !buttonRef.current.contains(e.target)) {
        setOpen(false);
        setQ("");
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  const dropdown = open
    ? createPortal(
        <div
          style={dropdownStyle}
          className="bg-slate-800 border border-slate-700 rounded-lg shadow-2xl overflow-hidden"
        >
          <div className="p-2 border-b border-slate-700">
            <input
              autoFocus
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder={placeholder}
              className="w-full px-3 py-2 bg-slate-900/60 border border-slate-700 rounded-lg text-white text-sm focus:ring-2 focus:ring-blue-500 outline-none"
            />
          </div>
          <div className="max-h-56 overflow-y-auto">
            <button
              type="button"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => {
                onChange("");
                setOpen(false);
                setQ("");
              }}
              className={`w-full text-left px-3 py-2 text-sm hover:bg-slate-700/50 ${
                value === "" ? "text-blue-300" : "text-slate-200"
              }`}
            >
              {allLabel}
            </button>
            {filtered.map((o) => (
              <button
                key={o.value}
                type="button"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => {
                  onChange(o.value);
                  setOpen(false);
                  setQ("");
                }}
                className={`w-full text-left px-3 py-2 text-sm hover:bg-slate-700/50 ${
                  o.value === value ? "text-blue-300" : "text-slate-200"
                }`}
              >
                <div className="font-medium">{o.label}</div>
                {o.subLabel && (
                  <div className="text-[11px] text-slate-400">{o.subLabel}</div>
                )}
              </button>
            ))}
            {filtered.length === 0 && (
              <div className="px-3 py-3 text-sm text-slate-400">Tidak ada hasil</div>
            )}
          </div>
        </div>,
        document.body
      )
    : null;

  return (
    <div className="relative">
      <button
        ref={buttonRef}
        type="button"
        onClick={() => (open ? (setOpen(false), setQ("")) : openDropdown())}
        className="w-full px-3 py-2 bg-slate-700/50 border border-slate-600 rounded-lg text-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-left"
      >
        <span className={selected ? "text-white" : "text-slate-400"}>
          {selected ? selected.label : allLabel}
        </span>
      </button>
      {dropdown}
    </div>
  );
};

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
    if (activeTab === "details") {
      loadDetails();
    }
  }, [activeTab, filters]);

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

  // Config for late request cards
  const lateRequestCards = [
    {
      key: "total",
      label: "Total",
      colorClass: "bg-slate-700/30",
      textClass: "text-white",
      subTextClass: "text-slate-400",
    },
    {
      key: "pending",
      label: "Pending",
      colorClass: "bg-yellow-500/20 border border-yellow-500/30",
      textClass: "text-yellow-400",
      subTextClass: "text-yellow-400/80",
    },
    {
      key: "approved",
      label: "Approved",
      colorClass: "bg-green-500/20 border border-green-500/30",
      textClass: "text-green-400",
      subTextClass: "text-green-400/80",
    },
    {
      key: "rejected",
      label: "Rejected",
      colorClass: "bg-red-500/20 border border-red-500/30",
      textClass: "text-red-400",
      subTextClass: "text-red-400/80",
    },
    {
      key: "filled",
      label: "Filled",
      colorClass: "bg-blue-500/20 border border-blue-500/30",
      textClass: "text-blue-400",
      subTextClass: "text-blue-400/80",
    },
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 p-4 lg:p-8">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-8"
        >
          <div className="flex items-center justify-between mb-4">
            <div>
              <h1 className="text-4xl font-bold bg-gradient-to-r from-blue-400 to-indigo-400 bg-clip-text text-transparent mb-2">
                Analytics Presensi
              </h1>
              <p className="text-slate-400">
                Analisis kehadiran dan statistik presensi karyawan
              </p>
            </div>
            <motion.button
              onClick={() => {
                loadOverview();
                if (activeTab === "details") loadDetails();
              }}
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              className="p-3 bg-slate-800/50 hover:bg-slate-700/70 rounded-xl text-slate-300 hover:text-white transition-all"
            >
              <RefreshCw className="w-5 h-5" />
            </motion.button>
          </div>

          {/* Tabs */}
          <div className="flex gap-2 bg-slate-800/50 p-1 rounded-xl">
            {[
              { id: "overview", label: "Overview", icon: BarChart3 },
              { id: "details", label: "Detail Presensi", icon: TrendingUp },
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
              <label className="block text-sm font-medium text-slate-300 mb-2">
                Tanggal Mulai
              </label>
              <input
                type="date"
                value={filters.start_date}
                onChange={(e) => handleFilterChange("start_date", e.target.value)}
                className="w-full px-3 py-2 bg-slate-700/50 border border-slate-600 rounded-lg text-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">
                Tanggal Akhir
              </label>
              <input
                type="date"
                value={filters.end_date}
                onChange={(e) => handleFilterChange("end_date", e.target.value)}
                className="w-full px-3 py-2 bg-slate-700/50 border border-slate-600 rounded-lg text-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">
                Divisi
              </label>
              <SearchSelect
                value={filters.division_id}
                onChange={(val) => handleFilterChange("division_id", val)}
                options={divisions.map((d) => ({ value: d._id, label: d.name }))}
                placeholder="Cari divisi..."
                allLabel="Semua Divisi"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">
                Karyawan
              </label>
              <SearchSelect
                value={filters.user_id}
                onChange={(val) => handleFilterChange("user_id", val)}
                options={users.map((u) => ({
                  value: u._id,
                  label: u.full_name,
                  subLabel: `${u.employee_code || u.email}`,
                }))}
                placeholder="Cari karyawan..."
                allLabel="Semua Karyawan"
              />
            </div>
            {activeTab === "details" && (
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">
                  Status
                </label>
                <select
                  value={filters.status}
                  onChange={(e) => handleFilterChange("status", e.target.value)}
                  className="w-full px-3 py-2 bg-slate-700/50 border border-slate-600 rounded-lg text-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                >
                  <option value="">Semua Status</option>
                  {Object.entries(STATUS_LABELS).map(([key, label]) => (
                    <option key={key} value={key}>
                      {label}
                    </option>
                  ))}
                </select>
              </div>
            )}
          </div>
        </motion.div>

        {/* Content */}
        {loading && (
          <div className="text-center py-12 text-slate-400">
            Memuat data...
          </div>
        )}

        {!loading && activeTab === "overview" && overview && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="space-y-6"
          >
            {/* Summary Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <motion.div
                whileHover={{ scale: 1.02 }}
                className="bg-slate-800/50 backdrop-blur-xl rounded-xl p-6 border border-slate-700/50"
              >
                <div className="flex items-center justify-between mb-4">
                  <div className="p-3 bg-blue-500/20 rounded-lg">
                    <CalendarCheck className="w-6 h-6 text-blue-400" />
                  </div>
                </div>
                <h3 className="text-2xl font-bold text-white mb-1">
                  {overview.total_attendances}
                </h3>
                <p className="text-slate-400 text-sm">Total Presensi</p>
              </motion.div>

              <motion.div
                whileHover={{ scale: 1.02 }}
                className="bg-slate-800/50 backdrop-blur-xl rounded-xl p-6 border border-slate-700/50"
              >
                <div className="flex items-center justify-between mb-4">
                  <div className="p-3 bg-green-500/20 rounded-lg">
                    <CheckCircle2 className="w-6 h-6 text-green-400" />
                  </div>
                </div>
                <h3 className="text-2xl font-bold text-white mb-1">
                  {overview.by_status?.normal || 0}
                </h3>
                <p className="text-slate-400 text-sm">Presensi Normal</p>
              </motion.div>

              <motion.div
                whileHover={{ scale: 1.02 }}
                className="bg-slate-800/50 backdrop-blur-xl rounded-xl p-6 border border-slate-700/50"
              >
                <div className="flex items-center justify-between mb-4">
                  <div className="p-3 bg-red-500/20 rounded-lg">
                    <AlertCircle className="w-6 h-6 text-red-400" />
                  </div>
                </div>
                <h3 className="text-2xl font-bold text-white mb-1">
                  {(overview.by_status?.late || 0) + (overview.by_status?.late_checkin || 0)}
                </h3>
                <p className="text-slate-400 text-sm">Terlambat</p>
              </motion.div>

              <motion.div
                whileHover={{ scale: 1.02 }}
                className="bg-slate-800/50 backdrop-blur-xl rounded-xl p-6 border border-slate-700/50"
              >
                <div className="flex items-center justify-between mb-4">
                  <div className="p-3 bg-purple-500/20 rounded-lg">
                    <Timer className="w-6 h-6 text-purple-400" />
                  </div>
                </div>
                <h3 className="text-2xl font-bold text-white mb-1">
                  {overview.attendance_rate?.toFixed(1) || 0}%
                </h3>
                <p className="text-slate-400 text-sm">Tingkat Kehadiran</p>
              </motion.div>
            </div>

            {/* Status Breakdown */}
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
                      onClick={() =>
                        openDrilldown({
                          title: `Drilldown: ${label}`,
                          metric: "status",
                          value: key,
                        })
                      }
                      className={`p-4 rounded-lg border cursor-pointer hover:opacity-80 transition-opacity ${STATUS_COLORS[key] || "bg-slate-700/50"}`}
                    >
                      <div className="text-2xl font-bold mb-1">{count}</div>
                      <div className="text-sm opacity-80">{label}</div>
                      <div className="mt-2 h-2 bg-slate-700/50 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-current opacity-50 rounded-full"
                          style={{ width: `${percentage}%` }}
                        />
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Late Requests — clickable cards */}
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
                      onClick={() =>
                        openDrilldown({
                          title: `Drilldown Pengajuan: ${label}`,
                          metric: lrMeta.metric,
                          value: lrMeta.value,
                        })
                      }
                      className={`p-4 rounded-lg text-left cursor-pointer hover:opacity-80 transition-opacity ${colorClass}`}
                    >
                      <div className={`text-2xl font-bold mb-1 ${textClass}`}>
                        {overview.late_requests?.[key] || 0}
                      </div>
                      <div className={`text-sm ${subTextClass}`}>{label}</div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Activity Breakdown */}
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
                      onClick={() =>
                        openDrilldown({
                          title: `Drilldown: Aktivitas • ${a.name_activity || "Unknown"}`,
                          metric: "activity",
                          value: a.activity_id,
                        })
                      }
                      className="p-4 rounded-lg border bg-slate-700/30 border-slate-600 hover:bg-slate-700/50 transition-all text-left"
                    >
                      <div className="text-sm text-slate-300 font-semibold mb-1">
                        {a.name_activity || "Unknown Activity"}
                      </div>
                      <div className="text-2xl font-bold text-white">{a.count || 0}</div>
                      <div className="text-xs text-slate-400 mt-1">Jumlah kemunculan activity di presensi</div>
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Daily Trend */}
            {overview.by_date && overview.by_date.length > 0 && (
              <div className="bg-slate-800/50 backdrop-blur-xl rounded-xl p-6 border border-slate-700/50">
                <h2 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
                  <TrendingUp className="w-5 h-5" />
                  Tren Harian (30 Hari Terakhir)
                </h2>
                <div className="space-y-2 max-h-96 overflow-y-auto">
                  {overview.by_date.map((item, index) => (
                    <div
                      key={index}
                      className="flex items-center justify-between p-3 bg-slate-700/30 rounded-lg"
                    >
                      <div className="flex items-center gap-3">
                        <Calendar className="w-4 h-4 text-slate-400" />
                        <span className="text-white font-medium">
                          {formatDate(item.date)}
                        </span>
                      </div>
                      <div className="flex items-center gap-4">
                        <span className="text-slate-400 text-sm">
                          {item.count} presensi
                        </span>
                        <div className="flex gap-2">
                          {Object.entries(item.statuses || {}).map(([status, count]) => (
                            <span
                              key={status}
                              className={`px-2 py-1 rounded text-xs ${
                                STATUS_COLORS[status] || "bg-slate-600"
                              }`}
                            >
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

        {!loading && activeTab === "details" && details && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="space-y-6"
          >
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
                        className="border-b border-slate-700/50 hover:bg-slate-700/30 transition-colors"
                      >
                        <td className="py-3 px-4 text-white">
                          {formatDate(attendance.date)}
                        </td>
                        <td className="py-3 px-4 text-white">
                          <div>
                            <div className="font-medium">
                              {attendance.user_id?.full_name || "-"}
                            </div>
                            <div className="text-sm text-slate-400">
                              {attendance.user_id?.employee_code || attendance.user_id?.email || "-"}
                            </div>
                          </div>
                        </td>
                        <td className="py-3 px-4 text-white">
                          {formatTime(attendance.checkIn_at)}
                        </td>
                        <td className="py-3 px-4 text-white">
                          {attendance.checkOut_at ? formatTime(attendance.checkOut_at) : "-"}
                        </td>
                        <td className="py-3 px-4">
                          <span
                            className={`px-3 py-1 rounded-full text-xs font-medium ${
                              STATUS_COLORS[attendance.status] || "bg-slate-600"
                            }`}
                          >
                            {STATUS_LABELS[attendance.status] || attendance.status}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Pagination */}
              {details.pagination && (
                <div className="flex items-center justify-between mt-4">
                  <div className="text-slate-400 text-sm">
                    Menampilkan {((details.pagination.page - 1) * details.pagination.limit) + 1} -{" "}
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
      </div>

      {/* Drilldown Modal */}
      {drillOpen && (
        <div
          className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4"
          onClick={() => {
            setDrillOpen(false);
            setDrillRows([]);
            setDrillPagination(null);
          }}
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
                onClick={() => {
                  setDrillOpen(false);
                  setDrillRows([]);
                  setDrillPagination(null);
                }}
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
                            <div className="text-xs text-slate-400">
                              {r.user?.employee_code || r.user?.email || "-"}
                            </div>
                          </td>
                          <td className="py-2 px-2 text-slate-200">
                            {r.user?.division?.name || "-"}
                          </td>
                          <td className="py-2 px-2 text-right text-white font-bold tabular-nums">
                            {r.count || 0}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              {drillPagination && drillPagination.pages > 1 && (
                <div className="mt-4 flex items-center justify-between">
                  <div className="text-xs text-slate-400">
                    Halaman {drillPagination.page} / {drillPagination.pages} • Total {drillPagination.total}
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
    </div>
  );
};

export default AttendanceAnalytics;