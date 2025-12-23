import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import {
  BarChart3,
  TrendingUp,
  Clock,
  CheckCircle2,
  XCircle,
  AlertCircle,
  Search,
  Filter,
  Calendar,
  ArrowRight,
  Eye,
  RefreshCw,
} from "lucide-react";
import {
  fetchWorkflowOverview,
  fetchWorkflowDetails,
  fetchWorkflowTimeline,
  fetchWorkflowStatistics,
} from "../utils/api.jsx";
import toast from "react-hot-toast";

const REQUEST_TYPE_LABELS = {
  account_request: "Account Request",
  promotion: "Promotion",
  termination: "Termination",
  transfer: "Transfer",
  salary_change: "Salary Change",
};

const STATUS_COLORS = {
  pending: "bg-yellow-500/20 text-yellow-400 border-yellow-500/30",
  approved: "bg-green-500/20 text-green-400 border-green-500/30",
  rejected: "bg-red-500/20 text-red-400 border-red-500/30",
};

const STATUS_ICONS = {
  pending: AlertCircle,
  approved: CheckCircle2,
  rejected: XCircle,
};

const WorkflowAnalytics = () => {
  const [activeTab, setActiveTab] = useState("overview");
  const [overview, setOverview] = useState(null);
  const [details, setDetails] = useState(null);
  const [statistics, setStatistics] = useState(null);
  const [selectedRequest, setSelectedRequest] = useState(null);
  const [timeline, setTimeline] = useState(null);
  const [loading, setLoading] = useState(false);
  const [filters, setFilters] = useState({
    request_type: "",
    status: "",
    search: "",
    page: 1,
    limit: 20,
  });
  const [dateRange, setDateRange] = useState({
    start_date: "",
    end_date: "",
  });

  useEffect(() => {
    loadOverview();
    loadStatistics();
  }, []);

  useEffect(() => {
    if (activeTab === "details") {
      loadDetails();
    }
  }, [activeTab, filters]);

  const loadOverview = async () => {
    try {
      setLoading(true);
      const response = await fetchWorkflowOverview();
      setOverview(response.data);
    } catch (error) {
      toast.error(error.message || "Gagal memuat overview");
    } finally {
      setLoading(false);
    }
  };

  const loadDetails = async () => {
    try {
      setLoading(true);
      const response = await fetchWorkflowDetails(filters);
      setDetails(response);
    } catch (error) {
      toast.error(error.message || "Gagal memuat detail workflow");
    } finally {
      setLoading(false);
    }
  };

  const loadStatistics = async () => {
    try {
      const response = await fetchWorkflowStatistics({
        ...dateRange,
        request_type: filters.request_type || undefined,
      });
      setStatistics(response.data);
    } catch (error) {
      console.error("Failed to load statistics:", error);
    }
  };

  const loadTimeline = async (requestId) => {
    try {
      setLoading(true);
      const response = await fetchWorkflowTimeline(requestId);
      setTimeline(response.data);
      setSelectedRequest(requestId);
    } catch (error) {
      toast.error(error.message || "Gagal memuat timeline");
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (date) => {
    if (!date) return "-";
    return new Date(date).toLocaleDateString("id-ID", {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const formatDuration = (ms) => {
    if (!ms) return "-";
    const hours = Math.floor(ms / (1000 * 60 * 60));
    const days = Math.floor(hours / 24);
    if (days > 0) return `${days} hari ${hours % 24} jam`;
    return `${hours} jam`;
  };

  const getProgressColor = (percentage) => {
    if (percentage === 100) return "bg-green-500";
    if (percentage >= 50) return "bg-blue-500";
    return "bg-yellow-500";
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
                Workflow Analytics
              </h1>
              <p className="text-slate-400">
                Analisis alur kerja dan persetujuan request
              </p>
            </div>
            <motion.button
              onClick={() => {
                loadOverview();
                loadStatistics();
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
              { id: "details", label: "Detail Workflow", icon: TrendingUp },
              { id: "statistics", label: "Statistik", icon: Clock },
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
                  <span className="font-medium">{tab.label}</span>
                </motion.button>
              );
            })}
          </div>
        </motion.div>

        {/* Content */}
        {loading && activeTab !== "overview" && (
          <div className="flex items-center justify-center py-20">
            <motion.div
              animate={{ rotate: 360 }}
              transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
            >
              <RefreshCw className="w-8 h-8 text-blue-400" />
            </motion.div>
          </div>
        )}

        {/* Overview Tab */}
        {activeTab === "overview" && overview && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="space-y-6"
          >
            {/* Summary Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1 }}
                className="bg-slate-800/50 backdrop-blur-xl rounded-2xl p-6 border border-slate-700/50"
              >
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-slate-400 text-sm font-medium">
                    Total Requests
                  </h3>
                  <BarChart3 className="w-5 h-5 text-blue-400" />
                </div>
                <p className="text-3xl font-bold text-white">
                  {overview.total_requests}
                </p>
              </motion.div>

              {Object.entries(overview.by_status).map(([status, count], idx) => {
                const Icon = STATUS_ICONS[status];
                return (
                  <motion.div
                    key={status}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.1 + idx * 0.1 }}
                    className="bg-slate-800/50 backdrop-blur-xl rounded-2xl p-6 border border-slate-700/50"
                  >
                    <div className="flex items-center justify-between mb-4">
                      <h3 className="text-slate-400 text-sm font-medium capitalize">
                        {status}
                      </h3>
                      <Icon className={`w-5 h-5 ${STATUS_COLORS[status].split(' ')[1]}`} />
                    </div>
                    <p className="text-3xl font-bold text-white">{count}</p>
                  </motion.div>
                );
              })}
            </div>

            {/* By Request Type */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-slate-800/50 backdrop-blur-xl rounded-2xl p-6 border border-slate-700/50"
            >
              <h2 className="text-xl font-bold text-white mb-6">
                Request by Type
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
                {Object.entries(overview.by_request_type).map(
                  ([type, data]) => (
                    <div
                      key={type}
                      className="bg-slate-900/50 rounded-xl p-4 border border-slate-700/30"
                    >
                      <h3 className="text-sm text-slate-400 mb-2">
                        {REQUEST_TYPE_LABELS[type] || type}
                      </h3>
                      <p className="text-2xl font-bold text-white mb-2">
                        {data.total}
                      </p>
                      <div className="flex gap-2 text-xs">
                        <span className="text-green-400">
                          ✓ {data.approved}
                        </span>
                        <span className="text-yellow-400">
                          ⏳ {data.pending}
                        </span>
                        <span className="text-red-400">✗ {data.rejected}</span>
                      </div>
                    </div>
                  )
                )}
              </div>
            </motion.div>

            {/* Recent Requests */}
            {overview.recent_requests && overview.recent_requests.length > 0 && (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="bg-slate-800/50 backdrop-blur-xl rounded-2xl p-6 border border-slate-700/50"
              >
                <h2 className="text-xl font-bold text-white mb-6">
                  Recent Requests
                </h2>
                <div className="space-y-3">
                  {overview.recent_requests.map((req) => {
                    const StatusIcon = STATUS_ICONS[req.status];
                    return (
                      <div
                        key={req._id}
                        className="flex items-center justify-between p-4 bg-slate-900/50 rounded-xl border border-slate-700/30 hover:border-slate-600/50 transition-all"
                      >
                        <div className="flex items-center gap-4">
                          <div
                            className={`p-2 rounded-lg ${STATUS_COLORS[req.status]}`}
                          >
                            <StatusIcon className="w-4 h-4" />
                          </div>
                          <div>
                            <p className="text-white font-medium">
                              {req.requester_name}
                            </p>
                            <p className="text-sm text-slate-400">
                              {REQUEST_TYPE_LABELS[req.request_type] || req.request_type} • {formatDate(req.created_at)}
                            </p>
                          </div>
                        </div>
                        <span
                          className={`px-3 py-1 rounded-lg text-xs font-medium ${STATUS_COLORS[req.status]}`}
                        >
                          {req.status}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </motion.div>
            )}
          </motion.div>
        )}

        {/* Details Tab */}
        {activeTab === "details" && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="space-y-6"
          >
            {/* Filters */}
            <div className="bg-slate-800/50 backdrop-blur-xl rounded-2xl p-6 border border-slate-700/50">
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-slate-400" />
                  <input
                    type="text"
                    placeholder="Cari nama atau email..."
                    value={filters.search}
                    onChange={(e) =>
                      setFilters({ ...filters, search: e.target.value, page: 1 })
                    }
                    className="w-full pl-10 pr-4 py-3 bg-slate-900/50 border border-slate-700/50 rounded-xl text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <select
                  value={filters.request_type}
                  onChange={(e) =>
                    setFilters({ ...filters, request_type: e.target.value, page: 1 })
                  }
                  className="px-4 py-3 bg-slate-900/50 border border-slate-700/50 rounded-xl text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">All Request Types</option>
                  {Object.entries(REQUEST_TYPE_LABELS).map(([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </select>
                <select
                  value={filters.status}
                  onChange={(e) =>
                    setFilters({ ...filters, status: e.target.value, page: 1 })
                  }
                  className="px-4 py-3 bg-slate-900/50 border border-slate-700/50 rounded-xl text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">All Status</option>
                  <option value="pending">Pending</option>
                  <option value="approved">Approved</option>
                  <option value="rejected">Rejected</option>
                </select>
                <motion.button
                  onClick={loadDetails}
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  className="px-6 py-3 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-xl font-medium hover:shadow-lg transition-all"
                >
                  <Filter className="w-5 h-5 inline mr-2" />
                  Filter
                </motion.button>
              </div>
            </div>

            {/* Workflow Details List */}
            {details && details.data && (
              <div className="space-y-4">
                {details.data.map((item) => (
                  <motion.div
                    key={item.request._id}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="bg-slate-800/50 backdrop-blur-xl rounded-2xl p-6 border border-slate-700/50 hover:border-slate-600/50 transition-all"
                  >
                    <div className="flex items-start justify-between mb-4">
                      <div className="flex-1">
                        <div className="flex items-center gap-3 mb-2">
                          <h3 className="text-lg font-bold text-white">
                            {item.request.requester_name}
                          </h3>
                          <span
                            className={`px-3 py-1 rounded-lg text-xs font-medium ${STATUS_COLORS[item.request.status]}`}
                          >
                            {item.request.status}
                          </span>
                          <span className="px-3 py-1 rounded-lg text-xs font-medium bg-blue-500/20 text-blue-400 border border-blue-500/30">
                            {REQUEST_TYPE_LABELS[item.request.request_type] ||
                              item.request.request_type}
                          </span>
                        </div>
                        <p className="text-sm text-slate-400 mb-4">
                          {item.request.email} • {formatDate(item.request.created_at)}
                        </p>

                        {/* Workflow Steps */}
                        <div className="mb-4">
                          <div className="flex items-center gap-2 mb-3">
                            <span className="text-sm text-slate-400">
                              Progress: {item.workflow.progress.completion_percentage}%
                            </span>
                            <div className="flex-1 h-2 bg-slate-700/50 rounded-full overflow-hidden">
                              <motion.div
                                initial={{ width: 0 }}
                                animate={{
                                  width: `${item.workflow.progress.completion_percentage}%`,
                                }}
                                className={`h-full ${getProgressColor(
                                  item.workflow.progress.completion_percentage
                                )}`}
                              />
                            </div>
                          </div>

                          <div className="flex gap-2 flex-wrap">
                            {item.workflow.steps.map((step, idx) => {
                              const StepIcon = STATUS_ICONS[step.status];
                              return (
                                <div
                                  key={step.level}
                                  className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm border ${
                                    step.status === "approved"
                                      ? "bg-green-500/20 text-green-400 border-green-500/30"
                                      : step.status === "rejected"
                                      ? "bg-red-500/20 text-red-400 border-red-500/30"
                                      : "bg-yellow-500/20 text-yellow-400 border-yellow-500/30"
                                  }`}
                                >
                                  <StepIcon className="w-4 h-4" />
                                  <span>Level {step.level}</span>
                                  {idx < item.workflow.steps.length - 1 && (
                                    <ArrowRight className="w-4 h-4 text-slate-500" />
                                  )}
                                </div>
                              );
                            })}
                          </div>
                        </div>

                        {/* Current Step Info */}
                        {item.workflow.current_step && (
                          <div className="bg-slate-900/50 rounded-xl p-4 border border-slate-700/30">
                            <p className="text-sm text-slate-400 mb-1">
                              Current Step:
                            </p>
                            <p className="text-white font-medium">
                              Level {item.workflow.current_step.level} -{" "}
                              {item.workflow.current_step.approver_role}
                            </p>
                            {item.workflow.current_step.approver && (
                              <p className="text-sm text-slate-400 mt-1">
                                Approver: {item.workflow.current_step.approver.full_name}
                              </p>
                            )}
                          </div>
                        )}
                      </div>
                      <motion.button
                        onClick={() => loadTimeline(item.request._id)}
                        whileHover={{ scale: 1.05 }}
                        whileTap={{ scale: 0.95 }}
                        className="ml-4 p-3 bg-blue-600/20 hover:bg-blue-600/30 border border-blue-500/30 rounded-xl text-blue-400 hover:text-blue-300 transition-all"
                      >
                        <Eye className="w-5 h-5" />
                      </motion.button>
                    </div>
                  </motion.div>
                ))}

                {/* Pagination */}
                {details.pagination && (
                  <div className="flex items-center justify-center gap-2 mt-6">
                    <motion.button
                      onClick={() =>
                        setFilters({
                          ...filters,
                          page: Math.max(1, filters.page - 1),
                        })
                      }
                      disabled={filters.page === 1}
                      whileHover={{ scale: 1.05 }}
                      whileTap={{ scale: 0.95 }}
                      className="px-4 py-2 bg-slate-800/50 border border-slate-700/50 rounded-xl text-white disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      Previous
                    </motion.button>
                    <span className="px-4 py-2 text-slate-400">
                      Page {filters.page} of {details.pagination.pages}
                    </span>
                    <motion.button
                      onClick={() =>
                        setFilters({
                          ...filters,
                          page: Math.min(
                            details.pagination.pages,
                            filters.page + 1
                          ),
                        })
                      }
                      disabled={filters.page >= details.pagination.pages}
                      whileHover={{ scale: 1.05 }}
                      whileTap={{ scale: 0.95 }}
                      className="px-4 py-2 bg-slate-800/50 border border-slate-700/50 rounded-xl text-white disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      Next
                    </motion.button>
                  </div>
                )}
              </div>
            )}
          </motion.div>
        )}

        {/* Statistics Tab */}
        {activeTab === "statistics" && statistics && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="space-y-6"
          >
            {/* Date Range Filter */}
            <div className="bg-slate-800/50 backdrop-blur-xl rounded-2xl p-6 border border-slate-700/50">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm text-slate-400 mb-2">
                    Start Date
                  </label>
                  <input
                    type="date"
                    value={dateRange.start_date}
                    onChange={(e) => {
                      setDateRange({ ...dateRange, start_date: e.target.value });
                      loadStatistics();
                    }}
                    className="w-full px-4 py-3 bg-slate-900/50 border border-slate-700/50 rounded-xl text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm text-slate-400 mb-2">
                    End Date
                  </label>
                  <input
                    type="date"
                    value={dateRange.end_date}
                    onChange={(e) => {
                      setDateRange({ ...dateRange, end_date: e.target.value });
                      loadStatistics();
                    }}
                    className="w-full px-4 py-3 bg-slate-900/50 border border-slate-700/50 rounded-xl text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div className="flex items-end">
                  <motion.button
                    onClick={loadStatistics}
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    className="w-full px-6 py-3 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-xl font-medium"
                  >
                    Apply Filter
                  </motion.button>
                </div>
              </div>
            </div>

            {/* Statistics Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="bg-slate-800/50 backdrop-blur-xl rounded-2xl p-6 border border-slate-700/50"
              >
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-slate-400 text-sm font-medium">
                    Approval Rate
                  </h3>
                  <TrendingUp className="w-5 h-5 text-green-400" />
                </div>
                <p className="text-3xl font-bold text-white">
                  {statistics.approval_rate}%
                </p>
              </motion.div>

              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1 }}
                className="bg-slate-800/50 backdrop-blur-xl rounded-2xl p-6 border border-slate-700/50"
              >
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-slate-400 text-sm font-medium">
                    Rejection Rate
                  </h3>
                  <XCircle className="w-5 h-5 text-red-400" />
                </div>
                <p className="text-3xl font-bold text-white">
                  {statistics.rejection_rate}%
                </p>
              </motion.div>

              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2 }}
                className="bg-slate-800/50 backdrop-blur-xl rounded-2xl p-6 border border-slate-700/50"
              >
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-slate-400 text-sm font-medium">
                    Avg Approval Time
                  </h3>
                  <Clock className="w-5 h-5 text-blue-400" />
                </div>
                <p className="text-3xl font-bold text-white">
                  {statistics.average_approval_time_hours.toFixed(1)}h
                </p>
              </motion.div>

              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.3 }}
                className="bg-slate-800/50 backdrop-blur-xl rounded-2xl p-6 border border-slate-700/50"
              >
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-slate-400 text-sm font-medium">
                    Total Requests
                  </h3>
                  <BarChart3 className="w-5 h-5 text-indigo-400" />
                </div>
                <p className="text-3xl font-bold text-white">
                  {statistics.total_requests}
                </p>
              </motion.div>
            </div>

            {/* By Request Type Statistics */}
            {statistics.by_request_type && (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="bg-slate-800/50 backdrop-blur-xl rounded-2xl p-6 border border-slate-700/50"
              >
                <h2 className="text-xl font-bold text-white mb-6">
                  Statistics by Request Type
                </h2>
                <div className="space-y-4">
                  {Object.entries(statistics.by_request_type).map(
                    ([type, data]) => (
                      <div
                        key={type}
                        className="bg-slate-900/50 rounded-xl p-4 border border-slate-700/30"
                      >
                        <div className="flex items-center justify-between mb-3">
                          <h3 className="text-white font-medium">
                            {REQUEST_TYPE_LABELS[type] || type}
                          </h3>
                          <span className="text-sm text-slate-400">
                            Avg: {data.average_approval_time_hours.toFixed(1)}h
                          </span>
                        </div>
                        <div className="grid grid-cols-4 gap-4">
                          <div>
                            <p className="text-xs text-slate-400 mb-1">Total</p>
                            <p className="text-lg font-bold text-white">
                              {data.total}
                            </p>
                          </div>
                          <div>
                            <p className="text-xs text-slate-400 mb-1">Approved</p>
                            <p className="text-lg font-bold text-green-400">
                              {data.approved}
                            </p>
                          </div>
                          <div>
                            <p className="text-xs text-slate-400 mb-1">Pending</p>
                            <p className="text-lg font-bold text-yellow-400">
                              {data.pending}
                            </p>
                          </div>
                          <div>
                            <p className="text-xs text-slate-400 mb-1">Rejected</p>
                            <p className="text-lg font-bold text-red-400">
                              {data.rejected}
                            </p>
                          </div>
                        </div>
                      </div>
                    )
                  )}
                </div>
              </motion.div>
            )}
          </motion.div>
        )}

        {/* Timeline Modal */}
        {selectedRequest && timeline && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4"
            onClick={() => {
              setSelectedRequest(null);
              setTimeline(null);
            }}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-slate-800 rounded-2xl p-6 max-w-3xl w-full max-h-[90vh] overflow-y-auto border border-slate-700/50"
            >
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-2xl font-bold text-white">Workflow Timeline</h2>
                <button
                  onClick={() => {
                    setSelectedRequest(null);
                    setTimeline(null);
                  }}
                  className="p-2 hover:bg-slate-700/50 rounded-xl text-slate-400 hover:text-white transition-all"
                >
                  <XCircle className="w-6 h-6" />
                </button>
              </div>

              <div className="space-y-4">
                {timeline.timeline.map((event, idx) => (
                  <div
                    key={idx}
                    className="flex gap-4 p-4 bg-slate-900/50 rounded-xl border border-slate-700/30"
                  >
                    <div className="flex-shrink-0">
                      <div className="w-3 h-3 rounded-full bg-blue-500 mt-2" />
                      {idx < timeline.timeline.length - 1 && (
                        <div className="w-0.5 h-full bg-slate-700 ml-1.5 mt-2" />
                      )}
                    </div>
                    <div className="flex-1">
                      <p className="text-white font-medium mb-1">
                        {event.description}
                      </p>
                      {event.actor && (
                        <p className="text-sm text-slate-400 mb-2">
                          by {event.actor.full_name || event.actor.email || "System"}
                        </p>
                      )}
                      <p className="text-xs text-slate-500">
                        {formatDate(event.timestamp)}
                      </p>
                      {event.data && event.data.comments && (
                        <p className="text-sm text-slate-300 mt-2 italic">
                          "{event.data.comments}"
                        </p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </motion.div>
          </motion.div>
        )}
      </div>
    </div>
  );
};

export default WorkflowAnalytics;

