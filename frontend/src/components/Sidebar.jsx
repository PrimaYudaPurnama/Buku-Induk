import React from 'react';
import { X, Home, Users, BookOpen, FileText, Settings, LogOut, Shield, ClipboardList } from 'lucide-react';
import { useAuthStore } from '../stores/useAuthStore';

// Komponen Sidebar
const Sidebar = ({ isOpen, closeSidebar, permissions, activePage, setActivePage }) => {
  const rawMenu = [
    { id: 'Home', label: 'Home', icon: Home, permission: null }, // Selalu tampil
    { id: 'UserList', label: 'User Management', icon: Users, permission: "user:read:any" },
    { id: 'AccountList', label: 'Account Management', icon: ClipboardList, permission: "account:create" },
    { id: 'UserHistory', label: 'User History', icon: BookOpen, permission: "user:view_history:any" },
    { id: 'SalaryReport', label: 'Salary Report', icon: FileText, permission: "user:view_salary:any" },
    { id: 'DivisionList', label: 'Division Settings', icon: Settings, permission: "system:manage_divisions" },
    { id: 'RoleSettings', label: 'Role Settings', icon: Shield, permission: "system:manage_roles" },
    { id: 'AuditLogs', label: 'Audit Logs', icon: FileText, permission: "system:view_audit_logs" },
  ];

  // Helper function untuk cek permission
  const hasPermission = (perm) => {
    if (!perm) return true; // Jika tidak ada permission required, selalu tampil
    if (!permissions || !Array.isArray(permissions)) return false;
    return permissions.includes(perm);
  };

  const logout = () => {
    useAuthStore.getState().logout();
    window.location.href = '/'
  }

  // Filter menu berdasarkan permission
  const menu = rawMenu.filter(item => hasPermission(item.permission));

  return (
    <>
      {isOpen && (  
        <div 
          className="fixed inset-0 bg-black bg-opacity-50 z-40 lg:hidden"
          onClick={closeSidebar}
        />
      )}
      <aside className={`fixed lg:static inset-y-0 left-0 z-50 w-64 bg-gray-900 text-white transform transition-transform duration-300 ease-in-out ${isOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}`}>
        <div className="flex items-center justify-between p-6 border-b border-gray-800">
          <h2 className="text-xl font-bold">My App</h2>
          <button onClick={closeSidebar} className="lg:hidden p-1 hover:bg-gray-800 rounded">
            <X className="w-6 h-6" />
          </button>
        </div>
        
        <nav className="p-4 flex-1">
          <ul className="space-y-2">
            {menu.map((item) => {
              const Icon = item.icon;
              return (
                <li key={item.id}>
                  <button
                    onClick={() => {
                      setActivePage(item.id);
                      closeSidebar();
                    }}
                    className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${
                      activePage === item.id 
                        ? 'bg-blue-600 text-white' 
                        : 'text-gray-300 hover:bg-gray-800'
                    }`}
                  >
                    <Icon className="w-5 h-5" />
                    <span>{item.label}</span>
                  </button>
                </li>
              );
            })}
          </ul>
        </nav>

        <div className="p-4 border-t border-gray-800">
          <button 
            onClick={logout}
            className="w-full flex items-center gap-3 px-4 py-3 text-gray-300 hover:bg-gray-800 rounded-lg transition-colors"
          >
            <LogOut className="w-5 h-5" />
            <span>Keluar</span>
          </button>
        </div>
      </aside>
    </>
  );
};

export default Sidebar;