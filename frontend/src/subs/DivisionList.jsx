import { useState, useEffect } from "react";
import {
  Search, Download, Filter, X, Building2, Edit, Trash2,
  ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight,
  Loader2, Save, Plus, User, AlertCircle
} from "lucide-react";
import toast, { Toaster } from "react-hot-toast";
import { useAuthStore } from "../stores/useAuthStore";

import {
  fetchDivisions,
  createDivision,
  updateDivision,
  deleteDivision
} from "../utils/api.jsx";

export default function DivisionList() {
  const { user } = useAuthStore();
  const permissions = user?.role_id?.permissions || [];

//   const canCreate = permissions.includes("division:create");
//   const canUpdate = permissions.includes("division:update");
//   const canDelete = permissions.includes("division:delete");

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

  const activeFiltersCount = [search, managerFilter, activeGeneralFilter].filter(Boolean).length;

  useEffect(() => {
    loadDivisions();
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
      <Toaster position="top-right" />
      <div className="min-h-screen bg-gray-50 p-6">
        <div className="max-w-7xl mx-auto">
          <div className="mb-6">
            <h1 className="text-3xl font-bold text-gray-900">Division Management</h1>
            <p className="text-gray-600 mt-1">Kelola divisi dan struktur organisasi perusahaan</p>
          </div>

          {/* Toolbar */}
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4 mb-6">
            <div className="flex flex-col lg:flex-row gap-4">
              <div className="flex-1 relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-5 h-5" />
                <input
                  type="text"
                  placeholder="Cari nama atau deskripsi divisi..."
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
                {/* {canCreate && ( */}
                  <button onClick={openAddModal} className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700">
                    <Plus className="w-5 h-5" /> Tambah Divisi
                  </button>
                {/* )} */}
              </div>
            </div>

            {showFilters && (
              <div className="mt-6 pt-6 border-t border-gray-200">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Manager ID</label>
                    <input value={managerFilter} onChange={(e) => { setManagerFilter(e.target.value); setPage(1); }} placeholder="Filter manager" className="w-full px-3 py-2 border rounded-lg" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Active General ID</label>
                    <input value={activeGeneralFilter} onChange={(e) => { setActiveGeneralFilter(e.target.value); setPage(1); }} placeholder="Filter active general" className="w-full px-3 py-2 border rounded-lg" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Urutkan</label>
                    <select value={sortBy} onChange={(e) => setSortBy(e.target.value)} className="w-full px-3 py-2 border rounded-lg">
                      <option value="-created_at">Terbaru</option>
                      <option value="created_at">Terlama</option>
                      <option value="name">Nama A-Z</option>
                      <option value="-name">Nama Z-A</option>
                    </select>
                  </div>
                </div>
                {activeFiltersCount > 0 && (
                  <button onClick={() => { setSearch(""); setManagerFilter(""); setActiveGeneralFilter(""); setSortBy("-created_at"); setPage(1); }} className="mt-4 text-sm text-blue-600 hover:text-blue-800 flex items-center gap-1">
                    <X className="w-4 h-4" /> Hapus semua filter
                  </button>
                )}
              </div>
            )}
          </div>

          {/* Table */}
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
            {loading ? (
              <div className="flex justify-center py-12"><Loader2 className="animate-spin w-10 h-10 text-blue-600" /></div>
            ) : divisions.length === 0 ? (
              <div className="text-center py-12 text-gray-500">Tidak ada data divisi</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gray-50 border-b">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Divisi</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Manager</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Active General</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Dibuat</th>
                      <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Aksi</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {divisions.map((div) => (
                      <tr key={div._id} className="hover:bg-gray-50">
                        <td className="px-6 py-4">
                          <div className="flex items-center">
                            <div className="w-10 h-10 bg-indigo-600 rounded-full flex items-center justify-center text-white font-medium">
                              <Building2 className="w-6 h-6" />
                            </div>
                            <div className="ml-4">
                              <div className="text-sm font-medium text-gray-900">{div.name}</div>
                              {div.description && <div className="text-sm text-gray-500">{div.description}</div>}
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-4 text-sm">
                          {div.manager_id ? (
                            <div className="flex items-center gap-2">
                              <User className="w-4 h-4 text-gray-400" />
                              <span>{div.manager_id.full_name || div.manager_id.name}</span>
                            </div>
                          ) : "-"}
                        </td>
                        <td className="px-6 py-4 text-sm">
                          {div.active_general_id ? (
                            <div className="flex items-center gap-2">
                              <User className="w-4 h-4 text-gray-400" />
                              <span>{div.active_general_id.full_name || div.active_general_id.name}</span>
                            </div>
                          ) : "-"}
                        </td>
                        <td className="px-6 py-4 text-sm text-gray-500">
                          {new Date(div.created_at).toLocaleDateString("id-ID")}
                        </td>
                        <td className="px-6 py-4 text-right">
                          <div className="flex justify-end gap-3">
                            {/* {canUpdate && ( */}
                              <button onClick={() => openEditModal(div)} className="text-gray-600 hover:text-gray-900">
                                <Edit className="w-5 h-5" />
                              </button>
                            {/* )} */}
                            {/* {canDelete && ( */}
                              <button onClick={() => openDeleteConfirm(div)} className="text-red-600 hover:text-red-900">
                                <Trash2 className="w-5 h-5" />
                              </button>
                            {/* )} */}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Pagination */}
          {!loading && divisions.length > 0 && (
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
                {[10, 15, 25, 50].map(s => <option key={s} value={s}>{s}/hal</option>)}
              </select>
            </div>
          )}
        </div>
      </div>

      {/* Modal Tambah/Edit */}
      {(showAddModal || showEditModal) && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <h2 className="text-2xl font-bold mb-6">{showAddModal ? "Tambah Divisi Baru" : "Edit Divisi"}</h2>
              <form onSubmit={handleSubmit}>
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Nama Divisi *</label>
                    <input required type="text" value={formData.name} onChange={(e) => setFormData({...formData, name: e.target.value})} className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Deskripsi</label>
                    <textarea rows={3} value={formData.description} onChange={(e) => setFormData({...formData, description: e.target.value})} className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Manager ID (opsional)</label>
                    <input type="text" placeholder="UUID user" value={formData.manager_id} onChange={(e) => setFormData({...formData, manager_id: e.target.value})} className="w-full px-3 py-2 border rounded-lg" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Active General ID (opsional)</label>
                    <input type="text" placeholder="UUID user" value={formData.active_general_id} onChange={(e) => setFormData({...formData, active_general_id: e.target.value})} className="w-full px-3 py-2 border rounded-lg" />
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

      {/* Modal Konfirmasi Hapus */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl p-6 max-w-md w-full">
            <div className="flex items-center gap-3 text-red-600 mb-4">
              <AlertCircle className="w-10 h-10" />
              <h3 className="text-xl font-bold">Konfirmasi Hapus</h3>
            </div>
            <p className="text-gray-700 mb-6">
              Apakah Anda yakin ingin menghapus divisi <strong>{selectedDivision?.name}</strong>?
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