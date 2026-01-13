import { useState, useEffect } from "react";
import {
  Search, Download, Filter, X, Building2, Edit, Trash2,
  ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight,
  Loader2, Save, Plus, User, AlertCircle, Sparkles, Calendar
} from "lucide-react";
import { motion } from "framer-motion";
import toast, { Toaster } from "react-hot-toast";
import { useAuthStore } from "../stores/useAuthStore";

import {
  fetchDivisions,
  fetchUsers,
  createDivision,
  updateDivision,
  deleteDivision
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

export default function DivisionList() {
  const { user } = useAuthStore();
  const permissions = user?.role_id?.permissions || [];

  const [divisions, setDivisions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(15);
  const [totalPages, setTotalPages] = useState(1);
  const [totalItems, setTotalItems] = useState(0);

  // Filters
  const [search, setSearch] = useState("");
  const [managerFilter, setManagerFilter] = useState("");
  const [activeGeneralFilter, setActiveGeneralFilter] = useState("");
  const [sortBy, setSortBy] = useState("-created_at");
  const [showFilters, setShowFilters] = useState(false);

  // Modal states
  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [selectedDivision, setSelectedDivision] = useState(null);
  const [processing, setProcessing] = useState(false);

  // Form state
  const [formData, setFormData] = useState({
    name: "",
    description: "",
    manager_id: null,
    active_general_id: null
  });

  const [managers, setManagers] = useState([]);
  const [generals, setGenerals] = useState([]);

  const activeFiltersCount = [search, managerFilter, activeGeneralFilter].filter(Boolean).length;

  useEffect(() => {
    loadDivisions();
    loadUsers();
  }, [page, pageSize, search, managerFilter, activeGeneralFilter, sortBy]);

  const loadDivisions = async () => {
    setLoading(true);
    try {
      const res = await fetchDivisions({
        page,
        limit: pageSize,
        search,
        manager_id: managerFilter || undefined,
        active_general_id: activeGeneralFilter || undefined,
        sort: sortBy,
        include: "manager,active_general"
      });

      setDivisions(res.data || []);
      setTotalPages(res.total_pages || 1);
      setTotalItems(res.total || 0);
    } catch (err) {
      toast.error("Gagal memuat data divisi");
    } finally {
      setLoading(false);
    }
  };

  const loadUsers = async () => {
    try {
      const res = await fetchUsers();

      const mgr = res.data.filter(u => u.role_id?.name === "Manager");
      const gen = res.data.filter(u => u.role_id?.name === "General");

      setManagers(mgr);
      setGenerals(gen);
    } catch (err) {
      toast.error("Gagal memuat data user");
    }
  };

  const resetForm = () => {
    setFormData({
      name: "",
      description: "",
      manager_id: null,
      active_general_id: null
    });
  };

  const openAddModal = () => {
    resetForm();
    setShowAddModal(true);
  };

  const openEditModal = (division) => {
    setSelectedDivision(division);
    setFormData({
      name: division.name,
      description: division.description || "",
      manager_id: division.manager_id?._id || null,
      active_general_id: division.active_general_id?._id || null
    });
    setShowEditModal(true);
  };

  const openDeleteConfirm = (division) => {
    setSelectedDivision(division);
    setShowDeleteConfirm(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (processing) return;
    setProcessing(true);

    try {
      if (showAddModal) {
        await createDivision(formData);
        toast.success("Divisi berhasil ditambahkan");
        setShowAddModal(false);
      } else if (showEditModal) {
        await updateDivision(selectedDivision._id, formData);
        toast.success("Divisi berhasil diperbarui");
        setShowEditModal(false);
      }
      loadDivisions();
      resetForm();
    } catch (err) {
      const msg = err.response?.data?.message || "Terjadi kesalahan";
      toast.error(msg);
    } finally {
      setProcessing(false);
    }
  };

  const handleDelete = async () => {
    if (processing) return;
    setProcessing(true);
    try {
      await deleteDivision(selectedDivision._id);
      toast.success("Divisi berhasil dihapus");
      setShowDeleteConfirm(false);
      loadDivisions();
    } catch (err) {
      toast.error(err.response?.data?.message || "Gagal menghapus divisi");
    } finally {
      setProcessing(false);
    }
  };

  const exportToCSV = () => {
    const headers = ["Nama Divisi", "Deskripsi", "Manager", "Active General", "Dibuat Pada"];
    const rows = divisions.map(d => [
      d.name,
      d.description || "-",
      d.manager_id ? `${d.manager_id.full_name || d.manager_id.name} (${d.manager_id.email})` : "-",
      d.active_general_id ? `${d.active_general_id.full_name || d.active_general_id.name} (${d.active_general_id.email})` : "-",
      new Date(d.created_at).toLocaleDateString("id-ID")
    ]);
    const csv = [headers, ...rows].map(r => r.map(c => `"${c}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `divisions_${new Date().toISOString().slice(0,10)}.csv`;
    a.click();
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
              Division Management
            </h1>
            <p className="text-slate-400 mt-2 flex items-center gap-2">
              <Sparkles className="w-5 h-5" />
              Kelola divisi dan struktur organisasi perusahaan
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
                  placeholder="Cari nama atau deskripsi divisi..."
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
                {permissions.includes("system:manage_divisions") && (
                  <motion.button 
                    onClick={openAddModal}
                    className="flex items-center gap-3 px-6 py-4 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white rounded-2xl transition-all shadow-lg"
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                  >
                    <Plus className="w-6 h-6" />
                    Tambah Divisi
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
                    <label className="block text-sm font-medium text-slate-300 mb-2">Manager</label>
                    <select
                      value={managerFilter}
                      onChange={(e) => { setManagerFilter(e.target.value); setPage(1); }}
                      className="w-full px-5 py-4 bg-slate-800/50 border border-slate-700 rounded-2xl text-white focus:ring-2 focus:ring-blue-500 backdrop-blur-sm"
                    >
                      <option value="">Semua Manager</option>
                      {managers.map(m => (
                        <option key={m._id} value={m._id}>
                          {m.full_name || m.name}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-300 mb-2">Active General</label>
                    <select
                      value={activeGeneralFilter}
                      onChange={(e) => { setActiveGeneralFilter(e.target.value); setPage(1); }}
                      className="w-full px-5 py-4 bg-slate-800/50 border border-slate-700 rounded-2xl text-white focus:ring-2 focus:ring-blue-500 backdrop-blur-sm"
                    >
                      <option value="">Semua Active General</option>
                      {generals.map(g => (
                        <option key={g._id} value={g._id}>
                          {g.full_name || g.name}
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
            ) : divisions.length === 0 ? (
              <div className="text-center py-20 text-slate-400 text-lg">Tidak ada data divisi</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full table-fixed">
                  <thead className="bg-slate-800/70 backdrop-blur-sm border-b border-slate-700/50 sticky top-0 z-20">
                    <tr>
                      <th className="w-96 px-8 py-5 text-left text-sm font-medium text-slate-300">Divisi</th>
                      <th className="px-8 py-5 text-left text-sm font-medium text-slate-300">Manager</th>
                      <th className="px-8 py-5 text-left text-sm font-medium text-slate-300">Active General</th>
                      <th className="px-8 py-5 text-left text-sm font-medium text-slate-300">Dibuat</th>
                      {permissions.includes("system:manage_divisions") && (
                      <th className="w-48 px-8 py-5 text-right text-sm font-medium text-slate-300 sticky right-0 bg-slate-800/90 backdrop-blur-sm z-30">Aksi</th>
                      )}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-700/50">
                    {divisions.map((div) => (
                      <motion.tr 
                        key={div._id} 
                        className="hover:bg-slate-800/50 transition-all"
                        whileHover={{ x: 5 }}
                      >
                        <td className="w-96 px-8 py-6">
                          <div className="flex items-center gap-5">
                            <div className="w-14 h-14 bg-gradient-to-br from-indigo-600 to-purple-700 rounded-2xl flex items-center justify-center shadow-lg">
                              <Building2 className="w-8 h-8 text-white" />
                            </div>
                            <div>
                              <div className="text-lg font-semibold text-white">{div.name}</div>
                              {div.description && <div className="text-sm text-slate-400 mt-1">{div.description}</div>}
                            </div>
                          </div>
                        </td>
                        <td className="px-8 py-6">
                          {div.manager_id ? (
                            <div className="flex items-center gap-3">
                              <User className="w-5 h-5 text-blue-400" />
                              <span className="text-white font-medium">{div.manager_id.full_name || div.manager_id.name}</span>
                            </div>
                          ) : <span className="text-slate-500">-</span>}
                        </td>
                        <td className="px-8 py-6">
                          {div.active_general_id ? (
                            <div className="flex items-center gap-3">
                              <User className="w-5 h-5 text-indigo-400" />
                              <span className="text-white font-medium">{div.active_general_id.full_name || div.active_general_id.name}</span>
                            </div>
                          ) : <span className="text-slate-500">-</span>}
                        </td>
                        <td className="px-8 py-6 text-slate-300">
                          <div className="flex items-center gap-3">
                            <Calendar className="w-5 h-5 text-slate-400" />
                            {new Date(div.created_at).toLocaleDateString("id-ID")}
                          </div>
                        </td>
                          {permissions.includes("system:manage_divisions") && (
                        <td className="w-48 px-8 py-6 text-right sticky right-0 bg-slate-900/80 backdrop-blur-sm z-10">
                          <div className="flex justify-end gap-4">
                            <>
                              <motion.button whileHover={{ scale: 1.2 }} whileTap={{ scale: 0.9 }} onClick={() => openEditModal(div)} className="text-blue-400 hover:text-blue-300">
                                <Edit className="w-6 h-6" />
                              </motion.button>
                              <motion.button whileHover={{ scale: 1.2 }} whileTap={{ scale: 0.9 }} onClick={() => openDeleteConfirm(div)} className="text-red-400 hover:text-red-300">
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
          {!loading && divisions.length > 0 && (
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
              className="bg-slate-900/90 backdrop-blur-2xl rounded-3xl max-w-2xl w-full max-h-[90vh] overflow-y-auto border border-blue-900/50 shadow-2xl"
              initial={{ scale: 0.9, y: 50 }}
              animate={{ scale: 1, y: 0 }}
            >
              <div className="p-8">
                <h2 className="text-3xl font-bold text-white mb-8 flex items-center gap-3">
                  <Building2 className="w-10 h-10 text-indigo-400" />
                  {showAddModal ? "Tambah Divisi Baru" : "Edit Divisi"}
                </h2>
                <form onSubmit={handleSubmit} className="space-y-6">
                  <div>
                    <label className="block text-sm font-medium text-slate-300 mb-2">Nama Divisi *</label>
                    <input 
                      required 
                      type="text" 
                      value={formData.name} 
                      onChange={(e) => setFormData({...formData, name: e.target.value})} 
                      className="w-full px-5 py-4 bg-slate-800/50 border border-slate-700 rounded-2xl text-white placeholder-slate-500 focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all backdrop-blur-sm" 
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-300 mb-2">Deskripsi</label>
                    <textarea 
                      rows={4} 
                      value={formData.description} 
                      onChange={(e) => setFormData({...formData, description: e.target.value})} 
                      className="w-full px-5 py-4 bg-slate-800/50 border border-slate-700 rounded-2xl text-white placeholder-slate-500 focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all backdrop-blur-sm" 
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-300 mb-2">Manager</label>
                    <select
                      value={formData.manager_id ?? ""}
                      onChange={(e) => setFormData({...formData, manager_id: e.target.value || null})}
                      className="w-full px-5 py-4 bg-slate-800/50 border border-slate-700 rounded-2xl text-white focus:ring-2 focus:ring-blue-500 backdrop-blur-sm"
                    >
                      <option value="">Pilih Manager…</option>
                      {managers.map(m => (
                        <option key={m._id} value={m._id}>
                          {m.full_name || m.name}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-300 mb-2">Active General (opsional)</label>
                    <select
                      value={formData.active_general_id ?? ""}
                      onChange={(e) => setFormData({...formData, active_general_id: e.target.value || null})}
                      className="w-full px-5 py-4 bg-slate-800/50 border border-slate-700 rounded-2xl text-white focus:ring-2 focus:ring-blue-500 backdrop-blur-sm"
                    >
                      <option value="">Pilih Active General…</option>
                      {generals.map(g => (
                        <option key={g._id} value={g._id}>
                          {g.full_name || g.name}
                        </option>
                      ))}
                    </select>
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
                Apakah Anda yakin ingin menghapus divisi <strong className="text-white">{selectedDivision?.name}</strong>?
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