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
  AlertCircle,
  Sparkles,
  ArrowRight,
  ArrowLeft
} from 'lucide-react';
import { motion } from 'framer-motion';
import toast, { Toaster } from "react-hot-toast";
import { useAuthStore } from '../stores/useAuthStore';
import { useParams, useNavigate } from "react-router-dom";


const getToken = () => {
  return useAuthStore.getState().token;
};

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000/api/v1';

const UserProfile = () => {
  const { userId } = useParams();
  const [activeTab, setActiveTab] = useState('profile');
  const [userData, setUserData] = useState(null);
  const [historyData, setHistoryData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [error, setError] = useState(null);

  const navigate = useNavigate();
  
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
        credentials: "include",
      });
      
      if (!response.ok) throw new Error('Failed to fetch user data');
      
      const result = await response.json();
      console.log(result.data);
      setUserData(result.data);
      setError(null);
    } catch (err) {
      setError(err.message);
      toast.error(err.message);
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
          credentials: "include",
        }
      );
      
      if (!response.ok) throw new Error('Failed to fetch history');
      
      const result = await response.json();
      setHistoryData(result.data);
      setHistoryMeta(result.meta);
    } catch (err) {
      toast.error('Failed to load history');
    } finally {
      setHistoryLoading(false);
    }
  };

  const handleFileSelect = (e) => {
    const file = e.target.files[0];
    if (file) {
      if (!file.type.startsWith('image/')) {
        toast.error('Please select an image file');
        return;
      }
      if (file.size > 5 * 1024 * 1024) {
        toast.error('File size must be less than 5MB');
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
          credentials: "include",
          body: formData
        }
      );
      
      if (!response.ok) throw new Error('Upload failed');
      
      await fetchUserData();
      toast.success('Photo updated successfully');
      setShowPhotoModal(false);
      setSelectedFile(null);
      setPreviewUrl(null);
    } catch (err) {
      toast.error('Failed to upload photo');
    } finally {
      setUploading(false);
    }
  };

  const handleBackToDashboard = () => {
    navigate('/dashboard');
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
          'Content-Type': 'application/json'
        },
        credentials: "include",
        body: JSON.stringify({
          currentPassword: passwordData.currentPassword,
          newPassword: passwordData.newPassword
        })
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error?.message || 'Failed to change password');
      }

      toast.success('Password changed successfully');
      setPasswordSuccess(true);
      setTimeout(() => {
        setShowPasswordModal(false);
        setPasswordData({ currentPassword: '', newPassword: '', confirmPassword: '' });
        setPasswordSuccess(false);
      }, 1500);
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
      'role_change': 'bg-blue-900/30 text-blue-400 border border-blue-800/50',
      'division_change': 'bg-purple-900/30 text-purple-400 border border-purple-800/50',
      'salary_change': 'bg-green-900/30 text-green-400 border border-green-800/50',
      'status_change': 'bg-orange-900/30 text-orange-400 border border-orange-800/50',
      'promotion': 'bg-yellow-900/30 text-yellow-400 border border-yellow-800/50'
    };
    return badges[eventType] || 'bg-slate-800/50 text-slate-400 border border-slate-700/50';
  };

  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        delayChildren: 0.3,
        staggerChildren: 0.1
      }
    }
  };

  const itemVariants = {
    hidden: { y: 20, opacity: 0 },
    visible: {
      y: 0,
      opacity: 1,
      transition: {
        type: "spring",
        stiffness: 100
      }
    }
  };

  const floatingVariants = {
    animate: {
      y: [0, -15, 0],
      transition: {
        duration: 4,
        repeat: Infinity,
        ease: "easeInOut"
      }
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-950 via-blue-950 to-slate-900">
        <motion.div
          animate={{ rotate: 360 }}
          transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
          className="w-16 h-16 border-4 border-blue-500 border-t-transparent rounded-full"
        />
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-950 via-blue-950 to-slate-900">
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className="text-center"
        >
          <AlertCircle className="w-20 h-20 text-red-400 mx-auto mb-6" />
          <h2 className="text-2xl font-bold text-white mb-3">Error Loading Profile</h2>
          <p className="text-slate-400 max-w-sm">{error}</p>
        </motion.div>
      </div>
    );
  }

  return (
    <>
      <Toaster position="top-center" />
      <div className="min-h-screen bg-gradient-to-br from-slate-950 via-blue-950 to-slate-900 p-4 relative overflow-hidden">
        {/* Animated Background */}
        <div className="absolute inset-0 overflow-hidden">
          <motion.div
            className="absolute top-20 left-20 w-72 h-72 bg-blue-600 rounded-full mix-blend-multiply filter blur-3xl opacity-20"
            animate={{
              scale: [1, 1.2, 1],
              x: [0, 50, 0],
              y: [0, 30, 0],
            }}
            transition={{
              duration: 8,
              repeat: Infinity,
              ease: "easeInOut"
            }}
          />
          <motion.div
            className="absolute bottom-20 right-20 w-96 h-96 bg-indigo-600 rounded-full mix-blend-multiply filter blur-3xl opacity-20"
            animate={{
              scale: [1, 1.3, 1],
              x: [0, -50, 0],
              y: [0, -30, 0],
            }}
            transition={{
              duration: 10,
              repeat: Infinity,
              ease: "easeInOut"
            }}
          />
        </div>

        {/* Tombol Kembali ke Dashboard - Fixed di pojok kiri atas */}
        <motion.button
          onClick={handleBackToDashboard}
          className="fixed top-6 left-6 z-50 flex items-center gap-3 px-5 py-3 bg-slate-900/80 backdrop-blur-xl border border-slate-700/50 rounded-2xl text-white font-medium shadow-2xl hover:bg-slate-800/90 transition-all group"
          whileHover={{ scale: 1.05, x: -3 }}
          whileTap={{ scale: 0.95 }}
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.5 }}
        >
          <ArrowLeft className="w-5 h-5 group-hover:-translate-x-1 transition-transform" />
          Kembali ke Dashboard
        </motion.button>
        <motion.div
          className="max-w-6xl mx-auto relative z-10"
          initial="hidden"
          animate="visible"
          variants={containerVariants}
        >
          {/* Header Card */}
          <motion.div
            className="bg-slate-900/80 backdrop-blur-xl rounded-3xl shadow-2xl border border-blue-900/50 overflow-hidden mb-8"
            variants={itemVariants}
            whileHover={{ scale: 1.01 }}
          >
            <div className="h-40 bg-gradient-to-r from-blue-600 to-indigo-700 relative overflow-hidden">
              <motion.div
                className="absolute inset-0 bg-gradient-to-t from-slate-900/50 to-transparent"
              />
            </div>

            <div className="px-8 pb-10 relative">
              <div className="flex flex-col lg:flex-row items-start lg:items-end gap-8 -mt-20">
                {/* Profile Photo */}
                <motion.div 
                  className="relative group"
                  variants={floatingVariants}
                  animate="animate"
                >
                  <div className="w-40 h-40 rounded-3xl border-4 border-slate-900 shadow-2xl overflow-hidden bg-gradient-to-br from-blue-600 to-indigo-700">
                    {userData?.profile_photo_url ? (
                      <img 
                        src={userData.profile_photo_url} 
                        alt={userData.full_name}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-white text-5xl font-bold">
                        {getInitials(userData?.full_name)}
                      </div>
                    )}
                  </div>
                  <motion.button
                    onClick={() => setShowPhotoModal(true)}
                    className="absolute bottom-3 right-3 bg-blue-600 rounded-2xl p-3 shadow-xl hover:bg-blue-700 transition-all"
                    whileHover={{ scale: 1.1 }}
                    whileTap={{ scale: 0.9 }}
                  >
                    <Camera className="w-6 h-6 text-white" />
                  </motion.button>
                </motion.div>

                {/* User Info */}
                <div className="flex-1">
                  <motion.h1 
                    className="text-4xl font-bold bg-gradient-to-r from-blue-400 to-indigo-400 bg-clip-text text-transparent mb-4"
                    variants={itemVariants}
                  >
                    {userData?.full_name}
                  </motion.h1>
                  <motion.div 
                    className="flex flex-wrap items-center gap-4"
                    variants={itemVariants}
                  >
                    <span className="inline-flex items-center gap-2 px-5 py-2 bg-blue-900/50 border border-blue-800/50 rounded-2xl text-blue-300 backdrop-blur-sm">
                      <Shield className="w-5 h-5" />
                      <span className="font-medium">{userData?.role_id?.name}</span>
                    </span>
                    <span className="inline-flex items-center gap-2 px-5 py-2 bg-indigo-900/50 border border-indigo-800/50 rounded-2xl text-indigo-300 backdrop-blur-sm">
                      <Building2 className="w-5 h-5" />
                      <span className="font-medium">{userData?.division_id?.name}</span>
                    </span>
                  </motion.div>
                </div>

                {/* Change Password Button */}
                <motion.button
                  onClick={() => setShowPasswordModal(true)}
                  className="inline-flex items-center gap-3 px-6 py-4 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white font-semibold rounded-2xl transition-all shadow-lg relative overflow-hidden group"
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                >
                  <Key className="w-5 h-5" />
                  Change Password
                  <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
                </motion.button>
              </div>
            </div>
          </motion.div>

          {/* Tabs Card */}
          <motion.div
            className="bg-slate-900/80 backdrop-blur-xl rounded-3xl shadow-2xl border border-blue-900/50"
            variants={itemVariants}
          >
            <div className="border-b border-slate-700/50">
              <nav className="flex gap-10 px-10 pt-6">
                <motion.button
                  onClick={() => setActiveTab('profile')}
                  className={`pb-4 border-b-4 font-medium text-lg flex items-center gap-3 transition-all ${
                    activeTab === 'profile'
                      ? 'border-blue-500 text-blue-400'
                      : 'border-transparent text-slate-400 hover:text-slate-300'
                  }`}
                  whileHover={{ y: -2 }}
                >
                  <User className="w-6 h-6" />
                  Profile Information
                </motion.button>
                <motion.button
                  onClick={() => setActiveTab('history')}
                  className={`pb-4 border-b-4 font-medium text-lg flex items-center gap-3 transition-all ${
                    activeTab === 'history'
                      ? 'border-blue-500 text-blue-400'
                      : 'border-transparent text-slate-400 hover:text-slate-300'
                  }`}
                  whileHover={{ y: -2 }}
                >
                  <History className="w-6 h-6" />
                  Activity History
                </motion.button>
              </nav>
            </div>

            <div className="p-10">
            {activeTab === 'profile' && (
                <motion.div 
                  className="space-y-8"
                  variants={containerVariants}
                  initial="hidden"
                  animate="visible"
                >
                  {/* Basic Information */}
                  <div>
                    <h3 className="text-lg font-semibold text-blue-400 mb-4 flex items-center gap-2">
                      <User className="w-5 h-5" />
                      Informasi Dasar
                    </h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <InfoCard icon={Mail} label="Email" value={userData?.email} />
                      <InfoCard icon={Phone} label="No. Telepon" value={userData?.phone} />
                      <InfoCard icon={User} label="Jenis Kelamin" value={userData?.gender === 'male' ? 'Laki-laki' : 'Perempuan'} />
                      <InfoCard icon={Calendar} label="Tanggal Lahir" value={formatDate(userData?.date_of_birth)} />
                      <InfoCard icon={User} label="NIK" value={userData?.national_id} />
                      <InfoCard icon={User} label="Kode Karyawan" value={userData?.employee_code} />
                    </div>
                  </div>

                  {/* Employment Information */}
                  <div>
                    <h3 className="text-lg font-semibold text-indigo-400 mb-4 flex items-center gap-2">
                      <Briefcase className="w-5 h-5" />
                      Informasi Pekerjaan
                    </h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <InfoCard icon={Shield} label="Role" value={userData?.role_id?.name} />
                      <InfoCard icon={Building2} label="Divisi" value={userData?.division_id?.name} />
                      <InfoCard icon={Briefcase} label="Tipe Pekerjaan" value={userData?.employment_type === 'contract' ? 'Kontrak' : 'Tetap'} />
                      <InfoCard icon={User} label="Status" value={userData?.status === 'active' ? 'Aktif' : 'Tidak Aktif'} />
                      <InfoCard icon={Calendar} label="Tanggal Bergabung" value={formatDate(userData?.hire_date)} />
                      <InfoCard icon={Calendar} label="Berakhir Kontrak" value={formatDate(userData?.expired_date)} />
                    </div>
                  </div>

                  {/* Address Information */}
                  {userData?.address && (
                    <div>
                      <h3 className="text-lg font-semibold text-purple-400 mb-4 flex items-center gap-2">
                        <Building2 className="w-5 h-5" />
                        Alamat
                      </h3>
                      <motion.div 
                        className="bg-slate-800/50 border border-slate-700/50 rounded-2xl p-5 backdrop-blur-sm"
                        variants={itemVariants}
                      >
                        <div className="space-y-3 text-slate-300">
                          <p><span className="text-slate-400">Domisili:</span> {userData.address.domicile}</p>
                          <p><span className="text-slate-400">Jalan:</span> {userData.address.street}</p>
                          <p><span className="text-slate-400">Kota:</span> {userData.address.city}</p>
                          <p><span className="text-slate-400">Provinsi:</span> {userData.address.state}</p>
                          <p><span className="text-slate-400">Kode Pos:</span> {userData.address.postal_code}</p>
                          <p><span className="text-slate-400">Negara:</span> {userData.address.country}</p>
                        </div>
                      </motion.div>
                    </div>
                  )}

                  {/* Emergency Contact */}
                  {userData?.emergency_contact_name && (
                    <div>
                      <h3 className="text-lg font-semibold text-orange-400 mb-4 flex items-center gap-2">
                        <Phone className="w-5 h-5" />
                        Kontak Darurat
                      </h3>
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <InfoCard icon={User} label="Nama" value={userData?.emergency_contact_name} />
                        <InfoCard icon={Phone} label="No. Telepon" value={userData?.emergency_contact_phone} />
                        <InfoCard icon={User} label="Hubungan" value={userData?.emergency_contact_relation} />
                      </div>
                    </div>
                  )}

                  {/* Salary Information */}
                  {userData?.salary_data && (
                    <div>
                      <h3 className="text-lg font-semibold text-green-400 mb-4 flex items-center gap-2">
                        <Sparkles className="w-5 h-5" />
                        Informasi Gaji
                      </h3>
                      <motion.div 
                        className="bg-slate-800/50 border border-slate-700/50 rounded-2xl p-5 backdrop-blur-sm"
                        variants={itemVariants}
                      >
                        <div className="space-y-4">
                          <div className="flex justify-between items-center pb-3 border-b border-slate-700/50">
                            <span className="text-slate-400">Gaji Pokok</span>
                            <span className="text-white font-semibold">Rp {parseFloat(userData.salary_data.base_salary).toLocaleString('id-ID')}</span>
                          </div>
                          
                          {userData.salary_data.allowances?.length > 0 && (
                            <div>
                              <p className="text-slate-400 text-sm mb-2">Tunjangan:</p>
                              {userData.salary_data.allowances.map((allowance, idx) => (
                                <div key={idx} className="flex justify-between items-center pl-4 py-1">
                                  <span className="text-slate-300 text-sm">• {allowance.name}</span>
                                  <span className="text-green-400 text-sm">+Rp {parseFloat(allowance.amount).toLocaleString('id-ID')}</span>
                                </div>
                              ))}
                            </div>
                          )}

                          {userData.salary_data.deductions?.length > 0 && (
                            <div>
                              <p className="text-slate-400 text-sm mb-2">Potongan:</p>
                              {userData.salary_data.deductions.map((deduction, idx) => (
                                <div key={idx} className="flex justify-between items-center pl-4 py-1">
                                  <span className="text-slate-300 text-sm">• {deduction.name} ({deduction.category})</span>
                                  <span className="text-red-400 text-sm">-Rp {parseFloat(deduction.amount).toLocaleString('id-ID')}</span>
                                </div>
                              ))}
                            </div>
                          )}

                          <div className="flex justify-between items-center pt-3 border-t border-slate-700/50">
                            <span className="text-white font-semibold">Take Home Pay</span>
                            <span className="text-green-400 font-bold text-lg">Rp {parseFloat(userData.salary_data.take_home_pay).toLocaleString('id-ID')}</span>
                          </div>

                          {userData.salary_data.bank_account?.account_number && (
                            <div className="mt-4 pt-4 border-t border-slate-700/50">
                              <p className="text-slate-400 text-sm mb-2">Informasi Bank:</p>
                              <div className="space-y-1 pl-4">
                                <p className="text-slate-300 text-sm">Bank: {userData.salary_data.bank_account.bank_name}</p>
                                <p className="text-slate-300 text-sm">No. Rekening: {userData.salary_data.bank_account.account_number}</p>
                                <p className="text-slate-300 text-sm">Atas Nama: {userData.salary_data.bank_account.account_holder_name}</p>
                              </div>
                            </div>
                          )}

                          {userData.salary_data.note && (
                            <div className="mt-4 p-3 bg-slate-900/50 rounded-xl border border-slate-700/30">
                              <p className="text-slate-300 text-sm italic">Catatan: {userData.salary_data.note}</p>
                            </div>
                          )}
                        </div>
                      </motion.div>
                    </div>
                  )}
                </motion.div>
              )}

              {activeTab === 'history' && (
                <div>
                  {historyLoading ? (
                    <div className="flex justify-center py-20">
                      <motion.div
                        animate={{ rotate: 360 }}
                        transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                        className="w-12 h-12 border-4 border-blue-500 border-t-transparent rounded-full"
                      />
                    </div>
                  ) : historyData.length === 0 ? (
                    <motion.div 
                      className="text-center py-20"
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                    >
                      <History className="w-20 h-20 text-slate-600 mx-auto mb-6" />
                      <p className="text-slate-400 text-lg">No history records found</p>
                    </motion.div>
                  ) : (
                    <motion.div 
                      className="space-y-6"
                      variants={containerVariants}
                      initial="hidden"
                      animate="visible"
                    >
                      {historyData.map((item, index) => (
                        <motion.div 
                          key={index} 
                          className="bg-slate-800/50 border border-slate-700/50 rounded-2xl p-6 hover:bg-slate-800/70 transition-all backdrop-blur-sm"
                          variants={itemVariants}
                          whileHover={{ scale: 1.02 }}
                        >
                          <div className="flex items-center justify-between mb-5">
                            <span className={`px-4 py-2 rounded-xl text-sm font-medium ${getEventTypeBadge(item.event_type)} backdrop-blur-sm`}>
                              {item.event_type.replace('_', ' ').toUpperCase()}
                            </span>
                            <span className="text-slate-400 flex items-center gap-2">
                              <Calendar className="w-4 h-4" />
                              {formatDate(item.effective_date)}
                            </span>
                          </div>

                          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                            {item.old_role && (
                              <div className="bg-slate-900/50 rounded-xl p-4 border border-slate-700/30">
                                <p className="text-xs text-slate-500 mb-2">Role Change</p>
                                <p className="text-slate-300">
                                  {item.old_role?.name} → <span className="font-semibold text-blue-400">{item.new_role?.name}</span>
                                </p>
                              </div>
                            )}
                            {item.old_division && (
                              <div className="bg-slate-900/50 rounded-xl p-4 border border-slate-700/30">
                                <p className="text-xs text-slate-500 mb-2">Division Change</p>
                                <p className="text-slate-300">
                                  {item.old_division?.name} → <span className="font-semibold text-indigo-400">{item.new_division?.name}</span>
                                </p>
                              </div>
                            )}
                            {item.old_salary && (
                              <div className="bg-slate-900/50 rounded-xl p-4 border border-slate-700/30">
                                <p className="text-xs text-slate-500 mb-2">Salary Change</p>
                                <p className="text-slate-300">
                                  Rp {parseFloat(item.old_salary).toLocaleString('id-ID')} → <span className="font-semibold text-green-400">Rp {parseFloat(item.new_salary).toLocaleString('id-ID')}</span>
                                </p>
                              </div>
                            )}
                          </div>

                          {item.notes && (
                            <div className="mt-5 p-4 bg-slate-900/50 rounded-xl border border-slate-700/30">
                              <p className="text-slate-300 italic">"{item.notes}"</p>
                            </div>
                          )}

                          {item.created_by && (
                            <p className="mt-4 text-sm text-slate-500">
                              Modified by: <span className="text-slate-300 font-medium">{item.created_by.full_name}</span>
                            </p>
                          )}
                        </motion.div>
                      ))}
                    </motion.div>
                  )}

                  {historyMeta && historyMeta.pagination.total_pages > 1 && (
                    <motion.div 
                      className="flex justify-center items-center gap-4 mt-10"
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                    >
                      <motion.button
                        onClick={() => setHistoryPage(p => Math.max(1, p - 1))}
                        disabled={historyPage === 1}
                        className="px-6 py-3 bg-slate-800/70 border border-slate-700 rounded-xl text-slate-300 disabled:opacity-50 disabled:cursor-not-allowed hover:bg-slate-700/70 transition-all"
                        whileHover={{ scale: historyPage === 1 ? 1 : 1.05 }}
                      >
                        Previous
                      </motion.button>
                      <span className="text-slate-400 font-medium">
                        Page {historyPage} of {historyMeta.pagination.total_pages}
                      </span>
                      <motion.button
                        onClick={() => setHistoryPage(p => p + 1)}
                        disabled={historyPage === historyMeta.pagination.total_pages}
                        className="px-6 py-3 bg-slate-800/70 border border-slate-700 rounded-xl text-slate-300 disabled:opacity-50 disabled:cursor-not-allowed hover:bg-slate-700/70 transition-all"
                        whileHover={{ scale: historyPage === historyMeta.pagination.total_pages ? 1 : 1.05 }}
                      >
                        Next
                      </motion.button>
                    </motion.div>
                  )}
                </div>
              )}
            </div>
          </motion.div>
        </motion.div>

        {/* Photo Upload Modal */}
        {showPhotoModal && (
          <motion.div 
            className="fixed inset-0 bg-black/70 backdrop-blur-lg flex items-center justify-center z-50 p-4"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
          >
            <motion.div 
              className="bg-slate-900/90 backdrop-blur-2xl rounded-3xl max-w-lg w-full p-8 border border-blue-900/50 shadow-2xl"
              initial={{ scale: 0.9, y: 50 }}
              animate={{ scale: 1, y: 0 }}
            >
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-2xl font-bold text-white">Upload Profile Photo</h3>
                <motion.button
                  onClick={() => {
                    setShowPhotoModal(false);
                    setSelectedFile(null);
                    setPreviewUrl(null);
                  }}
                  className="text-slate-400 hover:text-white transition-colors"
                  whileHover={{ scale: 1.1 }}
                >
                  <X className="w-7 h-7" />
                </motion.button>
              </div>

              <div className="mb-8">
                {previewUrl ? (
                  <div className="relative rounded-2xl overflow-hidden">
                    <img src={previewUrl} alt="Preview" className="w-full h-80 object-cover" />
                    <motion.button
                      onClick={() => {
                        setSelectedFile(null);
                        setPreviewUrl(null);
                      }}
                      className="absolute top-4 right-4 bg-slate-800/80 backdrop-blur-sm rounded-full p-3 shadow-lg hover:bg-slate-700/80"
                      whileHover={{ scale: 1.1 }}
                    >
                      <X className="w-5 h-5 text-white" />
                    </motion.button>
                  </div>
                ) : (
                  <label className="flex flex-col items-center justify-center w-full h-80 border-2 border-dashed border-slate-600 rounded-2xl cursor-pointer hover:border-blue-500 hover:bg-slate-800/30 transition-all group">
                    <Upload className="w-16 h-16 text-slate-500 group-hover:text-blue-400 mb-4 transition-colors" />
                    <span className="text-lg text-slate-300 group-hover:text-white">Click to upload image</span>
                    <span className="text-sm text-slate-500 mt-2">Max 5MB • JPG, PNG</span>
                    <input
                      type="file"
                      className="hidden"
                      accept="image/*"
                      onChange={handleFileSelect}
                    />
                  </label>
                )}
              </div>

              <div className="flex gap-4">
                <motion.button
                  onClick={() => {
                    setShowPhotoModal(false);
                    setSelectedFile(null);
                    setPreviewUrl(null);
                  }}
                  className="flex-1 py-4 bg-slate-800/70 border border-slate-700 rounded-2xl text-slate-300 hover:bg-slate-700/70 transition-all font-medium"
                  whileHover={{ scale: 1.03 }}
                >
                  Cancel
                </motion.button>
                <motion.button
                  onClick={handlePhotoUpload}
                  disabled={!selectedFile || uploading}
                  className="flex-1 py-4 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white rounded-2xl font-semibold disabled:opacity-50 disabled:cursor-not-allowed relative overflow-hidden group"
                  whileHover={{ scale: selectedFile ? 1.05 : 1 }}
                >
                  {uploading ? 'Uploading...' : 'Upload Photo'}
                </motion.button>
              </div>
            </motion.div>
          </motion.div>
        )}

        {/* Change Password Modal */}
        {showPasswordModal && (
          <motion.div 
            className="fixed inset-0 bg-black/70 backdrop-blur-lg flex items-center justify-center z-50 p-4"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
          >
            <motion.div 
              className="bg-slate-900/90 backdrop-blur-2xl rounded-3xl max-w-lg w-full p-8 border border-blue-900/50 shadow-2xl"
              initial={{ scale: 0.9, y: 50 }}
              animate={{ scale: 1, y: 0 }}
            >
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-2xl font-bold text-white flex items-center gap-3">
                  <Key className="w-8 h-8 text-blue-400" />
                  Change Password
                </h3>
                <motion.button
                  onClick={() => {
                    setShowPasswordModal(false);
                    setPasswordData({ currentPassword: '', newPassword: '', confirmPassword: '' });
                    setPasswordError('');
                    setPasswordSuccess(false);
                  }}
                  className="text-slate-400 hover:text-white transition-colors"
                  whileHover={{ scale: 1.1 }}
                >
                  <X className="w-7 h-7" />
                </motion.button>
              </div>

              {passwordSuccess && (
                <motion.div
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="mb-6 p-5 bg-green-900/30 border border-green-700/50 rounded-2xl flex items-center gap-4 backdrop-blur-sm"
                >
                  <Check className="w-8 h-8 text-green-400" />
                  <span className="text-green-300 font-medium">Password changed successfully!</span>
                </motion.div>
              )}

              {passwordError && (
                <motion.div
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="mb-6 p-5 bg-red-900/30 border border-red-700/50 rounded-2xl flex items-start gap-4 backdrop-blur-sm"
                >
                  <AlertCircle className="w-8 h-8 text-red-400 flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="text-red-300 font-medium">Password Change Failed</p>
                    <p className="text-red-400 text-sm mt-1">{passwordError}</p>
                  </div>
                </motion.div>
              )}

              <div className="space-y-6">
                {['current', 'new', 'confirm'].map((field, idx) => (
                  <motion.div key={field} variants={itemVariants}>
                    <label className="block text-sm font-medium text-slate-300 mb-2">
                      {field === 'current' ? 'Current Password' : field === 'new' ? 'New Password' : 'Confirm New Password'}
                    </label>
                    <div className="relative">
                      <input
                        type={showPasswords[field] ? 'text' : 'password'}
                        value={passwordData[field === 'current' ? 'currentPassword' : field === 'new' ? 'newPassword' : 'confirmPassword']}
                        onChange={(e) => setPasswordData({ ...passwordData, [field === 'current' ? 'currentPassword' : field === 'new' ? 'newPassword' : 'confirmPassword']: e.target.value })}
                        className="w-full pl-5 pr-14 py-4 bg-slate-800/50 border border-slate-700 rounded-2xl text-white placeholder-slate-500 focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all backdrop-blur-sm"
                        placeholder="••••••••"
                      />
                      <motion.button
                        type="button"
                        onClick={() => setShowPasswords({ ...showPasswords, [field]: !showPasswords[field] })}
                        className="absolute inset-y-0 right-0 pr-5 flex items-center"
                        whileHover={{ scale: 1.1 }}
                        whileTap={{ scale: 0.9 }}
                      >
                        {showPasswords[field] ? (
                          <EyeOff className="h-6 w-6 text-slate-400 hover:text-blue-400 transition-colors" />
                        ) : (
                          <Eye className="h-6 w-6 text-slate-400 hover:text-blue-400 transition-colors" />
                        )}
                      </motion.button>
                    </div>
                  </motion.div>
                ))}
              </div>

              <div className="flex gap-4 mt-8">
                <motion.button
                  onClick={() => {
                    setShowPasswordModal(false);
                    setPasswordData({ currentPassword: '', newPassword: '', confirmPassword: '' });
                    setPasswordError('');
                    setPasswordSuccess(false);
                  }}
                  className="flex-1 py-4 bg-slate-800/70 border border-slate-700 rounded-2xl text-slate-300 hover:bg-slate-700/70 transition-all font-medium"
                  whileHover={{ scale: 1.03 }}
                >
                  Cancel
                </motion.button>
                <motion.button
                  onClick={handlePasswordChange}
                  className="flex-1 py-4 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white rounded-2xl font-semibold relative overflow-hidden group"
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                >
                  <motion.div
                    className="absolute inset-0 bg-gradient-to-r from-transparent via-white to-transparent opacity-0 group-hover:opacity-20"
                    animate={{ x: ['-100%', '100%'] }}
                    transition={{ duration: 1.5, repeat: Infinity, ease: "linear" }}
                  />
                  Change Password
                </motion.button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </div>
    </>
  );
};

const InfoCard = ({ icon: Icon, label, value }) => (
  <motion.div 
    className="bg-slate-800/50 border border-slate-700/50 rounded-2xl p-6 hover:bg-slate-800/70 transition-all backdrop-blur-sm"
    variants={{
      hidden: { y: 20, opacity: 0 },
      visible: { y: 0, opacity: 1 }
    }}
    whileHover={{ scale: 1.03, y: -5 }}
  >
    <div className="flex items-center gap-5">
      <div className="p-4 bg-blue-900/30 rounded-2xl border border-blue-800/50">
        <Icon className="w-7 h-7 text-blue-400" />
      </div>
      <div>
        <p className="text-sm text-slate-400 mb-1">{label}</p>
        <p className="text-lg font-semibold text-white">{value || 'N/A'}</p>
      </div>
    </div>
  </motion.div>
);

export default UserProfile;