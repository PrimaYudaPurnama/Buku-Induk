import { useState } from "react";
import { motion } from "framer-motion";
import { CheckCircle, XCircle, ChevronRight } from "lucide-react";
import { getWorkflowName } from "../utils/workflowUtils";

const ApprovalCard = ({ approval, onApprove, onReject }) => {
  const request = approval.request_id;
  const requestType = request?.request_type || "account_request";

  const getRequestTypeColor = (type) => {
    switch (type) {
      case "promotion": return "text-blue-400 bg-blue-500/10";
      case "termination": return "text-red-400 bg-red-500/10";
      case "transfer": return "text-purple-400 bg-purple-500/10";
      case "account_request": return "text-green-400 bg-green-500/10";
      default: return "text-slate-400 bg-slate-500/10";
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

  const getStatusColor = (status) => {
    switch (status) {
      case "approved": return "bg-green-500/20 text-green-400 border-green-500/30";
      case "rejected": return "bg-red-500/20 text-red-400 border-red-500/30";
      case "pending": return "bg-yellow-500/20 text-yellow-400 border-yellow-500/30";
      default: return "bg-slate-700/50 text-slate-300 border-slate-600/50";
    }
  };

  return (
    <motion.div
      className="bg-slate-900/70 backdrop-blur-md rounded-xl border border-slate-800/70 overflow-hidden hover:border-blue-800/50 transition-all cursor-pointer"
      whileHover={{ y: -2, boxShadow: "0 10px 30px -10px rgba(0, 0, 0, 0.3)" }}
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ type: "spring", stiffness: 300, damping: 30 }}
    >
      <div className="p-5">
        {/* Header dengan Nama & Jenis Request */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex-1">
            <h3 className="text-lg font-bold text-white mb-2">
              {request?.requester_name || request?.requested_by?.full_name || "N/A"}
            </h3>
            <div className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-lg ${getRequestTypeColor(requestType)}`}>
              <span className="text-lg">{getRequestTypeIcon(requestType)}</span>
              <span className="text-sm font-semibold">{getWorkflowName(requestType)}</span>
            </div>
          </div>
          
          <div className="flex items-center gap-3">
            <span className={`px-3 py-1 rounded-full text-xs font-medium border ${getStatusColor(approval.status)}`}>
              {approval.status.toUpperCase()}
            </span>
            <ChevronRight className="w-5 h-5 text-slate-400" />
          </div>
        </div>

        {/* Action Buttons - Hanya jika pending */}
        {approval.status === "pending" && (
          <div className="flex gap-3 mt-4 pt-4 border-t border-slate-800/50">
            <motion.button
              onClick={(e) => {
                e.stopPropagation();
                onApprove(approval._id);
              }}
              className="flex-1 flex items-center justify-center gap-2 py-2.5 px-4 bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700 text-white font-semibold rounded-lg transition-all"
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
            >
              <CheckCircle className="w-4 h-4" />
              Setujui
            </motion.button>

            <motion.button
              onClick={(e) => {
                e.stopPropagation();
                onReject(approval._id);
              }}
              className="flex-1 flex items-center justify-center gap-2 py-2.5 px-4 bg-gradient-to-r from-red-600 to-rose-600 hover:from-red-700 hover:to-rose-700 text-white font-semibold rounded-lg transition-all"
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
            >
              <XCircle className="w-4 h-4" />
              Tolak
            </motion.button>
          </div>
        )}
      </div>
    </motion.div>
  );
};

export default ApprovalCard;