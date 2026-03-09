import { useState, useEffect } from "react";
import {
  Search, Download, Filter, X, Target, Edit, Trash2,
  ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight,
  Loader2, Save, Plus, AlertCircle, Sparkles, Calendar, Code, TrendingUp, Ban
} from "lucide-react";
import { motion } from "framer-motion";
import toast, { Toaster } from "react-hot-toast";
import { useAuthStore } from "../stores/useAuthStore";

import {
  fetchProjectsList,
  createProject,
  updateProject,
  deleteProject
} from "../utils/api.jsx";

const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { delayChildren: 0.3, staggerChildren: 0.1 }
  }
};

const itemVariants = {
  hidden: { y: 20, opacity: 0 },
  visible: { y: 0, opacity: 1, transition: { type: "spring", stiffness: 100 } }
};

const WORK_TYPE_OPTIONS = [
  { value: "management", label: "Management" },
  { value: "technic", label: "Teknis" },
];

const STATUS_OPTIONS = [
  { value: "planned", label: "Direncanakan" },
  { value: "ongoing", label: "Berjalan" },
  { value: "completed", label: "Selesai" },
  { value: "cancelled", label: "Dibatalkan" },
];

export default function ProjectList() {
  const { user } = useAuthStore();
  const permissions = user?.role_id?.permissions || [];

  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(15);
  const [totalPages, setTotalPages] = useState(1);
  const [totalItems, setTotalItems] = useState(0);

  // Filters
  const [search, setSearch] = useState("");
  const [workTypeFilter, setWorkTypeFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [sortBy, setSortBy] = useState("-created_at");
  const [showFilters, setShowFilters] = useState(false);

  // Modal states
  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [selectedProject, setSelectedProject] = useState(null);
  const [processing, setProcessing] = useState(false);

  // Form state
  const [formData, setFormData] = useState({
    code: "",
    name: "",
    work_type: "management",
    percentage: 0,
    status: "planned", // Default, hidden from form
    start_date: "",
    end_date: "", // Hidden from form, auto-filled by system
  });

  const activeFiltersCount = [search, workTypeFilter, statusFilter].filter(Boolean).length;

  useEffect(() => {
    loadProjects();
  }, [page, pageSize, search, workTypeFilter, statusFilter, sortBy]);

  const loadProjects = async () => {
    setLoading(true);
    try {
      const res = await fetchProjectsList({
        page,
        limit: pageSize,
        search,
        work_type: workTypeFilter || undefined,
        status: statusFilter || undefined,
        sort: sortBy,
      });

      setProjects(res.data || []);
      setTotalPages(res.total_pages || 1);
      setTotalItems(res.total || 0);
    } catch (err) {
      toast.error("Gagal memuat data proyek");
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setFormData({
      code: "",
      name: "",
      work_type: "management",
      percentage: 0,
      status: "planned", // Default, hidden from form
      start_date: "",
      end_date: "", // Hidden from form, auto-filled by system
    });
  };

  const openAddModal = () => {
    resetForm();
    setShowAddModal(true);
  };

  const openEditModal = (project) => {
    setSelectedProject(project);
    setFormData({
      code: project.code || "",
      name: project.name || "",
      work_type: project.work_type || "management",
      percentage: project.percentage || 0,
      status: project.status || "planned", // Hidden from form
      start_date: project.start_date ? new Date(project.start_date).toISOString().split("T")[0] : "",
      end_date: "", // Hidden from form, auto-filled by system
    });
    setShowEditModal(true);
  };

  const openDeleteConfirm = (project) => {
    setSelectedProject(project);
    setShowDeleteConfirm(true);
  };

  const handleCancelProject = async (project) => {
    if (processing) return;
    if (!confirm(`Apakah Anda yakin ingin membatalkan proyek "${project.name}"?`)) return;
    
    setProcessing(true);
    try {
      await updateProject(project._id, { status: "cancelled" });
      toast.success("Proyek berhasil dibatalkan");
      loadProjects();
    } catch (err) {
      toast.error(err.response?.data?.message || "Gagal membatalkan proyek");
    } finally {
      setProcessing(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (processing) return;
    setProcessing(true);

    try {
      const payload = {
        code: formData.code,
        name: formData.name,
        work_type: formData.work_type,
        percentage: Number(formData.percentage),
        start_date: formData.start_date || null,
        // status dan end_date tidak dikirim, biar sistem yang handle otomatis
      };

      if (showAddModal) {
        await createProject(payload);
        toast.success("Proyek berhasil ditambahkan");
        setShowAddModal(false);
      } else if (showEditModal) {
        // For edit, only send fields that user can modify (status & end_date are system-managed)
        const editPayload = {
          code: payload.code,
          name: payload.name,
          work_type: payload.work_type,
          percentage: payload.percentage,
          start_date: payload.start_date,
          // status dan end_date tidak dikirim, biar sistem yang handle otomatis
        };
        await updateProject(selectedProject._id, editPayload);
        toast.success("Proyek berhasil diperbarui");
        setShowEditModal(false);
      }
      loadProjects();
      resetForm();
    } catch (err) {
      const msg = err.response?.data?.message || err.message || "Terjadi kesalahan";
      toast.error(msg);
    } finally {
      setProcessing(false);
    }
  };

  const handleDelete = async () => {
    if (processing) return;
    setProcessing(true);
    try {
      await deleteProject(selectedProject._id);
      toast.success("Proyek berhasil dihapus");
      setShowDeleteConfirm(false);
      loadProjects();
    } catch (err) {
      toast.error(err.response?.data?.message || "Gagal menghapus proyek");
    } finally {
      setProcessing(false);
    }
  };

  const exportToCSV = () => {
    const headers = ["Kode", "Nama Proyek", "Tipe Kerja", "Progress (%)", "Status", "Tanggal Mulai", "Tanggal Selesai", "Dibuat Pada"];
    const rows = projects.map(p => [
      p.code,
      p.name,
      p.work_type === "management" ? "Management" : "Teknis",
      p.percentage,
      p.status === "planned" ? "Direncanakan" : p.status === "ongoing" ? "Berjalan" : p.status === "completed" ? "Selesai" : "Dibatalkan",
      p.start_date ? new Date(p.start_date).toLocaleDateString("id-ID") : "-",
      p.end_date ? new Date(p.end_date).toLocaleDateString("id-ID") : "-",
      new Date(p.created_at).toLocaleDateString("id-ID")
    ]);
    const csv = [headers, ...rows].map(r => r.map(c => `"${c}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `projects_${new Date().toISOString().slice(0,10)}.csv`;
    a.click();
  };

  const getStatusColor = (status) => {
    switch (status) {
      case "planned": return "bg-blue-500/20 text-blue-400 border-blue-500/30";
      case "ongoing": return "bg-yellow-500/20 text-yellow-400 border-yellow-500/30";
      case "completed": return "bg-green-500/20 text-green-400 border-green-500/30";
      case "cancelled": return "bg-red-500/20 text-red-400 border-red-500/30";
      default: return "bg-slate-500/20 text-slate-400 border-slate-500/30";
    }
  };

  const getWorkTypeColor = (workType) => {
    return workType === "management" 
      ? "bg-purple-500/20 text-purple-400 border-purple-500/30"
      : "bg-cyan-500/20 text-cyan-400 border-cyan-500/30";
  };

  return (
    <>
      <Toaster position="top-center" />
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

        <motion.div 
          className="max-w-7xl mx-auto relative z-10"
          variants={containerVariants}
          initial="hidden"
          animate="visible"
        >
          {/* Header */}
          <motion.div variants={itemVariants} className="mb-8">
            <h1 className="text-4xl font-bold bg-gradient-to-r from-blue-400 to-indigo-400 bg-clip-text text-transparent">
              Project Management
            </h1>
            <p className="text-slate-400 mt-2 flex items-center gap-2">
              <Sparkles className="w-5 h-5" />
              Kelola proyek dan progress perusahaan
            </p>
          </motion.div>

          {/* Toolbar Card */}
          <motion.div 
            className="bg-slate-900/80 backdrop-blur-xl rounded-3xl shadow-2xl border border-blue-900/50 p-6 mb-8"
            variants={itemVariants}
          >
            <div className="flex flex-col lg:flex-row gap-6">
              <div className="flex-1 relative">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-blue-400 w-6 h-6" />
                <input
                  type="text"
                  placeholder="Cari kode atau nama proyek..."
                  value={search}
                  onChange={(e) => { setSearch(e.target.value); setPage(1); }}
                  className="w-full pl-14 pr-6 py-4 bg-slate-800/50 border border-slate-700 rounded-2xl text-white placeholder-slate-500 focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all backdrop-blur-sm"
                />
              </div>
              <div className="flex gap-4">
                <motion.button 
                  onClick={() => setShowFilters(!showFilters)}
                  className="relative flex items-center gap-3 px-6 py-4 bg-slate-800/50 backdrop-blur-sm rounded-2xl border border-slate-700 hover:bg-slate-700/70 transition-all text-white"
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                >
                  <Filter className="w-6 h-6 text-blue-400" />
                  Filter
                  {activeFiltersCount > 0 && (
                    <span className="absolute -top-2 -right-2 bg-blue-600 text-white text-xs rounded-full w-6 h-6 flex items-center justify-center">
                      {activeFiltersCount}
                    </span>
                  )}
                </motion.button>
                <motion.button 
                  onClick={exportToCSV}
                  className="flex items-center gap-3 px-6 py-4 bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700 text-white rounded-2xl transition-all shadow-lg"
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                >
                  <Download className="w-6 h-6" />
                  Export CSV
                </motion.button>
                {permissions.includes("system:manage_projects") && (
                  <motion.button 
                    onClick={openAddModal}
                    className="flex items-center gap-3 px-6 py-4 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white rounded-2xl transition-all shadow-lg"
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                  >
                    <Plus className="w-6 h-6" />
                    Tambah Proyek
                  </motion.button>
                )}
              </div>
            </div>

            {showFilters && (
              <motion.div 
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                className="mt-8 pt-8 border-t border-slate-700/50"
              >
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  <div>
                    <label className="block text-sm font-medium text-slate-300 mb-2">Tipe Kerja</label>
                    <select
                      value={workTypeFilter}
                      onChange={(e) => { setWorkTypeFilter(e.target.value); setPage(1); }}
                      className="w-full px-5 py-4 bg-slate-800/50 border border-slate-700 rounded-2xl text-white focus:ring-2 focus:ring-blue-500 backdrop-blur-sm"
                    >
                      <option value="">Semua Tipe</option>
                      {WORK_TYPE_OPTIONS.map(opt => (
                        <option key={opt.value} value={opt.value}>
                          {opt.label}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-300 mb-2">Status</label>
                    <select
                      value={statusFilter}
                      onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}
                      className="w-full px-5 py-4 bg-slate-800/50 border border-slate-700 rounded-2xl text-white focus:ring-2 focus:ring-blue-500 backdrop-blur-sm"
                    >
                      <option value="">Semua Status</option>
                      {STATUS_OPTIONS.map(opt => (
                        <option key={opt.value} value={opt.value}>
                          {opt.label}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-300 mb-2">Urutkan</label>
                    <select value={sortBy} onChange={(e) => { setSortBy(e.target.value); setPage(1); }} className="w-full px-5 py-4 bg-slate-800/50 border border-slate-700 rounded-2xl text-white focus:ring-2 focus:ring-blue-500 backdrop-blur-sm">
                      <option value="-created_at">Terbaru</option>
                      <option value="created_at">Terlama</option>
                      <option value="name">Nama A-Z</option>
                      <option value="-name">Nama Z-A</option>
                      <option value="percentage">Progress Terendah</option>
                      <option value="-percentage">Progress Tertinggi</option>
                    </select>
                  </div>
                </div>
              </motion.div>
            )}
          </motion.div>

          {/* Table Card */}
          <motion.div 
            className="bg-slate-900/80 backdrop-blur-xl rounded-3xl shadow-2xl border border-blue-900/50 overflow-hidden"
            variants={itemVariants}
          >
            {loading ? (
              <div className="flex justify-center py-20">
                <motion.div animate={{ rotate: 360 }} transition={{ duration: 1, repeat: Infinity, ease: "linear" }} className="w-16 h-16 border-4 border-blue-500 border-t-transparent rounded-full" />
              </div>
            ) : projects.length === 0 ? (
              <div className="text-center py-20 text-slate-400 text-lg">Tidak ada data proyek</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full table-fixed">
                  <thead className="bg-slate-800/70 backdrop-blur-sm border-b border-slate-700/50 sticky top-0 z-20">
                    <tr>
                      <th className="w-96 px-8 py-5 text-left text-sm font-medium text-slate-300">Proyek</th>
                      <th className="px-8 py-5 text-left text-sm font-medium text-slate-300">Tipe</th>
                      <th className="px-8 py-5 text-left text-sm font-medium text-slate-300">Progress</th>
                      <th className="px-8 py-5 text-left text-sm font-medium text-slate-300">Status</th>
                      <th className="px-8 py-5 text-left text-sm font-medium text-slate-300">Timeline</th>
                      {permissions.includes("system:manage_projects") && (
                      <th className="w-48 px-8 py-5 text-right text-sm font-medium text-slate-300 sticky right-0 bg-slate-800/90 backdrop-blur-sm z-30">Aksi</th>
                      )}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-700/50">
                    {projects.map((proj) => (
                      <motion.tr 
                        key={proj._id} 
                        className="hover:bg-slate-800/50 transition-all"
                        whileHover={{ x: 5 }}
                      >
                        <td className="w-96 px-8 py-6">
                          <div className="flex items-center gap-5">
                            <div className="w-14 h-14 bg-gradient-to-br from-indigo-600 to-purple-700 rounded-2xl flex items-center justify-center shadow-lg">
                              <Target className="w-8 h-8 text-white" />
                            </div>
                            <div>
                              <div className="text-lg font-semibold text-white">{proj.name}</div>
                              <div className="text-sm text-slate-400 flex items-center gap-1 mt-1">
                                <Code className="w-3 h-3" />
                                {proj.code}
                              </div>
                            </div>
                          </div>
                        </td>
                        <td className="px-8 py-6">
                          <span className={`px-3 py-1 rounded-full text-xs font-medium ${getWorkTypeColor(proj.work_type)}`}>
                            {proj.work_type === "management" ? "Management" : "Teknis"}
                          </span>
                        </td>
                        <td className="px-8 py-6">
                          <div className="flex items-center gap-3">
                            <div className="flex-1 bg-slate-700/50 rounded-full h-2 overflow-hidden">
                              <div 
                                className={`h-full ${
                                  proj.percentage >= 80 ? "bg-green-500" : 
                                  proj.percentage >= 50 ? "bg-yellow-500" : 
                                  "bg-red-500"
                                }`}
                                style={{ width: `${proj.percentage}%` }}
                              />
                            </div>
                            <span className="text-white font-medium text-sm w-12 text-right">{proj.percentage}%</span>
                          </div>
                        </td>
                        <td className="px-8 py-6">
                          <span className={`px-3 py-1 rounded-full text-xs font-medium ${getStatusColor(proj.status)}`}>
                            {STATUS_OPTIONS.find(s => s.value === proj.status)?.label || proj.status}
                          </span>
                        </td>
                        <td className="px-8 py-6 text-slate-300">
                          <div className="flex flex-col gap-1 text-sm">
                            <div className="flex items-center gap-2">
                              <Calendar className="w-4 h-4 text-slate-400" />
                              <span>{proj.start_date ? new Date(proj.start_date).toLocaleDateString("id-ID") : "-"}</span>
                            </div>
                            {proj.end_date && (
                              <div className="flex items-center gap-2">
                                <Calendar className="w-4 h-4 text-slate-400" />
                                <span>{new Date(proj.end_date).toLocaleDateString("id-ID")}</span>
                              </div>
                            )}
                          </div>
                        </td>
                          {permissions.includes("system:manage_projects") && (
                        <td className="w-48 px-8 py-6 text-right sticky right-0 bg-slate-900/80 backdrop-blur-sm z-10">
                          <div className="flex justify-end gap-4">
                            <>
                              <motion.button whileHover={{ scale: 1.2 }} whileTap={{ scale: 0.9 }} onClick={() => openEditModal(proj)} className="text-blue-400 hover:text-blue-300" title="Edit">
                                <Edit className="w-6 h-6" />
                              </motion.button>
                              {proj.status !== "cancelled" && proj.status !== "completed" && (
                                <motion.button whileHover={{ scale: 1.2 }} whileTap={{ scale: 0.9 }} onClick={() => handleCancelProject(proj)} disabled={processing} className="text-orange-400 hover:text-orange-300 disabled:opacity-50" title="Batalkan Proyek">
                                  <Ban className="w-6 h-6" />
                                </motion.button>
                              )}
                              <motion.button whileHover={{ scale: 1.2 }} whileTap={{ scale: 0.9 }} onClick={() => openDeleteConfirm(proj)} className="text-red-400 hover:text-red-300" title="Hapus">
                                <Trash2 className="w-6 h-6" />
                              </motion.button>
                            </>
                          </div>
                        </td>
                          )}
                      </motion.tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </motion.div>

          {/* Pagination */}
          {!loading && projects.length > 0 && (
            <motion.div 
              className="mt-8 flex flex-col sm:flex-row items-center justify-between gap-6 bg-slate-900/80 backdrop-blur-xl rounded-3xl p-6 border border-blue-900/50"
              
            >
              <p className="text-slate-400">
                Halaman <strong className="text-white">{page}</strong> dari <strong className="text-white">{totalPages}</strong> ({totalItems} total)
              </p>
              <div className="flex items-center gap-4">
                <motion.button whileHover={{ scale: 1.1 }} disabled={page === 1} onClick={() => setPage(1)} className="p-3 bg-slate-800/50 rounded-2xl disabled:opacity-50"><ChevronsLeft className="w-6 h-6 text-slate-300" /></motion.button>
                <motion.button whileHover={{ scale: 1.1 }} disabled={page === 1} onClick={() => setPage(p => Math.max(1, p-1))} className="p-3 bg-slate-800/50 rounded-2xl disabled:opacity-50"><ChevronLeft className="w-6 h-6 text-slate-300" /></motion.button>
                <span className="text-white font-medium">{page} / {totalPages}</span>
                <motion.button whileHover={{ scale: 1.1 }} disabled={page === totalPages} onClick={() => setPage(p => Math.min(totalPages, p+1))} className="p-3 bg-slate-800/50 rounded-2xl disabled:opacity-50"><ChevronRight className="w-6 h-6 text-slate-300" /></motion.button>
                <motion.button whileHover={{ scale: 1.1 }} disabled={page === totalPages} onClick={() => setPage(totalPages)} className="p-3 bg-slate-800/50 rounded-2xl disabled:opacity-50"><ChevronsRight className="w-6 h-6 text-slate-300" /></motion.button>
              </div>
              <select value={pageSize} onChange={(e) => { setPageSize(+e.target.value); setPage(1); }} className="px-5 py-3 bg-slate-800/50 border border-slate-700 rounded-2xl text-white">
                {[10, 15, 25, 50].map(s => <option key={s} value={s}>{s}/hal</option>)}
              </select>
            </motion.div>
          )}
        </motion.div>

        {/* Modal Tambah/Edit - Premium Style */}
        {(showAddModal || showEditModal) && (
          <motion.div 
            className="fixed inset-0 bg-black/70 backdrop-blur-lg flex items-center justify-center z-50 p-4"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
          >
            <motion.div 
              className="bg-slate-900/90 backdrop-blur-2xl rounded-3xl max-w-3xl w-full max-h-[90vh] overflow-y-auto border border-blue-900/50 shadow-2xl"
              initial={{ scale: 0.9, y: 50 }}
              animate={{ scale: 1, y: 0 }}
            >
              <div className="p-8">
                <h2 className="text-3xl font-bold text-white mb-8 flex items-center gap-3">
                  <Target className="w-10 h-10 text-indigo-400" />
                  {showAddModal ? "Tambah Proyek Baru" : "Edit Proyek"}
                </h2>
                <form onSubmit={handleSubmit} className="space-y-6">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                      <label className="block text-sm font-medium text-slate-300 mb-2">Kode Proyek *</label>
                      <input 
                        required 
                        type="text" 
                        value={formData.code} 
                        onChange={(e) => setFormData({...formData, code: e.target.value.toUpperCase()})} 
                        className="w-full px-5 py-4 bg-slate-800/50 border border-slate-700 rounded-2xl text-white placeholder-slate-500 focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all backdrop-blur-sm" 
                        placeholder="PROJ001"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-slate-300 mb-2">Nama Proyek *</label>
                      <input 
                        required 
                        type="text" 
                        value={formData.name} 
                        onChange={(e) => setFormData({...formData, name: e.target.value})} 
                        className="w-full px-5 py-4 bg-slate-800/50 border border-slate-700 rounded-2xl text-white placeholder-slate-500 focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all backdrop-blur-sm" 
                        placeholder="Nama proyek"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                      <label className="block text-sm font-medium text-slate-300 mb-2">Tipe Kerja *</label>
                      <select
                        required
                        value={formData.work_type}
                        onChange={(e) => setFormData({...formData, work_type: e.target.value})}
                        className="w-full px-5 py-4 bg-slate-800/50 border border-slate-700 rounded-2xl text-white focus:ring-2 focus:ring-blue-500 backdrop-blur-sm"
                      >
                        {WORK_TYPE_OPTIONS.map(opt => (
                          <option key={opt.value} value={opt.value}>
                            {opt.label}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-slate-300 mb-2">Progress (%)</label>
                    <div className="flex items-center gap-4">
                      <input 
                        type="range"
                        min="0"
                        max="100"
                        value={formData.percentage}
                        onChange={(e) => setFormData({...formData, percentage: Number(e.target.value)})}
                        className="flex-1 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-blue-500 [&::-webkit-slider-thumb]:cursor-pointer [&::-moz-range-thumb]:w-4 [&::-moz-range-thumb]:h-4 [&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:bg-blue-500 [&::-moz-range-thumb]:cursor-pointer [&::-moz-range-thumb]:border-0"
                        style={{ scrollbarWidth: "none", msOverflowStyle: "none" }}
                      />
                      <input 
                        type="number"
                        min="0"
                        max="100"
                        value={formData.percentage}
                        onChange={(e) => setFormData({...formData, percentage: Math.max(0, Math.min(100, Number(e.target.value)))})}
                        className="w-24 px-5 py-4 bg-slate-800/50 border border-slate-700 rounded-2xl text-white focus:ring-2 focus:ring-blue-500 backdrop-blur-sm text-center"
                      />
                    </div>
                    <p className="text-xs text-slate-400 mt-1">
                      Progress akan otomatis terisi dari kontribusi attendance. Saat mencapai 100%, status otomatis menjadi "Selesai" dan tanggal selesai terisi.
                    </p>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-slate-300 mb-2">Tanggal Mulai</label>
                    <input 
                      type="date" 
                      value={formData.start_date} 
                      onChange={(e) => setFormData({...formData, start_date: e.target.value})} 
                      className="w-full px-5 py-4 bg-slate-800/50 border border-slate-700 rounded-2xl text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all backdrop-blur-sm" 
                    />
                    <p className="text-xs text-slate-400 mt-1">
                      Status akan otomatis berubah menjadi "Berjalan" saat tanggal mulai tercapai
                    </p>
                  </div>

                  <div className="flex justify-end gap-4 pt-4">
                    <motion.button 
                      type="button" 
                      onClick={() => { setShowAddModal(false); setShowEditModal(false); }} 
                      className="px-6 py-4 bg-slate-800/70 border border-slate-700 rounded-2xl text-slate-300 hover:bg-slate-700/70 transition-all font-medium"
                      whileHover={{ scale: 1.03 }}
                    >
                      Batal
                    </motion.button>
                    <motion.button 
                      type="submit" 
                      disabled={processing}
                      className="flex items-center gap-3 px-8 py-4 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white rounded-2xl font-semibold disabled:opacity-50 relative overflow-hidden group"
                      whileHover={{ scale: 1.05 }}
                      whileTap={{ scale: 0.95 }}
                    >
                      <motion.div
                        className="absolute inset-0 bg-gradient-to-r from-transparent via-white to-transparent opacity-0 group-hover:opacity-20"
                        animate={{ x: ['-100%', '100%'] }}
                        transition={{ duration: 1.5, repeat: Infinity, ease: "linear" }}
                      />
                      {processing ? <Loader2 className="animate-spin w-6 h-6" /> : <Save className="w-6 h-6" />}
                      {showAddModal ? "Simpan" : "Update"}
                    </motion.button>
                  </div>
                </form>
              </div>
            </motion.div>
          </motion.div>
        )}

        {/* Modal Konfirmasi Hapus - Premium Style */}
        {showDeleteConfirm && (
          <motion.div 
            className="fixed inset-0 bg-black/70 backdrop-blur-lg flex items-center justify-center z-50 p-4"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
          >
            <motion.div 
              className="bg-slate-900/90 backdrop-blur-2xl rounded-3xl max-w-md w-full p-8 border border-red-900/50 shadow-2xl"
              initial={{ scale: 0.9, y: 50 }}
              animate={{ scale: 1, y: 0 }}
            >
              <div className="flex items-center gap-4 text-red-400 mb-6">
                <AlertCircle className="w-12 h-12" />
                <h3 className="text-2xl font-bold text-white">Konfirmasi Hapus</h3>
              </div>
              <p className="text-slate-300 mb-8">
                Apakah Anda yakin ingin menghapus proyek <strong className="text-white">{selectedProject?.name}</strong> ({selectedProject?.code})?
              </p>
              <div className="flex justify-end gap-4">
                <motion.button 
                  onClick={() => setShowDeleteConfirm(false)} 
                  className="px-6 py-4 bg-slate-800/70 border border-slate-700 rounded-2xl text-slate-300 hover:bg-slate-700/70 transition-all font-medium"
                  whileHover={{ scale: 1.03 }}
                >
                  Batal
                </motion.button>
                <motion.button 
                  onClick={handleDelete} 
                  disabled={processing}
                  className="flex items-center gap-3 px-8 py-4 bg-gradient-to-r from-red-600 to-red-700 hover:from-red-700 hover:to-red-800 text-white rounded-2xl font-semibold disabled:opacity-50 relative overflow-hidden group"
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                >
                  <motion.div
                    className="absolute inset-0 bg-gradient-to-r from-transparent via-white to-transparent opacity-0 group-hover:opacity-20"
                    animate={{ x: ['-100%', '100%'] }}
                    transition={{ duration: 1.5, repeat: Infinity, ease: "linear" }}
                  />
                  {processing ? <Loader2 className="animate-spin w-6 h-6" /> : <Trash2 className="w-6 h-6" />}
                  Hapus
                </motion.button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </div>
    </>
  );
}
