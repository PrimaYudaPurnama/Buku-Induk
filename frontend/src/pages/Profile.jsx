import React, { useState, useEffect } from 'react';
import { 
  User, 
  Mail, 
  Phone, 
  Briefcase, 
  Building2, 
  Calendar,
  Clock,
  Shield,
  Camera,
  Key,
  History,
  Upload,
  X,
  Eye,
  EyeOff,
  Check,
  AlertCircle
} from 'lucide-react';
import { useAuthStore } from '../stores/useAuthStore';
import { useParams } from "react-router-dom";

const getToken = () => {
  return useAuthStore.getState().token;
};

const API_BASE_URL = 'http://localhost:3000/api/v1';

const UserProfile = () => {
  const { userId } = useParams();
  const [activeTab, setActiveTab] = useState('profile');
  const [userData, setUserData] = useState(null);
  const [historyData, setHistoryData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [error, setError] = useState(null);
  
  // Photo upload states
  const [showPhotoModal, setShowPhotoModal] = useState(false);
  const [selectedFile, setSelectedFile] = useState(null);
  const [previewUrl, setPreviewUrl] = useState(null);
  const [uploading, setUploading] = useState(false);
  
  // Change password states
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [passwordData, setPasswordData] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: ''
  });
  const [showPasswords, setShowPasswords] = useState({
    current: false,
    new: false,
    confirm: false
  });
  const [passwordError, setPasswordError] = useState('');
  const [passwordSuccess, setPasswordSuccess] = useState(false);
  
  // Pagination for history
  const [historyPage, setHistoryPage] = useState(1);
  const [historyMeta, setHistoryMeta] = useState(null);

  useEffect(() => {
    fetchUserData();
  }, [userId]);

  useEffect(() => {
    if (activeTab === 'history') {
      fetchUserHistory();
    }
  }, [activeTab, historyPage]);

  const fetchUserData = async () => {
    try {
      setLoading(true);
      const response = await fetch(`${API_BASE_URL}/users/${userId}`, {
        headers: {
          'Authorization': `Bearer ${getToken()}`
        }
      });
      
      if (!response.ok) throw new Error('Failed to fetch user data');
      
      const result = await response.json();
      setUserData(result.data);
      setError(null);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const fetchUserHistory = async () => {
    try {
      setHistoryLoading(true);
      const response = await fetch(
        `${API_BASE_URL}/users/${userId}/history?page[number]=${historyPage}&page[size]=10`,
        {
          headers: {
            'Authorization': `Bearer ${getToken()}`
          }
        }
      );
      
      if (!response.ok) throw new Error('Failed to fetch history');
      
      const result = await response.json();
      setHistoryData(result.data);
      setHistoryMeta(result.meta);
    } catch (err) {
      console.error('History fetch error:', err);
    } finally {
      setHistoryLoading(false);
    }
  };

  const handleFileSelect = (e) => {
    const file = e.target.files[0];
    if (file) {
      if (!file.type.startsWith('image/')) {
        alert('Please select an image file');
        return;
      }
      if (file.size > 5 * 1024 * 1024) {
        alert('File size must be less than 5MB');
        return;
      }
      setSelectedFile(file);
      setPreviewUrl(URL.createObjectURL(file));
    }
  };

  const handlePhotoUpload = async () => {
    if (!selectedFile) return;
    
    try {
      setUploading(true);
      const formData = new FormData();
      formData.append('file', selectedFile);
      
      const response = await fetch(
        `${API_BASE_URL}/files/${userId}/upload`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${getToken()}`
          },
          body: formData
        }
      );
      
      if (!response.ok) throw new Error('Upload failed');
      
      await fetchUserData();
      setShowPhotoModal(false);
      setSelectedFile(null);
      setPreviewUrl(null);
    } catch (err) {
      alert('Failed to upload photo: ' + err.message);
    } finally {
      setUploading(false);
    }
  };

  const handlePasswordChange = async () => {
    setPasswordError('');
    setPasswordSuccess(false);

    if (!passwordData.currentPassword || !passwordData.newPassword || !passwordData.confirmPassword) {
      setPasswordError('All fields are required');
      return;
    }

    if (passwordData.newPassword !== passwordData.confirmPassword) {
      setPasswordError('New passwords do not match');
      return;
    }

    if (passwordData.newPassword.length < 8) {
      setPasswordError('Password must be at least 8 characters');
      return;
    }

    try {
      const response = await fetch(`${API_BASE_URL}/users/${userId}/change-password`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${getToken()}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          currentPassword: passwordData.currentPassword,
          newPassword: passwordData.newPassword
        })
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error?.message || 'Failed to change password');
      }

      setPasswordSuccess(true);
      setTimeout(() => {
        setShowPasswordModal(false);
        setPasswordData({ currentPassword: '', newPassword: '', confirmPassword: '' });
        setPasswordSuccess(false);
      }, 2000);
    } catch (err) {
      setPasswordError(err.message);
    }
  };

  const getInitials = (name) => {
    if (!name) return '?';
    return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
  };

  const formatDate = (dateString) => {
    if (!dateString) return 'N/A';
    return new Date(dateString).toLocaleDateString('id-ID', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  };

  const getEventTypeBadge = (eventType) => {
    const badges = {
      'role_change': 'bg-blue-100 text-blue-800',
      'division_change': 'bg-purple-100 text-purple-800',
      'salary_change': 'bg-green-100 text-green-800',
      'status_change': 'bg-orange-100 text-orange-800',
      'promotion': 'bg-yellow-100 text-yellow-800'
    };
    return badges[eventType] || 'bg-gray-100 text-gray-800';
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <AlertCircle className="w-16 h-16 text-red-500 mx-auto mb-4" />
          <h2 className="text-xl font-semibold text-gray-800 mb-2">Error Loading Profile</h2>
          <p className="text-gray-600">{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-6xl mx-auto">
        {/* Header Card */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden mb-6">
          <div className="h-32 bg-gradient-to-r from-blue-500 to-blue-600"></div>
          <div className="px-8 pb-8">
            <div className="flex flex-col md:flex-row items-start md:items-end gap-6 -mt-16">
              {/* Profile Photo */}
              <div className="relative group">
                <div className="w-32 h-32 rounded-full border-4 border-white shadow-lg overflow-hidden bg-gray-100">
                  {userData?.profile_photo_url ? (
                    <img 
                      src={userData.profile_photo_url} 
                      alt={userData.full_name}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="w-full h-full bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center text-white text-3xl font-bold">
                      {getInitials(userData?.full_name)}
                    </div>
                  )}
                </div>
                <button
                  onClick={() => setShowPhotoModal(true)}
                  className="absolute bottom-2 right-2 bg-white rounded-full p-2 shadow-lg hover:bg-gray-50 transition-colors"
                >
                  <Camera className="w-4 h-4 text-gray-700" />
                </button>
              </div>

              {/* User Info */}
              <div className="flex-1 mt-4 md:mt-0">
                <h1 className="text-3xl font-bold text-gray-900">{userData?.full_name}</h1>
                <div className="flex flex-wrap items-center gap-3 mt-2">
                  <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-blue-100 text-blue-700 rounded-full text-sm font-medium">
                    <Shield className="w-4 h-4" />
                    {userData?.role_id?.name}
                  </span>
                  <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-purple-100 text-purple-700 rounded-full text-sm font-medium">
                    <Building2 className="w-4 h-4" />
                    {userData?.division_id?.name}
                  </span>
                </div>
              </div>

              {/* Action Button */}
              <button
                onClick={() => setShowPasswordModal(true)}
                className="inline-flex items-center gap-2 px-4 py-2 bg-gray-800 text-white rounded-lg hover:bg-gray-700 transition-colors"
              >
                <Key className="w-4 h-4" />
                Change Password
              </button>
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 mb-6">
          <div className="border-b border-gray-200">
            <nav className="flex gap-8 px-8">
              <button
                onClick={() => setActiveTab('profile')}
                className={`py-4 border-b-2 font-medium text-sm transition-colors ${
                  activeTab === 'profile'
                    ? 'border-blue-600 text-blue-600'
                    : 'border-transparent text-gray-600 hover:text-gray-800'
                }`}
              >
                <User className="w-4 h-4 inline mr-2" />
                Profile Information
              </button>
              <button
                onClick={() => setActiveTab('history')}
                className={`py-4 border-b-2 font-medium text-sm transition-colors ${
                  activeTab === 'history'
                    ? 'border-blue-600 text-blue-600'
                    : 'border-transparent text-gray-600 hover:text-gray-800'
                }`}
              >
                <History className="w-4 h-4 inline mr-2" />
                History
              </button>
            </nav>
          </div>

          {/* Tab Content */}
          <div className="p-8">
            {activeTab === 'profile' && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <InfoCard icon={Mail} label="Email" value={userData?.email} />
                <InfoCard icon={Phone} label="Phone" value={userData?.phone} />
                <InfoCard icon={Briefcase} label="Role" value={userData?.role_id?.name} />
                <InfoCard icon={Building2} label="Division" value={userData?.division_id?.name} />
                <InfoCard icon={Calendar} label="Join Date" value={formatDate(userData?.created_at)} />
                <InfoCard icon={Clock} label="Last Updated" value={formatDate(userData?.updated_at)} />
                
                {userData?.role_id?.description && (
                  <div className="md:col-span-2 p-4 bg-gray-50 rounded-lg border border-gray-200">
                    <h3 className="text-sm font-semibold text-gray-700 mb-2">Role Description</h3>
                    <p className="text-gray-600">{userData.role_id.description}</p>
                  </div>
                )}
                
                {userData?.division_id?.description && (
                  <div className="md:col-span-2 p-4 bg-gray-50 rounded-lg border border-gray-200">
                    <h3 className="text-sm font-semibold text-gray-700 mb-2">Division Description</h3>
                    <p className="text-gray-600">{userData.division_id.description}</p>
                  </div>
                )}
              </div>
            )}

            {activeTab === 'history' && (
              <div>
                {historyLoading ? (
                  <div className="flex justify-center py-12">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                  </div>
                ) : historyData.length === 0 ? (
                  <div className="text-center py-12">
                    <History className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                    <p className="text-gray-500">No history records found</p>
                  </div>
                ) : (
                  <>
                    <div className="space-y-4">
                      {historyData.map((item, index) => (
                        <div key={index} className="border border-gray-200 rounded-lg p-4 hover:bg-gray-50 transition-colors">
                          <div className="flex items-start justify-between mb-3">
                            <span className={`px-3 py-1 rounded-full text-xs font-medium ${getEventTypeBadge(item.event_type)}`}>
                              {item.event_type.replace('_', ' ').toUpperCase()}
                            </span>
                            <span className="text-sm text-gray-500">{formatDate(item.effective_date)}</span>
                          </div>
                          
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            {item.old_role && (
                              <div>
                                <p className="text-xs text-gray-500 mb-1">Role Change</p>
                                <p className="text-sm">
                                  <span className="text-gray-600">{item.old_role?.name}</span>
                                  <span className="mx-2">→</span>
                                  <span className="font-medium text-gray-900">{item.new_role?.name}</span>
                                </p>
                              </div>
                            )}
                            
                            {item.old_division && (
                              <div>
                                <p className="text-xs text-gray-500 mb-1">Division Change</p>
                                <p className="text-sm">
                                  <span className="text-gray-600">{item.old_division?.name}</span>
                                  <span className="mx-2">→</span>
                                  <span className="font-medium text-gray-900">{item.new_division?.name}</span>
                                </p>
                              </div>
                            )}
                            
                            {item.old_salary && (
                              <div>
                                <p className="text-xs text-gray-500 mb-1">Salary Change</p>
                                <p className="text-sm">
                                  <span className="text-gray-600">Rp {parseFloat(item.old_salary).toLocaleString('id-ID')}</span>
                                  <span className="mx-2">→</span>
                                  <span className="font-medium text-gray-900">Rp {parseFloat(item.new_salary).toLocaleString('id-ID')}</span>
                                </p>
                              </div>
                            )}
                          </div>
                          
                          {item.notes && (
                            <p className="mt-3 text-sm text-gray-600 bg-gray-50 p-3 rounded">{item.notes}</p>
                          )}
                          
                          {item.created_by && (
                            <p className="mt-2 text-xs text-gray-500">
                              Modified by: {item.created_by.full_name}
                            </p>
                          )}
                        </div>
                      ))}
                    </div>
                    
                    {historyMeta && historyMeta.pagination.total_pages > 1 && (
                      <div className="flex justify-center gap-2 mt-6">
                        <button
                          onClick={() => setHistoryPage(p => Math.max(1, p - 1))}
                          disabled={historyPage === 1}
                          className="px-4 py-2 border border-gray-300 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50"
                        >
                          Previous
                        </button>
                        <span className="px-4 py-2 text-gray-600">
                          Page {historyPage} of {historyMeta.pagination.total_pages}
                        </span>
                        <button
                          onClick={() => setHistoryPage(p => p + 1)}
                          disabled={historyPage === historyMeta.pagination.total_pages}
                          className="px-4 py-2 border border-gray-300 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50"
                        >
                          Next
                        </button>
                      </div>
                    )}
                  </>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Photo Upload Modal */}
      {showPhotoModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg max-w-md w-full p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-900">Upload Profile Photo</h3>
              <button
                onClick={() => {
                  setShowPhotoModal(false);
                  setSelectedFile(null);
                  setPreviewUrl(null);
                }}
                className="text-gray-400 hover:text-gray-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <div className="mb-4">
              {previewUrl ? (
                <div className="relative">
                  <img src={previewUrl} alt="Preview" className="w-full h-64 object-cover rounded-lg" />
                  <button
                    onClick={() => {
                      setSelectedFile(null);
                      setPreviewUrl(null);
                    }}
                    className="absolute top-2 right-2 bg-white rounded-full p-1 shadow-lg hover:bg-gray-100"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              ) : (
                <label className="flex flex-col items-center justify-center w-full h-64 border-2 border-dashed border-gray-300 rounded-lg cursor-pointer hover:bg-gray-50">
                  <Upload className="w-12 h-12 text-gray-400 mb-2" />
                  <span className="text-sm text-gray-600">Click to upload image</span>
                  <span className="text-xs text-gray-400 mt-1">Max 5MB</span>
                  <input
                    type="file"
                    className="hidden"
                    accept="image/*"
                    onChange={handleFileSelect}
                  />
                </label>
              )}
            </div>
            
            <div className="flex gap-3">
              <button
                onClick={() => {
                  setShowPhotoModal(false);
                  setSelectedFile(null);
                  setPreviewUrl(null);
                }}
                className="flex-1 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={handlePhotoUpload}
                disabled={!selectedFile || uploading}
                className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {uploading ? 'Uploading...' : 'Upload'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Change Password Modal */}
      {showPasswordModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg max-w-md w-full p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-900">Change Password</h3>
              <button
                onClick={() => {
                  setShowPasswordModal(false);
                  setPasswordData({ currentPassword: '', newPassword: '', confirmPassword: '' });
                  setPasswordError('');
                }}
                className="text-gray-400 hover:text-gray-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {passwordSuccess && (
              <div className="mb-4 p-3 bg-green-50 border border-green-200 rounded-lg flex items-center gap-2 text-green-800">
                <Check className="w-5 h-5" />
                <span className="text-sm">Password changed successfully!</span>
              </div>
            )}

            {passwordError && (
              <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg flex items-center gap-2 text-red-800">
                <AlertCircle className="w-5 h-5" />
                <span className="text-sm">{passwordError}</span>
              </div>
            )}

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Current Password</label>
                <div className="relative">
                  <input
                    type={showPasswords.current ? 'text' : 'password'}
                    value={passwordData.currentPassword}
                    onChange={(e) => setPasswordData({ ...passwordData, currentPassword: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPasswords({ ...showPasswords, current: !showPasswords.current })}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                  >
                    {showPasswords.current ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">New Password</label>
                <div className="relative">
                  <input
                    type={showPasswords.new ? 'text' : 'password'}
                    value={passwordData.newPassword}
                    onChange={(e) => setPasswordData({ ...passwordData, newPassword: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPasswords({ ...showPasswords, new: !showPasswords.new })}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                  >
                    {showPasswords.new ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Confirm New Password</label>
                <div className="relative">
                  <input
                    type={showPasswords.confirm ? 'text' : 'password'}
                    value={passwordData.confirmPassword}
                    onChange={(e) => setPasswordData({ ...passwordData, confirmPassword: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPasswords({ ...showPasswords, confirm: !showPasswords.confirm })}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                  >
                    {showPasswords.confirm ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>
            </div>

            <div className="flex gap-3 mt-6">
              <button
                onClick={() => {
                  setShowPasswordModal(false);
                  setPasswordData({ currentPassword: '', newPassword: '', confirmPassword: '' });
                  setPasswordError('');
                }}
                className="flex-1 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={handlePasswordChange}
                className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
              >
                Change Password
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

const InfoCard = ({ icon: Icon, label, value }) => (
  <div className="p-4 border border-gray-200 rounded-lg hover:shadow-sm transition-shadow">
    <div className="flex items-center gap-3">
      <div className="p-2 bg-gray-100 rounded-lg">
        <Icon className="w-5 h-5 text-gray-600" />
      </div>
      <div>
        <p className="text-xs text-gray-500 mb-0.5">{label}</p>
        <p className="text-sm font-medium text-gray-900">{value || 'N/A'}</p>
      </div>
    </div>
  </div>
);

// Demo dengan user ID
export default UserProfile