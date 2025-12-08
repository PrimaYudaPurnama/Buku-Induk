import React, { useState, useEffect, useRef } from 'react';
import { Menu, User, LogOut, ChevronDown } from 'lucide-react';
import { useAuthStore } from '../stores/useAuthStore';

const API_BASE_URL = 'http://localhost:3000/api/v1';

const getToken = () => {
  return useAuthStore.getState().token;
};

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
        headers: {
          'Authorization': `Bearer ${getToken()}`
        }
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
    // Atau jika menggunakan react-router:
    // navigate(`/profile/${user._id}`);
  };

  const handleLogout = () => {
    logout();
    // navigate('/login');
    window.location.href = '/login';
  };

  return (
    <header className="bg-white shadow-sm border-b border-gray-200 px-6 py-4 flex items-center justify-between">
      <div className="flex items-center gap-4">
        <button 
          onClick={toggleSidebar}
          className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
        >
          <Menu className="w-6 h-6 text-gray-600" />
        </button>
        <h1 className="text-xl font-semibold text-gray-800">Dashboard</h1>
      </div>

      <div className="relative" ref={dropdownRef}>
        <button
          onClick={() => setShowDropdown(!showDropdown)}
          className="flex items-center gap-3 hover:bg-gray-50 rounded-lg px-3 py-2 transition-colors"
        >
          <div className="text-right">
            <p className="text-sm font-medium text-gray-800">{user?.full_name || 'Loading...'}</p>
            <p className="text-xs text-gray-500">
              {user?.role_id?.name || "Loading..."}
            </p>
          </div>
          
          <div className="w-10 h-10 rounded-full overflow-hidden border-2 border-gray-200">
            {profilePhoto || user?.profile_photo_url ? (
              <img 
                src={profilePhoto || user?.profile_photo_url} 
                alt={user?.full_name}
                className="w-full h-full object-cover"
              />
            ) : (
              <div className="w-full h-full bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center text-white font-semibold text-sm">
                {getInitials(user?.full_name)}
              </div>
            )}
          </div>

          <ChevronDown className={`w-4 h-4 text-gray-400 transition-transform ${showDropdown ? 'rotate-180' : ''}`} />
        </button>

        {/* Dropdown Menu */}
        {showDropdown && (
          <div className="absolute right-0 mt-2 w-56 bg-white rounded-lg shadow-lg border border-gray-200 py-2 z-50">
            <div className="px-4 py-3 border-b border-gray-100">
              <p className="text-sm font-medium text-gray-900">{user?.full_name}</p>
              <p className="text-xs text-gray-500 mt-0.5">{user?.email}</p>
            </div>

            <button
              onClick={handleViewProfile}
              className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50 transition-colors"
            >
              <User className="w-4 h-4" />
              View Profile
            </button>

            <div className="border-t border-gray-100 my-1"></div>

            <button
              onClick={handleLogout}
              className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-red-600 hover:bg-red-50 transition-colors"
            >
              <LogOut className="w-4 h-4" />
              Logout
            </button>
          </div>
        )}
      </div>
    </header>
  );
};

export default Header;