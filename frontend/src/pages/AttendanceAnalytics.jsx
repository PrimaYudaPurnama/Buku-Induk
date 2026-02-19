import { useState, useEffect } from "react";
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

const AttendanceAnalytics = () => {
  const [activeTab, setActiveTab] = useState("overview");
  const [overview, setOverview] = useState(null);
  const [details, setDetails] = useState(null);
  const [loading, setLoading] = useState(false);
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

  const formatDateTime = (date) => {
    if (!date) return "-";
    return new Date(date).toLocaleString("id-ID", {
      year: "numeric",
      month: "short",
      day: "numeric",
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
              <select
                value={filters.division_id}
                onChange={(e) => handleFilterChange("division_id", e.target.value)}
                className="w-full px-3 py-2 bg-slate-700/50 border border-slate-600 rounded-lg text-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="">Semua Divisi</option>
                {divisions.map((div) => (
                  <option key={div._id} value={div._id}>
                    {div.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">
                Karyawan
              </label>
              <select
                value={filters.user_id}
                onChange={(e) => handleFilterChange("user_id", e.target.value)}
                className="w-full px-3 py-2 bg-slate-700/50 border border-slate-600 rounded-lg text-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="">Semua Karyawan</option>
                {users.map((user) => (
                  <option key={user._id} value={user._id}>
                    {user.full_name} ({user.employee_code || user.email})
                  </option>
                ))}
              </select>
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
                    <div
                      key={key}
                      className={`p-4 rounded-lg border ${STATUS_COLORS[key] || "bg-slate-700/50"}`}
                    >
                      <div className="text-2xl font-bold mb-1">{count}</div>
                      <div className="text-sm opacity-80">{label}</div>
                      <div className="mt-2 h-2 bg-slate-700/50 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-current opacity-50 rounded-full"
                          style={{ width: `${percentage}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Late Requests */}
            <div className="bg-slate-800/50 backdrop-blur-xl rounded-xl p-6 border border-slate-700/50">
              <h2 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
                <AlertCircle className="w-5 h-5" />
                Pengajuan Presensi Terlambat
              </h2>
              <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                <div className="p-4 bg-slate-700/30 rounded-lg">
                  <div className="text-2xl font-bold text-white mb-1">
                    {overview.late_requests?.total || 0}
                  </div>
                  <div className="text-sm text-slate-400">Total</div>
                </div>
                <div className="p-4 bg-yellow-500/20 rounded-lg border border-yellow-500/30">
                  <div className="text-2xl font-bold text-yellow-400 mb-1">
                    {overview.late_requests?.pending || 0}
                  </div>
                  <div className="text-sm text-yellow-400/80">Pending</div>
                </div>
                <div className="p-4 bg-green-500/20 rounded-lg border border-green-500/30">
                  <div className="text-2xl font-bold text-green-400 mb-1">
                    {overview.late_requests?.approved || 0}
                  </div>
                  <div className="text-sm text-green-400/80">Approved</div>
                </div>
                <div className="p-4 bg-red-500/20 rounded-lg border border-red-500/30">
                  <div className="text-2xl font-bold text-red-400 mb-1">
                    {overview.late_requests?.rejected || 0}
                  </div>
                  <div className="text-sm text-red-400/80">Rejected</div>
                </div>
                <div className="p-4 bg-blue-500/20 rounded-lg border border-blue-500/30">
                  <div className="text-2xl font-bold text-blue-400 mb-1">
                    {overview.late_requests?.filled || 0}
                  </div>
                  <div className="text-sm text-blue-400/80">Filled</div>
                </div>
              </div>
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
    </div>
  );
};

export default AttendanceAnalytics;
