import { useState } from "react";
import { useAuditLogs } from "../hooks/useAuditLogs";
import { motion } from "framer-motion";
import toast, { Toaster } from "react-hot-toast";
import { FileText, Search, Calendar, User, Activity, Sparkles, ChevronLeft, ChevronRight, RefreshCw } from "lucide-react";

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

export default function AuditLogs() {
  const [filters, setFilters] = useState({
    page: 1,
    limit: 50,
    user_id: "",
    action: "",
    resource_type: "",
    start_date: "",
    end_date: "",
  });

  const { data, loading, error, pagination, refetch } = useAuditLogs(filters);

  const formatDate = (dateString) => {
    if (!dateString) return "-";
    return new Date(dateString).toLocaleString("id-ID", {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const getActionColor = (action) => {
    if (action.includes("create")) return "bg-green-900/30 text-green-400 border border-green-800/50 backdrop-blur-sm";
    if (action.includes("update")) return "bg-blue-900/30 text-blue-400 border border-blue-800/50 backdrop-blur-sm";
    if (action.includes("delete")) return "bg-red-900/30 text-red-400 border border-red-800/50 backdrop-blur-sm";
    if (action.includes("approve")) return "bg-purple-900/30 text-purple-400 border border-purple-800/50 backdrop-blur-sm";
    if (action.includes("reject")) return "bg-orange-900/30 text-orange-400 border border-orange-800/50 backdrop-blur-sm";
    return "bg-slate-800/50 text-slate-300 border border-slate-700/50 backdrop-blur-sm";
  };

  const handlePageChange = (newPage) => {
    setFilters({ ...filters, page: newPage });
  };

  const handleResetFilters = () => {
    setFilters({
      page: 1,
      limit: 50,
      user_id: "",
      action: "",
      resource_type: "",
      start_date: "",
      end_date: "",
    });
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
              <Activity className="w-14 h-14 text-indigo-400" />
              Audit Logs
            </h1>
            <p className="text-slate-400 mt-4 text-xl flex items-center gap-3">
              <Sparkles className="w-6 h-6" />
              Riwayat lengkap aktivitas dan perubahan data sistem
            </p>
          </motion.div>

          {/* Filters Card */}
          <motion.div 
            className="bg-slate-900/80 backdrop-blur-xl rounded-3xl shadow-2xl border border-blue-900/50 p-8 mb-10"
            variants={itemVariants}
          >
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
              <div>
                <label className="flex items-center gap-3 text-lg font-medium text-slate-300 mb-4">
                  <Activity className="w-6 h-6 text-blue-400" />
                  Action
                </label>
                <select
                  value={filters.action}
                  onChange={(e) => setFilters({ ...filters, action: e.target.value, page: 1 })}
                  className="w-full px-6 py-4 bg-slate-800/50 border border-slate-700 rounded-2xl text-white focus:ring-2 focus:ring-blue-500 backdrop-blur-sm"
                >
                  <option value="">Semua Action</option>
                  <option value="create">Create</option>
                  <option value="update">Update</option>
                  <option value="delete">Delete</option>
                  <option value="approve">Approve</option>
                  <option value="reject">Reject</option>
                </select>
              </div>

              <div>
                <label className="flex items-center gap-3 text-lg font-medium text-slate-300 mb-4">
                  <FileText className="w-6 h-6 text-indigo-400" />
                  Resource Type
                </label>
                <select
                  value={filters.resource_type}
                  onChange={(e) => setFilters({ ...filters, resource_type: e.target.value, page: 1 })}
                  className="w-full px-6 py-4 bg-slate-800/50 border border-slate-700 rounded-2xl text-white focus:ring-2 focus:ring-blue-500 backdrop-blur-sm"
                >
                  <option value="">Semua Resource</option>
                  <option value="user">User</option>
                  <option value="role">Role</option>
                  <option value="division">Division</option>
                  <option value="account_request">Account Request</option>
                  <option value="approval">Approval</option>
                  <option value="document">Document</option>
                </select>
              </div>

              <div className="flex items-end">
                <motion.button
                  onClick={handleResetFilters}
                  className="w-full flex items-center justify-center gap-3 px-6 py-4 bg-slate-800/70 hover:bg-slate-700/70 border border-slate-700 rounded-2xl text-slate-300 font-medium transition-all"
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                >
                  <RefreshCw className="w-6 h-6" />
                  Reset Filter
                </motion.button>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mt-8">
              <div>
                <label className="flex items-center gap-3 text-lg font-medium text-slate-300 mb-4">
                  <Calendar className="w-6 h-6 text-blue-400" />
                  Tanggal Mulai
                </label>
                <input
                  type="date"
                  value={filters.start_date}
                  onChange={(e) => setFilters({ ...filters, start_date: e.target.value, page: 1 })}
                  className="w-full px-6 py-4 bg-slate-800/50 border border-slate-700 rounded-2xl text-white focus:ring-2 focus:ring-blue-500 backdrop-blur-sm"
                />
              </div>
              <div>
                <label className="flex items-center gap-3 text-lg font-medium text-slate-300 mb-4">
                  <Calendar className="w-6 h-6 text-indigo-400" />
                  Tanggal Akhir
                </label>
                <input
                  type="date"
                  value={filters.end_date}
                  onChange={(e) => setFilters({ ...filters, end_date: e.target.value, page: 1 })}
                  className="w-full px-6 py-4 bg-slate-800/50 border border-slate-700 rounded-2xl text-white focus:ring-2 focus:ring-blue-500 backdrop-blur-sm"
                />
              </div>
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
              <div className="text-center py-32">
                <AlertCircle className="w-24 h-24 text-red-400 mx-auto mb-6" />
                <p className="text-2xl text-red-400 mb-6">{error}</p>
                <motion.button
                  onClick={refetch}
                  className="px-8 py-4 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-2xl font-semibold"
                  whileHover={{ scale: 1.05 }}
                >
                  Coba Lagi
                </motion.button>
              </div>
            ) : data.length === 0 ? (
              <div className="text-center py-32">
                <FileText className="w-24 h-24 text-slate-600 mx-auto mb-6" />
                <p className="text-2xl text-slate-400">Tidak ada audit log ditemukan</p>
                <p className="text-slate-500 mt-4">Coba ubah filter atau tunggu aktivitas baru</p>
              </div>
            ) : (
              <>
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead className="bg-slate-800/70 backdrop-blur-sm border-b border-slate-700/50">
                      <tr>
                        <th className="px-8 py-6 text-left text-sm font-medium text-slate-300">Waktu</th>
                        <th className="px-8 py-6 text-left text-sm font-medium text-slate-300">User</th>
                        <th className="px-8 py-6 text-left text-sm font-medium text-slate-300">Action</th>
                        <th className="px-8 py-6 text-left text-sm font-medium text-slate-300">Resource</th>
                        <th className="px-8 py-6 text-left text-sm font-medium text-slate-300">IP Address</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-700/50">
                      {data.map((log) => (
                        <motion.tr
                          key={log._id}
                          className="hover:bg-slate-800/50 transition-all"
                          whileHover={{ x: 5 }}
                        >
                          <td className="px-8 py-6">
                            <div className="flex items-center gap-3">
                              <Calendar className="w-6 h-6 text-slate-400" />
                              <span className="text-white font-medium">{formatDate(log.created_at)}</span>
                            </div>
                          </td>
                          <td className="px-8 py-6">
                            {log.user_id ? (
                              <div className="flex items-center gap-4">
                                <User className="w-7 h-7 text-blue-400" />
                                <div>
                                  <p className="text-lg font-semibold text-white">{log.user_id.full_name || "-"}</p>
                                  <p className="text-sm text-slate-400">{log.user_id.email || "-"}</p>
                                </div>
                              </div>
                            ) : (
                              <span className="text-slate-400 italic">System</span>
                            )}
                          </td>
                          <td className="px-8 py-6">
                            <span className={`px-6 py-3 rounded-2xl text-lg font-bold ${getActionColor(log.action)}`}>
                              {log.action.toUpperCase()}
                            </span>
                          </td>
                          <td className="px-8 py-6">
                            <div>
                              <p className="text-lg font-medium text-white">{log.resource_type}</p>
                              <p className="text-sm text-slate-400">ID: {log.resource_id || "-"}</p>
                            </div>
                          </td>
                          <td className="px-8 py-6 text-slate-300">
                            {log.ip_address || "-"}
                          </td>
                        </motion.tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Pagination */}
                {pagination && pagination.total_pages > 1 && (
                  <motion.div 
                    className="px-8 py-6 border-t border-slate-700/50 flex flex-col sm:flex-row items-center justify-between gap-6"
                    variants={itemVariants}
                  >
                    <p className="text-slate-400">
                      Menampilkan <strong className="text-white">{((pagination.page - 1) * pagination.limit) + 1}</strong> -{" "}
                      <strong className="text-white">{Math.min(pagination.page * pagination.limit, pagination.total)}</strong> dari{" "}
                      <strong className="text-white">{pagination.total}</strong> entri
                    </p>
                    <div className="flex items-center gap-4">
                      <motion.button
                        onClick={() => handlePageChange(pagination.page - 1)}
                        disabled={pagination.page === 1}
                        className="px-6 py-4 bg-slate-800/70 rounded-2xl disabled:opacity-50 flex items-center gap-3 text-slate-300"
                        whileHover={{ scale: pagination.page === 1 ? 1 : 1.05 }}
                      >
                        <ChevronLeft className="w-6 h-6" />
                        Sebelumnya
                      </motion.button>
                      <span className="text-white font-bold text-xl">
                        {pagination.page} / {pagination.total_pages}
                      </span>
                      <motion.button
                        onClick={() => handlePageChange(pagination.page + 1)}
                        disabled={pagination.page >= pagination.total_pages}
                        className="px-6 py-4 bg-slate-800/70 rounded-2xl disabled:opacity-50 flex items-center gap-3 text-slate-300"
                        whileHover={{ scale: pagination.page >= pagination.total_pages ? 1 : 1.05 }}
                      >
                        Selanjutnya
                        <ChevronRight className="w-6 h-6" />
                      </motion.button>
                    </div>
                  </motion.div>
                )}
              </>
            )}
          </motion.div>
        </motion.div>
      </div>
    </>
  );
}