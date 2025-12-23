import { useState, useEffect, useMemo } from "react";
import { useRoles } from "../hooks/useRoles";
import { fetchPermissionCatalog } from "../utils/api";
import { motion } from "framer-motion";
import toast, { Toaster } from "react-hot-toast";
import { Shield, Plus, Edit, Trash2, Search, X, Save, PlusCircle, RefreshCw, Sparkles } from "lucide-react";

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

export default function RoleManagement() {
  const { data, loading, error, refetch, create, update, delete: deleteRole } = useRoles();
  const [showModal, setShowModal] = useState(false);
  const [editingRole, setEditingRole] = useState(null);
  const [search, setSearch] = useState("");
  const [customPermission, setCustomPermission] = useState("");
  const [permissionCatalog, setPermissionCatalog] = useState([]);
  const [loadingPermissions, setLoadingPermissions] = useState(false);
  const [formData, setFormData] = useState({
    name: "",
    description: "",
    permissions: [],
    hierarchy_level: "",
  });

  const permissionsList = useMemo(() => {
    const merged = new Set([...(permissionCatalog || []), ...(formData.permissions || [])]);
    return Array.from(merged).sort();
  }, [permissionCatalog, formData.permissions]);

  const loadPermissions = async () => {
    try {
      setLoadingPermissions(true);
      const response = await fetchPermissionCatalog();
      setPermissionCatalog(response?.data || []);
    } catch (err) {
      toast.error(err.message || "Gagal memuat daftar permission");
    } finally {
      setLoadingPermissions(false);
    }
  };

  useEffect(() => {
    loadPermissions();
  }, []);

  const filteredRoles = data.filter(
    (role) =>
      role.name.toLowerCase().includes(search.toLowerCase()) ||
      (role.description && role.description.toLowerCase().includes(search.toLowerCase()))
  );

  const handleOpenModal = (role = null) => {
    if (role) {
      setEditingRole(role);
      setFormData({
        name: role.name,
        description: role.description || "",
        permissions: role.permissions || [],
        hierarchy_level: role.hierarchy_level.toString(),
      });
    } else {
      setEditingRole(null);
      setFormData({
        name: "",
        description: "",
        permissions: [],
        hierarchy_level: "",
      });
    }
    setShowModal(true);
  };

  const handleCloseModal = () => {
    setShowModal(false);
    setEditingRole(null);
    setFormData({
      name: "",
      description: "",
      permissions: [],
      hierarchy_level: "",
    });
    setCustomPermission("");
  };

  const handleTogglePermission = (permission) => {
    setFormData((prev) => ({
      ...prev,
      permissions: prev.permissions.includes(permission)
        ? prev.permissions.filter((p) => p !== permission)
        : [...prev.permissions, permission],
    }));
  };

  const handleAddCustomPermission = () => {
    const trimmed = customPermission.trim();
    if (!trimmed) return;
    setFormData((prev) => ({
      ...prev,
      permissions: prev.permissions.includes(trimmed)
        ? prev.permissions
        : [...prev.permissions, trimmed],
    }));
    setCustomPermission("");
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      const payload = {
        ...formData,
        hierarchy_level: parseInt(formData.hierarchy_level),
      };

      if (editingRole) {
        await update(editingRole._id, payload);
        toast.success("Role berhasil diperbarui");
      } else {
        await create(payload);
        toast.success("Role berhasil ditambahkan");
      }
      handleCloseModal();
      refetch();
    } catch (err) {
      toast.error(err.message || "Gagal menyimpan role");
    }
  };

  const handleDelete = async (roleId, roleName) => {
    if (!window.confirm(`Apakah Anda yakin ingin menghapus role "${roleName}"?`)) return;
    try {
      await deleteRole(roleId);
      toast.success("Role berhasil dihapus");
    } catch (err) {
      toast.error(err.message || "Gagal menghapus role");
    }
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
          <motion.div variants={itemVariants} className="mb-10">
            <h1 className="text-5xl font-bold bg-gradient-to-r from-blue-400 to-indigo-400 bg-clip-text text-transparent flex items-center gap-5">
              <Shield className="w-14 h-14 text-indigo-400" />
              Role Management
            </h1>
            <p className="text-slate-400 mt-4 text-xl flex items-center gap-3">
              <Sparkles className="w-6 h-6" />
              Kelola role dan permission sistem dengan aman
            </p>
          </motion.div>

          {/* Toolbar */}
          <motion.div 
            className="bg-slate-900/80 backdrop-blur-xl rounded-3xl shadow-2xl border border-blue-900/50 p-8 mb-10"
            variants={itemVariants}
          >
            <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-6">
              <div className="flex-1 relative">
                <Search className="absolute left-6 top-1/2 -translate-y-1/2 text-blue-400 w-6 h-6" />
                <input
                  type="text"
                  placeholder="Cari nama role atau deskripsi..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="w-full pl-16 pr-6 py-5 bg-slate-800/50 border border-slate-700 rounded-2xl text-white placeholder-slate-500 focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all backdrop-blur-sm"
                />
              </div>

              <motion.button
                onClick={() => handleOpenModal()}
                className="flex items-center gap-4 px-8 py-5 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white font-semibold rounded-2xl shadow-lg relative overflow-hidden group"
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
              >
                <motion.div
                  className="absolute inset-0 bg-gradient-to-r from-transparent via-white to-transparent opacity-0 group-hover:opacity-20"
                  animate={{ x: ["-100%", "100%"] }}
                  transition={{ duration: 1.5, repeat: Infinity, ease: "linear" }}
                />
                <Plus className="w-7 h-7" />
                Tambah Role Baru
              </motion.button>
            </div>
          </motion.div>

          {/* Table Card */}
          <motion.div 
            className="bg-slate-900/80 backdrop-blur-xl rounded-3xl shadow-2xl border border-blue-900/50 overflow-hidden"
            variants={itemVariants}
          >
            {loading ? (
              <div className="flex justify-center py-32">
                <motion.div animate={{ rotate: 360 }} transition={{ duration: 1, repeat: Infinity, ease: "linear" }} className="w-20 h-20 border-4 border-blue-500 border-t-transparent rounded-full" />
              </div>
            ) : error ? (
              <div className="text-center py-32 text-red-400 text-2xl">{error}</div>
            ) : filteredRoles.length === 0 ? (
              <div className="text-center py-32">
                <Shield className="w-24 h-24 text-slate-600 mx-auto mb-6" />
                <p className="text-2xl text-slate-400">Tidak ada role ditemukan</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full table-fixed">
                  <thead className="bg-slate-800/70 backdrop-blur-sm border-b border-slate-700/50">
                    <tr>
                      <th className="w-64 px-8 py-6 text-left text-sm font-medium text-slate-300">Nama Role</th>
                      <th className="px-8 py-6 text-left text-sm font-medium text-slate-300">Deskripsi</th>
                      <th className="px-8 py-6 text-left text-sm font-medium text-slate-300">Hierarchy Level</th>
                      <th className="px-8 py-6 text-left text-sm font-medium text-slate-300">Jumlah Permission</th>
                      <th className="w-48 px-8 py-6 text-right text-sm font-medium text-slate-300 sticky right-0 bg-slate-800/90 backdrop-blur-sm">Aksi</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-700/50">
                    {filteredRoles.map((role) => (
                      <motion.tr
                        key={role._id}
                        className="hover:bg-slate-800/50 transition-all"
                        whileHover={{ x: 5 }}
                      >
                        <td className="w-64 px-8 py-6">
                          <div className="text-xl font-bold text-white">{role.name}</div>
                        </td>
                        <td className="px-8 py-6">
                          <p className="text-slate-300 leading-relaxed">{role.description || "-"}</p>
                        </td>
                        <td className="px-8 py-6">
                          <span className="inline-flex items-center gap-2 px-5 py-3 bg-gradient-to-r from-indigo-600 to-purple-600 rounded-2xl text-white font-bold shadow-lg">
                            Level {role.hierarchy_level}
                          </span>
                        </td>
                        <td className="px-8 py-6">
                          <p className="text-lg text-slate-300">
                            <strong className="text-white">{role.permissions?.length || 0}</strong> permission{role.permissions?.length !== 1 ? "s" : ""}
                          </p>
                        </td>
                        <td className="w-48 px-8 py-6 text-right sticky right-0 bg-slate-900/80 backdrop-blur-sm">
                          <div className="flex justify-end gap-4">
                            <motion.button whileHover={{ scale: 1.2 }} whileTap={{ scale: 0.9 }} onClick={() => handleOpenModal(role)} className="text-blue-400 hover:text-blue-300">
                              <Edit className="w-7 h-7" />
                            </motion.button>
                            <motion.button whileHover={{ scale: 1.2 }} whileTap={{ scale: 0.9 }} onClick={() => handleDelete(role._id, role.name)} className="text-red-400 hover:text-red-300">
                              <Trash2 className="w-7 h-7" />
                            </motion.button>
                          </div>
                        </td>
                      </motion.tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </motion.div>
        </motion.div>

        {/* Modal */}
        {showModal && (
          <motion.div 
            className="fixed inset-0 bg-black/70 backdrop-blur-lg flex items-center justify-center z-50 p-4"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
          >
            <motion.div 
              className="bg-slate-900/90 backdrop-blur-2xl rounded-3xl max-w-4xl w-full max-h-[90vh] overflow-y-auto border border-blue-900/50 shadow-2xl"
              initial={{ scale: 0.9, y: 50 }}
              animate={{ scale: 1, y: 0 }}
            >
              <div className="p-10">
                <div className="flex items-center justify-between mb-8">
                  <h2 className="text-4xl font-bold text-white flex items-center gap-4">
                    <Shield className="w-12 h-12 text-indigo-400" />
                    {editingRole ? "Edit Role" : "Tambah Role Baru"}
                  </h2>
                  <motion.button
                    onClick={handleCloseModal}
                    className="text-slate-400 hover:text-white transition-colors"
                    whileHover={{ scale: 1.1 }}
                  >
                    <X className="w-8 h-8" />
                  </motion.button>
                </div>

                <form onSubmit={handleSubmit} className="space-y-10">
                  <motion.div variants={itemVariants}>
                    <label className="flex items-center gap-3 text-xl font-medium text-slate-300 mb-4">
                      <Shield className="w-8 h-8 text-indigo-400" />
                      Nama Role
                    </label>
                    <input
                      type="text"
                      required
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      className="w-full px-6 py-5 bg-slate-800/50 border border-slate-700 rounded-2xl text-white placeholder-slate-500 focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all backdrop-blur-sm"
                      placeholder="Contoh: Manager HR"
                    />
                  </motion.div>

                  <motion.div variants={itemVariants}>
                    <label className="flex items-center gap-3 text-xl font-medium text-slate-300 mb-4">
                      {/* <FileText className="w-8 h-8 text-blue-400" /> */}
                      Deskripsi
                    </label>
                    <textarea
                      value={formData.description}
                      onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                      rows={4}
                      className="w-full px-6 py-5 bg-slate-800/50 border border-slate-700 rounded-2xl text-white placeholder-slate-500 focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all backdrop-blur-sm resize-none"
                      placeholder="Jelaskan tanggung jawab role ini..."
                    />
                  </motion.div>

                  <motion.div variants={itemVariants}>
                    <label className="flex items-center gap-3 text-xl font-medium text-slate-300 mb-4">
                      <Sparkles className="w-8 h-8 text-yellow-400" />
                      Hierarchy Level
                    </label>
                    <input
                      type="number"
                      required
                      min="1"
                      max="10"
                      value={formData.hierarchy_level}
                      onChange={(e) => setFormData({ ...formData, hierarchy_level: e.target.value })}
                      className="w-full px-6 py-5 bg-slate-800/50 border border-slate-700 rounded-2xl text-white placeholder-slate-500 focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all backdrop-blur-sm"
                    />
                    <p className="text-sm text-slate-400 mt-3">
                      Angka lebih kecil = otoritas lebih tinggi (Level 1 = tertinggi)
                    </p>
                  </motion.div>

                  <motion.div variants={itemVariants}>
                    <label className="flex items-center gap-3 text-xl font-medium text-slate-300 mb-6">
                      <Shield className="w-8 h-8 text-green-400" />
                      Permissions ({formData.permissions.length} dipilih)
                    </label>

                    <div className="flex items-center gap-4 mb-6">
                      <input
                        type="text"
                        placeholder="Tambah permission custom (contoh: dashboard:read)"
                        value={customPermission}
                        onChange={(e) => setCustomPermission(e.target.value)}
                        className="flex-1 px-6 py-4 bg-slate-800/50 border border-slate-700 rounded-2xl text-white placeholder-slate-500 focus:ring-2 focus:ring-blue-500"
                      />
                      <motion.button
                        type="button"
                        onClick={handleAddCustomPermission}
                        className="px-6 py-4 bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700 text-white rounded-2xl font-medium flex items-center gap-3"
                        whileHover={{ scale: 1.05 }}
                      >
                        <PlusCircle className="w-6 h-6" />
                        Tambah
                      </motion.button>
                      <motion.button
                        type="button"
                        onClick={loadPermissions}
                        disabled={loadingPermissions}
                        className="px-6 py-4 bg-slate-800/70 border border-slate-700 rounded-2xl text-slate-300 hover:bg-slate-700/70 flex items-center gap-3 disabled:opacity-50"
                        whileHover={{ scale: loadingPermissions ? 1 : 1.05 }}
                      >
                        <RefreshCw className={`w-6 h-6 ${loadingPermissions ? "animate-spin" : ""}`} />
                        Refresh
                      </motion.button>
                    </div>

                    <div className="bg-slate-800/50 border border-slate-700 rounded-2xl p-6 max-h-96 overflow-y-auto">
                      {loadingPermissions ? (
                        <div className="text-center py-12 text-slate-400">
                          <motion.div animate={{ rotate: 360 }} transition={{ duration: 1, repeat: Infinity }} className="w-12 h-12 border-4 border-blue-500 border-t-transparent rounded-full mx-auto" />
                          <p className="mt-4">Memuat permission catalog...</p>
                        </div>
                      ) : permissionsList.length === 0 ? (
                        <p className="text-center text-slate-400 py-12">
                          Belum ada permission. Tambahkan secara manual di atas.
                        </p>
                      ) : (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          {permissionsList.map((permission) => (
                            <motion.label
                              key={permission}
                              className="flex items-center gap-4 p-4 bg-slate-700/50 rounded-2xl cursor-pointer hover:bg-slate-700/80 transition-all"
                              whileHover={{ scale: 1.02 }}
                            >
                              <input
                                type="checkbox"
                                checked={formData.permissions.includes(permission)}
                                onChange={() => handleTogglePermission(permission)}
                                className="w-6 h-6 text-blue-600 rounded focus:ring-blue-500"
                              />
                              <span className="text-slate-200 break-all">{permission}</span>
                            </motion.label>
                          ))}
                        </div>
                      )}
                    </div>
                  </motion.div>

                  <div className="flex justify-end gap-6 pt-8">
                    <motion.button
                      type="button"
                      onClick={handleCloseModal}
                      className="px-8 py-5 bg-slate-800/70 border border-slate-700 rounded-2xl text-slate-300 hover:bg-slate-700/70 font-semibold transition-all"
                      whileHover={{ scale: 1.03 }}
                    >
                      Batal
                    </motion.button>
                    <motion.button
                      type="submit"
                      className="flex items-center gap-4 px-10 py-5 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white text-xl font-bold rounded-2xl shadow-2xl relative overflow-hidden group"
                      whileHover={{ scale: 1.05 }}
                      whileTap={{ scale: 0.98 }}
                    >
                      <motion.div
                        className="absolute inset-0 bg-gradient-to-r from-transparent via-white to-transparent opacity-0 group-hover:opacity-20"
                        animate={{ x: ["-100%", "100%"] }}
                        transition={{ duration: 1.5, repeat: Infinity, ease: "linear" }}
                      />
                      <Save className="w-8 h-8" />
                      Simpan Role
                    </motion.button>
                  </div>
                </form>
              </div>
            </motion.div>
          </motion.div>
        )}
      </div>
    </>
  );
}