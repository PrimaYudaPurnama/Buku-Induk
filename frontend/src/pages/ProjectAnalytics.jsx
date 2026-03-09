import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import {
  BarChart3,
  TrendingUp,
  Users,
  Target,
  Calendar,
  RefreshCw,
  Eye,
  CheckCircle2,
  Clock,
  X,
} from "lucide-react";
import {
  fetchProjectOverview,
  fetchProjectDetails,
} from "../utils/api.jsx";
import toast from "react-hot-toast";

const STATUS_COLORS = {
  planned: "bg-blue-500/20 text-blue-400 border-blue-500/30",
  ongoing: "bg-yellow-500/20 text-yellow-400 border-yellow-500/30",
  completed: "bg-green-500/20 text-green-400 border-green-500/30",
  cancelled: "bg-red-500/20 text-red-400 border-red-500/30",
};

const STATUS_LABELS = {
  planned: "Direncanakan",
  ongoing: "Berjalan",
  completed: "Selesai",
  cancelled: "Dibatalkan",
};

const WORK_TYPE_LABELS = {
  management: "Management",
  technic: "Teknis",
};

const ProjectAnalytics = () => {
  const [overview, setOverview] = useState(null);
  const [selectedProject, setSelectedProject] = useState(null);
  const [projectDetails, setProjectDetails] = useState(null);
  const [loading, setLoading] = useState(false);
  const [detailsLoading, setDetailsLoading] = useState(false);
  const [filters, setFilters] = useState({
    work_type: "",
    status: "",
  });

  useEffect(() => {
    loadOverview();
  }, [filters]);

  const loadOverview = async () => {
    try {
      setLoading(true);
      const response = await fetchProjectOverview({
        work_type: filters.work_type || undefined,
        status: filters.status || undefined,
      });
      setOverview(response.data);
    } catch (error) {
      toast.error(error.message || "Gagal memuat overview proyek");
    } finally {
      setLoading(false);
    }
  };

  const loadProjectDetails = async (projectId) => {
    try {
      setDetailsLoading(true);
      const response = await fetchProjectDetails(projectId);
      setProjectDetails(response.data);
      setSelectedProject(projectId);
    } catch (error) {
      toast.error(error.message || "Gagal memuat detail proyek");
    } finally {
      setDetailsLoading(false);
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

  const getProgressColor = (percentage) => {
    if (percentage >= 80) return "bg-green-500";
    if (percentage >= 50) return "bg-yellow-500";
    return "bg-red-500";
  };

  const handleFilterChange = (key, value) => {
    setFilters((prev) => ({ ...prev, [key]: value }));
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
                Analytics Proyek
              </h1>
              <p className="text-slate-400">
                Analisis progress proyek dan kontribusi karyawan
              </p>
            </div>
            <motion.button
              onClick={loadOverview}
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              className="p-3 bg-slate-800/50 hover:bg-slate-700/70 rounded-xl text-slate-300 hover:text-white transition-all"
            >
              <RefreshCw className="w-5 h-5" />
            </motion.button>
          </div>

          {/* Filters */}
          <div className="flex gap-4 bg-slate-800/50 backdrop-blur-xl rounded-xl p-4 border border-slate-700/50">
            <div className="flex-1">
              <label className="block text-sm font-medium text-slate-300 mb-2">
                Tipe Kerja
              </label>
              <select
                value={filters.work_type}
                onChange={(e) => handleFilterChange("work_type", e.target.value)}
                className="w-full px-3 py-2 bg-slate-700/50 border border-slate-600 rounded-lg text-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="">Semua Tipe</option>
                {Object.entries(WORK_TYPE_LABELS).map(([key, label]) => (
                  <option key={key} value={key}>
                    {label}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex-1">
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
          </div>
        </motion.div>

        {loading && (
          <div className="text-center py-12 text-slate-400">
            Memuat data...
          </div>
        )}

        {!loading && overview && (
          <div className="space-y-6">
            {/* Overall Statistics */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4"
            >
              <motion.div
                whileHover={{ scale: 1.02 }}
                className="bg-slate-800/50 backdrop-blur-xl rounded-xl p-6 border border-slate-700/50"
              >
                <div className="flex items-center justify-between mb-4">
                  <div className="p-3 bg-blue-500/20 rounded-lg">
                    <Target className="w-6 h-6 text-blue-400" />
                  </div>
                </div>
                <h3 className="text-2xl font-bold text-white mb-1">
                  {overview.overall?.total_projects || 0}
                </h3>
                <p className="text-slate-400 text-sm">Total Proyek</p>
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
                  {overview.overall?.by_status?.completed || 0}
                </h3>
                <p className="text-slate-400 text-sm">Proyek Selesai</p>
              </motion.div>

              <motion.div
                whileHover={{ scale: 1.02 }}
                className="bg-slate-800/50 backdrop-blur-xl rounded-xl p-6 border border-slate-700/50"
              >
                <div className="flex items-center justify-between mb-4">
                  <div className="p-3 bg-yellow-500/20 rounded-lg">
                    <Clock className="w-6 h-6 text-yellow-400" />
                  </div>
                </div>
                <h3 className="text-2xl font-bold text-white mb-1">
                  {overview.overall?.by_status?.ongoing || 0}
                </h3>
                <p className="text-slate-400 text-sm">Proyek Berjalan</p>
              </motion.div>

              <motion.div
                whileHover={{ scale: 1.02 }}
                className="bg-slate-800/50 backdrop-blur-xl rounded-xl p-6 border border-slate-700/50"
              >
                <div className="flex items-center justify-between mb-4">
                  <div className="p-3 bg-purple-500/20 rounded-lg">
                    <TrendingUp className="w-6 h-6 text-purple-400" />
                  </div>
                </div>
                <h3 className="text-2xl font-bold text-white mb-1">
                  {overview.overall?.average_progress?.toFixed(1) || 0}%
                </h3>
                <p className="text-slate-400 text-sm">Rata-rata Progress</p>
              </motion.div>
            </motion.div>

            {/* Status Breakdown */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-slate-800/50 backdrop-blur-xl rounded-xl p-6 border border-slate-700/50"
            >
              <h2 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
                <BarChart3 className="w-5 h-5" />
                Breakdown Status Proyek
              </h2>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {Object.entries(STATUS_LABELS).map(([key, label]) => {
                  const count = overview.overall?.by_status?.[key] || 0;
                  const total = overview.overall?.total_projects || 1;
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
            </motion.div>

            {/* Projects List */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-slate-800/50 backdrop-blur-xl rounded-xl p-6 border border-slate-700/50"
            >
              <h2 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
                <Target className="w-5 h-5" />
                Daftar Proyek
              </h2>
              <div className="space-y-4">
                {overview.projects?.map((projectData) => {
                  const project = projectData.project;
                  const stats = projectData.statistics;
                  return (
                    <motion.div
                      key={project._id}
                      whileHover={{ scale: 1.01 }}
                      className="bg-slate-700/30 rounded-xl p-6 border border-slate-600/50 hover:border-blue-500/50 transition-all"
                    >
                      <div className="flex items-start justify-between mb-4">
                        <div className="flex-1">
                          <div className="flex items-center gap-3 mb-2">
                            <h3 className="text-xl font-bold text-white">
                              {project.name}
                            </h3>
                            <span
                              className={`px-3 py-1 rounded-full text-xs font-medium ${
                                STATUS_COLORS[project.status] || "bg-slate-600"
                              }`}
                            >
                              {STATUS_LABELS[project.status] || project.status}
                            </span>
                            <span className="px-3 py-1 rounded-full text-xs font-medium bg-slate-600 text-slate-300">
                              {WORK_TYPE_LABELS[project.work_type] || project.work_type}
                            </span>
                          </div>
                          <p className="text-slate-400 text-sm mb-2">
                            Kode: {project.code}
                          </p>
                          <div className="flex items-center gap-4 text-sm text-slate-400">
                            <div className="flex items-center gap-2">
                              <Calendar className="w-4 h-4" />
                              <span>
                                {formatDate(project.start_date)} - {formatDate(project.end_date)}
                              </span>
                            </div>
                            <div className="flex items-center gap-2">
                              <Users className="w-4 h-4" />
                              <span>{stats.unique_contributors} kontributor</span>
                            </div>
                          </div>
                        </div>
                        <motion.button
                          onClick={() => loadProjectDetails(project._id)}
                          whileHover={{ scale: 1.05 }}
                          whileTap={{ scale: 0.95 }}
                          className="px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded-lg text-white flex items-center gap-2 transition-all"
                        >
                          <Eye className="w-4 h-4" />
                          Detail
                        </motion.button>
                      </div>

                      {/* Progress Bar */}
                      <div className="mb-4">
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-sm text-slate-300">Progress</span>
                          <span className="text-sm font-bold text-white">
                            {project.percentage}%
                          </span>
                        </div>
                        <div className="h-3 bg-slate-700 rounded-full overflow-hidden">
                          <div
                            className={`h-full ${getProgressColor(project.percentage)} transition-all`}
                            style={{ width: `${project.percentage}%` }}
                          />
                        </div>
                      </div>

                      {/* Statistics */}
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 pt-4 border-t border-slate-600/50">
                        <div>
                          <div className="text-sm text-slate-400 mb-1">
                            Total Kontribusi
                          </div>
                          <div className="text-lg font-bold text-white">
                            {stats.total_contribution_percentage.toFixed(2)}%
                          </div>
                        </div>
                        <div>
                          <div className="text-sm text-slate-400 mb-1">
                            Rata-rata/User
                          </div>
                          <div className="text-lg font-bold text-white">
                            {stats.average_contribution_per_user.toFixed(2)}%
                          </div>
                        </div>
                        <div>
                          <div className="text-sm text-slate-400 mb-1">
                            Jumlah Kontribusi
                          </div>
                          <div className="text-lg font-bold text-white">
                            {stats.contribution_count}
                          </div>
                        </div>
                        <div>
                          <div className="text-sm text-slate-400 mb-1">
                            Kontributor
                          </div>
                          <div className="text-lg font-bold text-white">
                            {stats.unique_contributors}
                          </div>
                        </div>
                      </div>

                      {/* Top Contributors */}
                      {projectData.contributors && projectData.contributors.length > 0 && (
                        <div className="mt-4 pt-4 border-t border-slate-600/50">
                          <div className="text-sm text-slate-400 mb-2">Top Kontributor:</div>
                          <div className="flex flex-wrap gap-2">
                            {projectData.contributors.slice(0, 5).map((contributor, idx) => (
                              <div
                                key={idx}
                                className="px-3 py-1 bg-slate-600/50 rounded-lg text-sm text-white"
                              >
                                {contributor.user_name} ({contributor.total_contribution.toFixed(1)}%)
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </motion.div>
                  );
                })}
              </div>
            </motion.div>
          </div>
        )}

        {/* Project Details Modal */}
        {selectedProject && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4"
            onClick={() => {
              setSelectedProject(null);
              setProjectDetails(null);
            }}
          >
            <motion.div
              initial={{ scale: 0.9, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.9, y: 20 }}
              className="bg-slate-800 rounded-xl shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-y-auto border border-slate-700"
              onClick={(e) => e.stopPropagation()}
            >
              {detailsLoading ? (
                <div className="p-12 text-center text-slate-400">
                  Memuat detail proyek...
                </div>
              ) : projectDetails ? (
                <>
                  <div className="sticky top-0 bg-slate-800 border-b border-slate-700 p-6 flex items-center justify-between">
                    <div>
                      <h2 className="text-2xl font-bold text-white mb-1">
                        {projectDetails.project.name}
                      </h2>
                      <p className="text-slate-400 text-sm">
                        {projectDetails.project.code} • {WORK_TYPE_LABELS[projectDetails.project.work_type]}
                      </p>
                    </div>
                    <button
                      onClick={() => {
                        setSelectedProject(null);
                        setProjectDetails(null);
                      }}
                      className="p-2 hover:bg-slate-700 rounded-lg text-slate-400 hover:text-white transition-all"
                    >
                      <X className="w-5 h-5" />
                    </button>
                  </div>

                  <div className="p-6 space-y-6">
                    {/* Project Info */}
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <div className="text-sm text-slate-400 mb-1">Status</div>
                        <span
                          className={`px-3 py-1 rounded-full text-sm font-medium inline-block ${
                            STATUS_COLORS[projectDetails.project.status] || "bg-slate-600"
                          }`}
                        >
                          {STATUS_LABELS[projectDetails.project.status]}
                        </span>
                      </div>
                      <div>
                        <div className="text-sm text-slate-400 mb-1">Progress</div>
                        <div className="text-2xl font-bold text-white">
                          {projectDetails.project.percentage}%
                        </div>
                      </div>
                      <div>
                        <div className="text-sm text-slate-400 mb-1">Tanggal Mulai</div>
                        <div className="text-white">{formatDate(projectDetails.project.start_date)}</div>
                      </div>
                      <div>
                        <div className="text-sm text-slate-400 mb-1">Tanggal Selesai</div>
                        <div className="text-white">{formatDate(projectDetails.project.end_date)}</div>
                      </div>
                    </div>

                    {/* Contributors */}
                    <div>
                      <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
                        <Users className="w-5 h-5" />
                        Kontributor ({projectDetails.contributors.length})
                      </h3>
                      <div className="space-y-3">
                        {projectDetails.contributors.map((contributor, idx) => (
                          <div
                            key={idx}
                            className="bg-slate-700/30 rounded-lg p-4 border border-slate-600/50"
                          >
                            <div className="flex items-center justify-between mb-2">
                              <div>
                                <div className="font-medium text-white">
                                  {contributor.user?.full_name || "Unknown"}
                                </div>
                                <div className="text-sm text-slate-400">
                                  {contributor.user?.email || ""}
                                </div>
                              </div>
                              <div className="text-right">
                                <div className="text-lg font-bold text-white">
                                  {contributor.total_contribution.toFixed(2)}%
                                </div>
                                <div className="text-xs text-slate-400">
                                  {contributor.contribution_count} kontribusi
                                </div>
                              </div>
                            </div>
                            <div className="h-2 bg-slate-700 rounded-full overflow-hidden mt-2">
                              <div
                                className="h-full bg-blue-500"
                                style={{
                                  width: `${Math.min((contributor.total_contribution / projectDetails.total_contribution) * 100, 100)}%`,
                                }}
                              />
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Timeline */}
                    {projectDetails.timeline && projectDetails.timeline.length > 0 && (
                      <div>
                        <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
                          <Calendar className="w-5 h-5" />
                          Timeline Kontribusi
                        </h3>
                        <div className="space-y-2 max-h-64 overflow-y-auto">
                          {projectDetails.timeline.map((item, idx) => (
                            <div
                              key={idx}
                              className="p-3 bg-slate-700/30 rounded-lg border border-slate-600/50"
                            >
                              <div className="flex items-center justify-between mb-2">
                                <div className="flex items-center gap-3">
                                  <Calendar className="w-4 h-4 text-slate-400" />
                                  <span className="text-white font-medium">
                                    {formatDate(item.date)}
                                  </span>
                                </div>
                                <div className="flex items-center gap-4">
                                  <span className="text-slate-400 text-sm">
                                    {item.contribution_count} kontribusi
                                  </span>
                                  <span className="text-white font-medium">
                                    {item.total_contribution.toFixed(2)}%
                                  </span>
                                </div>
                              </div>
                              {item.contributors && item.contributors.length > 0 && (
                                <div className="mt-2 pt-2 border-t border-slate-600/50">
                                  <div className="text-xs text-slate-400 mb-1">Kontributor:</div>
                                  <div className="flex flex-wrap gap-1.5">
                                    {item.contributors.map((contrib, cIdx) => (
                                      <span
                                        key={cIdx}
                                        className="px-2 py-0.5 bg-slate-600/50 rounded text-xs text-slate-300"
                                        title={contrib.user_email}
                                      >
                                        {contrib.user_name} ({contrib.contribution.toFixed(1)}%)
                                      </span>
                                    ))}
                                  </div>
                                </div>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </>
              ) : null}
            </motion.div>
          </motion.div>
        )}
      </div>
    </div>
  );
};

export default ProjectAnalytics;
