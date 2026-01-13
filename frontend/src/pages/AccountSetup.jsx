import React, { useState, useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { verifySetupToken, submitAccountSetup } from '../utils/api';
import toast, { Toaster } from 'react-hot-toast';
import { 
  Eye, 
  EyeOff, 
  User, 
  Mail, 
  Phone, 
  Lock, 
  Calendar, 
  MapPin, 
  IdCard, 
  Users,
  CheckCircle,
  AlertCircle,
  Upload,
  X
} from 'lucide-react';

const AccountSetup = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const token = searchParams.get('token');

  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [requestData, setRequestData] = useState(null);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [profilePhotoPreview, setProfilePhotoPreview] = useState(null);
  const [profilePhotoFile, setProfilePhotoFile] = useState(null);

  const [formData, setFormData] = useState({
    password: '',
    confirmPassword: '',
    profile_photo_url: '',
    date_of_birth: '',
    national_id: '',
    address: '',
    city: '',
    state: '',
    postal_code: '',
    country: 'Indonesia',
    emergency_contact_name: '',
    emergency_contact_phone: '',
    emergency_contact_relation: '',
  });

  useEffect(() => {
    if (!token) {
      setError('Token tidak ditemukan');
      setLoading(false);
      return;
    }

    verifyToken();
  }, [token]);

  const verifyToken = async () => {
    try {
      setLoading(true);
      setError('');
      const result = await verifySetupToken(token);
      
      if (result.valid && result.data) {
        setRequestData(result.data);
        // Pre-fill some fields from request data
        setFormData(prev => ({
          ...prev,
          // Phone might be in request data
        }));
      } else {
        setError('Token tidak valid atau sudah kedaluwarsa');
      }
    } catch (err) {
      setError(err.message || 'Gagal memverifikasi token');
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value,
    }));
  };

  const handlePhotoSelect = (e) => {
    const file = e.target.files[0];
    if (file) {
      if (!file.type.startsWith('image/')) {
        toast.error('File harus berupa gambar');
        return;
      }
      if (file.size > 5 * 1024 * 1024) {
        toast.error('Ukuran file maksimal 5MB');
        return;
      }
      setProfilePhotoFile(file);
      setProfilePhotoPreview(URL.createObjectURL(file));
    }
  };

  const removePhoto = () => {
    setProfilePhotoFile(null);
    setProfilePhotoPreview(null);
  };

  const uploadProfilePhoto = async () => {
    if (!profilePhotoFile) return null;

    try {
      const formDataUpload = new FormData();
      formDataUpload.append('file', profilePhotoFile);
      
      // Upload to cloudinary endpoint for account setup
      const API_BASE = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000/api/v1';
      const response = await fetch(`${API_BASE}/files/upload`, {
        method: 'POST',
        credentials: "include",
        body: formDataUpload,
      });

      if (!response.ok) {
        const error = await response.json().catch(() => ({}));
        throw new Error(error.message || 'Gagal mengupload foto profil');
      }

      const result = await response.json();
      return result.data?.url || result.url;
    } catch (err) {
      console.error('Upload error:', err);
      toast.error('Gagal mengupload foto profil. Anda bisa melanjutkan tanpa foto.');
      return null;
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    // Validation
    if (!formData.password) {
      setError('Password wajib diisi');
      return;
    }

    if (formData.password.length < 8) {
      setError('Password minimal 8 karakter');
      return;
    }

    if (formData.password !== formData.confirmPassword) {
      setError('Password dan konfirmasi password tidak sama');
      return;
    }

    try {
      setSubmitting(true);

      // Upload profile photo if selected
      let profilePhotoUrl = formData.profile_photo_url;
      if (profilePhotoFile) {
        const uploadedUrl = await uploadProfilePhoto();
        if (uploadedUrl) {
          profilePhotoUrl = uploadedUrl;
        }
      }

      // Prepare submit data (exclude confirmPassword)
      const submitData = {
        password: formData.password,
        profile_photo_url: profilePhotoUrl || null,
        date_of_birth: formData.date_of_birth || null,
        national_id: formData.national_id || null,
        address: formData.address || null,
        city: formData.city || null,
        state: formData.state || null,
        postal_code: formData.postal_code || null,
        country: formData.country || 'Indonesia',
        emergency_contact_name: formData.emergency_contact_name || null,
        emergency_contact_phone: formData.emergency_contact_phone || null,
        emergency_contact_relation: formData.emergency_contact_relation || null,
      };

      // Remove null values
      Object.keys(submitData).forEach(key => {
        if (submitData[key] === null || submitData[key] === '') {
          delete submitData[key];
        }
      });

      const result = await submitAccountSetup(token, submitData);

      toast.success('Akun berhasil dibuat! Silakan login.');
      
      // Redirect to login after 2 seconds
      setTimeout(() => {
        navigate('/');
      }, 2000);
    } catch (err) {
      setError(err.message || 'Gagal menyelesaikan setup akun');
      toast.error(err.message || 'Gagal menyelesaikan setup akun');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Memverifikasi token...</p>
        </div>
      </div>
    );
  }

  if (error && !requestData) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100 p-4">
        <div className="bg-white rounded-2xl shadow-xl p-8 max-w-md w-full text-center">
          <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <AlertCircle className="w-8 h-8 text-red-600" />
          </div>
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Token Tidak Valid</h1>
          <p className="text-gray-600 mb-6">{error}</p>
          <button
            onClick={() => navigate('/')}
            className="px-6 py-3 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors"
          >
            Kembali ke Login
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 py-12 px-4">
      <Toaster position="top-right" />
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <CheckCircle className="w-8 h-8 text-green-600" />
          </div>
          <h1 className="text-3xl font-bold text-gray-900 mb-2">
            Selamat! Permintaan Akun Anda Disetujui
          </h1>
          <p className="text-gray-600">
            Lengkapi informasi di bawah ini untuk menyelesaikan pendaftaran akun Anda
          </p>
        </div>

        {/* Account Info Card */}
        {requestData && (
          <div className="bg-white rounded-lg shadow-md p-6 mb-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Informasi Akun</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="flex items-center gap-3">
                <User className="w-5 h-5 text-gray-400" />
                <div>
                  <p className="text-sm text-gray-500">Nama</p>
                  <p className="font-medium text-gray-900">{requestData.requester_name}</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <Mail className="w-5 h-5 text-gray-400" />
                <div>
                  <p className="text-sm text-gray-500">Email</p>
                  <p className="font-medium text-gray-900">{requestData.email}</p>
                </div>
              </div>
              {requestData.phone && (
                <div className="flex items-center gap-3">
                  <Phone className="w-5 h-5 text-gray-400" />
                  <div>
                    <p className="text-sm text-gray-500">Telepon</p>
                    <p className="font-medium text-gray-900">{requestData.phone}</p>
                  </div>
                </div>
              )}
              {requestData.requested_role && (
                <div className="flex items-center gap-3">
                  <IdCard className="w-5 h-5 text-gray-400" />
                  <div>
                    <p className="text-sm text-gray-500">Role</p>
                    <p className="font-medium text-gray-900">{requestData.requested_role.name}</p>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Form */}
        <div className="bg-white rounded-2xl shadow-xl p-8">
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Error Alert */}
            {error && (
              <div className="p-4 bg-red-50 border border-red-200 rounded-lg flex items-start gap-3">
                <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
                <div className="flex-1">
                  <p className="text-sm text-red-800 font-medium">Error</p>
                  <p className="text-sm text-red-700 mt-1">{error}</p>
                </div>
              </div>
            )}

            {/* Password Section */}
            <div className="border-b border-gray-200 pb-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
                <Lock className="w-5 h-5" />
                Password
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-2">
                    Password <span className="text-red-500">*</span>
                  </label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                      <Lock className="h-5 w-5 text-gray-400" />
                    </div>
                    <input
                      id="password"
                      name="password"
                      type={showPassword ? 'text' : 'password'}
                      required
                      value={formData.password}
                      onChange={handleChange}
                      className="block w-full pl-10 pr-12 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                      placeholder="Minimal 8 karakter"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute inset-y-0 right-0 pr-3 flex items-center"
                    >
                      {showPassword ? (
                        <EyeOff className="h-5 w-5 text-gray-400 hover:text-gray-600" />
                      ) : (
                        <Eye className="h-5 w-5 text-gray-400 hover:text-gray-600" />
                      )}
                    </button>
                  </div>
                </div>
                <div>
                  <label htmlFor="confirmPassword" className="block text-sm font-medium text-gray-700 mb-2">
                    Konfirmasi Password <span className="text-red-500">*</span>
                  </label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                      <Lock className="h-5 w-5 text-gray-400" />
                    </div>
                    <input
                      id="confirmPassword"
                      name="confirmPassword"
                      type={showConfirmPassword ? 'text' : 'password'}
                      required
                      value={formData.confirmPassword}
                      onChange={handleChange}
                      className="block w-full pl-10 pr-12 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                      placeholder="Ulangi password"
                    />
                    <button
                      type="button"
                      onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                      className="absolute inset-y-0 right-0 pr-3 flex items-center"
                    >
                      {showConfirmPassword ? (
                        <EyeOff className="h-5 w-5 text-gray-400 hover:text-gray-600" />
                      ) : (
                        <Eye className="h-5 w-5 text-gray-400 hover:text-gray-600" />
                      )}
                    </button>
                  </div>
                </div>
              </div>
            </div>

            {/* Profile Photo Section */}
            <div className="border-b border-gray-200 pb-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
                <Upload className="w-5 h-5" />
                Foto Profil
              </h3>
              <div className="flex items-start gap-6">
                {profilePhotoPreview ? (
                  <div className="relative">
                    <img
                      src={profilePhotoPreview}
                      alt="Preview"
                      className="w-32 h-32 rounded-full object-cover border-4 border-gray-200"
                    />
                    <button
                      type="button"
                      onClick={removePhoto}
                      className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full p-1 hover:bg-red-600"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                ) : (
                  <div className="w-32 h-32 rounded-full bg-gray-100 border-4 border-gray-200 flex items-center justify-center">
                    <User className="w-12 h-12 text-gray-400" />
                  </div>
                )}
                <div className="flex-1">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Upload Foto Profil
                  </label>
                  <label className="flex flex-col items-center justify-center w-full h-32 border-2 border-dashed border-gray-300 rounded-lg cursor-pointer hover:bg-gray-50">
                    <Upload className="w-8 h-8 text-gray-400 mb-2" />
                    <span className="text-sm text-gray-600">Klik untuk upload</span>
                    <span className="text-xs text-gray-400 mt-1">Max 5MB, Format: JPG/PNG</span>
                    <input
                      type="file"
                      className="hidden"
                      accept="image/*"
                      onChange={handlePhotoSelect}
                    />
                  </label>
                </div>
              </div>
            </div>

            {/* Personal Information Section */}
            <div className="border-b border-gray-200 pb-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
                <User className="w-5 h-5" />
                Informasi Pribadi
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label htmlFor="date_of_birth" className="block text-sm font-medium text-gray-700 mb-2">
                    Tanggal Lahir
                  </label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                      <Calendar className="h-5 w-5 text-gray-400" />
                    </div>
                    <input
                      id="date_of_birth"
                      name="date_of_birth"
                      type="date"
                      value={formData.date_of_birth}
                      onChange={handleChange}
                      className="block w-full pl-10 pr-3 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                    />
                  </div>
                </div>
                <div>
                  <label htmlFor="national_id" className="block text-sm font-medium text-gray-700 mb-2">
                    NIK / Nomor Identitas
                  </label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                      <IdCard className="h-5 w-5 text-gray-400" />
                    </div>
                    <input
                      id="national_id"
                      name="national_id"
                      type="text"
                      value={formData.national_id}
                      onChange={handleChange}
                      className="block w-full pl-10 pr-3 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                      placeholder="Nomor KTP/NIK"
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Address Section */}
            <div className="border-b border-gray-200 pb-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
                <MapPin className="w-5 h-5" />
                Alamat
              </h3>
              <div className="space-y-4">
                <div>
                  <label htmlFor="address" className="block text-sm font-medium text-gray-700 mb-2">
                    Alamat Lengkap
                  </label>
                  <textarea
                    id="address"
                    name="address"
                    rows="3"
                    value={formData.address}
                    onChange={handleChange}
                    className="block w-full px-3 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                    placeholder="Jl. Contoh No. 123"
                  />
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <label htmlFor="city" className="block text-sm font-medium text-gray-700 mb-2">
                      Kota
                    </label>
                    <input
                      id="city"
                      name="city"
                      type="text"
                      value={formData.city}
                      onChange={handleChange}
                      className="block w-full px-3 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                      placeholder="Jakarta"
                    />
                  </div>
                  <div>
                    <label htmlFor="state" className="block text-sm font-medium text-gray-700 mb-2">
                      Provinsi
                    </label>
                    <input
                      id="state"
                      name="state"
                      type="text"
                      value={formData.state}
                      onChange={handleChange}
                      className="block w-full px-3 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                      placeholder="DKI Jakarta"
                    />
                  </div>
                  <div>
                    <label htmlFor="postal_code" className="block text-sm font-medium text-gray-700 mb-2">
                      Kode Pos
                    </label>
                    <input
                      id="postal_code"
                      name="postal_code"
                      type="text"
                      value={formData.postal_code}
                      onChange={handleChange}
                      className="block w-full px-3 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                      placeholder="12345"
                    />
                  </div>
                </div>
                <div>
                  <label htmlFor="country" className="block text-sm font-medium text-gray-700 mb-2">
                    Negara
                  </label>
                  <input
                    id="country"
                    name="country"
                    type="text"
                    value={formData.country}
                    onChange={handleChange}
                    className="block w-full px-3 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                    placeholder="Indonesia"
                  />
                </div>
              </div>
            </div>

            {/* Emergency Contact Section */}
            <div>
              <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
                <Users className="w-5 h-5" />
                Kontak Darurat
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label htmlFor="emergency_contact_name" className="block text-sm font-medium text-gray-700 mb-2">
                    Nama Kontak Darurat
                  </label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                      <User className="h-5 w-5 text-gray-400" />
                    </div>
                    <input
                      id="emergency_contact_name"
                      name="emergency_contact_name"
                      type="text"
                      value={formData.emergency_contact_name}
                      onChange={handleChange}
                      className="block w-full pl-10 pr-3 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                      placeholder="Nama lengkap"
                    />
                  </div>
                </div>
                <div>
                  <label htmlFor="emergency_contact_phone" className="block text-sm font-medium text-gray-700 mb-2">
                    Nomor Telepon
                  </label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                      <Phone className="h-5 w-5 text-gray-400" />
                    </div>
                    <input
                      id="emergency_contact_phone"
                      name="emergency_contact_phone"
                      type="tel"
                      value={formData.emergency_contact_phone}
                      onChange={handleChange}
                      className="block w-full pl-10 pr-3 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                      placeholder="081234567890"
                    />
                  </div>
                </div>
                <div>
                  <label htmlFor="emergency_contact_relation" className="block text-sm font-medium text-gray-700 mb-2">
                    Hubungan
                  </label>
                  <input
                    id="emergency_contact_relation"
                    name="emergency_contact_relation"
                    type="text"
                    value={formData.emergency_contact_relation}
                    onChange={handleChange}
                    className="block w-full px-3 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                    placeholder="Ayah, Ibu, Saudara, dll"
                  />
                </div>
              </div>
            </div>

            {/* Submit Button */}
            <div className="pt-6">
              <button
                type="submit"
                disabled={submitting}
                className="w-full py-3 px-4 bg-indigo-600 hover:bg-indigo-700 text-white font-medium rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {submitting ? (
                  <span className="flex items-center justify-center">
                    <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    Menyimpan...
                  </span>
                ) : (
                  'Selesaikan Pendaftaran'
                )}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};

export default AccountSetup;

