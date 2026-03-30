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
  deleteProject,
  fetchProjectTasks,
  approveTask,
  rejectTask,
  createTask,
  updateTask,
  deleteTask,
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

function TaskListWithActions({
  tasks,
  project,
  processing,
  onApprove,
  onReject,
  onOpenDetail,
}) {
  const totalHours = tasks.reduce(
    (sum, t) => sum + (Number(t.hour_weight) || 0),
    0
  );

  const handleHourChange = async (task, value) => {
    const n = Number(value);
    if (Number.isNaN(n) || n <= 0) {
      toast.error("Bobot jam harus lebih dari 0");
      return;
    }
    const current = Number(task.hour_weight) || 0;
    if (n === current) return;
    const confirmed = window.confirm(
      `Ubah bobot jam task "${task.title}" dari ${current} menjadi ${n}?`
    );
    if (!confirmed) return;
    try {
      await updateTask(task._id, { hour_weight: n });
      toast.success("Bobot jam task diupdate");
    } catch (err) {
      const msg = err?.message || "Gagal mengupdate bobot jam";
      toast.error(msg);
    }
  };

  const canApproveReject = (status) => status === "done";
  const statusBadge = (status) => {
    if (status === "approved") return "bg-emerald-500/15 text-emerald-300 border-emerald-500/30";
    if (status === "rejected") return "bg-red-500/15 text-red-300 border-red-500/30";
    if (status === "done") return "bg-blue-500/15 text-blue-300 border-blue-500/30";
    if (status === "ongoing") return "bg-yellow-500/15 text-yellow-300 border-yellow-500/30";
    return "bg-slate-500/15 text-slate-200 border-slate-500/30";
  };

  return (
    <div className="space-y-2 max-h-80 overflow-y-auto">
      {tasks.map((task) => {
        const hours = Number(task.hour_weight) || 0;
        const percent =
          totalHours > 0 ? ((hours / totalHours) * 100).toFixed(1) : "0.0";
        const isDone = task.status === "done";
        const isApproved = task.status === "approved";

        return (
          <button
            key={task._id}
            type="button"
            onClick={() => onOpenDetail?.(task)}
            className="w-full text-left flex items-center justify-between gap-3 px-3 py-2 rounded-xl bg-slate-900/80 border border-slate-800 hover:border-slate-700 hover:bg-slate-900/95 transition-colors"
          >
            <div className="flex-1">
              <div className="text-sm text-slate-100 font-medium">
                {task.title}
              </div>
              <div className="flex items-center gap-2 text-[11px] text-slate-500 flex-wrap">
                <span className={`px-2 py-0.5 rounded-full border ${statusBadge(task.status)}`}>
                  {task.status}
                </span>
                <span>
                  Bobot jam:{" "}
                  <input
                    type="number"
                    min={0.25}
                    step={0.25}
                    defaultValue={hours}
                    onClick={(e) => e.stopPropagation()}
                    onBlur={(e) => handleHourChange(task, e.target.value)}
                    className="w-16 px-1 py-0.5 text-xs bg-slate-900 border border-slate-600 rounded ml-1"
                  />{" "}
                  ({percent}% dari total jam task proyek)
                </span>
                {task.user_id?.full_name && <span>Dikerjakan oleh: {task.user_id.full_name}</span>}
                {task.approved_by && task.approved_at && (
                  <span>
                    Disetujui:{" "}
                    {new Date(task.approved_at).toLocaleString("id-ID")}
                  </span>
                )}
              </div>
            </div>
            <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
              {canApproveReject(task.status) && !isApproved && (
                <motion.button
                  whileHover={{ scale: 1.1 }}
                  whileTap={{ scale: 0.95 }}
                  disabled={processing}
                  onClick={() => onApprove(task)}
                  className="px-3 py-1 rounded-full text-xs bg-emerald-600 hover:bg-emerald-700 text-white disabled:opacity-50"
                >
                  Approve
                </motion.button>
              )}
              {canApproveReject(task.status) && !isApproved && (
                <motion.button
                  whileHover={{ scale: 1.1 }}
                  whileTap={{ scale: 0.95 }}
                  disabled={processing}
                  onClick={() => onReject(task)}
                  className="px-3 py-1 rounded-full text-xs bg-orange-600 hover:bg-orange-700 text-white disabled:opacity-50"
                >
                  Reject
                </motion.button>
              )}
            </div>
          </button>
        );
      })}
    </div>
  );
}

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
  const [showCancelConfirm, setShowCancelConfirm] = useState(false);
  const [selectedProject, setSelectedProject] = useState(null);
  const [processing, setProcessing] = useState(false);

  // Task management per project
  const [showTaskModal, setShowTaskModal] = useState(false);
  const [taskModalProject, setTaskModalProject] = useState(null);
  const [projectTasks, setProjectTasks] = useState([]);
  const [loadingTasks, setLoadingTasks] = useState(false);
  const [taskForm, setTaskForm] = useState({ title: "", hour_weight: 1 });
  const [taskProcessing, setTaskProcessing] = useState(false);
  const [showTaskDetailModal, setShowTaskDetailModal] = useState(false);
  const [taskDetail, setTaskDetail] = useState(null);
  const [taskDetailHour, setTaskDetailHour] = useState(1);
  const [initialTasks, setInitialTasks] = useState([{ title: "", hour_weight: 1 }]);

  // Form state
  const [formData, setFormData] = useState({
    code: "",
    name: "",
    work_type: "management",
    percentage: 0,
    status: "planned", // Default, hidden from form
    start_date: "",
    end_date: "", // Hidden from form, auto-filled by system
    target_end_date: "",
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
      target_end_date: "",
    });
    setInitialTasks([{ title: "", hour_weight: 1 }]);
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
      target_end_date: project.target_end_date ? new Date(project.target_end_date).toISOString().split("T")[0] : "",
    });
    setShowEditModal(true);
  };

  const openDeleteConfirm = (project) => {
    setSelectedProject(project);
    setShowDeleteConfirm(true);
  };
  const openCancelConfirm = (project) => {
    setSelectedProject(project);
    setShowCancelConfirm(true);
  };

  const openTaskModal = async (project) => {
    setTaskModalProject(project);
    setShowTaskModal(true);
    setTaskForm({ title: "", hour_weight: 1 });
    setLoadingTasks(true);
    try {
      const res = await fetchProjectTasks(project._id);
      setProjectTasks(res.data || []);
    } catch (err) {
      toast.error("Gagal memuat task proyek");
      setProjectTasks([]);
    } finally {
      setLoadingTasks(false);
    }
  };

  const refreshTasks = async () => {
    if (!taskModalProject) return;
    setLoadingTasks(true);
    try {
      const res = await fetchProjectTasks(taskModalProject._id);
      setProjectTasks(res.data || []);
    } catch (err) {
      console.error(err);
      toast.error("Gagal memuat task proyek");
    } finally {
      setLoadingTasks(false);
    }
  };

  const handleCreateTaskForProject = async (e) => {
    e.preventDefault();
    if (!taskModalProject || !taskForm.title.trim()) {
      toast.error("Judul task wajib diisi");
      return;
    }
    setTaskProcessing(true);
    try {
      await createProjectTask(taskModalProject._id, taskForm);
      toast.success("Task berhasil ditambahkan");
      setTaskForm({ title: "", hour_weight: 1 });
      await refreshTasks();
    } catch (err) {
      const msg = err?.message || "Gagal menambah task";
      toast.error(msg);
    } finally {
      setTaskProcessing(false);
    }
  };

  const createProjectTask = async (projectId, form) => {
    const payload = {
      title: form.title.trim(),
      project_id: projectId,
      hour_weight: Number(form.hour_weight) || 1,
      status: "planned",
    };
    await createTask(payload);
  };

  const handleApproveTask = async (task) => {
    setTaskProcessing(true);
    try {
      await approveTask(task._id, { hour_weight: task.hour_weight });
      toast.success("Task disetujui");
      await refreshTasks();
      await loadProjects();
    } catch (err) {
      const msg = err?.message || "Gagal menyetujui task";
      toast.error(msg);
    } finally {
      setTaskProcessing(false);
    }
  };

  const handleRejectTask = async (task) => {
    setTaskProcessing(true);
    try {
      await rejectTask(task._id);
      toast.success("Task ditolak");
      await refreshTasks();
      await loadProjects();
    } catch (err) {
      const msg = err?.message || "Gagal menolak task";
      toast.error(msg);
    } finally {
      setTaskProcessing(false);
    }
  };

  const openTaskDetail = (task) => {
    setTaskDetail(task);
    setTaskDetailHour(Number(task?.hour_weight) || 1);
    setShowTaskDetailModal(true);
  };

  const closeTaskDetail = () => {
    setShowTaskDetailModal(false);
    setTaskDetail(null);
  };

  const handleSaveTaskDetail = async () => {
    if (!taskDetail) return;
    setTaskProcessing(true);
    try {
      await updateTask(taskDetail._id, { hour_weight: Number(taskDetailHour) || 1 });
      toast.success("Bobot jam diperbarui");
      await refreshTasks();
      await loadProjects();
      closeTaskDetail();
    } catch (err) {
      toast.error(err?.message || "Gagal memperbarui bobot jam");
    } finally {
      setTaskProcessing(false);
    }
  };

  const handleDeleteTask = async () => {
    if (!taskDetail) return;
    const ok = window.confirm("Hapus task ini? Aksi ini tidak bisa dibatalkan.");
    if (!ok) return;
    setTaskProcessing(true);
    try {
      await deleteTask(taskDetail._id);
      toast.success("Task dihapus");
      await refreshTasks();
      await loadProjects();
      closeTaskDetail();
    } catch (err) {
      toast.error(err?.message || "Gagal menghapus task");
    } finally {
      setTaskProcessing(false);
    }
  };

  const handleCancelProject = async () => {
    if (processing) return;
    setProcessing(true);
    
    try {
      await updateProject(selectedProject._id, { status: "cancelled" });
      toast.success("Proyek berhasil dibatalkan");
      setShowCancelConfirm(false);
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
        start_date: formData.start_date || null,
        target_end_date: formData.target_end_date || null,
      };

      if (showAddModal) {
        const created = await createProject(payload);
        const createdProject = created?.data || created;
        const projectId = createdProject?._id;
        if (projectId) {
          const tasksToCreate = (initialTasks || [])
            .map((t) => ({
              title: String(t.title || "").trim(),
              hour_weight: Number(t.hour_weight) || 1,
            }))
            .filter((t) => t.title.length > 0);

          if (tasksToCreate.length > 0) {
            await Promise.all(
              tasksToCreate.map((t) =>
                createTask({
                  title: t.title,
                  project_id: projectId,
                  hour_weight: t.hour_weight,
                  status: "planned",
                  user_id: null, // manager menyiapkan task unassigned
                })
              )
            );
          }
        }
        toast.success("Proyek berhasil ditambahkan");
        setShowAddModal(false);
        // Jika di masa depan ingin langsung membuka modal task untuk project baru,
        // bisa panggil openTaskModal(created).
      } else if (showEditModal) {
        // For edit, only send fields that user can modify (status & end_date are system-managed)
        const editPayload = {
          code: payload.code,
          name: payload.name,
          work_type: payload.work_type,
          start_date: payload.start_date,
          target_end_date: payload.target_end_date,
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
                              <div className="flex items-center gap-2 flex-wrap">
                                <Calendar className="w-4 h-4 text-slate-400" />
                                <span>Selesai: {new Date(proj.end_date).toLocaleDateString("id-ID")}</span>
                              </div>
                            )}
                            {proj.target_end_date && (
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className="text-slate-500">Target: {new Date(proj.target_end_date).toLocaleDateString("id-ID")}</span>
                                {(() => {
                                  const tgt = new Date(proj.target_end_date);
                                  const done = proj.end_date ? new Date(proj.end_date) : new Date();
                                  tgt.setHours(0, 0, 0, 0);
                                  done.setHours(0, 0, 0, 0);
                                  const late = done > tgt;
                                  return late ? (
                                    <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-rose-500/20 text-rose-300 border border-rose-500/30">
                                      Terlambat
                                    </span>
                                  ) : null;
                                })()}
                              </div>
                            )}
                          </div>
                        </td>
                          {permissions.includes("system:manage_projects") && (
                        <td className="w-48 px-8 py-6 text-right sticky right-0 bg-slate-900/80 backdrop-blur-sm z-10">
                          <div className="flex justify-end gap-4">
                            <>
                              <motion.button
                                whileHover={{ scale: 1.2 }}
                                whileTap={{ scale: 0.9 }}
                                onClick={() => openTaskModal(proj)}
                                className="text-emerald-400 hover:text-emerald-300"
                                title="Kelola Task"
                              >
                                <TrendingUp className="w-6 h-6" />
                              </motion.button>
                              <motion.button whileHover={{ scale: 1.2 }} whileTap={{ scale: 0.9 }} onClick={() => openEditModal(proj)} className="text-blue-400 hover:text-blue-300" title="Edit">
                                <Edit className="w-6 h-6" />
                              </motion.button>
                              {proj.status !== "cancelled" && proj.status !== "completed" && (
                                <motion.button whileHover={{ scale: 1.2 }} whileTap={{ scale: 0.9 }} onClick={() => openCancelConfirm(proj)} disabled={processing} className="text-orange-400 hover:text-orange-300 disabled:opacity-50" title="Batalkan Proyek">
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
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                      <label className="block text-sm font-medium text-slate-300 mb-2">Target Selesai (manual)</label>
                      <input
                        type="date"
                        value={formData.target_end_date}
                        onChange={(e) => setFormData({ ...formData, target_end_date: e.target.value })}
                        className="w-full px-5 py-4 bg-slate-800/50 border border-slate-700 rounded-2xl text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all backdrop-blur-sm"
                      />
                      <p className="text-xs text-slate-400 mt-1">
                        Perubahan target akan terekam di riwayat target.
                      </p>
                      {showEditModal && (
                        <div className="text-xs text-slate-500 mt-3">
                          Riwayat target:{" "}
                          {Array.isArray(selectedProject?.target_end_history) &&
                          selectedProject.target_end_history.length > 0
                            ? selectedProject.target_end_history
                                .map((d) => new Date(d).toLocaleDateString("id-ID"))
                                .join(" -> ")
                            : "-"}
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="border border-slate-800 rounded-2xl p-4 bg-slate-950/60">
                    <h3 className="text-sm font-semibold text-slate-100 mb-3">
                      Task Awal Proyek (opsional)
                    </h3>
                    <p className="text-[11px] text-slate-400 mb-3">
                      Anda dapat menyiapkan beberapa task awal beserta bobot jamnya. Task akan dibuat
                      dengan status <span className="font-semibold">planned</span> setelah proyek tersimpan.
                    </p>

                    {showAddModal && (
                      <div className="space-y-3">
                        {initialTasks.map((t, idx) => (
                          <div key={idx} className="grid grid-cols-1 md:grid-cols-12 gap-3">
                            <div className="md:col-span-8">
                              <input
                                value={t.title}
                                onChange={(e) => {
                                  const v = e.target.value;
                                  setInitialTasks((prev) => {
                                    const next = [...prev];
                                    next[idx] = { ...next[idx], title: v };
                                    return next;
                                  });
                                }}
                                placeholder={`Judul task #${idx + 1}`}
                                className="w-full px-4 py-3 bg-slate-800/50 border border-slate-700 rounded-2xl text-white focus:ring-2 focus:ring-blue-500"
                              />
                            </div>
                            <div className="md:col-span-3">
                              <input
                                type="number"
                                min={0.25}
                                step={0.25}
                                value={t.hour_weight}
                                onChange={(e) => {
                                  const v = e.target.value;
                                  setInitialTasks((prev) => {
                                    const next = [...prev];
                                    next[idx] = { ...next[idx], hour_weight: v };
                                    return next;
                                  });
                                }}
                                className="w-full px-4 py-3 bg-slate-800/50 border border-slate-700 rounded-2xl text-white focus:ring-2 focus:ring-blue-500"
                              />
                            </div>
                            <div className="md:col-span-1 flex items-center justify-end">
                              <button
                                type="button"
                                onClick={() => {
                                  setInitialTasks((prev) => {
                                    if (prev.length <= 1) return [{ title: "", hour_weight: 1 }];
                                    return prev.filter((_, i) => i !== idx);
                                  });
                                }}
                                className="p-3 rounded-2xl bg-slate-800/70 border border-slate-700 text-slate-300 hover:bg-red-500/20 hover:border-red-500/40 hover:text-red-300 transition-all"
                                title="Hapus baris"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </div>
                          </div>
                        ))}

                        <div className="flex justify-between items-center">
                          <p className="text-[11px] text-slate-500">
                            Tip: kosongkan judul jika tidak ingin membuat task awal.
                          </p>
                          <motion.button
                            type="button"
                            whileHover={{ scale: 1.03 }}
                            whileTap={{ scale: 0.97 }}
                            onClick={() =>
                              setInitialTasks((prev) => [...prev, { title: "", hour_weight: 1 }])
                            }
                            className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold flex items-center gap-2"
                          >
                            <Plus className="w-4 h-4" />
                            Tambah Task
                          </motion.button>
                        </div>
                      </div>
                    )}
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
        {/* Modal Konfirmasi Batalkan - Premium Style */}
        {showCancelConfirm && (
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
                <h3 className="text-2xl font-bold text-white">Konfirmasi Batalkan</h3>
              </div>
              <p className="text-slate-300 mb-8">
                Apakah Anda yakin ingin membatalkan proyek <strong className="text-white">{selectedProject?.name}</strong> ({selectedProject?.code})?
              </p>
              <div className="flex justify-end gap-4">
                <motion.button 
                  onClick={() => setShowCancelConfirm(false)} 
                  className="px-6 py-4 bg-slate-800/70 border border-slate-700 rounded-2xl text-slate-300 hover:bg-slate-700/70 transition-all font-medium"
                  whileHover={{ scale: 1.03 }}
                >
                  Batal
                </motion.button>
                <motion.button 
                  onClick={handleCancelProject} 
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
                  {processing ? <Loader2 className="animate-spin w-6 h-6" /> : <Ban className="w-6 h-6" />}
                  Batalkan
                </motion.button>
              </div>
            </motion.div>
          </motion.div>
        )}
        {/* Modal Task Management per Project */}
        {showTaskModal && taskModalProject && (
          <motion.div
            className="fixed inset-0 bg-black/70 backdrop-blur-lg flex items-center justify-center z-50 p-4"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
          >
            <motion.div
              className="bg-slate-900/95 backdrop-blur-2xl rounded-3xl max-w-3xl w-full max-h-[90vh] overflow-y-auto border border-blue-900/50 shadow-2xl"
              initial={{ scale: 0.9, y: 50 }}
              animate={{ scale: 1, y: 0 }}
            >
              <div className="p-6">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <h2 className="text-2xl font-bold text-white flex items-center gap-2">
                      <Target className="w-6 h-6 text-indigo-400" />
                      Task Proyek: {taskModalProject.name}
                    </h2>
                    <p className="text-xs text-slate-400 mt-1">
                      Kelola daftar task, bobot jam, dan approval untuk proyek ini.
                    </p>
                  </div>
                  <button
                    onClick={() => {
                      setShowTaskModal(false);
                      setTaskModalProject(null);
                      setProjectTasks([]);
                    }}
                    className="p-2 rounded-xl bg-slate-800/80 text-slate-300 hover:bg-slate-700/80"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>

                <div className="mb-4 border border-slate-800 rounded-2xl p-4 bg-slate-950/60">
                  <h3 className="text-sm font-semibold text-slate-100 mb-3">
                    Tambah Task Baru
                  </h3>
                  <form
                    className="flex flex-col md:flex-row gap-3"
                    onSubmit={handleCreateTaskForProject}
                  >
                    <input
                      type="text"
                      placeholder="Judul task..."
                      value={taskForm.title}
                      onChange={(e) =>
                        setTaskForm((prev) => ({ ...prev, title: e.target.value }))
                      }
                      className="flex-1 px-4 py-3 bg-slate-800/70 border border-slate-700 rounded-2xl text-sm text-white placeholder-slate-500 focus:ring-2 focus:ring-blue-500"
                    />
                    <input
                      type="number"
                      min={0.25}
                      step={0.25}
                      value={taskForm.hour_weight}
                      onChange={(e) =>
                        setTaskForm((prev) => ({
                          ...prev,
                          hour_weight: Number(e.target.value) || 1,
                        }))
                      }
                      className="w-28 px-3 py-3 bg-slate-800/70 border border-slate-700 rounded-2xl text-sm text-white focus:ring-2 focus:ring-blue-500"
                    />
                    <motion.button
                      type="submit"
                      disabled={taskProcessing || !taskForm.title.trim()}
                      whileHover={{ scale: 1.03 }}
                      whileTap={{ scale: 0.97 }}
                      className="px-5 py-3 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white rounded-2xl text-sm font-semibold disabled:opacity-50 flex items-center gap-2 justify-center"
                    >
                      {taskProcessing ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <Plus className="w-4 h-4" />
                      )}
                      Tambah
                    </motion.button>
                  </form>
                </div>

                <div className="border border-slate-800 rounded-2xl p-4 bg-slate-950/40">
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="text-sm font-semibold text-slate-100">
                      Daftar Task
                    </h3>
                    <button
                      onClick={refreshTasks}
                      className="text-xs text-slate-400 hover:text-slate-200 flex items-center gap-1"
                    >
                      <Loader2 className="w-3 h-3" />
                      Refresh
                    </button>
                  </div>

                  {loadingTasks ? (
                    <div className="py-6 text-sm text-slate-400">
                      Memuat task proyek...
                    </div>
                  ) : projectTasks.length === 0 ? (
                    <div className="py-6 text-sm text-slate-400">
                      Belum ada task untuk proyek ini.
                    </div>
                  ) : (
                    <TaskListWithActions
                      tasks={projectTasks}
                      project={taskModalProject}
                      loading={loadingTasks}
                      processing={taskProcessing}
                      onApprove={handleApproveTask}
                      onReject={handleRejectTask}
                      onOpenDetail={openTaskDetail}
                    />
                  )}
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}

        {/* Modal Detail Task */}
        {showTaskDetailModal && taskDetail && (
          <motion.div
            className="fixed inset-0 bg-black/70 backdrop-blur-lg flex items-center justify-center z-50 p-4"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
          >
            <motion.div
              className="bg-slate-900/95 backdrop-blur-2xl rounded-3xl max-w-xl w-full border border-blue-900/50 shadow-2xl"
              initial={{ scale: 0.95, y: 30 }}
              animate={{ scale: 1, y: 0 }}
            >
              <div className="p-6">
                <div className="flex items-start justify-between gap-3 mb-4">
                  <div>
                    <h3 className="text-xl font-bold text-white">{taskDetail.title}</h3>
                    <p className="text-xs text-slate-400 mt-1">
                      Status: <span className="font-semibold">{taskDetail.status}</span>
                    </p>
                  </div>
                  <button
                    onClick={closeTaskDetail}
                    className="p-2 rounded-xl bg-slate-800/80 text-slate-300 hover:bg-slate-700/80"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>

                <div className="space-y-3 text-sm text-slate-200">
                  <div className="grid grid-cols-2 gap-3">
                    <div className="bg-slate-950/50 border border-slate-800 rounded-2xl p-3">
                      <div className="text-[11px] text-slate-500 mb-1">Dikerjakan oleh</div>
                      <div className="font-medium">
                        {taskDetail.user_id?.full_name || "-"}
                      </div>
                      <div className="text-[11px] text-slate-400">
                        {taskDetail.user_id?.email || ""}
                      </div>
                    </div>
                    <div className="bg-slate-950/50 border border-slate-800 rounded-2xl p-3">
                      <div className="text-[11px] text-slate-500 mb-1">Disetujui oleh</div>
                      <div className="font-medium">
                        {taskDetail.approved_by?.full_name || "-"}
                      </div>
                      <div className="text-[11px] text-slate-400">
                        {taskDetail.approved_at
                          ? new Date(taskDetail.approved_at).toLocaleString("id-ID")
                          : ""}
                      </div>
                    </div>
                  </div>

                  <div className="bg-slate-950/50 border border-slate-800 rounded-2xl p-3">
                    <div className="text-[11px] text-slate-500 mb-2">Bobot jam</div>
                    <div className="flex items-center gap-2">
                      <input
                        type="number"
                        min={0.25}
                        step={0.25}
                        value={taskDetailHour}
                        onChange={(e) => setTaskDetailHour(e.target.value)}
                        className="w-28 px-3 py-2 bg-slate-800/60 border border-slate-700 rounded-xl text-sm text-white focus:ring-2 focus:ring-blue-500"
                      />
                      <span className="text-xs text-slate-400">jam</span>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div className="bg-slate-950/50 border border-slate-800 rounded-2xl p-3">
                      <div className="text-[11px] text-slate-500 mb-1">Dibuat</div>
                      <div className="text-xs text-slate-300">
                        {taskDetail.created_at
                          ? new Date(taskDetail.created_at).toLocaleString("id-ID")
                          : "-"}
                      </div>
                    </div>
                    <div className="bg-slate-950/50 border border-slate-800 rounded-2xl p-3">
                      <div className="text-[11px] text-slate-500 mb-1">Diupdate</div>
                      <div className="text-xs text-slate-300">
                        {taskDetail.updated_at
                          ? new Date(taskDetail.updated_at).toLocaleString("id-ID")
                          : "-"}
                      </div>
                    </div>
                  </div>
                </div>

                <div className="flex items-center justify-between gap-3 mt-6">
                  <motion.button
                    whileHover={{ scale: 1.03 }}
                    whileTap={{ scale: 0.97 }}
                    onClick={handleDeleteTask}
                    disabled={taskProcessing}
                    className="px-4 py-2 rounded-xl bg-red-600 hover:bg-red-700 text-white text-sm font-semibold disabled:opacity-50"
                  >
                    Hapus Task
                  </motion.button>
                  <div className="flex items-center gap-2">
                    {taskDetail.status === "done" && (
                      <>
                        <motion.button
                          whileHover={{ scale: 1.03 }}
                          whileTap={{ scale: 0.97 }}
                          onClick={() => handleApproveTask(taskDetail)}
                          disabled={taskProcessing}
                          className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-semibold disabled:opacity-50"
                        >
                          Approve
                        </motion.button>
                        <motion.button
                          whileHover={{ scale: 1.03 }}
                          whileTap={{ scale: 0.97 }}
                          onClick={() => handleRejectTask(taskDetail)}
                          disabled={taskProcessing}
                          className="px-4 py-2 rounded-xl bg-orange-600 hover:bg-orange-700 text-white text-sm font-semibold disabled:opacity-50"
                        >
                          Reject
                        </motion.button>
                      </>
                    )}
                    <motion.button
                      whileHover={{ scale: 1.03 }}
                      whileTap={{ scale: 0.97 }}
                      onClick={handleSaveTaskDetail}
                      disabled={taskProcessing}
                      className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold disabled:opacity-50"
                    >
                      Simpan
                    </motion.button>
                  </div>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </div>
    </>
  );
}
