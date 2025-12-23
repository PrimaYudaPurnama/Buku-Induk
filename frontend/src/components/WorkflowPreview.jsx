import { motion } from "framer-motion";
import { CheckCircle, Clock, User, Sparkles, ArrowRight } from "lucide-react";
import { getExpectedWorkflowSteps, getWorkflowName } from "../utils/workflowUtils";

const containerVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0, transition: { staggerChildren: 0.1 } }
};

const stepVariants = {
  hidden: { opacity: 0, x: -30 },
  visible: { opacity: 1, x: 0, transition: { type: "spring", stiffness: 100 } }
};

const WorkflowPreview = ({ requestType }) => {
  const steps = getExpectedWorkflowSteps(requestType);

  if (!steps || steps.length === 0) {
    return null;
  }

  const workflowName = getWorkflowName(requestType);

  return (
    <motion.div
      className="bg-slate-900/80 backdrop-blur-xl rounded-3xl shadow-2xl border border-blue-900/50 p-8 mt-10"
      variants={containerVariants}
      initial="hidden"
      animate="visible"
    >
      {/* Header */}
      <div className="flex items-center gap-4 mb-6">
        <div className="w-12 h-12 bg-gradient-to-br from-blue-600 to-indigo-600 rounded-2xl flex items-center justify-center shadow-lg">
          <Clock className="w-7 h-7 text-white" />
        </div>
        <div>
          <h4 className="text-2xl font-bold text-white flex items-center gap-3">
            Alur Persetujuan
            <Sparkles className="w-6 h-6 text-blue-400" />
          </h4>
          <p className="text-slate-400 mt-1">
            Request <span className="font-semibold text-blue-300">{workflowName}</span> akan melalui{" "}
            <strong className="text-white">{steps.length}</strong> level persetujuan
          </p>
        </div>
      </div>

      {/* Steps */}
      <div className="space-y-5">
        {steps.map((step, index) => (
          <motion.div
            key={index}
            variants={stepVariants}
            className="relative bg-slate-800/70 backdrop-blur-sm rounded-2xl p-6 border border-slate-700/50 hover:border-blue-600/70 transition-all group"
            whileHover={{ scale: 1.02 }}
          >
            {/* Connector Line */}
            {index < steps.length - 1 && (
              <div className="absolute left-12 top-20 w-0.5 h-12 bg-gradient-to-b from-blue-600/50 to-transparent" />
            )}

            <div className="flex items-center gap-6">
              {/* Level Badge */}
              <div className="flex-shrink-0 w-14 h-14 bg-gradient-to-br from-blue-600 to-indigo-600 rounded-2xl flex items-center justify-center shadow-xl">
                <span className="text-2xl font-bold text-white">{step.level}</span>
              </div>

              {/* Content */}
              <div className="flex-1">
                <div className="flex items-center gap-3 mb-2">
                  <User className="w-6 h-6 text-blue-400" />
                  <h5 className="text-xl font-semibold text-white">{step.approver_role}</h5>
                  {index === 0 && (
                    <span className="px-3 py-1 bg-blue-900/50 border border-blue-700/50 rounded-xl text-xs font-medium text-blue-300 backdrop-blur-sm">
                      Langkah Pertama
                    </span>
                  )}
                </div>
                <p className="text-slate-300 leading-relaxed">{step.description}</p>
              </div>

              {/* Check Icon */}
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ delay: index * 0.1 + 0.3 }}
              >
                <CheckCircle className="w-10 h-10 text-green-400/70 group-hover:text-green-400 transition-colors" />
              </motion.div>
            </div>

            {/* Arrow to next step */}
            {index < steps.length - 1 && (
              <motion.div
                className="absolute -bottom-8 left-12"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.5 }}
              >
                <ArrowRight className="w-8 h-8 text-blue-500/50" />
              </motion.div>
            )}
          </motion.div>
        ))}
      </div>

      {/* Footer Note */}
      <motion.p 
        className="text-sm text-slate-400 mt-8 flex items-center gap-2 italic"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.6 }}
      >
        <Sparkles className="w-4 h-4 text-blue-400" />
        Setiap level harus disetujui secara berurutan sebelum melanjutkan ke level berikutnya
      </motion.p>
    </motion.div>
  );
};

export default WorkflowPreview;