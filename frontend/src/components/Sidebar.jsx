import React from 'react';
import { X, Home, Users, BookOpen, FileText, Settings, LogOut, Shield, ClipboardList, CheckCircle, Bell, FolderOpen, Sparkles, BarChart3, GitBranch } from 'lucide-react';
import { motion } from 'framer-motion';
import toast from "react-hot-toast";
import { useAuthStore } from '../stores/useAuthStore';

// Komponen Sidebar
const Sidebar = ({ isOpen, closeSidebar, permissions, activePage, setActivePage }) => {
  const rawMenu = [
    { id: 'Home', label: 'Home', icon: Home, permission: null },
    { id: 'WorkflowAnalytics', label: 'Workflow Analytics', icon: BarChart3, permission: ["system:manage_analytics", "dashboard:read"]},
    { id: 'OrgChart', label: 'Company Org Chart', icon: GitBranch, permission: ["dashboard:read", "user:read:any", "user:read:own_division"] },
    { id: 'UserList', label: 'User Management', icon: Users, permission: ["user:read:any", "user:read:own_division", "dashboard:read"] },
    { id: 'AccountRequest', label: 'Account Request', icon: ClipboardList, permission: ["account:create"] },
    { id: 'ApprovalInbox', label: 'Approval Inbox', icon: CheckCircle, permission: ["account:approve:any", "account:approve:own_division"] },
    { id: 'Documents', label: 'Documents', icon: FolderOpen, permission: ["user:read:any", "user:read:own_division", "user:read:self"] },
    { id: 'Notifications', label: 'Notifications', icon: Bell, permission: null },
    { id: 'DivisionList', label: 'Division Settings', icon: Settings, permission: ["system:manage_divisions", "dashboard:read"] },
    { id: 'RoleSettings', label: 'Role Settings', icon: Shield, permission: ["system:manage_roles"] },
    { id: 'AuditLogs', label: 'Audit Logs', icon: FileText, permission: ["system:view_audit_logs", "dashboard:read"] },
  ];

  const isMobile = () => window.innerWidth < 1024;

  const hasPermission = (perm) => {
    if (!perm) return true;
    if (!permissions || !Array.isArray(permissions)) return false;
    if (Array.isArray(perm)) {
      return perm.some(p => permissions.includes(p));
    }
    return permissions.includes(perm);
  };

  const logout = async () => {
    try {
      await fetch("http://localhost:3000/api/v1/auth/logout", {
        method: "POST",
        credentials: "include",
      });
    } catch (err) {
      console.error("Logout error", err);
    } finally {
      useAuthStore.getState().logout();
      toast.success("Berhasil keluar");
      window.location.href = "/";
    }
  };
  

  const menu = rawMenu.filter(item => hasPermission(item.permission));

  const menuVariants = {
    hidden: { opacity: 0, x: -30 },
    visible: { opacity: 1, x: 0 }
  };

  const itemVariants = {
    hidden: { opacity: 0, y: 20 },
    visible: { opacity: 1, y: 0 }
  };

  return (
    <>
      {/* Mobile Overlay */}
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={closeSidebar}
          className="fixed inset-0 bg-black/70 backdrop-blur-sm z-40 lg:hidden"
        />
      )}

      {/* Sidebar */}
      <motion.aside
        initial={false}
        animate={{ x: isOpen ? 0 : -320 }}
        transition={{ type: "spring", stiffness: 260, damping: 30 }}
        className="fixed inset-y-0 left-0 z-50 w-80 bg-slate-900/90 backdrop-blur-2xl border-r border-blue-900/50 shadow-2xl flex flex-col"
      >
        {/* Header */}
        <div className="p-8 border-b border-slate-800/50">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <motion.div
                className="w-14 h-14 rounded-2xl flex items-center justify-center shadow-lg"
                animate={{
                  y: [0, -3, 0],
                }}
                transition={{
                  duration: 3,
                  repeat: Infinity,
                  ease: "easeInOut"
                }}
              >
                {/* <Sparkles className="w-8 h-8 text-white" /> */}
                <img src="https://res.cloudinary.com/dtbqhmgjz/image/upload/v1764926597/employees/dev/documents/e8d94016-d909-48b7-add0-3e6a745eb67a-1764926594722-Logo%20Resolusi.png" alt="" />
              </motion.div>
              <div>
                <h2 className="text-2xl font-bold bg-gradient-to-r from-blue-400 to-indigo-400 bg-clip-text text-transparent">
                  Resolusi
                </h2>
                <p className="text-sm text-slate-400">Buku Induk</p>
              </div>
            </div>
            <motion.button
              onClick={closeSidebar}
              className="lg:hidden p-3 bg-slate-800/50 rounded-2xl hover:bg-slate-700/70 transition-all"
              whileHover={{ scale: 1.1 }}
              whileTap={{ scale: 0.9 }}
            >
              <X className="w-6 h-6 text-slate-300" />
            </motion.button>
          </div>
        </div>

        {/* Navigation */}
        <nav className="flex-1 p-6 overflow-y-auto">
          <motion.ul
            className="space-y-3"
            variants={menuVariants}
            initial="hidden"
            animate="visible"
            transition={{ staggerChildren: 0.07 }}
          >
            {menu.map((item, index) => {
              const Icon = item.icon;
              return (
                <motion.li
                  key={item.id}
                  variants={itemVariants}
                  transition={{ delay: index * 0.05 }}
                >
                  <motion.button
                    onClick={() => {
                      setActivePage(item.id);
                      if (isMobile()) {
                        closeSidebar();
                      }
                    }}
                    className={`w-full flex items-center gap-5 px-6 py-4 rounded-2xl transition-all group relative overflow-hidden ${
                      activePage === item.id
                        ? 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-lg'
                        : 'text-slate-300 hover:bg-slate-800/70 hover:text-white'
                    }`}
                    whileHover={{ scale: 1.03 }}
                    whileTap={{ scale: 0.98 }}
                  >
                    {activePage === item.id && (
                      <motion.div
                        className="absolute inset-0 bg-gradient-to-r from-transparent via-white to-transparent opacity-20"
                        animate={{ x: ['-100%', '100%'] }}
                        transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
                      />
                    )}
                    <Icon className={`w-6 h-6 relative z-10 transition-colors ${
                      activePage === item.id ? 'text-white' : 'group-hover:text-blue-400'
                    }`} />
                    <span className="font-medium relative z-10">{item.label}</span>
                  </motion.button>
                </motion.li>
              );
            })}
          </motion.ul>
        </nav>

        {/* Logout */}
        <div className="p-6 border-t border-slate-800/50">
          <motion.button
            onClick={logout}
            className="w-full flex items-center gap-5 px-6 py-4 bg-red-900/30 hover:bg-red-900/50 border border-red-800/50 rounded-2xl text-red-400 hover:text-red-300 transition-all group relative overflow-hidden"
            whileHover={{ scale: 1.03 }}
            whileTap={{ scale: 0.98 }}
          >
            <motion.div
              className="absolute inset-0 bg-gradient-to-r from-transparent via-red-500 to-transparent opacity-0 group-hover:opacity-30"
              animate={{ x: ['-100%', '100%'] }}
              transition={{ duration: 1.5, repeat: Infinity, ease: "linear" }}
            />
            <LogOut className="w-6 h-6 relative z-10" />
            <span className="font-medium relative z-10">Keluar</span>
          </motion.button>
        </div>
      </motion.aside>
    </>
  );
};

export default Sidebar;