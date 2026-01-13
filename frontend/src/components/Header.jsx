import React, { useState, useEffect, useRef } from 'react';
import { Menu, User, LogOut, ChevronDown, Sparkles } from 'lucide-react';
import { motion } from 'framer-motion';
import toast, { Toaster } from "react-hot-toast";
import { useAuthStore } from '../stores/useAuthStore';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000/api/v1';


const Header = ({ toggleSidebar, onNavigateToProfile }) => {
  const user = useAuthStore((state) => state.user);
  const logout = useAuthStore((state) => state.logout);
  
  const [profilePhoto, setProfilePhoto] = useState(null);
  const [showDropdown, setShowDropdown] = useState(false);
  const dropdownRef = useRef(null);

  useEffect(() => {
    if (user?._id) {
      fetchProfilePhoto();
    }
  }, [user?._id]);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setShowDropdown(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const fetchProfilePhoto = async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/files/${user._id}`, {
        credentials: "include",
      });
      
      if (response.ok) {
        const result = await response.json();
        setProfilePhoto(result.data?.profile_photo_url);
      }
    } catch (err) {
      console.error('Failed to fetch profile photo:', err);
    }
  };

  const getInitials = (name) => {
    if (!name) return '?';
    return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
  };

  const handleViewProfile = () => {
    setShowDropdown(false);
    if (onNavigateToProfile) {
      onNavigateToProfile(user._id);
    }
  };

  const handleLogout = async () => {
    setShowDropdown(false); 
  
    try {
      await fetch(`${API_BASE_URL}/auth/logout`, {
        method: "POST",
        credentials: "include",
      });
    } catch (_) {
      // sengaja kosong — logout client tetap jalan
    } finally {
      logout();
      toast.success("Logged out successfully");
      window.location.replace("/"); // lebih bersih dari href
    }
  };
  
  

  const floatingVariants = {
    animate: {
      y: [0, -10, 0],
      transition: {
        duration: 4,
        repeat: Infinity,
        ease: "easeInOut"
      }
    }
  };

  return (
    <>
      <Toaster position="top-center" />
      <header className="relative z-50 px-6 py-5 flex items-center justify-between">
        {/* Background Glass Effect */}
        <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-xl border-b border-blue-900/50" />
        
        <div className="relative flex items-center gap-6 flex-1">
          <motion.button 
            onClick={toggleSidebar}
            className="p-3 bg-slate-800/50 backdrop-blur-sm rounded-2xl border border-slate-700/50 hover:bg-slate-700/70 transition-all group"
            whileHover={{ scale: 1.1 }}
            whileTap={{ scale: 0.95 }}
          >
            <Menu className="w-6 h-6 text-blue-400 group-hover:text-white transition-colors" />
          </motion.button>

          <motion.div 
            className="flex items-center gap-3"
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.2 }}
          >
            <motion.div
              className="w-12 h-12 bg-gradient-to-br from-blue-600 to-indigo-700 rounded-2xl flex items-center justify-center"
              variants={floatingVariants}
              animate="animate"
            >
              <Sparkles className="w-7 h-7 text-white" />
            </motion.div>
            <div>
              <h1 className="text-2xl font-bold bg-gradient-to-r from-blue-400 to-indigo-400 bg-clip-text text-transparent">
                Dashboard
              </h1>
              <p className="text-sm text-slate-400 mt-0.5">Welcome back, {user?.full_name?.split(' ')[0] || 'User'}</p>
            </div>
          </motion.div>
        </div>

        {/* User Dropdown */}
        <div className="relative" ref={dropdownRef}>
          <motion.button
            onClick={() => setShowDropdown(!showDropdown)}
            className="flex items-center gap-4 px-5 py-3 bg-slate-800/50 backdrop-blur-sm rounded-2xl border border-slate-700/50 hover:bg-slate-700/70 transition-all group"
            whileHover={{ scale: 1.03 }}
            whileTap={{ scale: 0.97 }}
          >
            <div className="text-right">
              <p className="text-sm font-semibold text-white">{user?.full_name || 'Loading...'}</p>
              <p className="text-xs text-slate-400 flex items-center gap-1">
                <Sparkles className="w-3 h-3" />
                {user?.role_id?.name || "Loading..."}
              </p>
            </div>
            
            <div className="w-12 h-12 rounded-2xl overflow-hidden border-4 border-blue-900/50 shadow-lg">
              {profilePhoto || user?.profile_photo_url ? (
                <img 
                  src={profilePhoto || user?.profile_photo_url} 
                  alt={user?.full_name}
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="w-full h-full bg-gradient-to-br from-blue-600 to-indigo-700 flex items-center justify-center text-white font-bold text-lg">
                  {getInitials(user?.full_name)}
                </div>
              )}
            </div>

            <ChevronDown className={`w-5 h-5 text-slate-400 transition-transform duration-300 ${showDropdown ? 'rotate-180' : ''}`} />
          </motion.button>

          {/* Dropdown Menu */}
          <motion.div
            initial={{ opacity: 0, y: -10, scale: 0.95 }}
            animate={{ opacity: showDropdown ? 1 : 0, y: showDropdown ? 0 : -10, scale: showDropdown ? 1 : 0.95 }}
            transition={{ duration: 0.2 }}
            className={`absolute right-0 mt-3 w-64 bg-slate-900/90 backdrop-blur-2xl rounded-3xl shadow-2xl border border-blue-900/50 overflow-hidden z-50 pointer-events-${showDropdown ? 'auto' : 'none'}`}
          >
            {/* User Info Header */}
            <div className="px-6 py-5 border-b border-slate-700/50">
              <div className="flex items-center gap-4">
                <div className="w-14 h-14 rounded-2xl overflow-hidden border-4 border-blue-900/50">
                  {profilePhoto || user?.profile_photo_url ? (
                    <img 
                      src={profilePhoto || user?.profile_photo_url} 
                      alt={user?.full_name}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="w-full h-full bg-gradient-to-br from-blue-600 to-indigo-700 flex items-center justify-center text-white font-bold text-xl">
                      {getInitials(user?.full_name)}
                    </div>
                  )}
                </div>
                <div>
                  <p className="text-lg font-semibold text-white">{user?.full_name}</p>
                  <p className="text-sm text-slate-400">{user?.email}</p>
                  <p className="text-xs text-blue-400 mt-1 flex items-center gap-1">
                    
                    {user?.role_id?.name}
                  </p>
                </div>
              </div>
            </div>

            {/* Menu Items */}
            <div className="py-2">
              <motion.button
                onClick={handleViewProfile}
                className="w-full flex items-center gap-4 px-6 py-4 text-slate-300 hover:bg-slate-800/50 hover:text-white transition-all"
                whileHover={{ x: 5 }}
              >
                <User className="w-5 h-5 text-blue-400" />
                <span className="font-medium">View Profile</span>
              </motion.button>

              <div className="border-t border-slate-700/50 my-2 mx-6" />

              <motion.button
                onClick={handleLogout}
                className="w-full flex items-center gap-4 px-6 py-4 text-red-400 hover:bg-red-900/20 hover:text-red-300 transition-all"
                whileHover={{ x: 5 }}
              >
                <LogOut className="w-5 h-5" />
                <span className="font-medium">Logout</span>
              </motion.button>
            </div>
          </motion.div>
        </div>
      </header>
    </>
  );
};

export default Header;