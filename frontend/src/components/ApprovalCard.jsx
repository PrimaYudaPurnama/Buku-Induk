import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { CheckCircle, XCircle, Clock, User, FileText, Eye, ChevronDown, Sparkles, BadgeAlert } from "lucide-react";
import { mapApprovalsToSteps, getWorkflowName, getStepDescription } from "../utils/workflowUtils";
import { fetchUserDocuments} from "../utils/api";

const API_BASE = import.meta.env.VITE_API_BASE_URL || "http://localhost:3000/api/v1";

const ApprovalCard = ({ approval, onApprove, onReject }) => {
  const request = approval.request_id;
  const timeline = approval.timeline || [];
  const requestType = request?.request_type || "account_request";
  const [documents, setDocuments] = useState([]);
  const [showDocuments, setShowDocuments] = useState(false);
  const [loadingDocs, setLoadingDocs] = useState(false);

  useEffect(() => {
    if (requestType === "account_request" && request?._id) {
      setLoadingDocs(true);
      fetchUserDocuments(request._id, {})
        .then((result) => {
          const accountDocs = (result.data || []).filter(
            (doc) => ["id_card", "certificate", "resume"].includes(doc.document_type)
          );
          setDocuments(accountDocs);
        })
        .catch((err) => console.error("Failed to load documents:", err))
        .finally(() => setLoadingDocs(false));
    }
  }, [requestType, request?._id]);

  const getStatusColor = (status) => {
    switch (status) {
      case "approved": return "bg-green-500/20 text-green-400 border-green-500/30";
      case "rejected": return "bg-red-500/20 text-red-400 border-red-500/30";
      case "pending": return "bg-yellow-500/20 text-yellow-400 border-yellow-500/30";
      default: return "bg-slate-700/50 text-slate-300 border-slate-600/50";
    }
  };

  const getRequestTypeColor = (type) => {
    switch (type) {
      case "promotion": return "text-blue-400 border-blue-500/50 bg-blue-500/10";
      case "termination": return "text-red-400 border-red-500/50 bg-red-500/10";
      case "transfer": return "text-purple-400 border-purple-500/50 bg-purple-500/10";
      case "account_request": return "text-green-400 border-green-500/50 bg-green-500/10";
      default: return "text-slate-400 border-slate-500/50 bg-slate-500/10";
    }
  };

  const getRequestTypeIcon = (type) => {
    switch (type) {
      case "promotion": return "📈";
      case "termination": return "🚫";
      case "transfer": return "🔄";
      case "account_request": return "✨";
      default: return "📋";
    }
  };

  const mappedTimeline = mapApprovalsToSteps(timeline || [], requestType);

  const docTypeLabels = {
    id_card: "KTP / ID Card",
    certificate: "Sertifikat / Ijazah",
    resume: "Resume / CV"
  };

  return (
    <motion.div
      className="bg-slate-900/70 backdrop-blur-md rounded-2xl border border-slate-800/70 overflow-hidden hover:border-blue-800/50 transition-all"
      whileHover={{ y: -4, boxShadow: "0 20px 40px -12px rgba(0, 0, 0, 0.4)" }}
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ type: "spring", stiffness: 300, damping: 30 }}
    >
      <div className="p-6">
        {/* Header */}
        <div className="flex items-center justify-between mb-5">
          <div className="flex items-center gap-4">
            <h3 className={`text-xl font-bold flex items-center gap-3 px-4 py-2 rounded-xl border ${getRequestTypeColor(requestType)}`}>
              <span className="text-2xl">{getRequestTypeIcon(requestType)}</span>
              {getWorkflowName(requestType)}
            </h3>
            <span className={`px-4 py-1.5 rounded-full text-sm font-medium border ${getStatusColor(approval.status)}`}>
              {approval.status.toUpperCase()}
            </span>
          </div>
          <div className="text-sm text-slate-400">
            Level <span className="font-semibold text-blue-400">{approval.approval_level}</span>
          </div>
        </div>

        <p className="text-slate-300 text-sm mb-5">
          {getStepDescription(approval, requestType)}
        </p>

        {/* Requester & Requested By Info */}
        <div className="bg-slate-800/50 rounded-xl p-4 mb-5 border border-slate-700/50">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-sm">
            <div className="flex items-center gap-3">
              <User className="w-5 h-5 text-blue-400" />
              <div>
                <p className="text-slate-400">Requester</p>
                <p className="font-medium text-white">{request?.requester_name || "N/A"}</p>
                <p className="font-medium text-white truncate">{request.email || "N/A"}</p>
              </div>
            </div>

            {/* NEW: Requested By (siapa yang mengajukan request ini) */}
            {request?.requested_by && (
              <div className="flex items-center gap-3">
                <User className="w-5 h-5 text-indigo-400" />
                <div>
                  <p className="text-slate-400">Requested By</p>
                  <p className="font-medium text-white">{request.requested_by.full_name}</p>
                  <p className="font-medium text-white">{request.requested_by.email}</p>
                </div>
              </div>
            )}

            {/* Role Information - Different display for promotion/termination vs account_request/transfer */}
            {(requestType === "promotion" || requestType === "termination") && request?.user_id ? (
              <div className="flex items-center gap-3">
                <BadgeAlert className="w-5 h-5 text-orange-400" />
                <div>
                  <p className="text-slate-400">Role Perubahan</p>
                  {request?.user_id?.role_id && (
                    <p className="font-medium text-slate-300 line-through truncate">
                      {request.user_id.role_id.name || "N/A"}
                    </p>
                  )}
                  {request?.requested_role && (
                    <p className="font-medium text-white truncate">
                      → {request.requested_role.name || "N/A"}
                    </p>
                  )}
                  {request?.user_id?.division_id && (
                    <p className="text-xs text-slate-500 truncate mt-1">
                      Divisi: {request.user_id.division_id.name || "N/A"}
                    </p>
                  )}
                </div>
              </div>
            ) : (request?.requested_role && request?.division_id) ? (
              <div className="flex items-center gap-3">
                <BadgeAlert className="w-5 h-5 text-green-400" />
                <div>
                  <p className="text-slate-400">Requested position</p>
                  <p className="font-medium text-white truncate">{request.requested_role.name}</p>
                  <p className="font-medium text-white truncate">{request.division_id.name}</p>
                </div>
              </div>
            ) : request?.requested_role ? (
              <div className="flex items-center gap-3">
                <BadgeAlert className="w-5 h-5 text-green-400" />
                <div>
                  <p className="text-slate-400">Requested Role</p>
                  <p className="font-medium text-white truncate">{request.requested_role.name}</p>
                </div>
              </div>
            ) : null}
          </div>

          {request?.notes && (
            <div className="mt-4 pt-4 border-t border-slate-700/50">
              <p className="text-xs text-slate-400 mb-1">Catatan</p>
              <p className="text-sm text-slate-200 leading-relaxed">{request.notes}</p>
            </div>
          )}
        </div>

        {/* Dokumen Pendukung - Collapsible */}
        {requestType === "account_request" && documents.length > 0 && (
          <div className="mb-5">
            <button
              onClick={() => setShowDocuments(!showDocuments)}
              className="w-full flex items-center justify-between p-3 rounded-lg bg-slate-800/40 hover:bg-slate-800/70 transition-colors"
            >
              <div className="flex items-center gap-3">
                <FileText className="w-5 h-5 text-blue-400" />
                <span className="text-white font-medium">Dokumen Pendukung ({documents.length})</span>
              </div>
              <ChevronDown className={`w-5 h-5 text-slate-400 transition-transform ${showDocuments ? "rotate-180" : ""}`} />
            </button>

            {showDocuments && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: "auto", opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                className="mt-3 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 overflow-hidden"
              >
                {documents.map((doc) => (
                  <div
                    key={doc._id}
                    className="bg-slate-800/60 rounded-lg p-4 border border-slate-700/50 hover:border-blue-600/50 transition-all"
                  >
                    <p className="font-medium text-white text-sm mb-2">
                      {docTypeLabels[doc.document_type]}
                    </p>
                    <p className="text-xs text-slate-400 mb-3 truncate">{doc.file_name}</p>
                    <a
                      href={doc.view_url?.startsWith('/') ? `${API_BASE.replace('/api/v1', '')}${doc.view_url}` : (doc.view_url || doc.file_url)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-2 text-sm text-blue-400 hover:text-blue-300 font-medium"
                    >
                      <Eye className="w-4 h-4" />
                      Lihat Dokumen
                    </a>
                  </div>
                ))}
              </motion.div>
            )}
          </div>
        )}

        {/* Action Buttons - Only if pending */}
        {approval.status === "pending" && (
          <div className="flex gap-4 pt-4 border-t border-slate-800/50">
            <motion.button
              onClick={() => onApprove(approval._id)}
              className="flex-1 flex items-center justify-center gap-2 py-3 px-5 bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700 text-white font-semibold rounded-xl transition-all"
              whileHover={{ scale: 1.03 }}
              whileTap={{ scale: 0.98 }}
            >
              <CheckCircle className="w-5 h-5" />
              Setujui
            </motion.button>

            <motion.button
              onClick={() => onReject(approval._id)}
              className="flex-1 flex items-center justify-center gap-2 py-3 px-5 bg-gradient-to-r from-red-600 to-rose-600 hover:from-red-700 hover:to-rose-700 text-white font-semibold rounded-xl transition-all"
              whileHover={{ scale: 1.03 }}
              whileTap={{ scale: 0.98 }}
            >
              <XCircle className="w-5 h-5" />
              Tolak
            </motion.button>
          </div>
        )}

        {/* Optional: Mini Timeline (bisa dikecilin atau dihapus kalau terlalu ramai) */}
        {mappedTimeline.length > 1 && (
          <div className="mt-5 pt-5 border-t border-slate-800/50">
            <p className="text-xs text-slate-400 mb-3 flex items-center gap-2">
              <Clock className="w-4 h-4" />
              Progress Persetujuan
            </p>
            <div className="flex items-center gap-2">
              {mappedTimeline.map((step, i) => (
                <motion.div 
                  key={`${approval._id}-${step.approval_level}-${i}`}
                  className="flex items-center"
                  initial={{ opacity: 0, scale: 0.8 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: i * 0.1, duration: 0.3 }}
                >
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold ${
                    step.status === "approved" ? "bg-green-500/80 text-white" :
                    step.status === "rejected" ? "bg-red-500/80 text-white" :
                    step.approval_level === approval.approval_level ? "bg-blue-500/80 text-white ring-2 ring-blue-400" :
                    "bg-slate-700 text-slate-400"
                  }`}>
                    {step.approval_level}
                  </div>
                  {i < mappedTimeline.length - 1 && (
                    <div className="w-12 h-0.5 bg-slate-700" />
                  )}
                </motion.div>
              ))}
            </div>
          </div>
        )}
      </div>
    </motion.div>
  );
};

export default ApprovalCard;