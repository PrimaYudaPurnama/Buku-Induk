import { useState, useEffect } from "react";
import { useCreateAccountRequest } from "../hooks/useAccountRequests";
import { fetchDivisions, uploadDocument } from "../utils/api";
import toast, { Toaster } from "react-hot-toast";
import { motion } from "framer-motion";
import { Sparkles, User, Mail, Phone, Building2, FileText, Upload, Send, Loader2, CheckCircle } from "lucide-react";
import WorkflowPreview from "../components/WorkflowPreview";

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

const AccountRequestForm = () => {
  const [formData, setFormData] = useState({
    requester_name: "",
    email: "",
    phone: "",
    requested_role: "692fb92f9411b0f083edbbbb", // Staff role
    division_id: "",
    request_type: "account_request",
    notes: "",
  });
  const [documents, setDocuments] = useState({
    id_card: null,
    certificate: null,
    resume: null,
  });
  const [divisions, setDivisions] = useState([]);
  const [loading, setLoading] = useState(false);
  const { create } = useCreateAccountRequest();

  useEffect(() => {
    const loadDivisions = async () => {
      try {
        const result = await fetchDivisions({ limit: 100 });
        setDivisions(result.data || []);
      } catch (err) {
        toast.error("Gagal memuat data divisi");
      }
    };
    loadDivisions();
  }, []);

  const handleFileChange = (type, file) => {
    if (file) {
      setDocuments((prev) => ({
        ...prev,
        [type]: file,
      }));
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (loading) return;

    try {
      setLoading(true);
      
      const requestResult = await create(formData);
      const requestId = requestResult.data?._id;
      
      if (!requestId) {
        throw new Error("Gagal mendapatkan ID permintaan");
      }

      const uploadPromises = [];
      const docTypes = {
        id_card: "id_card",
        certificate: "certificate",
        resume: "resume"
      };

      Object.entries(documents).forEach(([key, file]) => {
        if (file) {
          const formDataDoc = new FormData();
          formDataDoc.append("file", file);
          formDataDoc.append("document_type", docTypes[key]);
          formDataDoc.append("account_request_id", requestId);
          formDataDoc.append("description", `Dokumen ${docTypes[key]} untuk account request`);
          uploadPromises.push(uploadDocument(formDataDoc));
        }
      });

      if (uploadPromises.length > 0) {
        await Promise.all(uploadPromises);
      }

      toast.success("Permintaan akun berhasil dibuat dan dikirim untuk persetujuan!");
      
      // Reset form
      setFormData({
        requester_name: "",
        email: "",
        phone: "",
        requested_role: "692fb92f9411b0f083edbbbb",
        division_id: "",
        request_type: "account_request",
        notes: "",
      });
      setDocuments({ id_card: null, certificate: null, resume: null });
    } catch (err) {
      toast.error(err.message || "Gagal membuat permintaan akun");
    } finally {
      setLoading(false);
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
          className="max-w-4xl mx-auto relative z-10"
          variants={containerVariants}
          initial="hidden"
          animate="visible"
        >
          {/* Header */}
          <motion.div variants={itemVariants} className="text-center mb-12">
            <h1 className="text-5xl font-bold bg-gradient-to-r from-blue-400 to-indigo-400 bg-clip-text text-transparent flex items-center justify-center gap-5">
              {/* <UserPlus className="w-14 h-14 text-blue-400" /> */}
              Buat Permintaan Akun Baru
            </h1>
            <p className="text-slate-400 mt-4 text-xl flex items-center justify-center gap-3">
              <Sparkles className="w-6 h-6" />
              Isi data lengkap dan unggah dokumen pendukung
            </p>
          </motion.div>

          {/* Form Card */}
          <motion.div 
            className="bg-slate-900/80 backdrop-blur-xl rounded-3xl shadow-2xl border border-blue-900/50 p-10"
            variants={itemVariants}
          >
            <form onSubmit={handleSubmit} className="space-y-8">
              {/* Personal Info */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                <motion.div variants={itemVariants}>
                  <label className="flex items-center gap-3 text-lg font-medium text-slate-300 mb-3">
                    <User className="w-6 h-6 text-blue-400" />
                    Nama Lengkap
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.requester_name}
                    onChange={(e) => setFormData({ ...formData, requester_name: e.target.value })}
                    className="w-full px-6 py-4 bg-slate-800/50 border border-slate-700 rounded-2xl text-white placeholder-slate-500 focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all backdrop-blur-sm"
                    placeholder="Masukkan nama lengkap"
                  />
                </motion.div>

                <motion.div variants={itemVariants}>
                  <label className="flex items-center gap-3 text-lg font-medium text-slate-300 mb-3">
                    <Mail className="w-6 h-6 text-blue-400" />
                    Email
                  </label>
                  <input
                    type="email"
                    required
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    className="w-full px-6 py-4 bg-slate-800/50 border border-slate-700 rounded-2xl text-white placeholder-slate-500 focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all backdrop-blur-sm"
                    placeholder="email@contoh.com"
                  />
                </motion.div>

                <motion.div variants={itemVariants}>
                  <label className="flex items-center gap-3 text-lg font-medium text-slate-300 mb-3">
                    <Phone className="w-6 h-6 text-blue-400" />
                    Nomor Telepon
                  </label>
                  <input
                    type="tel"
                    value={formData.phone}
                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                    className="w-full px-6 py-4 bg-slate-800/50 border border-slate-700 rounded-2xl text-white placeholder-slate-500 focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all backdrop-blur-sm"
                    placeholder="+62 812 3456 7890"
                  />
                </motion.div>

                <motion.div variants={itemVariants}>
                  <label className="flex items-center gap-3 text-lg font-medium text-slate-300 mb-3">
                    <Building2 className="w-6 h-6 text-indigo-400" />
                    Divisi yang Diinginkan
                  </label>
                  <select
                    required
                    value={formData.division_id}
                    onChange={(e) => setFormData({ ...formData, division_id: e.target.value })}
                    className="w-full px-6 py-4 bg-slate-800/50 border border-slate-700 rounded-2xl text-white focus:ring-2 focus:ring-blue-500 backdrop-blur-sm"
                  >
                    <option value="">Pilih Divisi</option>
                    {divisions.map((div) => (
                      <option key={div._id} value={div._id}>
                        {div.name}
                      </option>
                    ))}
                  </select>
                </motion.div>
              </div>

              {/* Notes */}
              <motion.div variants={itemVariants}>
                <label className="flex items-center gap-3 text-lg font-medium text-slate-300 mb-3">
                  <FileText className="w-6 h-6 text-blue-400" />
                  Catatan Tambahan (Opsional)
                </label>
                <textarea
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  rows={5}
                  className="w-full px-6 py-4 bg-slate-800/50 border border-slate-700 rounded-2xl text-white placeholder-slate-500 focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all backdrop-blur-sm resize-none"
                  placeholder="Tulis alasan atau informasi tambahan mengapa Anda mengajukan akun ini..."
                />
              </motion.div>

              {/* Documents Section */}
              <motion.div variants={itemVariants}>
                <h3 className="text-2xl font-bold text-white mb-6 flex items-center gap-3">
                  <Upload className="w-8 h-8 text-indigo-400" />
                  Dokumen Pendukung
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                  {[
                    { key: "id_card", label: "KTP / ID Card", icon: User },
                    { key: "certificate", label: "Sertifikat / Ijazah", icon: FileText },
                    { key: "resume", label: "Resume / CV", icon: FileText },
                  ].map(({ key, label, icon: Icon }) => (
                    <div key={key} className="space-y-3">
                      <label className="flex items-center gap-3 text-lg font-medium text-slate-300">
                        <Icon className="w-6 h-6 text-blue-400" />
                        {label}
                      </label>
                      <div className="relative">
                        <input
                          type="file"
                          accept={key === "resume" ? ".pdf,.doc,.docx" : ".pdf,.jpg,.jpeg,.png"}
                          onChange={(e) => handleFileChange(key, e.target.files[0])}
                          className="hidden"
                          id={`file-${key}`}
                        />
                        <label
                          htmlFor={`file-${key}`}
                          className="flex flex-col items-center justify-center w-full h-48 bg-slate-800/50 border-2 border-dashed border-slate-600 rounded-2xl cursor-pointer hover:border-blue-500 hover:bg-slate-800/70 transition-all group"
                        >
                          
                          {documents[key] ? (
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
                              {documents[key].name}
                            </motion.p>
                          </div>                          
                          ) : (
                            <Upload className="w-12 h-12 text-slate-500 group-hover:text-blue-400 mb-3 transition-colors" />
                          )}

                          <span className="text-slate-400 group-hover:text-white">
                            Klik untuk unggah
                          </span>
                          <span className="text-xs text-slate-500 mt-1">
                            {key === "resume" ? "PDF, DOC, DOCX" : "PDF, JPG, PNG"}
                          </span>
                        </label>
                      </div>
                    </div>
                  ))}
                </div>
              </motion.div>

              {/* Workflow Preview */}
              <motion.div variants={itemVariants} className="mt-10">
                <WorkflowPreview requestType={formData.request_type} />
              </motion.div>

              {/* Submit Button */}
              <motion.div 
                className="pt-8"
                variants={itemVariants}
              >
                <motion.button
                  type="submit"
                  disabled={loading}
                  className="w-full flex items-center justify-center gap-4 px-8 py-6 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white text-xl font-semibold rounded-3xl shadow-2xl disabled:opacity-50 disabled:cursor-not-allowed relative overflow-hidden group"
                  whileHover={{ scale: loading ? 1 : 1.03 }}
                  whileTap={{ scale: loading ? 1 : 0.98 }}
                >
                  <motion.div
                    className="absolute inset-0 bg-gradient-to-r from-transparent via-white to-transparent opacity-0 group-hover:opacity-20"
                    animate={{ x: ["-100%", "100%"] }}
                    transition={{ duration: 1.5, repeat: Infinity, ease: "linear" }}
                  />
                  {loading ? (
                    <>
                      <Loader2 className="w-8 h-8 animate-spin" />
                      Mengirim Permintaan...
                    </>
                  ) : (
                    <>
                      <Send className="w-8 h-8" />
                      Kirim Permintaan Akun
                    </>
                  )}
                </motion.button>
              </motion.div>
            </form>
          </motion.div>
        </motion.div>
      </div>
    </>
  );
};

export default AccountRequestForm;