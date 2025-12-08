import { useState, useEffect } from "react";
import {
  Search, Download, Filter, X, UserPlus, Edit, Trash2, History,
  ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight,
  Loader2, Save, AlertCircle, TrendingUp, TrendingDown, 
  Briefcase, Users, DollarSign, UserX, Clock, ArrowRight
} from "lucide-react";
import toast, { Toaster } from "react-hot-toast";
import { useAuthStore } from "../stores/useAuthStore";

// API functions
import { 
  fetchUsers, 
  createUser, 
  updateUser, 
  deleteUser,
  fetchUserHistory,
  fetchDivisions
} from "../utils/api.jsx";

export default function UserList() {
  const { user } = useAuthStore();
  const permissions = user?.role_id?.permissions || [];
  console.log("permisi : ", permissions)
  
  const canCreateUser = permissions.includes("user:create");
  const canDeleteUser = permissions.includes("user:delete");
  const canUpdateUser = permissions.includes("user:update");
  // const canViewHistoryUser = permissions.includes("user:view_history");
  const canViewHistoryUser = permissions.some(p => p.startsWith("user:view_history"));

  const [users, setUsers] = useState([]);
  const [divisions, setDivisions] = useState([]);
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
    division_id: null, status: "pending", hire_date: ""
  });

  const activeFiltersCount = [search, statusFilter, roleFilter, divisionFilter].filter(Boolean).length;

  useEffect(() => {
    loadUsers();
    loadDivisions()
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
      division_id: "", status: "pending", hire_date: ""
    });
  };

  const openAddModal = () => {
    resetForm();
    setShowAddModal(true);
  };

  const openEditModal = (user) => {
    setSelectedUser(user);
    setFormData({
      email: user.email,
      password: "",
      full_name: user.full_name,
      phone: user.phone || "",
      role_id: user.role_id?._id || null,
      division_id: user.division_id?._id || null,
      status: user.status,
      hire_date: user.hire_date ? user.hire_date.split("T")[0] : ""
    });
    setShowEditModal(true);
  };

  const openDeleteConfirm = (user) => {
    setSelectedUser(user);
    setShowDeleteConfirm(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (processing) return;
    setProcessing(true);

    try {
      if (showAddModal) {
        await createUser(formData);
        toast.success("User berhasil ditambahkan");
        setShowAddModal(false);
      } else if (showEditModal) {
        await updateUser(selectedUser._id, formData);
        toast.success("User berhasil diperbarui");
        setShowEditModal(false);
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
    const headers = ["Full Name","Email","Status","Role","Division","Phone","Hire Date"];
    const rows = users.map(u => [
      u.full_name,
      u.email,
      u.status,
      u.role_id?.name || "-",
      u.division_id?.name || "-",
      u.phone || "-",
      u.hire_date ? new Date(u.hire_date).toLocaleDateString("id-ID") : "-"
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
      active: "bg-green-100 text-green-800 border-green-200",
      pending: "bg-yellow-100 text-yellow-800 border-yellow-200",
      inactive: "bg-gray-100 text-gray-800 border-gray-200",
      terminated: "bg-red-100 text-red-800 border-red-200",
    };
    return map[status] || "bg-gray-100 text-gray-800 border-gray-200";
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
      <Toaster position="top-right" />
      <div className="min-h-screen bg-gray-50 p-6">
        <div className="max-w-7xl mx-auto">
          <div className="mb-6">
            <h1 className="text-3xl font-bold text-gray-900">User Management</h1>
            <p className="text-gray-600 mt-1">Kelola akun karyawan dan hak akses</p>
          </div>

          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4 mb-6">
            <div className="flex flex-col lg:flex-row gap-4">
              <div className="flex-1 relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-5 h-5" />
                <input
                  type="text"
                  placeholder="Cari nama atau email..."
                  value={search}
                  onChange={(e) => { setSearch(e.target.value); setPage(1); }}
                  className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                />
              </div>
              <div className="flex gap-3">
                <button onClick={() => setShowFilters(!showFilters)} className="relative flex items-center gap-2 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50">
                  <Filter className="w-5 h-5" />
                  Filter
                  {activeFiltersCount > 0 && <span className="absolute -top-2 -right-2 bg-blue-600 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center">{activeFiltersCount}</span>}
                </button>
                <button onClick={exportToCSV} className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700">
                  <Download className="w-5 h-5" /> Export CSV
                </button>
                {canCreateUser && (
                  <button onClick={openAddModal} className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700">
                    <UserPlus className="w-5 h-5" /> Tambah User
                  </button>
                )}
              </div>
            </div>

            {showFilters && (
              <div className="mt-6 pt-6 border-t border-gray-200">
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
                    <select value={statusFilter} onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }} className="w-full px-3 py-2 border rounded-lg">
                      <option value="">Semua</option>
                      <option value="active">Active</option>
                      <option value="pending">Pending</option>
                      <option value="inactive">Inactive</option>
                      <option value="terminated">Terminated</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Role ID</label>
                    <input value={roleFilter} onChange={(e) => { setRoleFilter(e.target.value); setPage(1); }} placeholder="e.g. 60d5ec..." className="w-full px-3 py-2 border rounded-lg" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Division ID</label>
                    <input value={divisionFilter} onChange={(e) => { setDivisionFilter(e.target.value); setPage(1); }} placeholder="Filter division" className="w-full px-3 py-2 border rounded-lg" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Urutkan</label>
                    <select value={sortBy} onChange={(e) => { setSortBy(e.target.value); setPage(1); }} className="w-full px-3 py-2 border rounded-lg">
                      <option value="-created_at">Terbaru</option>
                      <option value="created_at">Terlama</option>
                      <option value="full_name">Nama A-Z</option>
                      <option value="-full_name">Nama Z-A</option>
                    </select>
                  </div>
                </div>
                {activeFiltersCount > 0 && (
                  <button onClick={() => { setSearch(""); setStatusFilter(""); setRoleFilter(""); setDivisionFilter(""); setSortBy("-created_at"); setPage(1); }} className="mt-4 text-sm text-blue-600 hover:text-blue-800 flex items-center gap-1">
                    <X className="w-4 h-4" /> Hapus semua filter
                  </button>
                )}
              </div>
            )}
          </div>

          <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
            {loading ? (
              <div className="flex justify-center py-12"><Loader2 className="animate-spin w-10 h-10 text-blue-600" /></div>
            ) : users.length === 0 ? (
              <div className="text-center py-12 text-gray-500">Tidak ada data user</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gray-50 border-b">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Karyawan</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Role</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Divisi</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Tgl Masuk</th>
                      <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Aksi</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {users.map((user) => (
                      <tr key={user._id} className="hover:bg-gray-50">
                        <td className="px-6 py-4">
                          <div className="flex items-center">
                            <div className="w-10 h-10 bg-blue-600 rounded-full flex items-center justify-center text-white font-medium">
                              {user.full_name?.[0]?.toUpperCase() || "?"}
                            </div>
                            <div className="ml-4">
                              <div className="text-sm font-medium text-gray-900">{user.full_name}</div>
                              <div className="text-sm text-gray-500">{user.email}</div>
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <span className={`inline-flex px-2.5 py-0.5 rounded-full text-xs font-medium border ${getStatusBadge(user.status)}`}>
                            {user.status}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-sm">
                          <div className="font-medium">{user.role_id?.name || "-"}</div>
                          <div className="text-xs text-gray-500">Level {user.role_id?.hierarchy_level || "-"}</div>
                        </td>
                        <td className="px-6 py-4 text-sm text-gray-900">{user.division_id?.name || "-"}</td>
                        <td className="px-6 py-4 text-sm text-gray-500">
                          {user.hire_date ? new Date(user.hire_date).toLocaleDateString("id-ID") : "-"}
                        </td>
                        <td className="px-6 py-4 text-right">
                          <div className="flex justify-end gap-3">
                            {canViewHistoryUser && (
                              <button onClick={() => openHistoryModal(user)} className="text-purple-600 hover:text-purple-900" title="Lihat History">
                              <History className="w-5 h-5" />
                            </button>
                            )}
                            {canUpdateUser && (
                              <button onClick={() => openEditModal(user)} className="text-gray-600 hover:text-gray-900">
                              <Edit className="w-5 h-5" />
                            </button>
                            )}
                            {canDeleteUser && (
                              <button onClick={() => openDeleteConfirm(user)} className="text-red-600 hover:text-red-900">
                                <Trash2 className="w-5 h-5" />
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {!loading && users.length > 0 && (
            <div className="bg-white border border-gray-200 rounded-lg mt-6 p-4 flex items-center justify-between">
              <div className="text-sm text-gray-600">
                Halaman <strong>{page}</strong> dari <strong>{totalPages}</strong> ({totalItems} total)
              </div>
              <div className="flex items-center gap-2">
                <button onClick={() => setPage(1)} disabled={page === 1} className="p-2 border rounded disabled:opacity-50"><ChevronsLeft className="w-5 h-5" /></button>
                <button onClick={() => setPage(p => Math.max(1, p-1))} disabled={page === 1} className="p-2 border rounded disabled:opacity-50"><ChevronLeft className="w-5 h-5" /></button>
                <span className="px-3">{page} / {totalPages}</span>
                <button onClick={() => setPage(p => Math.min(totalPages, p+1))} disabled={page === totalPages} className="p-2 border rounded disabled:opacity-50"><ChevronRight className="w-5 h-5" /></button>
                <button onClick={() => setPage(totalPages)} disabled={page === totalPages} className="p-2 border rounded disabled:opacity-50"><ChevronsRight className="w-5 h-5" /></button>
              </div>
              <select value={pageSize} onChange={(e) => { setPageSize(+e.target.value); setPage(1); }} className="px-3 py-2 border rounded text-sm">
                {[10,15,25,50].map(s => <option key={s} value={s}>{s}/hal</option>)}
              </select>
            </div>
          )}
        </div>
      </div>

      {/* MODAL HISTORY */}
      {showHistoryModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
            <div className="p-6 border-b flex items-center justify-between">
              <div>
                <h2 className="text-2xl font-bold text-gray-900">History Karyawan</h2>
                <p className="text-gray-600 mt-1">{selectedUser?.full_name}</p>
              </div>
              <button onClick={() => setShowHistoryModal(false)} className="text-gray-400 hover:text-gray-600">
                <X className="w-6 h-6" />
              </button>
            </div>

            <div className="p-6 border-b bg-gray-50">
              <div className="flex gap-4">
                <select 
                  value={historyEventFilter} 
                  onChange={(e) => { setHistoryEventFilter(e.target.value); setHistoryPage(1); }}
                  className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
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
                  <button onClick={() => { setHistoryEventFilter(""); setHistoryPage(1); }} className="text-sm text-blue-600 hover:text-blue-800 flex items-center gap-1">
                    <X className="w-4 h-4" /> Reset Filter
                  </button>
                )}
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-6">
              {historyLoading ? (
                <div className="flex justify-center py-12">
                  <Loader2 className="animate-spin w-10 h-10 text-blue-600" />
                </div>
              ) : userHistory.length === 0 ? (
                <div className="text-center py-12 text-gray-500">
                  <History className="w-16 h-16 mx-auto mb-4 text-gray-300" />
                  <p>Tidak ada history untuk user ini</p>
                </div>
              ) : (
                <div className="relative">
                  {/* Timeline line */}
                  <div className="absolute left-6 top-0 bottom-0 w-0.5 bg-gray-200"></div>
                  
                  <div className="space-y-8">
                    {userHistory.map((item, idx) => (
                      <div key={item._id} className="relative flex gap-6">
                        {/* Timeline dot */}
                        <div className={`relative z-10 flex-shrink-0 w-12 h-12 rounded-full border-4 border-white flex items-center justify-center ${getEventColor(item.event_type)}`}>
                          {getEventIcon(item.event_type)}
                        </div>

                        {/* Content card */}
                        <div className="flex-1 bg-white border border-gray-200 rounded-lg p-4 shadow-sm hover:shadow-md transition-shadow">
                          <div className="flex items-start justify-between mb-3">
                            <div>
                              <h3 className="text-lg font-semibold text-gray-900">
                                {formatEventType(item.event_type)}
                              </h3>
                              <p className="text-sm text-gray-500">
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

                          <div className="space-y-2">
                            {/* Role change */}
                            {(item.old_role || item.new_role) && (
                              <div className="flex items-center gap-2 text-sm">
                                <Briefcase className="w-4 h-4 text-gray-400" />
                                <span className="text-gray-600">Role:</span>
                                {item.old_role && <span className="text-gray-500 line-through">{item.old_role.name}</span>}
                                {item.old_role && item.new_role && <ArrowRight className="w-4 h-4 text-gray-400" />}
                                {item.new_role && <span className="font-medium text-gray-900">{item.new_role.name}</span>}
                              </div>
                            )}

                            {/* Division change */}
                            {(item.old_division || item.new_division) && (
                              <div className="flex items-center gap-2 text-sm">
                                <Users className="w-4 h-4 text-gray-400" />
                                <span className="text-gray-600">Divisi:</span>
                                {item.old_division && <span className="text-gray-500 line-through">{item.old_division.name}</span>}
                                {item.old_division && item.new_division && <ArrowRight className="w-4 h-4 text-gray-400" />}
                                {item.new_division && <span className="font-medium text-gray-900">{item.new_division.name}</span>}
                              </div>
                            )}

                            {/* Salary change */}
                            {(item.old_salary || item.new_salary) && (
                              <div className="flex items-center gap-2 text-sm">
                                <DollarSign className="w-4 h-4 text-gray-400" />
                                <span className="text-gray-600">Gaji:</span>
                                {item.old_salary && <span className="text-gray-500 line-through">{formatCurrency(item.old_salary)}</span>}
                                {item.old_salary && item.new_salary && <ArrowRight className="w-4 h-4 text-gray-400" />}
                                {item.new_salary && <span className="font-medium text-gray-900">{formatCurrency(item.new_salary)}</span>}
                              </div>
                            )}

                            {/* Reason */}
                            {item.reason && (
                              <div className="mt-3 p-3 bg-gray-50 rounded text-sm">
                                <span className="font-medium text-gray-700">Alasan: </span>
                                <span className="text-gray-600">{item.reason}</span>
                              </div>
                            )}

                            {/* Notes */}
                            {item.notes && (
                              <div className="mt-2 p-3 bg-blue-50 rounded text-sm">
                                <span className="font-medium text-gray-700">Catatan: </span>
                                <span className="text-gray-600">{item.notes}</span>
                              </div>
                            )}

                            {/* Created by */}
                            <div className="mt-3 pt-3 border-t border-gray-100 flex items-center justify-between text-xs text-gray-500">
                              <span>
                                Dibuat oleh: <span className="font-medium">{item.created_by?.full_name || "System"}</span>
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

            {/* History Pagination */}
            {!historyLoading && userHistory.length > 0 && (
              <div className="p-4 border-t bg-gray-50 flex items-center justify-between">
                <div className="text-sm text-gray-600">
                  Halaman <strong>{historyPage}</strong> dari <strong>{historyTotalPages}</strong>
                </div>
                <div className="flex items-center gap-2">
                  <button 
                    onClick={() => setHistoryPage(p => Math.max(1, p-1))} 
                    disabled={historyPage === 1} 
                    className="p-2 border rounded disabled:opacity-50 hover:bg-gray-100"
                  >
                    <ChevronLeft className="w-5 h-5" />
                  </button>
                  <span className="px-3">{historyPage} / {historyTotalPages}</span>
                  <button 
                    onClick={() => setHistoryPage(p => Math.min(historyTotalPages, p+1))} 
                    disabled={historyPage === historyTotalPages} 
                    className="p-2 border rounded disabled:opacity-50 hover:bg-gray-100"
                  >
                    <ChevronRight className="w-5 h-5" />
                  </button>
                </div>
                <select 
                  value={historyPageSize} 
                  onChange={(e) => { setHistoryPageSize(+e.target.value); setHistoryPage(1); }} 
                  className="px-3 py-2 border rounded text-sm"
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
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <h2 className="text-2xl font-bold mb-6">{showAddModal ? "Tambah User Baru" : "Edit User"}</h2>
              <form onSubmit={handleSubmit}>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Email *</label>
                    <input required type="email" value={formData.email} onChange={(e) => setFormData({...formData, email: e.target.value})} className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500" />
                  </div>
                  {showAddModal && (
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Password *</label>
                      <input required type="password" value={formData.password} onChange={(e) => setFormData({...formData, password: e.target.value})} className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500" />
                    </div>
                  )}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Nama Lengkap *</label>
                    <input required type="text" value={formData.full_name} onChange={(e) => setFormData({...formData, full_name: e.target.value})} className="w-full px-3 py-2 border rounded-lg" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">No. HP</label>
                    <input type="text" value={formData.phone} onChange={(e) => setFormData({...formData, phone: e.target.value})} className="w-full px-3 py-2 border rounded-lg" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Role ID *</label>
                    <input required type="text" placeholder="contoh: 60d5ecf..." value={formData.role_id} onChange={(e) => setFormData({...formData, role_id: e.target.value})} className="w-full px-3 py-2 border rounded-lg" />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Division</label>
                    <select
                      className="w-full px-3 py-2 border rounded-lg"
                      value={formData.division_id ?? ""} //
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

                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
                    <select value={formData.status} onChange={(e) => setFormData({...formData, status: e.target.value})} className="w-full px-3 py-2 border rounded-lg">
                      <option value="pending">Pending</option>
                      <option value="active">Active</option>
                      <option value="inactive">Inactive</option>
                      <option value="terminated">Terminated</option>
                    </select>
                  </div>
                  <div className="md:col-span-2">
                    <label className="block text-sm font-medium text-gray-700 mb-1">Tanggal Masuk</label>
                    <input type="date" value={formData.hire_date} onChange={(e) => setFormData({...formData, hire_date: e.target.value})} className="w-full px-3 py-2 border rounded-lg" />
                  </div>
                </div>

                <div className="mt-6 flex justify-end gap-3">
                  <button type="button" onClick={() => { setShowAddModal(false); setShowEditModal(false); }} className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50">
                    Batal
                  </button>
                  <button type="submit" disabled={processing} className="flex items-center gap-2 px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-70">
                    {processing ? <Loader2 className="animate-spin w-5 h-5" /> : <Save className="w-5 h-5" />}
                    {showAddModal ? "Simpan" : "Update"}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* MODAL KONFIRMASI HAPUS */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl p-6 max-w-md w-full">
            <div className="flex items-center gap-3 text-red-600 mb-4">
              <AlertCircle className="w-10 h-10" />
              <h3 className="text-xl font-bold">Konfirmasi Hapus</h3>
            </div>
            <p className="text-gray-700 mb-6">
              Apakah Anda yakin ingin menghapus akun <strong>{selectedUser?.full_name}</strong>? 
              Akun akan di-soft-delete (status menjadi "terminated").
            </p>
            <div className="flex justify-end gap-3">
              <button onClick={() => setShowDeleteConfirm(false)} className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50">
                Batal
              </button>
              <button onClick={handleDelete} disabled={processing} className="flex items-center gap-2 px-6 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-70">
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