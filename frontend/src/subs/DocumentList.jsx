import { useState, useEffect } from "react";
import { useAuthStore } from "../stores/useAuthStore";
import { fetchUserDocuments, fetchUsers, fetchDivisions } from "../utils/api";
import DocumentCard from "../components/DocumentCard";
import { motion } from "framer-motion";
import { Sparkles, User, FileText, Search } from "lucide-react";
import toast, { Toaster } from "react-hot-toast";

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

const DocumentList = () => {
  const API_BASE = import.meta.env.VITE_API_BASE_URL || "http://localhost:3000/api/v1";
  const { user } = useAuthStore();
  const [documents, setDocuments] = useState([]);
  const [divisions, setDivisions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedType, setSelectedType] = useState("");
  const [selectedUserId, setSelectedUserId] = useState(user?._id || "");
  const [users, setUsers] = useState([]);

  useEffect(() => {
    const loadUsers = async () => {
      try {
        const result = await fetchUsers({ page: 1, pageSize: 200 });
        setUsers(result.data || []);
      } catch (err) {
        console.error("Failed to load users:", err);
        toast.error("Gagal memuat daftar user");
      }
    };
    loadUsers();

    const loadDivisions = async () => {
      try {
        const res = await fetchDivisions();
        setDivisions(res.data || []);
      } catch (err) {
        toast.error("Gagal memuat data divisi");
      }
    };
    loadDivisions();
  }, []);

  useEffect(() => {
    const loadDocuments = async () => {
      if (!selectedUserId) {
        setDocuments([]);
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        const result = await fetchUserDocuments(selectedUserId, {
          type: selectedType || undefined,
        });
        setDocuments(result.data || []);
        setError(null);
      } catch (err) {
        setError(err.message || "Gagal memuat dokumen");
        toast.error("Gagal memuat dokumen");
      } finally {
        setLoading(false);
      }
    };

    loadDocuments();
  }, [selectedUserId, selectedType]);

  const handleView = (document) => {
    const viewUrl = document.view_url?.startsWith("/")
      ? `${API_BASE.replace("/api/v1", "")}${document.view_url}`
      : document.view_url || document.file_url;
    window.open(viewUrl, "_blank");
  };

  const permissions = user?.role_id?.permissions || [];
  const canViewAny = permissions.includes("user:read:any");
  const canViewOwnDivision = permissions.includes("user:read:own_division");
  const canViewSelf = permissions.includes("user:read:self");

  const filteredUsers = users.filter((u) => {
    if (canViewAny) return true;
    if (canViewOwnDivision) {
      const managedDivision = divisions.find(d => d.manager_id?._id === user?._id);
      if (managedDivision && u.division_id?._id === managedDivision._id) return true;
    }
    if (canViewSelf && u._id === user?._id) return true;
    return false;
  });

  const currentUserName = users.find(u => u._id === selectedUserId)?.full_name || "User";

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
            <h1 className="text-4xl font-bold bg-gradient-to-r from-blue-400 to-indigo-400 bg-clip-text text-transparent flex items-center gap-4">
              <FileText className="w-12 h-12 text-blue-400" />
              Dokumen Karyawan
            </h1>
            <p className="text-slate-400 mt-3 text-lg flex items-center gap-2">
              <Sparkles className="w-5 h-5" />
              Lihat dan unduh dokumen resmi karyawan
            </p>
          </motion.div>

          {/* Filter Card */}
          <motion.div 
            className="bg-slate-900/80 backdrop-blur-xl rounded-3xl shadow-2xl border border-blue-900/50 p-8 mb-10"
            variants={itemVariants}
          >
            <div className="flex flex-col lg:flex-row gap-6 items-end">
              {(canViewAny || canViewOwnDivision || canViewSelf) && (
                <div className="flex-1">
                  <label className="block text-sm font-medium text-slate-300 mb-3 flex items-center gap-2">
                    <User className="w-5 h-5 text-blue-400" />
                    Pilih Karyawan
                  </label>
                  <select
                    value={selectedUserId}
                    onChange={(e) => setSelectedUserId(e.target.value)}
                    className="w-full px-6 py-4 bg-slate-800/50 border border-slate-700 rounded-2xl text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all backdrop-blur-sm"
                  >
                    <option value="">-- Pilih Karyawan --</option>
                    {filteredUsers.map((u) => (
                      <option key={u._id} value={u._id}>
                        {u.full_name} ({u.email}) — {u.role_id?.name || "No Role"}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {selectedUserId && (
                <div className="flex-1">
                  <label className="block text-sm font-medium text-slate-300 mb-3 flex items-center gap-2">
                    <Search className="w-5 h-5 text-blue-400" />
                    Filter Tipe Dokumen
                  </label>
                  <select
                    value={selectedType}
                    onChange={(e) => setSelectedType(e.target.value)}
                    className="w-full px-6 py-4 bg-slate-800/50 border border-slate-700 rounded-2xl text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all backdrop-blur-sm"
                  >
                    <option value="">Semua Tipe</option>
                    <option value="contract">Contract</option>
                    <option value="id_card">ID Card</option>
                    <option value="certificate">Certificate</option>
                    <option value="performance_review">Performance Review</option>
                    <option value="disciplinary">Disciplinary</option>
                    <option value="resignation">Resignation</option>
                    <option value="termination">Termination</option>
                  </select>
                </div>
              )}
            </div>

            {selectedUserId && (
              <motion.div 
                className="mt-6 pt-6 border-t border-slate-700/50"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
              >
                <p className="text-slate-300 text-lg">
                  Menampilkan dokumen untuk: <span className="font-semibold text-white">{currentUserName}</span>
                </p>
              </motion.div>
            )}
          </motion.div>

          {/* Content */}
          {!selectedUserId ? (
            <motion.div 
              className="text-center py-32"
              variants={itemVariants}
            >
              <FileText className="w-24 h-24 text-slate-600 mx-auto mb-6" />
              <p className="text-xl text-slate-400">
                {filteredUsers.length > 0 
                  ? "Pilih karyawan dari dropdown di atas untuk melihat dokumen"
                  : "Anda tidak memiliki akses untuk melihat dokumen karyawan lain"}
              </p>
            </motion.div>
          ) : loading ? (
            <div className="flex justify-center py-32">
              <motion.div 
                animate={{ rotate: 360 }} 
                transition={{ duration: 1, repeat: Infinity, ease: "linear" }} 
                className="w-20 h-20 border-4 border-blue-500 border-t-transparent rounded-full" 
              />
            </div>
          ) : error ? (
            <motion.div 
              className="text-center py-32"
              variants={itemVariants}
            >
              <AlertCircle className="w-24 h-24 text-red-400 mx-auto mb-6" />
              <p className="text-xl text-red-400">Error: {error}</p>
            </motion.div>
          ) : documents.length === 0 ? (
            <motion.div 
              className="text-center py-32"
              variants={itemVariants}
            >
              <FileText className="w-24 h-24 text-slate-600 mx-auto mb-6" />
              <p className="text-xl text-slate-400">
                Tidak ada dokumen tersedia untuk <span className="font-semibold text-white">{currentUserName}</span>
              </p>
              {selectedType && (
                <p className="text-slate-500 mt-3">
                  Coba hapus filter tipe dokumen atau pilih karyawan lain.
                </p>
              )}
            </motion.div>
          ) : (
            <motion.div 
              className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-8"
              variants={containerVariants}
              initial="hidden"
              animate="visible"
            >
              {documents.map((doc, index) => (
                <motion.div
                  key={doc._id}
                  variants={itemVariants}
                  transition={{ delay: index * 0.05 }}
                >
                  <DocumentCard
                    document={doc}
                    onView={handleView}
                  />
                </motion.div>
              ))}
            </motion.div>
          )}
        </motion.div>
      </div>
    </>
  );
};

export default DocumentList;