import { useState } from "react";
import { useApprovalInbox } from "../hooks/useApprovalInbox";
import ApprovalCard from "../components/ApprovalCard";
import { useAuthStore } from "../stores/useAuthStore";
import { uploadDocument, fetchUserDocuments } from "../utils/api";
import toast, { Toaster } from "react-hot-toast";
import { motion } from "framer-motion";
import { CheckCircle, XCircle, Upload, FileText, Eye, User, Clock, AlertCircle, Sparkles, ArrowRight } from "lucide-react";

const API_BASE = import.meta.env.VITE_API_BASE_URL || "http://localhost:3000/api/v1";

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

const ApprovalInbox = () => {
  const { data, loading, error, approve, reject } = useApprovalInbox();
  const { user } = useAuthStore();
  const userRole = user?.role_id?.name || "";
  const [showModal, setShowModal] = useState(false);
  const [action, setAction] = useState(null); // "approve" | "reject"
  const [approvalId, setApprovalId] = useState(null);
  const [currentApproval, setCurrentApproval] = useState(null); // objek approval aktif
  const [comments, setComments] = useState("");
  const [contractFile, setContractFile] = useState(null);
  const [contractDocuments, setContractDocuments] = useState([]);
  const [accountRequestDocuments, setAccountRequestDocuments] = useState([]);
  const [terminationDocuments, setTerminationDocuments] = useState([]);
  const [loadingDocuments, setLoadingDocuments] = useState(false);

  const resetModalState = () => {
    setShowModal(false);
    setComments("");
    setContractFile(null);
    setContractDocuments([]);
    setAccountRequestDocuments([]);
    setTerminationDocuments([]);
    setCurrentApproval(null);
  };

  const getRequestTypeLabel = (request) => {
    const type = request?.request_type;
    if (type === "account_request") return "Permintaan Akun Baru";
    if (type === "promotion") return "Perubahan Role (Promosi / Demosi)";
    if (type === "transfer") return "Perpindahan Divisi";
    if (type === "termination") return "Terminasi Karyawan";
    return type || "-";
  };

  const getRoleChangeLabel = (request) => {
    if (!request || request.request_type !== "promotion") return null;
    const oldLevel = request.user_id?.role_id?.hierarchy_level;
    const newLevel = request.requested_role?.hierarchy_level;
    if (oldLevel == null || newLevel == null) return "Perubahan Role";
    if (newLevel < oldLevel) return "Promosi";
    if (newLevel > oldLevel) return "Demosi";
    return "Perubahan Role";
  };

  const getRoleChangeClassName = (label) => {
    if (label === "Promosi") return "text-emerald-400";
    if (label === "Demosi") return "text-amber-300";
    return "text-slate-200";
  };

  const handleApprove = async (id, approval) => {
    setAction("approve");
    setApprovalId(id);
    setCurrentApproval(approval);
    console.log("approval : ", approval);
    
    if (approval?.request_id?.request_type === "account_request") {
      setLoadingDocuments(true);
      try {
        const requestId = approval.request_id?._id;
        if (requestId) {
          const allDocs = await fetchUserDocuments(requestId, {});
          setAccountRequestDocuments(allDocs.data || []);

          if (userRole === "Director" && approval.approval_level === 2) {
            const contractDocs = await fetchUserDocuments(requestId, { type: "contract" });
            setContractDocuments(contractDocs.data || []);
          }
        }
      } catch (err) {
        console.error("Failed to load documents:", err);
        toast.error("Gagal memuat dokumen");
      } finally {
        setLoadingDocuments(false);
      }
    } else if (approval?.request_id?.request_type === "termination") {
      // Tampilkan dokumen termination yang diupload saat pengajuan
      setLoadingDocuments(true);
      try {
        const userId = approval.request_id?.user_id?._id;
        if (userId) {
          const termDocs = await fetchUserDocuments(userId, { type: "termination" });
          setTerminationDocuments(termDocs.data || []);
        }
      } catch (err) {
        console.error("Failed to load termination documents:", err);
        toast.error("Gagal memuat dokumen terminasi");
      } finally {
        setLoadingDocuments(false);
      }
    }
    
    setShowModal(true);
  };

  const handleReject = async (id, approval) => {
    setAction("reject");
    setApprovalId(id);
    setCurrentApproval(approval);
    
    if (approval?.request_id?.request_type === "account_request") {
      setLoadingDocuments(true);
      try {
        const requestId = approval.request_id?._id;
        if (requestId) {
          const allDocs = await fetchUserDocuments(requestId, {});
          setAccountRequestDocuments(allDocs.data || []);
        }
      } catch (err) {
        console.error("Failed to load documents:", err);
        toast.error("Gagal memuat dokumen");
      } finally {
        setLoadingDocuments(false);
      }
    } else if (approval?.request_id?.request_type === "termination") {
      // Tetap tampilkan dokumen termination saat reviewer ingin menolak
      setLoadingDocuments(true);
      try {
        const userId = approval.request_id?.user_id?._id;
        if (userId) {
          const termDocs = await fetchUserDocuments(userId, { type: "termination" });
          setTerminationDocuments(termDocs.data || []);
        }
      } catch (err) {
        console.error("Failed to load termination documents:", err);
        toast.error("Gagal memuat dokumen terminasi");
      } finally {
        setLoadingDocuments(false);
      }
    }
    
    setShowModal(true);
  };

  const handleConfirm = async () => {
    try {
      const isManagerHR = userRole === "Manager HR";
      const isAccountRequest = currentApproval?.request_id?.request_type === "account_request";
      const isLevel1 = currentApproval?.approval_level === 1;
      
      if (action === "approve" && isManagerHR && isAccountRequest && isLevel1 && !contractFile) {
        toast.error("Harap upload dokumen contract terlebih dahulu");
        return;
      }

      if (contractFile && isManagerHR && isAccountRequest && isLevel1) {
        const formData = new FormData();
        formData.append("file", contractFile);
        formData.append("document_type", "contract");
        formData.append("account_request_id", currentApproval.request_id._id);
        formData.append("description", "Contract dari Manager HR untuk account request");
        
        await uploadDocument(formData);
      }

      if (action === "approve") {
        await approve(approvalId, comments);
        toast.success("Permintaan berhasil disetujui");
      } else {
        await reject(approvalId, comments);
        toast.success("Permintaan berhasil ditolak");
      }

      resetModalState();
    } catch (err) {
      toast.error(err.message || "Gagal memproses persetujuan");
    }
  };

  const docTypeLabels = {
    id_card: "KTP / ID Card",
    certificate: "Sertifikat / Ijazah",
    resume: "Resume / CV",
    contract: "Contract Kerja",
    termination: "Dokumen Terminasi",
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
            <h1 className="text-4xl font-bold bg-gradient-to-r from-blue-400 to-indigo-400 bg-clip-text text-transparent flex items-center gap-5">
              <CheckCircle className="w-10 h-10 text-green-400" />
              Kotak Masuk Persetujuan
            </h1>
            <p className="text-slate-400 mt-2 text-xl flex items-center gap-3">
              <Sparkles className="w-4 h-4" />
              Tinjau dan proses permintaan yang menunggu persetujuan Anda
            </p>
            <motion.p 
              className="text-xl font-medium text-blue-300 mt-2"
              initial={{ scale: 0.9 }}
              animate={{ scale: 1 }}
            >
              {data.length} permintaan menunggu tindakan
            </motion.p>
          </motion.div>

          {/* Approval Cards */}
          {loading ? (
            <div className="flex justify-center py-32">
              <motion.div animate={{ rotate: 360 }} transition={{ duration: 1, repeat: Infinity, ease: "linear" }} className="w-20 h-20 border-4 border-blue-500 border-t-transparent rounded-full" />
            </div>
          ) : error ? (
            <motion.div className="text-center py-32" variants={itemVariants}>
              <AlertCircle className="w-24 h-24 text-red-400 mx-auto mb-6" />
              <p className="text-2xl text-red-400">Error: {error}</p>
            </motion.div>
          ) : data.length === 0 ? (
            <motion.div className="text-center py-32" variants={itemVariants}>
              <CheckCircle className="w-24 h-24 text-slate-600 mx-auto mb-6" />
              <p className="text-2xl text-slate-400">
                Tidak ada permintaan persetujuan saat ini
              </p>
              <p className="text-slate-500 mt-4">
                Semua tugas Anda sudah selesai! 🎉
              </p>
            </motion.div>
          ) : (
            <motion.div className="space-y-8" variants={containerVariants} initial="hidden" animate="visible">
              {data.map((approval) => (
                <motion.div key={approval._id} variants={itemVariants}>
                  <ApprovalCard
                    approval={approval}
                    onApprove={(id) => handleApprove(id, approval)}
                    onReject={(id) => handleReject(id, approval)}
                  />
                </motion.div>
              ))}
            </motion.div>
          )}
        </motion.div>

        {/* Approval Modal */}
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
                  <h3 className="text-3xl font-bold text-white flex items-center gap-4">
                    {action === "approve" ? (
                      <>
                        <CheckCircle className="w-10 h-10 text-green-400" />
                        Setujui Permintaan
                      </>
                    ) : (
                      <>
                        <XCircle className="w-10 h-10 text-red-400" />
                        Tolak Permintaan
                      </>
                    )}
                  </h3>
                  <motion.button
                    onClick={() => {
                      resetModalState();
                    }}
                    className="text-slate-400 hover:text-white transition-colors"
                    whileHover={{ scale: 1.1 }}
                  >
                    <XCircle className="w-8 h-8" />
                  </motion.button>
                </div>

                {/* Ringkasan Permintaan (siapa, kapan, catatan) */}
                {currentApproval?.request_id && (
                  <div className="mb-8">
                    <h4 className="text-xl font-semibold text-white mb-4 flex items-center gap-3">
                      <Clock className="w-7 h-7 text-blue-400" />
                      Ringkasan Permintaan
                    </h4>
                    <div className="bg-slate-800/70 backdrop-blur-sm rounded-2xl p-6 border border-slate-700/50 space-y-3">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                          <p className="text-xs text-slate-400 uppercase tracking-wide mb-1">
                            Jenis Permintaan
                          </p>
                          <p className="text-base font-semibold text-slate-100">
                            {getRequestTypeLabel(currentApproval.request_id)}
                          </p>
                        </div>
                        <div>
                          <p className="text-xs text-slate-400 uppercase tracking-wide mb-1">
                            Diajukan Oleh
                          </p>
                          <p className="text-base font-semibold text-slate-100">
                            {currentApproval.request_id.requested_by?.full_name ||
                              "-"}
                          </p>
                        </div>
                        <div>
                          <p className="text-xs text-slate-400 uppercase tracking-wide mb-1">
                            Untuk Karyawan
                          </p>
                          <p className="text-base font-semibold text-slate-100">
                            {currentApproval.request_id.user_id?.full_name || "-"}
                          </p>
                        </div>
                        <div>
                          <p className="text-xs text-slate-400 uppercase tracking-wide mb-1">
                            Tanggal Pengajuan
                          </p>
                          <p className="text-base text-slate-100">
                            {currentApproval.request_id.created_at
                              ? new Date(
                                  currentApproval.request_id.created_at
                                ).toLocaleString("id-ID", {
                                  day: "numeric",
                                  month: "long",
                                  year: "numeric",
                                  hour: "2-digit",
                                  minute: "2-digit",
                                })
                              : "-"}
                          </p>
                        </div>
                      </div>

                      {/* Label promosi / demosi yang jelas */}
                      {currentApproval.request_id.request_type === "promotion" && (
                        <div className="pt-3 border-t border-slate-700/60">
                          {(() => {
                            const label = getRoleChangeLabel(
                              currentApproval.request_id
                            );
                            return (
                              <p className={`text-base font-semibold ${getRoleChangeClassName(label)}`}>
                                Perubahan Role: {label}
                              </p>
                            );
                          })()}
                        </div>
                      )}

                      <div className="pt-3 border-t border-slate-700/60">
                        <p className="text-xs text-slate-400 uppercase tracking-wide mb-1">
                          Catatan Pengajuan
                        </p>
                        <p className="text-sm text-slate-200 whitespace-pre-line">
                          {currentApproval.request_id.notes || "Tidak ada catatan tambahan."}
                        </p>
                      </div>
                    </div>
                  </div>
                )}

                {/* Role Information untuk Promotion/Termination */}
                {(currentApproval?.request_id?.request_type === "promotion" || 
                  currentApproval?.request_id?.request_type === "termination" || currentApproval?.request_id?.request_type === "transfer") && 
                  currentApproval?.request_id?.user_id && (
                  <div className="mb-8">
                    <h4 className="text-xl font-semibold text-white mb-4 flex items-center gap-3">
                      <User className="w-7 h-7 text-orange-400" />
                      Detail Perubahan 
                    </h4>
                    <div className="bg-slate-800/70 backdrop-blur-sm rounded-2xl p-6 border border-slate-700/50">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div>
                          {currentApproval?.request_id?.request_type === "promotion" ? (
                            <>
                              <p className="text-sm text-slate-400 mb-2">Role Saat Ini</p>
                            <p className="text-lg font-semibold text-slate-300 line-through">
                              {currentApproval.request_id.user_id.role_id.name}
                            </p>
                            </>
                          ) : currentApproval?.request_id?.request_type === "termination" ? (
                            <>
                              <p className="text-sm text-slate-400 mb-2">Status Saat Ini</p>
                              <p className="text-lg font-semibold text-slate-300 line-through">
                                {currentApproval.request_id.user_id.status}
                              </p>
                            </>
                          ) : currentApproval?.request_id?.request_type === "transfer" ? (
                            <>
                              <p className="text-sm text-slate-400 mb-2">Divisi Saat Ini</p>
                              <p className="text-lg font-semibold text-slate-300 line-through">
                                {currentApproval.request_id.user_id.division_id?.name}
                              </p>
                            </>
                          ) : <p className="text-lg font-semibold text-slate-500">Tidak ada</p>}
                        </div>
                        <div>
                          <p className="text-sm text-slate-400 mb-2">
                            {currentApproval.request_id.request_type === "termination"
                              ? "Status Tujuan"
                              : currentApproval?.request_id?.request_type === "promotion" ? "Role Tujuan" : "Divisi Tujuan"}
                          </p>
                          {currentApproval.request_id.request_type === "termination" ? (
                            <p className="text-lg font-semibold text-red-400">
                              Terminated
                            </p>
                          ) : currentApproval.request_id?.request_type === "promotion" ? (
                            <p className="text-lg font-semibold text-white">
                              {currentApproval.request_id.requested_role?.name}
                            </p>
                          ) : currentApproval?.request_id?.request_type === "transfer" ? (
                            <p className="text-lg font-semibold text-white">
                              {currentApproval.request_id.division_id?.name}
                            </p>
                          ) : <p className="text-lg font-semibold text-slate-500">Tidak ada</p>}
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {/* Dokumen Pendukung dari Requester */}
                {currentApproval?.request_id?.request_type === "account_request" && (
                  <div className="mb-8">
                    <h4 className="text-xl font-semibold text-white mb-4 flex items-center gap-3">
                      <FileText className="w-7 h-7 text-blue-400" />
                      Dokumen Pendukung dari Requester
                    </h4>
                    {loadingDocuments ? (
                      <div className="text-center py-8 text-slate-400">Memuat dokumen...</div>
                    ) : accountRequestDocuments.length > 0 ? (
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        {accountRequestDocuments
                          .filter(doc => ["id_card", "certificate", "resume"].includes(doc.document_type))
                          .map((doc) => (
                            <motion.div
                              key={doc._id}
                              className="bg-slate-800/70 backdrop-blur-sm rounded-2xl p-6 border border-slate-700/50 hover:border-blue-600/70 transition-all"
                              whileHover={{ scale: 1.03 }}
                            >
                              <div className="flex items-center justify-between mb-4">
                                <div className="flex items-center gap-3">
                                  <FileText className="w-6 h-6 text-blue-400" />
                                  <span className="font-medium text-white">
                                    {docTypeLabels[doc.document_type] || doc.document_type}
                                  </span>
                                </div>
                              </div>
                              <p className="text-sm text-slate-400 mb-4">{doc.file_name}</p>
                              <a
                                href={doc.view_url?.startsWith('/') ? `${API_BASE.replace('/api/v1', '')}${doc.view_url}` : (doc.view_url || doc.file_url)}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center gap-2 px-5 py-3 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white rounded-2xl font-medium transition-all"
                              >
                                <Eye className="w-5 h-5" />
                                Lihat Dokumen
                              </a>
                            </motion.div>
                          ))}
                      </div>
                    ) : (
                      <div className="p-6 bg-yellow-900/30 border border-yellow-700/50 rounded-2xl text-center">
                        <AlertCircle className="w-12 h-12 text-yellow-400 mx-auto mb-3" />
                        <p className="text-yellow-300">Tidak ada dokumen pendukung yang diupload</p>
                      </div>
                    )}
                  </div>
                )}

                {/* Dokumen Terminasi (diupload saat pengajuan) */}
                {currentApproval?.request_id?.request_type === "termination" && (
                  <div className="mb-8">
                    <h4 className="text-xl font-semibold text-white mb-4 flex items-center gap-3">
                      <FileText className="w-7 h-7 text-red-400" />
                      Dokumen Terminasi
                    </h4>
                    {loadingDocuments ? (
                      <div className="text-center py-8 text-slate-400">
                        Memuat dokumen terminasi...
                      </div>
                    ) : terminationDocuments.length > 0 ? (
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        {terminationDocuments.map((doc) => (
                          <motion.div
                            key={doc._id}
                            className="bg-slate-800/70 backdrop-blur-sm rounded-2xl p-6 border border-red-700/60 hover:border-red-500/80 transition-all"
                            whileHover={{ scale: 1.03 }}
                          >
                            <div className="flex items-center justify-between mb-4">
                              <div className="flex items-center gap-3">
                                <FileText className="w-6 h-6 text-red-400" />
                                <span className="font-medium text-white">
                                  {docTypeLabels[doc.document_type] || "Dokumen Terminasi"}
                                </span>
                              </div>
                            </div>
                            <p className="text-sm text-slate-400 mb-3">
                              {doc.file_name}
                            </p>
                            <p className="text-xs text-slate-500 mb-4 flex items-center gap-1">
                              <Clock className="w-4 h-4" />
                              {doc.created_at
                                ? new Date(doc.created_at).toLocaleString("id-ID", {
                                    day: "numeric",
                                    month: "short",
                                    year: "numeric",
                                    hour: "2-digit",
                                    minute: "2-digit",
                                  })
                                : "-"}
                            </p>
                            <a
                              href={
                                doc.view_url?.startsWith("/")
                                  ? `${API_BASE.replace("/api/v1", "")}${doc.view_url}`
                                  : doc.view_url || doc.file_url
                              }
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-2 px-5 py-3 bg-gradient-to-r from-red-600 to-rose-600 hover:from-red-700 hover:to-rose-700 text-white rounded-2xl font-medium transition-all"
                            >
                              <Eye className="w-5 h-5" />
                              Lihat Dokumen Terminasi
                            </a>
                          </motion.div>
                        ))}
                      </div>
                    ) : (
                      <div className="p-6 bg-slate-800/60 border border-slate-700/70 rounded-2xl text-center">
                        <AlertCircle className="w-10 h-10 text-slate-400 mx-auto mb-3" />
                        <p className="text-slate-300">
                          Tidak ada dokumen terminasi yang terlampir.
                        </p>
                      </div>
                    )}
                  </div>
                )}

                {/* Contract dari Manager HR untuk Director */}
                {action === "approve" && userRole === "Director" && contractDocuments.length > 0 && (
                  <div className="mb-8">
                    <h4 className="text-xl font-semibold text-white mb-4 flex items-center gap-3">
                      <FileText className="w-7 h-7 text-green-400" />
                      Contract Kerja dari Manager HR
                    </h4>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      {contractDocuments.map((doc) => (
                        <motion.div key={doc._id} className="bg-slate-800/70 rounded-2xl p-6 border border-green-700/50" whileHover={{ scale: 1.03 }}>
                          <p className="font-medium text-white mb-2">{doc.file_name}</p>
                          <p className="text-sm text-slate-400 mb-4">
                            {new Date(doc.created_at).toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric", hour: "2-digit", minute: "2-digit" })}
                          </p>
                          <a
                            href={doc.view_url?.startsWith('/') ? `${API_BASE.replace('/api/v1', '')}${doc.view_url}` : (doc.view_url || doc.file_url)}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-2 px-5 py-3 bg-gradient-to-r from-green-600 to-emerald-600 text-white rounded-2xl font-medium"
                          >
                            <Eye className="w-5 h-5" />
                            Lihat Contract
                          </a>
                        </motion.div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Upload Contract untuk Manager HR */}
                {action === "approve" && userRole === "Manager HR" && currentApproval?.approval_level === 1 && currentApproval?.request_id?.request_type === "account_request" && (
                  <motion.div className="mb-8" variants={itemVariants}>
                    <label className="flex items-center gap-3 text-xl font-semibold text-white mb-4">
                      <Upload className="w-8 h-8 text-indigo-400" />
                      Upload Contract Kerja <span className="text-red-400">*</span>
                    </label>
                    <div className="relative">
                      <input
                        type="file"
                        accept=".pdf,.doc,.docx"
                        onChange={(e) => setContractFile(e.target.files[0])}
                        className="hidden"
                        id="contract-upload"
                        required
                      />
                      <label
                        htmlFor="contract-upload"
                        className="flex flex-col items-center justify-center w-full h-48 bg-slate-800/50 border-2 border-dashed border-slate-600 rounded-2xl cursor-pointer hover:border-indigo-500 hover:bg-slate-800/70 transition-all group"
                      >
                        {contractFile ? (
                            <div className="flex flex-col items-center justify-center gap-2 text-center">
                            <motion.p
                              initial={{ opacity: 0 }}
                              animate={{ opacity: 1 }}
                              className="text-xl text-green-400"
                            >
                              <CheckCircle className="w-14 h-14" />
                            </motion.p>
                          
                            <motion.p
                              initial={{ opacity: 0 }}
                              animate={{ opacity: 1 }}
                              className="text-sm text-green-400"
                            >
                              {contractFile.name}
                            </motion.p>
                          </div>                          
                          ) : (
                            <Upload className="w-12 h-12 text-slate-500 group-hover:text-blue-400 mb-3 transition-colors" />
                          )}
                        <span className="text-lg text-slate-300 group-hover:text-white">
                          Klik untuk upload contract
                        </span>
                        <span className="text-sm text-slate-500 mt-2">PDF, DOC, DOCX • Max 10MB</span>
                      </label>
                    </div>
                  </motion.div>
                )}

                {/* Comments */}
                <motion.div variants={itemVariants}>
                  <label className="flex items-center gap-3 text-xl font-medium text-slate-300 mb-4">
                    <FileText className="w-7 h-7 text-blue-400" />
                    Komentar (Opsional)
                  </label>
                  <textarea
                    value={comments}
                    onChange={(e) => setComments(e.target.value)}
                    rows={5}
                    placeholder="Tambahkan catatan atau alasan keputusan Anda..."
                    className="w-full px-6 py-5 bg-slate-800/50 border border-slate-700 rounded-2xl text-white placeholder-slate-500 focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all backdrop-blur-sm resize-none"
                  />
                </motion.div>

                {/* Action Buttons */}
                <div className="flex gap-6 mt-10">
                  <motion.button
                    onClick={() => {
                      resetModalState();
                    }}
                    className="flex-1 px-8 py-5 bg-slate-800/70 border border-slate-700 rounded-2xl text-slate-300 hover:bg-slate-700/70 font-semibold transition-all"
                    whileHover={{ scale: 1.03 }}
                  >
                    Batal
                  </motion.button>

                  <motion.button
                    onClick={handleConfirm}
                    className={`flex-1 flex items-center justify-center gap-4 px-8 py-5 rounded-2xl font-bold text-xl shadow-2xl relative overflow-hidden group ${
                      action === "approve"
                        ? "bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700 text-white"
                        : "bg-gradient-to-r from-red-600 to-rose-600 hover:from-red-700 hover:to-rose-700 text-white"
                    }`}
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.98 }}
                  >
                    <motion.div
                      className="absolute inset-0 bg-gradient-to-r from-transparent via-white to-transparent opacity-0 group-hover:opacity-20"
                      animate={{ x: ["-100%", "100%"] }}
                      transition={{ duration: 1.5, repeat: Infinity, ease: "linear" }}
                    />
                    {action === "approve" ? (
                      <>
                        <CheckCircle className="w-8 h-8" />
                        Setujui Permintaan
                      </>
                    ) : (
                      <>
                        <XCircle className="w-8 h-8" />
                        Tolak Permintaan
                      </>
                    )}
                  </motion.button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </div>
    </>
  );
};

export default ApprovalInbox;