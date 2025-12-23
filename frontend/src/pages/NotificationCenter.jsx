import { useNotifications } from "../hooks/useNotifications";
import { useState } from "react";
import toast, { Toaster } from "react-hot-toast";
import { motion } from "framer-motion";
import { Bell, CheckCircle, Clock, AlertCircle, Sparkles, ArrowRight } from "lucide-react";

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

const NotificationCenter = () => {
  const [unreadOnly, setUnreadOnly] = useState(false);
  const { data, loading, error, unreadCount, markRead, markAllRead } =
    useNotifications({ unread_only: unreadOnly });

  const handleMarkRead = async (notificationId) => {
    try {
      await markRead(notificationId);
      toast.success("Notifikasi ditandai sebagai dibaca");
    } catch (err) {
      toast.error(err.message || "Gagal menandai notifikasi");
    }
  };

  const handleMarkAllRead = async () => {
    try {
      await markAllRead();
      toast.success("Semua notifikasi ditandai sebagai dibaca");
    } catch (err) {
      toast.error(err.message || "Gagal menandai semua notifikasi");
    }
  };

  const formatDate = (dateString) => {
    if (!dateString) return "N/A";
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now - date;
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 60) return `${diffMins} menit lalu`;
    if (diffHours < 24) return `${diffHours} jam lalu`;
    if (diffDays < 7) return `${diffDays} hari lalu`;

    return date.toLocaleDateString("id-ID", {
      year: "numeric",
      month: "long",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit"
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
          className="max-w-5xl mx-auto relative z-10"
          variants={containerVariants}
          initial="hidden"
          animate="visible"
        >
          {/* Header */}
          <motion.div variants={itemVariants} className="mb-10">
            <h1 className="text-5xl font-bold bg-gradient-to-r from-blue-400 to-indigo-400 bg-clip-text text-transparent flex items-center gap-5">
              <Bell className="w-14 h-14 text-blue-400" />
              Pusat Notifikasi
            </h1>
            <p className="text-slate-400 mt-4 text-xl flex items-center gap-3">
              <Sparkles className="w-6 h-6" />
              Pantau semua aktivitas dan pengumuman penting
            </p>
            {unreadCount > 0 && (
              <motion.p 
                className="text-2xl font-medium text-blue-400 mt-4"
                initial={{ scale: 0.8 }}
                animate={{ scale: 1 }}
                transition={{ type: "spring", stiffness: 200 }}
              >
                {unreadCount} notifikasi belum dibaca
              </motion.p>
            )}
          </motion.div>

          {/* Controls Card */}
          <motion.div 
            className="bg-slate-900/80 backdrop-blur-xl rounded-3xl shadow-2xl border border-blue-900/50 p-8 mb-10"
            variants={itemVariants}
          >
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-6">
              <div className="flex items-center gap-6">
                <label className="flex items-center gap-4 cursor-pointer">
                  <motion.div 
                    className="relative"
                    whileHover={{ scale: 1.1 }}
                    whileTap={{ scale: 0.95 }}
                  >
                    <input
                      type="checkbox"
                      checked={unreadOnly}
                      onChange={(e) => setUnreadOnly(e.target.checked)}
                      className="sr-only"
                    />
                    <div className={`w-14 h-8 rounded-full transition-all ${unreadOnly ? "bg-gradient-to-r from-blue-600 to-indigo-600" : "bg-slate-700"}`}>
                      <div className={`w-6 h-6 bg-white rounded-full shadow-lg absolute top-1 transition-all ${unreadOnly ? "translate-x-6" : "translate-x-1"}`} />
                    </div>
                  </motion.div>
                  <span className="text-lg text-slate-300 font-medium">
                    Hanya belum dibaca
                  </span>
                </label>
              </div>

              {unreadCount > 0 && (
                <motion.button
                  onClick={handleMarkAllRead}
                  className="flex items-center gap-3 px-8 py-4 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white font-semibold rounded-2xl shadow-lg relative overflow-hidden group"
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                >
                  <motion.div
                    className="absolute inset-0 bg-gradient-to-r from-transparent via-white to-transparent opacity-0 group-hover:opacity-20"
                    animate={{ x: ["-100%", "100%"] }}
                    transition={{ duration: 1.5, repeat: Infinity, ease: "linear" }}
                  />
                  <CheckCircle className="w-6 h-6" />
                  Tandai Semua Dibaca
                </motion.button>
              )}
            </div>
          </motion.div>

          {/* Notifications List */}
          {loading ? (
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
              <p className="text-2xl text-red-400">Error: {error}</p>
            </motion.div>
          ) : data.length === 0 ? (
            <motion.div 
              className="text-center py-32"
              variants={itemVariants}
            >
              <Bell className="w-24 h-24 text-slate-600 mx-auto mb-6" />
              <p className="text-2xl text-slate-400">
                {unreadOnly ? "Tidak ada notifikasi belum dibaca" : "Belum ada notifikasi"}
              </p>
              <p className="text-slate-500 mt-4">
                Anda akan menerima pemberitahuan di sini saat ada aktivitas penting.
              </p>
            </motion.div>
          ) : (
            <motion.div 
              className="space-y-6"
              variants={containerVariants}
              initial="hidden"
              animate="visible"
            >
              {data.map((notification, index) => (
                <motion.div
                  key={notification._id}
                  variants={itemVariants}
                  transition={{ delay: index * 0.05 }}
                  className={`bg-slate-900/80 backdrop-blur-xl rounded-3xl shadow-2xl border ${!notification.is_read ? "border-blue-600/70" : "border-slate-700/50"} overflow-hidden relative group`}
                  whileHover={{ scale: 1.02, y: -5 }}
                >
                  {/* Unread Indicator */}
                  {!notification.is_read && (
                    <div className="absolute left-0 top-0 bottom-0 w-2 bg-gradient-to-b from-blue-500 to-indigo-600" />
                  )}

                  <div className="p-8">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-4 mb-3">
                          <h3 className="text-2xl font-bold text-white">
                            {notification.title}
                          </h3>
                          {!notification.is_read && (
                            <motion.div
                              animate={{ scale: [1, 1.2, 1] }}
                              transition={{ duration: 1.5, repeat: Infinity }}
                            >
                              <span className="w-4 h-4 bg-blue-400 rounded-full shadow-lg shadow-blue-400/50" />
                            </motion.div>
                          )}
                        </div>

                        <p className="text-lg text-slate-300 leading-relaxed mb-5">
                          {notification.message}
                        </p>

                        <div className="flex items-center gap-6 text-sm text-slate-400">
                          <div className="flex items-center gap-2">
                            <Clock className="w-5 h-5" />
                            <span>{formatDate(notification.created_at)}</span>
                          </div>
                        </div>
{/* 
                        {notification.action_url && (
                          <motion.a
                            href={notification.action_url}
                            className="inline-flex items-center gap-3 mt-6 text-blue-400 hover:text-blue-300 font-medium text-lg"
                            whileHover={{ x: 10 }}
                          >
                            Lihat Detail
                            <ArrowRight className="w-6 h-6" />
                          </motion.a>
                        )} */}
                      </div>

                      {!notification.is_read && (
                        <motion.button
                          onClick={() => handleMarkRead(notification._id)}
                          className="ml-8 px-6 py-3 bg-slate-800/70 hover:bg-slate-700/70 border border-slate-600 rounded-2xl text-slate-300 hover:text-white font-medium transition-all"
                          whileHover={{ scale: 1.05 }}
                          whileTap={{ scale: 0.95 }}
                        >
                          Tandai Dibaca
                        </motion.button>
                      )}
                    </div>
                  </div>
                </motion.div>
              ))}
            </motion.div>
          )}
        </motion.div>
      </div>
    </>
  );
};

export default NotificationCenter;