import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { fetchPendingUsers, approveUser, rejectUser, fetchUserDocuments } from "../utils/api";
import toast, { Toaster } from "react-hot-toast";
import { motion } from "framer-motion";
import {
  User, Mail, Phone, Building2, Calendar, CheckCircle, XCircle,
  Search, Loader2, FileText, Eye, DollarSign, Briefcase, UserCheck,
  ChevronLeft, ChevronRight
} from "lucide-react";

const API_BASE = import.meta.env.VITE_API_URL || import.meta.env.VITE_API_BASE_URL?.replace('/api/v1', '') || "http://localhost:3000";

const PendingUsers = () => {
  const navigate = useNavigate();
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [selectedUser, setSelectedUser] = useState(null);
  const [showApproveModal, setShowApproveModal] = useState(false);
  const [approving, setApproving] = useState(false);
  const [approvalData, setApprovalData] = useState({
    employment_type: "full-time",
    base_salary: "",
    currency: "IDR",
    hire_date: "",
    expired_date: "",
    allowances: [],
    deductions: [],
    // bpjs: {
    //   kesehatan: false,
    //   ketenagakerjaan: false,
    // },
    note: "",
  });
  const salaryInputRef = useRef(null);
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [rejectReason, setRejectReason] = useState("");
  const [rejecting, setRejecting] = useState(false);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [userDocuments, setUserDocuments] = useState([]);
  const [loadingDocuments, setLoadingDocuments] = useState(false);

  useEffect(() => {
    loadUsers();
  }, [page, search]);

  useEffect(() => {
    if (
      approvalData.currency === "USD" &&
      salaryInputRef.current &&
      approvalData.base_salary &&
      document.activeElement === salaryInputRef.current
    ) {
      const formatted = formatCurrency(approvalData.base_salary, "USD");
      const dotIndex = formatted.indexOf(".");
  
      if (dotIndex !== -1) {
        salaryInputRef.current.setSelectionRange(dotIndex, dotIndex);
      }
    }
  }, [approvalData.base_salary, approvalData.currency]);

  const loadUsers = async () => {
    try {
      setLoading(true);
      const result = await fetchPendingUsers({ page, pageSize: 10, search });
      setUsers(result.data || []);
      setTotalPages(result.meta?.pagination?.total_pages || 1);
    } catch (err) {
      toast.error("Gagal memuat data pengguna pending");
    } finally {
      setLoading(false);
    }
  };

  const handleApprove = async () => {
    if (!selectedUser) return;

    if (!approvalData.base_salary || parseFloat(approvalData.base_salary) <= 0) {
      toast.error("Base salary harus diisi dan lebih besar dari 0");
      return;
    }

    // Validate hire_date and expired_date for non-full-time
    if (approvalData.employment_type !== "full-time") {
      if (!approvalData.hire_date) {
        toast.error("Tanggal mulai kerja harus diisi untuk tipe karyawan ini");
        return;
      }
      if (!approvalData.expired_date) {
        toast.error("Tanggal berakhir kontrak harus diisi untuk tipe karyawan ini");
        return;
      }
      if (new Date(approvalData.expired_date) <= new Date(approvalData.hire_date)) {
        toast.error("Tanggal berakhir kontrak harus setelah tanggal mulai kerja");
        return;
      }
    }

    try {
      setApproving(true);
      await approveUser(selectedUser._id, approvalData);
      toast.success("Pengguna berhasil disetujui dan diaktifkan!");
      setShowApproveModal(false);
      setSelectedUser(null);
      setApprovalData({
        employment_type: "full-time",
        base_salary: "",
        currency: "IDR",
        hire_date: "",
        expired_date: "",
        allowances: [],
        deductions: [],
        // bpjs: {
        //   kesehatan: false,
        //   ketenagakerjaan: false,
        // },
        note: "",
      });
      loadUsers();
    } catch (err) {
      toast.error(err.message || "Gagal menyetujui pengguna");
    } finally {
      setApproving(false);
    }
  };

  const handleReject = async () => {
    if (!selectedUser) return;

    if (!rejectReason || rejectReason.trim() === "") {
      toast.error("Alasan penolakan harus diisi");
      return;
    }

    try {
      setRejecting(true);
      await rejectUser(selectedUser._id, rejectReason);
      toast.success("Pengguna berhasil ditolak");
      setShowRejectModal(false);
      setSelectedUser(null);
      setRejectReason("");
      loadUsers();
    } catch (err) {
      toast.error(err.message || "Gagal menolak pengguna");
    } finally {
      setRejecting(false);
    }
  };

  const openDetailModal = async (user) => {
    setSelectedUser(user);
    setShowDetailModal(true);
    setLoadingDocuments(true);
    try {
      const result = await fetchUserDocuments(user._id);
      setUserDocuments(result.data || []);
    } catch (err) {
      toast.error("Gagal memuat dokumen");
      setUserDocuments([]);
    } finally {
      setLoadingDocuments(false);
    }
  };

  const localeMap = {
    IDR: "id-ID",
    USD: "en-US",
  };

  const formatCurrency = (value, currency = "IDR") => {
    if (value === null || value === undefined) return "-";
  
    return new Intl.NumberFormat(
      localeMap[currency] || "en-US",
      {
        style: "currency",
        currency,
        minimumFractionDigits: 0,
      }
    ).format(Number(value));
  };

  const addAllowanceRow = () => {
    setApprovalData((prev) => ({
      ...prev,
      allowances: [...(prev.allowances || []), { name: "", amount: "" }],
    }));
  };

  const addDeductionRow = () => {
    setApprovalData((prev) => ({
      ...prev,
      deductions: [...(prev.deductions || []), { name: "", amount: "", category: "other" }],
    }));
  };

  const updateAllowance = (index, field, value) => {
    setApprovalData((prev) => {
      const next = [...(prev.allowances || [])];
      next[index] = { ...next[index], [field]: value };
      return { ...prev, allowances: next };
    });
  };

  const removeAllowance = (index) => {
    setApprovalData((prev) => ({
      ...prev,
      allowances: (prev.allowances || []).filter((_, i) => i !== index),
    }));
  };

  const updateDeduction = (index, field, value) => {
    setApprovalData((prev) => {
      const next = [...(prev.deductions || [])];
      next[index] = { ...next[index], [field]: value };
      return { ...prev, deductions: next };
    });
  };

  const removeDeduction = (index) => {
    setApprovalData((prev) => ({
      ...prev,
      deductions: (prev.deductions || []).filter((_, i) => i !== index),
    }));
  };

  const openApproveModal = (user) => {
    setSelectedUser(user);
    setShowApproveModal(true);
  };

  const formatDate = (dateString) => {
    if (!dateString) return "-";
    return new Date(dateString).toLocaleDateString("id-ID", {
      year: "numeric",
      month: "long",
      day: "numeric",
    });
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
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.5 }}
        >
          {/* Header */}
          <motion.div className="mb-8">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 bg-gradient-to-br from-blue-600 to-indigo-700 rounded-2xl flex items-center justify-center shadow-lg">
                <UserCheck className="w-7 h-7 text-white" />
              </div>
              <div>
                <h1 className="text-4xl font-bold bg-gradient-to-r from-blue-400 to-indigo-400 bg-clip-text text-transparent">
                  Pengguna Pending Approval
                </h1>
                <p className="text-slate-400 mt-1">Kelola pengguna yang menunggu persetujuan HR</p>
              </div>
            </div>
          </motion.div>

          {/* Search */}
          <motion.div 
            className="bg-slate-900/80 backdrop-blur-xl rounded-3xl shadow-2xl border border-blue-900/50 p-6 mb-8"
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.1 }}
          >
            <div className="relative">
              <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 w-6 h-6 text-blue-400" />
              <input
                type="text"
                placeholder="Cari nama, email..."
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value);
                  setPage(1);
                }}
                className="w-full pl-14 pr-6 py-4 bg-slate-800/50 border border-slate-700 rounded-2xl text-white placeholder-slate-500 focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all backdrop-blur-sm"
              />
            </div>
          </motion.div>

          {/* Users List */}
          <motion.div 
            className="bg-slate-900/80 backdrop-blur-xl rounded-3xl shadow-2xl border border-blue-900/50 overflow-hidden"
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.2 }}
          >
            {loading ? (
              <div className="flex items-center justify-center py-16">
                <motion.div animate={{ rotate: 360 }} transition={{ duration: 1, repeat: Infinity, ease: "linear" }} className="w-14 h-14 border-4 border-blue-500 border-t-transparent rounded-full" />
              </div>
            ) : users.length === 0 ? (
              <div className="text-center py-16 text-slate-400 text-lg">Tidak ada pengguna pending</div>
            ) : (
              <div className="divide-y divide-slate-700/50">
                {users.map((user, index) => (
                  <motion.div
                    key={user._id}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: index * 0.05 }}
                    className="bg-slate-800/50 hover:bg-slate-800/70 transition-all p-6"
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-4 mb-4">
                          <div className="w-12 h-12 rounded-full bg-gradient-to-br from-blue-600 to-indigo-700 flex items-center justify-center text-white font-bold text-lg shadow-lg">
                            {user.full_name?.charAt(0)?.toUpperCase() || "U"}
                          </div>
                          <div>
                            <h3 className="text-xl font-semibold text-white">{user.full_name}</h3>
                            <p className="text-slate-400 flex items-center gap-2 mt-1">
                              <Mail className="w-4 h-4" />
                              {user.email}
                            </p>
                          </div>
                        </div>

                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-4">
                          {user.phone && (
                            <div className="flex items-center gap-2 text-slate-300">
                              <Phone className="w-4 h-4 text-blue-400" />
                              <span className="text-sm">{user.phone}</span>
                            </div>
                          )}
                          {user.division_id && (
                            <div className="flex items-center gap-2 text-slate-300">
                              <Building2 className="w-4 h-4 text-indigo-400" />
                              <span className="text-sm">{user.division_id.name}</span>
                            </div>
                          )}
                          {user.date_of_birth && (
                            <div className="flex items-center gap-2 text-slate-300">
                              <Calendar className="w-4 h-4 text-blue-400" />
                              <span className="text-sm">{formatDate(user.date_of_birth)}</span>
                            </div>
                          )}
                          <div className="flex items-center gap-2 text-slate-300">
                            <User className="w-4 h-4 text-indigo-400" />
                            <span className="text-sm capitalize">{user.gender || "-"}</span>
                          </div>
                        </div>

                        <div className="mt-4 flex items-center gap-2">
                          <span className="px-3 py-1 bg-yellow-900/30 text-yellow-400 border border-yellow-500/30 rounded-lg text-sm font-medium">
                            Pending
                          </span>
                          <span className="text-slate-400 text-sm">
                            Terdaftar: {formatDate(user.created_at)}
                          </span>
                        </div>
                      </div>

                      <div className="flex items-center gap-3 ml-4">
                        <motion.button
                          onClick={() => openDetailModal(user)}
                          className="p-3 bg-slate-700/50 hover:bg-slate-700 rounded-xl transition-colors"
                          title="Lihat Detail & Dokumen"
                          whileHover={{ scale: 1.1 }}
                          whileTap={{ scale: 0.9 }}
                        >
                          <Eye className="w-5 h-5 text-blue-400" />
                        </motion.button>
                        <motion.button
                          onClick={() => {
                            setSelectedUser(user);
                            setShowRejectModal(true);
                          }}
                          className="px-6 py-3 bg-gradient-to-r from-red-600 to-red-700 hover:from-red-700 hover:to-red-800 text-white font-semibold rounded-xl transition-all flex items-center gap-2 shadow-lg"
                          whileHover={{ scale: 1.05 }}
                          whileTap={{ scale: 0.95 }}
                        >
                          <XCircle className="w-5 h-5" />
                          Reject
                        </motion.button>
                        <motion.button
                          onClick={() => openApproveModal(user)}
                          className="px-6 py-3 bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700 text-white font-semibold rounded-xl transition-all flex items-center gap-2 shadow-lg"
                          whileHover={{ scale: 1.05 }}
                          whileTap={{ scale: 0.95 }}
                        >
                          <CheckCircle className="w-5 h-5" />
                          Approve
                        </motion.button>
                      </div>
                    </div>
                  </motion.div>
                ))}
              </div>
            )}
          </motion.div>

          {/* Pagination */}
          {!loading && totalPages > 1 && (
            <motion.div 
              className="mt-8 flex flex-col sm:flex-row items-center justify-between gap-6 bg-slate-900/80 backdrop-blur-xl rounded-3xl p-6 border border-blue-900/50"
              initial={{ y: 20, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ delay: 0.3 }}
            >
              <p className="text-slate-400">
                Halaman <strong className="text-white">{page}</strong> dari <strong className="text-white">{totalPages}</strong>
              </p>
              <div className="flex items-center gap-4">
                <motion.button 
                  whileHover={{ scale: 1.1 }} 
                  disabled={page === 1} 
                  onClick={() => setPage(1)} 
                  className="p-3 bg-slate-800/50 rounded-2xl disabled:opacity-50"
                >
                  <ChevronLeft className="w-6 h-6 text-slate-300" />
                </motion.button>
                <motion.button 
                  whileHover={{ scale: 1.1 }} 
                  disabled={page === 1} 
                  onClick={() => setPage(p => Math.max(1, p-1))} 
                  className="p-3 bg-slate-800/50 rounded-2xl disabled:opacity-50"
                >
                  <ChevronLeft className="w-6 h-6 text-slate-300" />
                </motion.button>
                <span className="text-white font-medium">{page} / {totalPages}</span>
                <motion.button 
                  whileHover={{ scale: 1.1 }} 
                  disabled={page === totalPages} 
                  onClick={() => setPage(p => Math.min(totalPages, p+1))} 
                  className="p-3 bg-slate-800/50 rounded-2xl disabled:opacity-50"
                >
                  <ChevronRight className="w-6 h-6 text-slate-300" />
                </motion.button>
                <motion.button 
                  whileHover={{ scale: 1.1 }} 
                  disabled={page === totalPages} 
                  onClick={() => setPage(totalPages)} 
                  className="p-3 bg-slate-800/50 rounded-2xl disabled:opacity-50"
                >
                  <ChevronRight className="w-6 h-6 text-slate-300" />
                </motion.button>
              </div>
            </motion.div>
          )}
        </motion.div>
      </div>

      {/* Approve Modal */}
      {showApproveModal && selectedUser && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-4xl max-h-[95vh] flex flex-col"
          >
            {/* HEADER */}
            <div className="shrink-0 p-6 border-b border-slate-800 flex items-center justify-between">
              <h2 className="text-xl font-bold text-white flex items-center gap-3">
                <UserCheck className="w-6 h-6 text-green-400" />
                Approve User — {selectedUser.full_name}
              </h2>
              <button
                onClick={() => setShowApproveModal(false)}
                className="p-2 rounded-lg hover:bg-slate-800"
              >
                <XCircle className="w-6 h-6 text-slate-400" />
              </button>
            </div>

            {/* BODY (SCROLL AREA) */}
            <div className="flex-1 overflow-y-auto p-6 space-y-8">
              {/* Employment Type */}
              <section className="space-y-3">
                <label className="text-sm font-semibold text-slate-300">
                  Tipe Karyawan *
                </label>
                <select
                  value={approvalData.employment_type}
                  onChange={(e) =>
                    setApprovalData({ ...approvalData, employment_type: e.target.value })
                  }
                  className="w-full px-4 py-3 bg-slate-800 border border-slate-700 rounded-xl text-white"
                >
                  <option value="full-time">Full-time</option>
                  <option value="contract">Contract</option>
                  <option value="intern">Intern</option>
                  <option value="freelance">Freelance</option>
                </select>
              </section>

              {/* Salary */}
              <section className="space-y-3">
                <label className="text-sm font-semibold text-slate-300">
                  Base Salary *
                </label>

                <div className="grid grid-cols-[100px_1fr] gap-3">
                  <select
                    value={approvalData.currency}
                    onChange={(e) =>
                      setApprovalData({
                        ...approvalData,
                        currency: e.target.value,
                        base_salary: "",
                      })
                    }
                    className="px-4 py-3 bg-slate-800 border border-slate-700 rounded-xl text-white"
                  >
                    <option value="IDR">IDR</option>
                    <option value="USD">USD</option>
                  </select>

                  <input
                    type="text"
                    required
                    value={
                      approvalData.base_salary
                        ? formatCurrency(
                            approvalData.base_salary,
                            approvalData.currency
                          )
                        : ""
                    }
                    onChange={(e) => {
                      let value = e.target.value;
                      if (approvalData.currency === "IDR") {
                        value = value.replace(/[^\d]/g, "");
                      } else {
                        value = value.replace(/[^0-9.]/g, "");
                      }
                      setApprovalData({ ...approvalData, base_salary: value });
                    }}
                    placeholder="0"
                    className="px-4 py-3 bg-slate-800 border border-slate-700 rounded-xl text-white"
                  />
                </div>
              </section>

              {/* Allowances & Deductions */}
              <section className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Allowances */}
                <div className="space-y-3">
                  <div className="flex justify-between items-center">
                    <h4 className="text-sm font-semibold text-slate-200">
                      Allowances
                    </h4>
                    <button
                      type="button"
                      onClick={addAllowanceRow}
                      className="text-xs text-emerald-400"
                    >
                      Tambah
                    </button>
                  </div>

                  {(approvalData.allowances || []).map((a, idx) => (
                    <div
                      key={idx}
                      className="grid grid-cols-1 gap-2 md:grid-cols-[1fr_120px_40px] md:items-center"
                    >
                      <input
                        type="text"
                        value={a.name}
                        onChange={(e) => updateAllowance(idx, "name", e.target.value)}
                        placeholder="Nama"
                        className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white text-sm"
                      />

                      <input
                        type="text"
                        value={a.amount ? formatCurrency(a.amount, approvalData.currency) : ""}
                        onChange={(e) => {
                          let value = e.target.value;
                          if (approvalData.currency === "IDR") {
                            value = value.replace(/[^\d]/g, "");
                          } else {
                            value = value.replace(/[^0-9.]/g, "");
                          }
                          updateAllowance(idx, "amount", value);
                        }}
                        placeholder="Jumlah"
                        className="w-full md:w-[120px] px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white text-sm"
                      />

                      <button
                        type="button"
                        onClick={() => removeAllowance(idx)}
                        className="flex items-center justify-center text-red-400 hover:text-red-300"
                      >
                        ✕
                      </button>
                    </div>
                  ))}

                </div>

                {/* Deductions */}
                <div className="space-y-3">
                  <div className="flex justify-between items-center">
                    <h4 className="text-sm font-semibold text-slate-200">
                      Deductions
                    </h4>
                    <button
                      type="button"
                      onClick={addDeductionRow}
                      className="text-xs text-emerald-400"
                    >
                      Tambah
                    </button>
                  </div>

                  {(approvalData.deductions || []).map((d, idx) => (
                    <div
                      key={idx}
                      className="grid grid-cols-1 gap-2 md:grid-cols-[1fr_120px_160px_40px] md:items-center"
                    >
                      <input
                        type="text"
                        value={d.name}
                        onChange={(e) => updateDeduction(idx, "name", e.target.value)}
                        placeholder="Nama"
                        className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white text-sm"
                      />

                      <input
                        type="text"
                        value={d.amount ? formatCurrency(d.amount, approvalData.currency) : ""}
                        onChange={(e) => {
                          let value = e.target.value;
                          if (approvalData.currency === "IDR") {
                            value = value.replace(/[^\d]/g, "");
                          } else {
                            value = value.replace(/[^0-9.]/g, "");
                          }
                          updateDeduction(idx, "amount", value);
                        }}
                        placeholder="Jumlah"
                        className="w-full md:w-[120px] px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white text-sm"
                      />

                      <select
                        value={d.category || "other"}
                        onChange={(e) => updateDeduction(idx, "category", e.target.value)}
                        className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white text-sm"
                      >
                        <option value="other">Other</option>
                        <option value="bpjs">BPJS</option>
                        <option value="insurance">Insurance</option>
                      </select>

                      <button
                        type="button"
                        onClick={() => removeDeduction(idx)}
                        className="flex items-center justify-center text-red-400 hover:text-red-300"
                      >
                        ✕
                      </button>
                    </div>
                  ))}

                </div>
              </section>

              {/* Note */}
              <section className="space-y-3">
                <label className="text-sm font-semibold text-slate-300">
                  Catatan
                </label>
                <textarea
                  rows={4}
                  value={approvalData.note}
                  onChange={(e) =>
                    setApprovalData({ ...approvalData, note: e.target.value })
                  }
                  className="w-full px-4 py-3 bg-slate-800 border border-slate-700 rounded-xl text-white resize-none"
                />
              </section>
            </div>

            {/* FOOTER */}
            <div className="shrink-0 p-6 border-t border-slate-800 flex justify-end gap-3">
              <button
                onClick={() => setShowApproveModal(false)}
                className="px-6 py-3 bg-slate-800 rounded-xl text-white"
              >
                Batal
              </button>
              <button
                onClick={handleApprove}
                disabled={approving || !approvalData.base_salary}
                className="px-6 py-3 bg-gradient-to-r from-green-600 to-emerald-600 text-white rounded-xl disabled:opacity-50"
              >
                Approve & Aktifkan
              </button>
            </div>
          </motion.div>
        </div>
      )}


      {/* Reject Modal */}
      {showRejectModal && selectedUser && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-slate-900 border border-slate-700 rounded-2xl p-8 max-w-lg w-full"
          >
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-2xl font-bold text-white flex items-center gap-3">
                <XCircle className="w-7 h-7 text-red-400" />
                Reject User: {selectedUser.full_name}
              </h2>
              <button
                onClick={() => {
                  setShowRejectModal(false);
                  setRejectReason("");
                }}
                className="p-2 hover:bg-slate-800 rounded-lg transition-colors"
              >
                <XCircle className="w-6 h-6 text-slate-400" />
              </button>
            </div>

            <div className="space-y-6">
              <div>
                <label className="block text-lg font-medium text-slate-300 mb-3">
                  Alasan Penolakan *
                </label>
                <textarea
                  value={rejectReason}
                  onChange={(e) => setRejectReason(e.target.value)}
                  rows={4}
                  placeholder="Masukkan alasan penolakan..."
                  className="w-full px-4 py-3 bg-slate-800/50 border border-slate-700 rounded-xl text-white placeholder-slate-500 focus:ring-2 focus:ring-red-500 focus:border-transparent resize-none"
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-4 mt-8">
              <button
                onClick={() => {
                  setShowRejectModal(false);
                  setRejectReason("");
                }}
                className="px-6 py-3 bg-slate-700/50 hover:bg-slate-700 text-white font-semibold rounded-xl transition-colors"
              >
                Batal
              </button>
              <button
                onClick={handleReject}
                disabled={rejecting || !rejectReason.trim()}
                className="px-6 py-3 bg-gradient-to-r from-red-600 to-red-700 hover:from-red-700 hover:to-red-800 text-white font-semibold rounded-xl transition-all flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {rejecting ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin" />
                    Memproses...
                  </>
                ) : (
                  <>
                    <XCircle className="w-5 h-5" />
                    Reject
                  </>
                )}
              </button>
            </div>
          </motion.div>
        </div>
      )}

      {/* Detail Modal with Documents */}
      {showDetailModal && selectedUser && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-lg z-50 flex items-center justify-center p-4">
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-slate-900 border border-slate-700 rounded-2xl p-8 max-w-4xl w-full max-h-[90vh] overflow-y-auto"
          >
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-2xl font-bold text-white flex items-center gap-3">
                <User className="w-7 h-7 text-blue-400" />
                Detail User: {selectedUser.full_name}
              </h2>
              <button
                onClick={() => setShowDetailModal(false)}
                className="p-2 hover:bg-slate-800 rounded-lg transition-colors"
              >
                <XCircle className="w-6 h-6 text-slate-400" />
              </button>
            </div>

            {/* User Info */}
            <div className="space-y-6 mb-8">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-400 mb-1">Email</label>
                  <p className="text-white">{selectedUser.email}</p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-400 mb-1">Phone</label>
                  <p className="text-white">{selectedUser.phone || "-"}</p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-400 mb-1">Gender</label>
                  <p className="text-white capitalize">{selectedUser.gender || "-"}</p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-400 mb-1">Date of Birth</label>
                  <p className="text-white">{formatDate(selectedUser.date_of_birth)}</p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-400 mb-1">Division</label>
                  <p className="text-white">{selectedUser.division_id?.name || "-"}</p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-400 mb-1">NIK</label>
                  <p className="text-white">{selectedUser.national_id || "-"}</p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-400 mb-1">NPWP</label>
                  <p className="text-white">{selectedUser.npwp || "-"}</p>
                </div>
              </div>
            </div>

            {/* Documents Section */}
            <div className="border-t border-slate-700 pt-6">
              <h3 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
                <FileText className="w-6 h-6 text-indigo-400" />
                Dokumen
              </h3>
              {loadingDocuments ? (
                <div className="flex justify-center py-8">
                  <Loader2 className="w-8 h-8 animate-spin text-blue-400" />
                </div>
              ) : userDocuments.length === 0 ? (
                <p className="text-slate-400 text-center py-8">Tidak ada dokumen</p>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {userDocuments.map((doc) => (
                    <div
                      key={doc._id}
                      className="bg-slate-800/50 border border-slate-700 rounded-xl p-4 hover:bg-slate-800/70 transition-colors"
                    >
                      <div className="flex items-start justify-between mb-2">
                        <div>
                          <h4 className="text-white font-semibold capitalize">{doc.document_type}</h4>
                          <p className="text-slate-400 text-sm">{doc.file_name}</p>
                        </div>
                        <FileText className="w-5 h-5 text-blue-400" />
                      </div>
                      {doc.description && (
                        <p className="text-slate-300 text-sm mt-2">{doc.description}</p>
                      )}
                      <div className="mt-3 flex gap-2">
                        {doc.view_url && (
                          <button
                            onClick={() => {
                              let url = doc.view_url || doc.file_url;
                              if (url && url.startsWith('/')) {
                                url = `${API_BASE}${url}`;
                              }
                              
                              if (url) {
                                window.open(url, "_blank");
                              } else {
                                toast.error('URL dokumen tidak tersedia');
                              }
                            }}
                            className="text-xs px-3 py-1 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors"
                          >
                            View
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </motion.div>
        </div>
      )}
    </>
  );
};

export default PendingUsers;

