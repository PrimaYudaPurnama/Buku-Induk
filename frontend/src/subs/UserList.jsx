import { useState, useEffect } from "react";
import {
  Search, Download, Filter, X, UserPlus, Edit, Trash2, History,
  ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight,
  Loader2, Save, AlertCircle, TrendingUp, TrendingDown, 
  Briefcase, Users, DollarSign, UserX, Clock, ArrowRight, Sparkles
} from "lucide-react";
import { motion } from "framer-motion";
import toast, { Toaster } from "react-hot-toast";
import { useAuthStore } from "../stores/useAuthStore";

// API functions
import { 
  fetchUsers, 
  createUser, 
  updateUser, 
  deleteUser,
  fetchUserHistory,
  fetchDivisions,
  fetchRoles,
  createAccountRequest,
  uploadDocument
} from "../utils/api.jsx";

const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { delayChildren: 0.25, staggerChildren: 0.08 }
  }
};

const itemVariants = {
  hidden: { y: 18, opacity: 0 },
  visible: { y: 0, opacity: 1, transition: { type: "spring", stiffness: 120 } }
};

export default function UserList() {
  const { user } = useAuthStore();
  const permissions = user?.role_id?.permissions || [];
  const isSuperadmin = user?.role_id?.name === "Superadmin";
  const currentRoleLevel = user?.role_id?.hierarchy_level ?? null;
  
  const canCreateUser = permissions.includes("user:create");
  const canUpdateDirect = isSuperadmin; // direct update only by Superadmin
  const canDeleteDirect = isSuperadmin; // direct delete only by Superadmin
  // Roles that can propose changes (even without direct update permission)
  const canProposeChange = isSuperadmin || permissions.some((p) =>
    p.startsWith("employee:promote") ||
    p.startsWith("employee:terminate") ||
    p.startsWith("employee:transfer")
  );
  // const canViewHistoryUser = permissions.includes("user:view_history");
  const canViewHistoryUser = permissions.some(p => p.startsWith("user:view_history"));

  const [users, setUsers] = useState([]);
  const [divisions, setDivisions] = useState([]);
  const [roles, setRoles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(15);
  const [totalPages, setTotalPages] = useState(1);
  const [totalItems, setTotalItems] = useState(0);

  // Filters
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [roleFilter, setRoleFilter] = useState("");
  const [divisionFilter, setDivisionFilter] = useState("");
  const [sortBy, setSortBy] = useState("-created_at");
  const [showFilters, setShowFilters] = useState(false);

  // Modal states
  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [showHistoryModal, setShowHistoryModal] = useState(false);
  const [showRequestModal, setShowRequestModal] = useState(false);
  const [requestType, setRequestType] = useState("promotion");
  const [requestForm, setRequestForm] = useState({
    requested_role: "",
    division_id: "",
    notes: ""
  });
  const [terminationDocument, setTerminationDocument] = useState(null);
  const [selectedUser, setSelectedUser] = useState(null);
  const [processing, setProcessing] = useState(false);

  // History state
  const [userHistory, setUserHistory] = useState([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyPage, setHistoryPage] = useState(1);
  const [historyPageSize, setHistoryPageSize] = useState(10);
  const [historyTotalPages, setHistoryTotalPages] = useState(1);
  const [historyEventFilter, setHistoryEventFilter] = useState("");

  // Form state
  const [formData, setFormData] = useState({
    email: "", password: "", full_name: "", phone: "", role_id: null,
    division_id: null, status: "pending", hire_date: "", salary: ""
  });

  const activeFiltersCount = [search, statusFilter, roleFilter, divisionFilter].filter(Boolean).length;

  useEffect(() => {
    loadUsers();
    loadDivisions();
    loadRoles();
  }, [page, pageSize, search, statusFilter, roleFilter, divisionFilter, sortBy]);

  const loadDivisions = async () => {
    setLoading(true);
    try {
      const res = await fetchDivisions();

      setDivisions(res.data || []);
    } catch (err) {
      toast.error("Gagal memuat data divisi");
    } finally {
      setLoading(false);
    }
  };

  const loadRoles = async () => {
    try {
      const res = await fetchRoles();
      setRoles(res.data || []);
    } catch (err) {
      toast.error("Gagal memuat data role");
    }
  };

  const loadUsers = async () => {
    setLoading(true);
    try {
      const res = await fetchUsers({
        page,
        pageSize,
        search,
        status: statusFilter,
        roleId: roleFilter,
        divisionId: divisionFilter,
        sort: sortBy,
      });

      setUsers(res.data || []);
      const meta = res.meta?.pagination || {};
      setTotalPages(meta.total_pages || 1);
      setTotalItems(meta.total_items || 0);
    } catch (err) {
      toast.error("Gagal memuat data user");
      // Set default values on error to prevent pagination from disappearing
      setUsers([]);
      setTotalPages(1);
      setTotalItems(0);
    } finally {
      setLoading(false);
    }
  };

  const loadUserHistory = async (userId) => {
    setHistoryLoading(true);
    try {
      const res = await fetchUserHistory(userId, {
        page: historyPage,
        pageSize: historyPageSize,
        eventType: historyEventFilter
      });

      setUserHistory(res.data || []);
      const meta = res.meta?.pagination || {};
      setHistoryTotalPages(meta.total_pages || 1);
    } catch (err) {
      toast.error("Gagal memuat history user");
      setShowHistoryModal(false);
    } finally {
      setHistoryLoading(false);
    }
  };

  const openHistoryModal = (user) => {
    setSelectedUser(user);
    setShowHistoryModal(true);
    setHistoryPage(1);
    setHistoryEventFilter("");
  };

  useEffect(() => {
    if (showHistoryModal && selectedUser) {
      loadUserHistory(selectedUser._id);
    }
  }, [showHistoryModal, historyPage, historyPageSize, historyEventFilter]);

  const resetForm = () => {
    setFormData({
      email: "", password: "", full_name: "", phone: "", role_id: "",
      division_id: "", status: "pending", hire_date: "", salary: ""
    });
  };

  const openAddModal = () => {
    resetForm();
    setShowAddModal(true);
  };

  const openEditModal = (user) => {
    if (!canUpdateDirect) {
      openRequestModal(user, "promotion");
      return;
    }
    setSelectedUser(user);
    setFormData({
      email: user.email,
      password: "",
      full_name: user.full_name,
      phone: user.phone || "",
      role_id: user.role_id?._id || null,
      division_id: user.division_id?._id || null,
      status: user.status,
      hire_date: user.hire_date ? user.hire_date.split("T")[0] : "",
      salary: user.salary ? user.salary.toString() : ""
    });
    setShowEditModal(true);
  };

  const openDeleteConfirm = (user) => {
    if (!canDeleteDirect) {
      openRequestModal(user, "termination");
      return;
    }
    setSelectedUser(user);
    setShowDeleteConfirm(true);
  };

  const openRequestModal = (user, type = "promotion") => {
    setSelectedUser(user);
    setRequestType(type);
    setRequestForm({
      requested_role: user?.role_id?._id || "",
      division_id: user?.division_id?._id || "",
      notes: ""
    });
    setTerminationDocument(null);
    setShowRequestModal(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (processing) return;
    setProcessing(true);

    try {
      if (showAddModal) {
        if (isSuperadmin) {
          await createUser(formData);
          toast.success("User berhasil ditambahkan");
          setShowAddModal(false);
        } else {
          if (!formData.role_id || !formData.division_id) {
            toast.error("Role dan divisi wajib diisi");
            setProcessing(false);
            return;
          }
          await createAccountRequest({
            requester_name: formData.full_name,
            email: formData.email,
            phone: formData.phone,
            requested_role: formData.role_id,
            division_id: formData.division_id,
            request_type: "account_request",
            notes: formData.notes || ""
          });
          toast.success("Permintaan akun dikirim untuk persetujuan");
          setShowAddModal(false);
        }
      } else if (showEditModal) {
        if (!isSuperadmin) {
          toast.error("Update langsung hanya untuk Superadmin. Gunakan tombol Ajukan.");
        } else {
          await updateUser(selectedUser._id, formData);
          toast.success("User berhasil diperbarui");
          setShowEditModal(false);
        }
      }
      loadUsers();
      resetForm();
    } catch (err) {
      const msg = err.response?.data?.error?.message || "Terjadi kesalahan";
      toast.error(msg);
    } finally {
      setProcessing(false);
    }
  };

  const handleRequestSubmit = async (e) => {
    e.preventDefault();
    if (!selectedUser) return;
    if (processing) return;

    const targetRoleId =
      requestType === "transfer"
        ? selectedUser.role_id?._id
        : requestForm.requested_role || selectedUser.role_id?._id;

    if (!requesterCanTargetUser(selectedUser)) {
      toast.error("Anda tidak bisa mengajukan untuk user dengan level sama/lebih tinggi");
      return;
    }

    if (!requesterCanTargetRole(targetRoleId)) {
      toast.error("Role tujuan melebihi otoritas Anda");
      return;
    }

    if (!targetRoleId) {
      toast.error("Pilih role tujuan");
      return;
    }

    const targetDivisionId =
      requestType === "transfer"
        ? requestForm.division_id || selectedUser.division_id?._id
        : selectedUser.division_id?._id;

    if (requestType === "transfer" && !targetDivisionId) {
      toast.error("Pilih divisi tujuan");
      return;
    }

    setProcessing(true);
    try {
      const requestResult = await createAccountRequest({
        requester_name: selectedUser.full_name,
        email: selectedUser.email,
        phone: selectedUser.phone || "",
        requested_role: targetRoleId,
        division_id: targetDivisionId,
        request_type: requestType,
        user_id: selectedUser._id,
        notes: requestForm.notes,
      });

      const requestId = requestResult.data?._id;

      // Upload termination document if provided
      if (requestType === "termination" && terminationDocument && requestId) {
        try {
          const formData = new FormData();
          formData.append("file", terminationDocument);
          formData.append("document_type", "termination");
          formData.append("user_id", selectedUser._id);
          formData.append("description", "Dokumen termination untuk user");
          
          await uploadDocument(formData);
        } catch (docErr) {
          console.error("Failed to upload termination document:", docErr);
          // Don't fail the whole request if document upload fails
          toast.error("Permintaan berhasil dibuat, namun upload dokumen gagal");
        }
      }

      toast.success("Permintaan dikirim untuk persetujuan");
      setShowRequestModal(false);
      setRequestForm({ requested_role: "", division_id: "", notes: "" });
      setTerminationDocument(null);
      loadUsers();
    } catch (err) {
      const msg = err.response?.data?.message || err.message || "Gagal mengirim permintaan";
      toast.error(msg);
    } finally {
      setProcessing(false);
    }
  };

  const handleDelete = async () => {
    if (processing) return;
    setProcessing(true);
    try {
      await deleteUser(selectedUser._id);
      toast.success("User berhasil dihapus (soft-delete)");
      setShowDeleteConfirm(false);
      loadUsers();
    } catch (err) {
      toast.error(err.response?.data?.error?.message || "Gagal menghapus user");
    } finally {
      setProcessing(false);
    }
  };

  const exportToCSV = () => {
    const headers = ["Full Name","Email","Status","Role","Division","Phone","Hire Date","Salary"];
    const rows = users.map(u => [
      u.full_name,
      u.email,
      u.status,
      u.role_id?.name || "-",
      u.division_id?.name || "-",
      u.phone || "-",
      u.hire_date ? new Date(u.hire_date).toLocaleDateString("id-ID") : "-",
      u.salary ? formatCurrency(u.salary) : "-"
    ]);
    const csv = [headers, ...rows].map(r => r.map(c => `"${c}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `users_${new Date().toISOString().slice(0,10)}.csv`;
    a.click();
  };

  const getStatusBadge = (status) => {
    const map = {
      active: "bg-green-500/15 text-green-200 border-green-500/30",
      pending: "bg-amber-500/15 text-amber-200 border-amber-500/30",
      inactive: "bg-slate-500/15 text-slate-200 border-slate-500/30",
      terminated: "bg-red-500/15 text-red-200 border-red-500/30",
    };
    return map[status] || "bg-slate-500/15 text-slate-200 border-slate-500/30";
  };

  const getEventIcon = (eventType) => {
    const icons = {
      hired: <UserPlus className="w-5 h-5 text-green-600" />,
      promotion: <TrendingUp className="w-5 h-5 text-blue-600" />,
      demotion: <TrendingDown className="w-5 h-5 text-orange-600" />,
      transfer: <ArrowRight className="w-5 h-5 text-purple-600" />,
      salary_change: <DollarSign className="w-5 h-5 text-emerald-600" />,
      resignation: <UserX className="w-5 h-5 text-gray-600" />,
      terminated: <AlertCircle className="w-5 h-5 text-red-600" />,
      status_change: <Clock className="w-5 h-5 text-yellow-600" />,
      role_change: <Briefcase className="w-5 h-5 text-indigo-600" />,
    };
    return icons[eventType] || <Clock className="w-5 h-5 text-gray-600" />;
  };

  const getEventColor = (eventType) => {
    const colors = {
      hired: "bg-green-100 border-green-300",
      promotion: "bg-blue-100 border-blue-300",
      demotion: "bg-orange-100 border-orange-300",
      transfer: "bg-purple-100 border-purple-300",
      salary_change: "bg-emerald-100 border-emerald-300",
      resignation: "bg-gray-100 border-gray-300",
      terminated: "bg-red-100 border-red-300",
      status_change: "bg-yellow-100 border-yellow-300",
      role_change: "bg-indigo-100 border-indigo-300",
    };
    return colors[eventType] || "bg-gray-100 border-gray-300";
  };

  const formatEventType = (type) => {
    const labels = {
      hired: "Hired",
      promotion: "Promosi",
      demotion: "Demosi",
      transfer: "Transfer",
      salary_change: "Perubahan Gaji",
      resignation: "Pengunduran Diri",
      terminated: "Terminated",
      status_change: "Perubahan Status",
      role_change: "Perubahan Role",
    };
    return labels[type] || type;
  };

  const getRoleNameById = (roleId) => {
    if (!roleId) return "-";
    const r = roles.find((r) => r._id === roleId || r._id === String(roleId));
    return r ? r.name : roleId;
  };

  const getRoleLevelById = (roleId) => {
    const r = roles.find((r) => r._id === roleId || r._id === String(roleId));
    return r?.hierarchy_level ?? null;
  };

  const isDivisionManagerUser = (targetUser) => {
    if (!targetUser?._id || !divisions?.length) return false;
    return divisions.some((d) => d.manager_id === targetUser._id);
  };

  const requesterCanTargetRole = (targetRoleId) => {
    if (isSuperadmin || !currentRoleLevel) return true;
    const targetLevel = getRoleLevelById(targetRoleId);
    if (!targetLevel) return true;
    return targetLevel >= currentRoleLevel;
  };

  const requesterCanTargetUser = (targetUser) => {
    if (isSuperadmin || !currentRoleLevel) return true;
    const targetLevel =
      targetUser?.role_id?.hierarchy_level ??
      getRoleLevelById(targetUser?.role_id?._id);
    if (!targetLevel) return true;
    return currentRoleLevel < targetLevel;
  };

  const renderRoleChangeHint = () => {
    if (!showEditModal || !selectedUser) return null;
    const oldRoleId = selectedUser.role_id?._id;
    const newRoleId = formData.role_id;
    if (!newRoleId || newRoleId === oldRoleId) return null;

    const oldLevel = getRoleLevelById(oldRoleId);
    const newLevel = getRoleLevelById(newRoleId);
    if (oldLevel == null || newLevel == null) return null;

    let label = "Perubahan role";
    if (newLevel < oldLevel) label = "Promosi";
    else if (newLevel > oldLevel) label = "Demosi";

    return (
      <div className={`mt-2 text-sm ${newLevel < oldLevel ? "text-blue-700" : "text-orange-700"}`}>
        {label}: {getRoleNameById(oldRoleId)} → {getRoleNameById(newRoleId)} (level {oldLevel} → {newLevel})
      </div>
    );
  };

  const renderDivisionChangeHint = () => {
    if (!showEditModal || !selectedUser) return null;
    const oldDiv = selectedUser.division_id?._id;
    const newDiv = formData.division_id;
    if (!newDiv || newDiv === oldDiv) return null;

    const oldDivName = divisions.find((d) => d._id === oldDiv)?.name || "-";
    const newDivName = divisions.find((d) => d._id === newDiv)?.name || "-";

    return (
      <div className="mt-2 text-sm text-purple-700">
        Perpindahan divisi: {oldDivName} → {newDivName}
      </div>
    );
  };

  const formatCurrency = (value) => {
    if (!value) return "-";
    return new Intl.NumberFormat("id-ID", {
      style: "currency",
      currency: "IDR",
      minimumFractionDigits: 0
    }).format(parseFloat(value));
  };

  return (
    <>
      <Toaster position="top-center" />
      <div className="min-h-screen bg-gradient-to-br from-slate-950 via-blue-950 to-slate-900 p-6 relative overflow-hidden">
        {/* Animated Background */}
        <div className="absolute inset-0 overflow-hidden">
          <motion.div
            className="absolute top-16 left-16 w-72 h-72 bg-blue-600 rounded-full mix-blend-multiply filter blur-3xl opacity-20"
            animate={{ scale: [1, 1.2, 1], x: [0, 60, 0], y: [0, 40, 0] }}
            transition={{ duration: 8, repeat: Infinity, ease: "easeInOut" }}
          />
          <motion.div
            className="absolute bottom-16 right-16 w-96 h-96 bg-indigo-600 rounded-full mix-blend-multiply filter blur-3xl opacity-20"
            animate={{ scale: [1, 1.25, 1], x: [0, -60, 0], y: [0, -40, 0] }}
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
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 bg-gradient-to-br from-blue-600 to-indigo-700 rounded-2xl flex items-center justify-center shadow-lg">
                <Sparkles className="w-7 h-7 text-white" />
              </div>
              <div>
                <h1 className="text-4xl font-bold bg-gradient-to-r from-blue-400 to-indigo-400 bg-clip-text text-transparent">
                  User Management
                </h1>
                <p className="text-slate-400 mt-1">Kelola akun karyawan dan hak akses</p>
              </div>
            </div>
          </motion.div>

          {/* Toolbar */}
          <motion.div 
            className="bg-slate-900/80 backdrop-blur-xl rounded-3xl shadow-2xl border border-blue-900/50 p-6 mb-8"
            variants={itemVariants}
          >
            <div className="flex flex-col lg:flex-row gap-6">
              <div className="flex-1 relative">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-blue-400 w-6 h-6" />
                <input
                  type="text"
                  placeholder="Cari nama atau email..."
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
                  className="flex items-center gap-3 px-6 py-4 bg-gradient-to-r from-emerald-600 to-green-600 hover:from-emerald-700 hover:to-green-700 text-white rounded-2xl transition-all shadow-lg"
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                >
                  <Download className="w-6 h-6" />
                  Export CSV
                </motion.button>
                {canCreateUser && (
                  <motion.button 
                    onClick={openAddModal} 
                    className="flex items-center gap-3 px-6 py-4 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white rounded-2xl transition-all shadow-lg"
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                  >
                    <UserPlus className="w-6 h-6" /> {isSuperadmin ? "Tambah User" : "Ajukan User"}
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
                    <label className="block text-sm font-medium text-slate-300 mb-2">Status</label>
                    <select value={statusFilter} onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }} className="w-full px-5 py-4 bg-slate-800/50 border border-slate-700 rounded-2xl text-white focus:ring-2 focus:ring-blue-500 backdrop-blur-sm">
                      <option value="">Semua</option>
                      <option value="active">Active</option>
                      <option value="pending">Pending</option>
                      <option value="inactive">Inactive</option>
                      <option value="terminated">Terminated</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-300 mb-2">Role</label>
                    <select value={roleFilter} onChange={(e) => { setRoleFilter(e.target.value); setPage(1); }} className="w-full px-5 py-4 bg-slate-800/50 border border-slate-700 rounded-2xl text-white focus:ring-2 focus:ring-blue-500 backdrop-blur-sm">
                      <option value="">Semua</option>
                      {roles.map((role) => (
                        <option key={role._id} value={role._id}>
                          {role.name} (Level {role.hierarchy_level})
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-300 mb-2">Division</label>
                    <select value={divisionFilter} onChange={(e) => { setDivisionFilter(e.target.value); setPage(1); }} className="w-full px-5 py-4 bg-slate-800/50 border border-slate-700 rounded-2xl text-white focus:ring-2 focus:ring-blue-500 backdrop-blur-sm">
                      <option value="">Semua</option>
                      {divisions.map((division) => (
                        <option key={division._id} value={division._id}>
                          {division.name}
                        </option>
                      ))}
                    </select>
                  </div>
                  {/* <div>
                    <label className="block text-sm font-medium text-slate-300 mb-2">Urutkan</label>
                    <select value={sortBy} onChange={(e) => { setSortBy(e.target.value); setPage(1); }} className="w-full px-5 py-4 bg-slate-800/50 border border-slate-700 rounded-2xl text-white focus:ring-2 focus:ring-blue-500 backdrop-blur-sm">
                      <option value="-created_at">Terbaru</option>
                      <option value="created_at">Terlama</option>
                      <option value="full_name">Nama A-Z</option>
                      <option value="-full_name">Nama Z-A</option>
                    </select>
                  </div> */}
                </div>
                {activeFiltersCount > 0 && (
                  <button onClick={() => { setSearch(""); setStatusFilter(""); setRoleFilter(""); setDivisionFilter(""); setSortBy("-created_at"); setPage(1); }} className="mt-4 text-sm text-blue-400 hover:text-blue-300 flex items-center gap-1">
                    <X className="w-4 h-4" /> Hapus semua filter
                  </button>
                )}
              </motion.div>
            )}
          </motion.div>

          {/* Table */}
          <motion.div 
            className="bg-slate-900/80 backdrop-blur-xl rounded-3xl shadow-2xl border border-blue-900/50 overflow-hidden"
            variants={itemVariants}
          >
            {loading ? (
              <div className="flex justify-center py-16">
                <motion.div animate={{ rotate: 360 }} transition={{ duration: 1, repeat: Infinity, ease: "linear" }} className="w-14 h-14 border-4 border-blue-500 border-t-transparent rounded-full" />
              </div>
            ) : users.length === 0 ? (
              <div className="text-center py-16 text-slate-400 text-lg">Tidak ada data user</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full table-fixed">
                  <thead className="bg-slate-800/70 backdrop-blur-sm border-b border-slate-700/50 sticky top-0 z-20">
                    <tr>
                      <th className="w-72 px-8 py-5 text-left text-xs font-semibold text-slate-300 uppercase tracking-wide">Karyawan</th>
                      <th className="px-8 py-5 text-left text-xs font-semibold text-slate-300 uppercase tracking-wide">Status</th>
                      <th className="px-8 py-5 text-left text-xs font-semibold text-slate-300 uppercase tracking-wide">Role</th>
                      <th className="px-8 py-5 text-left text-xs font-semibold text-slate-300 uppercase tracking-wide">Divisi</th>
                      <th className="px-8 py-5 text-left text-xs font-semibold text-slate-300 uppercase tracking-wide">Tgl Masuk</th>
                      <th className="px-8 py-5 text-left text-xs font-semibold text-slate-300 uppercase tracking-wide">Gaji</th>
                      <th className="w-40 px-8 py-5 text-right text-xs font-semibold text-slate-300 uppercase tracking-wide sticky right-0 bg-slate-800/90 backdrop-blur-sm">Aksi</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-700/50">
                    {users.map((user) => (
                      <motion.tr 
                        key={user._id} 
                        className="hover:bg-slate-800/50 transition-all"
                        whileHover={{ x: 4 }}
                      >
                        <td className="px-8 py-6">
                          <div className="flex items-center gap-4">
                            <div className="w-12 h-12 bg-gradient-to-br from-blue-600 to-indigo-700 rounded-2xl flex items-center justify-center text-white font-semibold shadow-lg">
                              {user.full_name?.[0]?.toUpperCase() || "?"}
                            </div>
                            <div>
                              <div className="text-base font-semibold text-white">{user.full_name}</div>
                              <div className="text-sm text-slate-400">{user.email}</div>
                            </div>
                          </div>
                        </td>
                        <td className="px-8 py-6">
                          <span className={`inline-flex px-3 py-1 rounded-full text-xs font-medium border ${getStatusBadge(user.status)}`}>
                            {user.status}
                          </span>
                        </td>
                        <td className="px-8 py-6 text-sm">
                          <div className="font-medium text-white">{user.role_id?.name || "-"}</div>
                          <div className="text-xs text-slate-400">Level {user.role_id?.hierarchy_level || "-"}</div>
                        </td>
                        <td className="px-8 py-6 text-sm text-slate-200">{user.division_id?.name || "-"}</td>
                        <td className="px-8 py-6 text-sm text-slate-300">
                          {user.hire_date ? new Date(user.hire_date).toLocaleDateString("id-ID") : "-"}
                        </td>
                        <td className="px-8 py-6 text-sm text-white">
                          {formatCurrency(user.salary)}
                        </td>
                        <td className="px-8 py-6 text-right sticky right-0 bg-slate-900/85 backdrop-blur-sm">
                          <div className="flex justify-end gap-3">
                            {canViewHistoryUser && (
                              <motion.button onClick={() => openHistoryModal(user)} className="text-purple-400 hover:text-purple-300" title="Lihat History" whileHover={{ scale: 1.1 }}>
                                <History className="w-5 h-5" />
                              </motion.button>
                            )}
                            {canUpdateDirect && (
                              <motion.button onClick={() => openEditModal(user)} className="text-slate-300 hover:text-white" title="Edit langsung" whileHover={{ scale: 1.1 }}>
                                <Edit className="w-5 h-5" />
                              </motion.button>
                            )}
                            {!canUpdateDirect && canProposeChange && requesterCanTargetUser(user) && (
                              <motion.button onClick={() => openRequestModal(user, "promotion")} className="text-blue-400 hover:text-blue-300" title="Ajukan perubahan (butuh persetujuan)" whileHover={{ scale: 1.1 }}>
                                <Edit className="w-5 h-5" />
                              </motion.button>
                            )}
                            {canDeleteDirect && (
                              <motion.button onClick={() => openDeleteConfirm(user)} className="text-red-400 hover:text-red-300" title="Hapus langsung" whileHover={{ scale: 1.1 }}>
                                <Trash2 className="w-5 h-5" />
                              </motion.button>
                            )}
                            {/* {!canDeleteDirect && canProposeChange && requesterCanTargetUser(user) && (
                              <motion.button onClick={() => openRequestModal(user, "termination")} className="text-red-400 hover:text-red-300" title="Ajukan terminasi (butuh persetujuan)" whileHover={{ scale: 1.1 }}>
                                <Trash2 className="w-5 h-5" />
                              </motion.button>
                            )} */}
                          </div>
                        </td>
                      </motion.tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </motion.div>

          {/* Pagination */}
          {!loading && totalItems > 0 && (
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
                {[10,15,25,50].map(s => <option key={s} value={s}>{s}/hal</option>)}
              </select>
            </motion.div>
          )}
        </motion.div>
      </div>

      {/* MODAL HISTORY */}
      {showHistoryModal && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-lg flex items-center justify-center z-50 p-4">
          <div className="bg-slate-900/90 rounded-3xl shadow-2xl w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col border border-blue-900/50">
            <div className="p-6 border-b border-slate-800/60 flex items-center justify-between">
              <div>
                <h2 className="text-2xl font-bold text-white">History Karyawan</h2>
                <p className="text-slate-400 mt-1">{selectedUser?.full_name}</p>
              </div>
              <button onClick={() => setShowHistoryModal(false)} className="text-slate-400 hover:text-white">
                <X className="w-6 h-6" />
              </button>
            </div>

            <div className="p-6 border-b border-slate-800/60 bg-slate-900/70">
              <div className="flex gap-4">
                <select 
                  value={historyEventFilter} 
                  onChange={(e) => { setHistoryEventFilter(e.target.value); setHistoryPage(1); }}
                  className="px-4 py-2 bg-slate-800/60 border border-slate-700 rounded-xl text-white focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">Semua Event</option>
                  <option value="hired">Hired</option>
                  <option value="promotion">Promosi</option>
                  <option value="demotion">Demosi</option>
                  <option value="transfer">Transfer</option>
                  <option value="salary_change">Perubahan Gaji</option>
                  <option value="resignation">Resign</option>
                  <option value="terminated">Terminated</option>
                  <option value="status_change">Perubahan Status</option>
                  <option value="role_change">Perubahan Role</option>
                </select>
                {historyEventFilter && (
                  <button onClick={() => { setHistoryEventFilter(""); setHistoryPage(1); }} className="text-sm text-blue-400 hover:text-blue-300 flex items-center gap-1">
                    <X className="w-4 h-4" /> Reset Filter
                  </button>
                )}
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-6">
              {historyLoading ? (
                <div className="flex justify-center py-12">
                  <Loader2 className="animate-spin w-10 h-10 text-blue-500" />
                </div>
              ) : userHistory.length === 0 ? (
                <div className="text-center py-12 text-slate-400">
                  <History className="w-16 h-16 mx-auto mb-4 text-slate-600" />
                  <p>Tidak ada history untuk user ini</p>
                </div>
              ) : (
                <div className="relative">
                  <div className="absolute left-6 top-0 bottom-0 w-0.5 bg-slate-800"></div>
                  
                  <div className="space-y-8">
                    {console.log(userHistory)}
                    {userHistory.map((item) => (
                      <div key={item._id} className="relative flex gap-6">
                        <div className={`relative z-10 flex-shrink-0 w-12 h-12 rounded-full border-4 border-slate-900 flex items-center justify-center ${getEventColor(item.event_type)}`}>
                          {getEventIcon(item.event_type)}
                        </div>

                        <div className="flex-1 bg-slate-900/80 border border-slate-800 rounded-2xl p-4 shadow-sm hover:shadow-lg transition-shadow">
                          <div className="flex items-start justify-between mb-3">
                            <div>
                              <h3 className="text-lg font-semibold text-white">
                                {formatEventType(item.event_type)}
                              </h3>
                              <p className="text-sm text-slate-400">
                                {new Date(item.effective_date).toLocaleDateString("id-ID", {
                                  day: "numeric",
                                  month: "long",
                                  year: "numeric"
                                })}
                              </p>
                            </div>
                            <span className={`px-3 py-1 rounded-full text-xs font-medium border ${getEventColor(item.event_type)}`}>
                              {formatEventType(item.event_type)}
                            </span>
                          </div>

                          <div className="space-y-2 text-slate-200">
                            {(item.old_role || item.new_role) && (
                              <div className="flex items-center gap-2 text-sm">
                                <Briefcase className="w-4 h-4 text-slate-400" />
                                <span className="text-slate-300">Role:</span>
                                {item.old_role && <span className="text-slate-400 line-through">{item.old_role.name}</span>}
                                {item.old_role && item.new_role && <ArrowRight className="w-4 h-4 text-slate-500" />}
                                {item.new_role && <span className="font-medium text-white">{item.new_role.name}</span>}
                              </div>
                            )}

                            {(item.old_division || item.new_division) && (
                              <div className="flex items-center gap-2 text-sm">
                                <Users className="w-4 h-4 text-slate-400" />
                                <span className="text-slate-300">Divisi:</span>
                                {item.old_division && <span className="text-slate-400 line-through">{item.old_division.name}</span>}
                                {item.old_division && item.new_division && <ArrowRight className="w-4 h-4 text-slate-500" />}
                                {item.new_division && <span className="font-medium text-white">{item.new_division.name}</span>}
                              </div>
                            )}

                            {(item.old_salary || item.new_salary) && (
                              <div className="flex items-center gap-2 text-sm">
                                <DollarSign className="w-4 h-4 text-slate-400" />
                                <span className="text-slate-300">Gaji:</span>
                                {item.old_salary && <span className="text-slate-400 line-through">{formatCurrency(item.old_salary)}</span>}
                                {item.old_salary && item.new_salary && <ArrowRight className="w-4 h-4 text-slate-500" />}
                                {item.new_salary && <span className="font-medium text-white">{formatCurrency(item.new_salary)}</span>}
                              </div>
                            )}

                            {item.reason && (
                              <div className="mt-3 p-3 bg-slate-800/60 rounded text-sm text-slate-200">
                                <span className="font-medium text-white">Alasan: </span>
                                <span className="text-slate-200">{item.reason}</span>
                              </div>
                            )}

                            {item.notes && (
                              <div className="mt-2 p-3 bg-blue-900/40 rounded text-sm text-slate-100 border border-blue-800/40">
                                <span className="font-medium text-white">Catatan: </span>
                                <span className="text-slate-100">{item.notes}</span>
                              </div>
                            )}

                            <div className="mt-3 pt-3 border-t border-slate-800 flex items-center justify-between text-xs text-slate-400">
                              <span>
                                Dibuat oleh: <span className="font-medium text-white">{item.created_by?.full_name || "System"}</span>
                              </span>
                              <span>
                                {new Date(item.created_at).toLocaleString("id-ID", {
                                  day: "numeric",
                                  month: "short",
                                  year: "numeric",
                                  hour: "2-digit",
                                  minute: "2-digit"
                                })}
                              </span>
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {!historyLoading && userHistory.length > 0 && (
              <div className="p-4 border-t border-slate-800/60 bg-slate-900/70 flex items-center justify-between">
                <div className="text-sm text-slate-300">
                  Halaman <strong className="text-white">{historyPage}</strong> dari <strong className="text-white">{historyTotalPages}</strong>
                </div>
                <div className="flex items-center gap-2">
                  <button 
                    onClick={() => setHistoryPage(p => Math.max(1, p-1))} 
                    disabled={historyPage === 1} 
                    className="p-2 bg-slate-800/60 border border-slate-700 rounded-xl disabled:opacity-50 hover:bg-slate-700/60"
                  >
                    <ChevronLeft className="w-5 h-5 text-slate-200" />
                  </button>
                  <span className="px-3 text-white">{historyPage} / {historyTotalPages}</span>
                  <button 
                    onClick={() => setHistoryPage(p => Math.min(historyTotalPages, p+1))} 
                    disabled={historyPage === historyTotalPages} 
                    className="p-2 bg-slate-800/60 border border-slate-700 rounded-xl disabled:opacity-50 hover:bg-slate-700/60"
                  >
                    <ChevronRight className="w-5 h-5 text-slate-200" />
                  </button>
                </div>
                <select 
                  value={historyPageSize} 
                  onChange={(e) => { setHistoryPageSize(+e.target.value); setHistoryPage(1); }} 
                  className="px-3 py-2 bg-slate-800/60 border border-slate-700 rounded-xl text-white text-sm"
                >
                  {[5,10,15,20].map(s => <option key={s} value={s}>{s}/hal</option>)}
                </select>
              </div>
            )}
          </div>
        </div>
      )}

      {/* MODAL TAMBAH / EDIT */}
      {(showAddModal || showEditModal) && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-lg flex items-center justify-center z-50 p-4">
          <div className="bg-slate-900/90 rounded-3xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto border border-blue-900/50">
            <div className="p-6 border-b border-slate-800/60">
              <h2 className="text-2xl font-bold text-white mb-2">{showAddModal ? "Tambah User Baru" : "Edit User"}</h2>
              <p className="text-slate-400 text-sm">Lengkapi informasi user</p>
            </div>
            <div className="p-6">
              <form onSubmit={handleSubmit}>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-300 mb-1">Email *</label>
                    <input required type="email" value={formData.email} onChange={(e) => setFormData({...formData, email: e.target.value})} className="w-full px-4 py-3 bg-slate-800/60 border border-slate-700 rounded-xl text-white focus:ring-2 focus:ring-blue-500" />
                  </div>
                  {showAddModal && isSuperadmin && (
                    <div>
                      <label className="block text-sm font-medium text-slate-300 mb-1">Password *</label>
                      <input required type="password" value={formData.password} onChange={(e) => setFormData({...formData, password: e.target.value})} className="w-full px-4 py-3 bg-slate-800/60 border border-slate-700 rounded-xl text-white focus:ring-2 focus:ring-blue-500" />
                    </div>
                  )}
                  <div>
                    <label className="block text-sm font-medium text-slate-300 mb-1">Nama Lengkap *</label>
                    <input required type="text" value={formData.full_name} onChange={(e) => setFormData({...formData, full_name: e.target.value})} className="w-full px-4 py-3 bg-slate-800/60 border border-slate-700 rounded-xl text-white" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-300 mb-1">No. HP</label>
                    <input type="text" value={formData.phone} onChange={(e) => setFormData({...formData, phone: e.target.value})} className="w-full px-4 py-3 bg-slate-800/60 border border-slate-700 rounded-xl text-white" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-300 mb-1">Role *</label>
                    <select
                      required
                      value={formData.role_id || ""}
                      onChange={(e) =>
                        setFormData({ ...formData, role_id: e.target.value || null })
                      }
                      className="w-full px-4 py-3 bg-slate-800/60 border border-slate-700 rounded-xl text-white"
                    >
                      <option value="">Pilih role…</option>
                      {roles.map((r) => (
                        <option key={r._id} value={r._id}>
                          {r.name} (Level {r.hierarchy_level})
                        </option>
                      ))}
                    </select>
                    {renderRoleChangeHint()}
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-slate-300 mb-1">Division</label>
                    <select
                      className="w-full px-4 py-3 bg-slate-800/60 border border-slate-700 rounded-xl text-white"
                      value={formData.division_id ?? ""} 
                      onChange={(e) => {
                        const val = e.target.value;
                        setFormData({
                          ...formData,
                          division_id: val === "" ? null : val, 
                        });
                      }}
                    >
                      <option value="">Pilih division…</option>

                      {divisions.map((option) => {
                        const manager = users.find(u => u._id === option.manager_id);
                        const managerName = manager ? manager.full_name : "";

                        return (
                          <option key={option._id} value={option._id}>
                            {managerName
                              ? `${option.name} — managed by ${managerName}`
                              : option.name}
                          </option>
                        );
                      })}
                    </select>
                    {renderDivisionChangeHint()}

                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-300 mb-1">Gaji</label>
                    <input
                      type="number"
                      min="0"
                      value={formData.salary}
                      onChange={(e) => setFormData({ ...formData, salary: e.target.value })}
                      className="w-full px-4 py-3 bg-slate-800/60 border border-slate-700 rounded-xl text-white"
                      placeholder="Contoh: 5000000"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-300 mb-1">Status</label>
                    <select value={formData.status} onChange={(e) => setFormData({...formData, status: e.target.value})} className="w-full px-4 py-3 bg-slate-800/60 border border-slate-700 rounded-xl text-white">
                      <option value="pending">Pending</option>
                      <option value="active">Active</option>
                      <option value="inactive">Inactive</option>
                      <option value="terminated">Terminated</option>
                    </select>
                  </div>
                  <div className="md:col-span-2">
                    <label className="block text-sm font-medium text-slate-300 mb-1">Tanggal Masuk</label>
                    <input type="date" value={formData.hire_date} onChange={(e) => setFormData({...formData, hire_date: e.target.value})} className="w-full px-4 py-3 bg-slate-800/60 border border-slate-700 rounded-xl text-white" />
                  </div>
                </div>

                <div className="mt-6 flex justify-end gap-3">
                  <button type="button" onClick={() => { setShowAddModal(false); setShowEditModal(false); }} className="px-4 py-3 bg-slate-800/60 border border-slate-700 rounded-xl text-slate-200 hover:bg-slate-700/60">
                    Batal
                  </button>
                  <button type="submit" disabled={processing} className="flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white rounded-xl shadow-lg disabled:opacity-70">
                    {processing ? <Loader2 className="animate-spin w-5 h-5" /> : <Save className="w-5 h-5" />}
                    {showAddModal ? "Simpan" : "Update"}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* MODAL PERMINTAAN PERUBAHAN (APPROVAL) */}
      {showRequestModal && selectedUser && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-lg flex items-center justify-center z-50 p-4">
          <div className="bg-slate-900/90 rounded-3xl shadow-2xl max-w-xl w-full max-h-[90vh] overflow-y-auto border border-blue-900/50">
            <div className="p-6 border-b border-slate-800/60">
              <h2 className="text-2xl font-bold text-white">Ajukan Perubahan</h2>
              <p className="text-slate-400 mt-1">
                {selectedUser.full_name} ({selectedUser.role_id?.name || "-"}) — {selectedUser.division_id?.name || "-"}
              </p>
              {!isSuperadmin && (
                <p className="text-xs text-amber-400 mt-2">
                  Perubahan akan mengikuti alur persetujuan sesuai hirarki.
                </p>
              )}
            </div>
            <form onSubmit={handleRequestSubmit} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1">Jenis Permintaan</label>
                <select
                  value={requestType}
                  onChange={(e) => setRequestType(e.target.value)}
                  className="w-full px-4 py-3 bg-slate-800/60 border border-slate-700 rounded-xl text-white"
                >
                  <option value="promotion">Perubahan Role (Promosi/Demosi)</option>
                  {!isDivisionManagerUser(selectedUser) && (
                    <option value="transfer">Perpindahan Divisi</option>
                  )}
                  <option value="termination">Terminasi</option>
                </select>
              </div>

              {requestType === "promotion" && (
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-1">Role Tujuan</label>
                  <select
                    value={requestForm.requested_role || ""}
                    onChange={(e) =>
                      setRequestForm({ ...requestForm, requested_role: e.target.value })
                    }
                    className="w-full px-4 py-3 bg-slate-800/60 border border-slate-700 rounded-xl text-white"
                  >
                    <option value="">Pilih role…</option>
                    {roles.map((r) => (
                      <option key={r._id} value={r._id} disabled={!requesterCanTargetRole(r._id)}>
                        {r.name} (Level {r.hierarchy_level})
                      </option>
                    ))}
                  </select>
                  {!requesterCanTargetRole(requestForm.requested_role) && (
                    <p className="text-xs text-red-400 mt-1">Role tujuan melebihi otoritas Anda.</p>
                  )}
                </div>
              )}

              {requestType === "transfer" && (
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-1">Divisi Tujuan</label>
                  <select
                    value={requestForm.division_id || ""}
                    onChange={(e) =>
                      setRequestForm({ ...requestForm, division_id: e.target.value })
                    }
                    className="w-full px-4 py-3 bg-slate-800/60 border border-slate-700 rounded-xl text-white"
                  >
                    <option value="">Pilih division…</option>
                    {divisions.map((option) => (
                      <option key={option._id} value={option._id}>
                        {option.name}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {requestType === "termination" && (
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-1">
                    Dokumen Termination (Opsional)
                  </label>
                  <input
                    type="file"
                    accept=".pdf,.doc,.docx"
                    onChange={(e) => setTerminationDocument(e.target.files[0])}
                    className="w-full px-4 py-3 bg-slate-800/60 border border-slate-700 rounded-xl text-white file:text-slate-200"
                  />
                  {terminationDocument && (
                    <p className="text-sm text-slate-400 mt-1">{terminationDocument.name}</p>
                  )}
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1">Catatan</label>
                <textarea
                  value={requestForm.notes}
                  onChange={(e) =>
                    setRequestForm({ ...requestForm, notes: e.target.value })
                  }
                  rows={3}
                  className="w-full px-4 py-3 bg-slate-800/60 border border-slate-700 rounded-xl text-white"
                  placeholder="Alasan pengajuan / konteks"
                />
              </div>

              <div className="flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowRequestModal(false)}
                  className="px-4 py-3 bg-slate-800/60 border border-slate-700 rounded-xl text-slate-200 hover:bg-slate-700/60"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={processing}
                  className="flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white rounded-xl shadow-lg disabled:opacity-70"
                >
                  {processing ? <Loader2 className="animate-spin w-5 h-5" /> : <Save className="w-5 h-5" />}
                  Kirim Permintaan
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL KONFIRMASI HAPUS */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-lg flex items-center justify-center z-50 p-4">
          <div className="bg-slate-900/90 rounded-3xl shadow-2xl p-6 max-w-md w-full border border-red-900/50">
            <div className="flex items-center gap-3 text-red-300 mb-4">
              <AlertCircle className="w-10 h-10" />
              <h3 className="text-xl font-bold text-white">Konfirmasi Hapus</h3>
            </div>
            <p className="text-slate-200 mb-6">
              Apakah Anda yakin ingin menghapus akun <strong className="text-white">{selectedUser?.full_name}</strong>? 
              Akun akan di-soft-delete (status menjadi "terminated").
            </p>
            <div className="flex justify-end gap-3">
              <button onClick={() => setShowDeleteConfirm(false)} className="px-4 py-3 bg-slate-800/60 border border-slate-700 rounded-xl text-slate-200 hover:bg-slate-700/60">
                Batal
              </button>
              <button onClick={handleDelete} disabled={processing} className="flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-red-600 to-red-700 hover:from-red-700 hover:to-red-800 text-white rounded-xl shadow-lg disabled:opacity-70">
                {processing ? <Loader2 className="animate-spin w-5 h-5" /> : null}
                Hapus
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}