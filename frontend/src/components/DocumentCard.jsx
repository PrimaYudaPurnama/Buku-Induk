import { motion } from "framer-motion";
import { Eye, Download, FileText, Calendar, Info, AlertCircle } from "lucide-react";

const DocumentCard = ({ document, onView, onDownload }) => {
  const getDocumentTypeLabel = (type) => {
    const labels = {
      contract: "Contract",
      id_card: "ID Card",
      certificate: "Certificate",
      certification: "Certification",
      resume: "Resume / CV",
      performance_review: "Performance Review",
      disciplinary: "Disciplinary",
      resignation: "Resignation",
      termination: "Termination",
      other: "Other",
    };
    return labels[type] || type;
  };

  const getTypeColor = (type) => {
    const colors = {
      contract: "from-blue-600 to-indigo-600",
      id_card: "from-cyan-600 to-blue-600",
      certificate: "from-green-600 to-emerald-600",
      certification: "from-green-600 to-emerald-600",
      resume: "from-purple-600 to-violet-600",
      performance_review: "from-purple-600 to-pink-600",
      disciplinary: "from-orange-600 to-red-600",
      resignation: "from-gray-600 to-slate-600",
      termination: "from-red-600 to-rose-600",
      other: "from-slate-600 to-gray-600",
    };
    return colors[type] || "from-slate-600 to-gray-600";
  };

  const formatFileSize = (bytes) => {
    if (!bytes) return "Unknown";
    if (bytes < 1024) return bytes + " B";
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + " KB";
    return (bytes / (1024 * 1024)).toFixed(1) + " MB";
  };

  const formatDate = (dateString) => {
    if (!dateString) return "N/A";
    return new Date(dateString).toLocaleDateString("id-ID", {
      year: "numeric",
      month: "long",
      day: "numeric",
    });
  };

  const gradientClass = getTypeColor(document.document_type);

  return (
    <motion.div
      className="bg-slate-900/80 backdrop-blur-xl rounded-3xl shadow-2xl border border-slate-700/50 overflow-hidden relative group"
      whileHover={{ scale: 1.03, y: -8 }}
      transition={{ type: "spring", stiffness: 300 }}
    >
      {/* Gradient Top Bar */}
      <div className={`h-2 bg-gradient-to-r ${gradientClass}`} />

      <div className="p-6">
        {/* Header */}
        <div className="flex items-start justify-between mb-4">
          <div className="flex items-center gap-4">
            <div className={`w-14 h-14 bg-gradient-to-br ${gradientClass} rounded-2xl flex items-center justify-center shadow-lg`}>
              <FileText className="w-8 h-8 text-white" />
            </div>
            <div>
              <h4 className="text-xl font-bold text-white">
                {getDocumentTypeLabel(document.document_type)}
              </h4>
              <p className="text-sm text-slate-400 mt-1 truncate max-w-xs">
                {document.file_name}
              </p>
            </div>
          </div>

          {/* <span className={`px-4 py-2 bg-slate-800/70 backdrop-blur-sm border border-slate-600/50 rounded-2xl text-xs font-medium text-slate-300`}>
            {document.document_type.replace("_", " ").toUpperCase()}
          </span> */}
        </div>

        {/* Description */}
        {document.description && (
          <div className="mb-5 p-4 bg-slate-800/50 rounded-2xl border border-slate-700/30">
            <div className="flex items-start gap-3">
              <Info className="w-5 h-5 text-slate-400 mt-0.5 flex-shrink-0" />
              <p className="text-sm text-slate-300 leading-relaxed">
                {document.description}
              </p>
            </div>
          </div>
        )}

        {/* Metadata */}
        <div className="grid grid-cols-2 gap-4 mb-6">
          <div className="flex items-center gap-3 text-slate-400">
            <FileText className="w-5 h-5" />
            <span className="text-sm">{formatFileSize(document.file_size)}</span>
          </div>
          <div className="flex items-center gap-3 text-slate-400">
            <Calendar className="w-5 h-5" />
            <span className="text-sm">{formatDate(document.created_at)}</span>
          </div>
        </div>

        {/* Actions */}
        <div className="flex gap-4">
          {onView && (
            <motion.button
              onClick={() => onView(document)}
              className="flex-1 flex items-center justify-center gap-3 px-6 py-4 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white font-semibold rounded-2xl shadow-lg relative overflow-hidden group/button"
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
            >
              <motion.div
                className="absolute inset-0 bg-gradient-to-r from-transparent via-white to-transparent opacity-0 group-hover/button:opacity-20"
                animate={{ x: ["-100%", "100%"] }}
                transition={{ duration: 1.5, repeat: Infinity, ease: "linear" }}
              />
              <Eye className="w-6 h-6" />
              Lihat Dokumen
            </motion.button>
          )}

          {/* {onDownload && (
            <motion.button
              onClick={() => onDownload(document)}
              className="flex-1 flex items-center justify-center gap-3 px-6 py-4 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white font-semibold rounded-2xl shadow-lg relative overflow-hidden group/button"
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
            >
              <motion.div
                className="absolute inset-0 bg-gradient-to-r from-transparent via-white to-transparent opacity-0 group-hover/button:opacity-20"
                animate={{ x: ["-100%", "100%"] }}
                transition={{ duration: 1.5, repeat: Infinity, ease: "linear" }}
              />
              <Download className="w-6 h-6" />
              Download
            </motion.button>
          )} */}
        </div>

        {/* Hover Glow Effect */}
        <motion.div
          className="absolute inset-0 rounded-3xl pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity"
          initial={{ boxShadow: "0 0 0 0 rgba(59, 130, 246, 0)" }}
          whileHover={{ boxShadow: "0 0 30px 5px rgba(59, 130, 246, 0.3)" }}
        />
      </div>
    </motion.div>
  );
};

export default DocumentCard;