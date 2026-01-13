import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { register } from "../utils/api";
import { fetchDivisions } from "../utils/api";
import toast, { Toaster } from "react-hot-toast";
import { motion } from "framer-motion";
import { 
  Sparkles, User, Mail, Phone, Building2, FileText, Upload, Send, 
  Loader2, CheckCircle, Calendar, MapPin, Users, Plus, X, Lock, Eye, EyeOff
} from "lucide-react";

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

const Register = () => {
  const navigate = useNavigate();
  const [formData, setFormData] = useState({
    email: "",
    password: "",
    full_name: "",
    phone: "",
    division_id: "",
    gender: "male",
    date_of_birth: "",
    national_id: "",
    npwp: "",
    address_domicile: "",
    address_street: "",
    address_city: "",
    address_state: "",
    address_subdistrict: "",        // ← BARU: Kecamatan
    address_postal_code: "",
    address_country: "Indonesia",
    emergency_contact_name: "",
    emergency_contact_phone: "",
    emergency_contact_relation: "",
  });
  const [documents, setDocuments] = useState({
    id_card: null,
    resume: null,
    npwp_file: null,
    certificates: [],
  });
  const [divisions, setDivisions] = useState([]);
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  
  // State untuk wilayah Indonesia (api.datawilayah.com)
  const [provinceOptions, setProvinceOptions] = useState([]);
  const [cityOptions, setCityOptions] = useState([]);
  const [subdistrictOptions, setSubdistrictOptions] = useState([]);
  
  const [loadingProvinces, setLoadingProvinces] = useState(false);
  const [loadingCities, setLoadingCities] = useState(false);
  const [loadingSubdistricts, setLoadingSubdistricts] = useState(false);

  useEffect(() => {
    const loadDivisions = async () => {
      try {
        const result = await fetchDivisions({ limit: 100 });
        setDivisions(result.data || []);
      } catch (err) {
        toast.error("Gagal memuat data divisi");
      }
    };
    loadDivisions();
    
    // Load provinsi saat komponen mount
    loadProvinces();
  }, []);

  // Load Provinsi
const loadProvinces = async () => {
  setLoadingProvinces(true);
  try {
    const response = await fetch('https://api.datawilayah.com/api/provinsi.json');
    const result = await response.json();
    
    if (result.status === "success" && Array.isArray(result.data)) {
      setProvinceOptions(result.data);  // ← hanya ambil result.data
    } else {
      setProvinceOptions([]);
      toast.error('Format data provinsi tidak valid');
    }
  } catch (error) {
    console.error('Error loading provinces:', error);
    toast.error('Gagal memuat data provinsi');
    setProvinceOptions([]);
  } finally {
    setLoadingProvinces(false);
  }
};

// Load Kabupaten/Kota
const loadCities = async (provinceCode) => {
  if (!provinceCode) {
    setCityOptions([]);
    setSubdistrictOptions([]);
    return;
  }
  
  setLoadingCities(true);
  try {
    const response = await fetch(`https://api.datawilayah.com/api/kabupaten_kota/${provinceCode}.json`);
    const result = await response.json();
    
    if (result.status === "success" && Array.isArray(result.data)) {
      setCityOptions(result.data);  // ← ambil result.data
    } else {
      setCityOptions([]);
    }
  } catch (error) {
    console.error('Error loading cities:', error);
    toast.error('Gagal memuat data kabupaten/kota');
    setCityOptions([]);
  } finally {
    setLoadingCities(false);
  }
};

// Load Kecamatan
const loadSubdistricts = async (cityCode) => {
  if (!cityCode) {
    setSubdistrictOptions([]);
    return;
  }
  
  setLoadingSubdistricts(true);
  try {
    const response = await fetch(`https://api.datawilayah.com/api/kecamatan/${cityCode}.json`);
    const result = await response.json();
    
    if (result.status === "success" && Array.isArray(result.data)) {
      setSubdistrictOptions(result.data);  // ← ambil result.data
    } else {
      setSubdistrictOptions([]);
    }
  } catch (error) {
    console.error('Error loading subdistricts:', error);
    toast.error('Gagal memuat data kecamatan');
    setSubdistrictOptions([]);
  } finally {
    setLoadingSubdistricts(false);
  }
};

  // Handle perubahan Provinsi
  const handleProvinceChange = (e) => {
    const selectedProvince = provinceOptions.find(p => p.nama_wilayah === e.target.value);
    const provinceCode = selectedProvince ? selectedProvince.kode_wilayah : '';
    
    setFormData({ 
      ...formData, 
      address_state: e.target.value,
      address_city: '',
      address_subdistrict: ''
    });
    
    loadCities(provinceCode);
    setSubdistrictOptions([]);
  };

  // Handle perubahan Kabupaten/Kota
  const handleCityChange = (e) => {
    const selectedCity = cityOptions.find(c => c.nama_wilayah === e.target.value);
    const cityCode = selectedCity ? selectedCity.kode_wilayah : '';
    
    setFormData({ 
      ...formData, 
      address_city: e.target.value,
      address_subdistrict: ''
    });
    
    loadSubdistricts(cityCode);
  };

  // Format nomor telepon
  const formatPhoneNumber = (value) => {
    let cleaned = value.replace(/\D/g, '');
    if (cleaned.startsWith('0')) {
      cleaned = '62' + cleaned.substring(1);
    }
    if (!cleaned.startsWith('62')) {
      cleaned = '62' + cleaned;
    }
    
    let formatted = '+' + cleaned.substring(0, 2);
    if (cleaned.length > 2) formatted += ' ' + cleaned.substring(2, 5);
    if (cleaned.length > 5) formatted += ' ' + cleaned.substring(5, 9);
    if (cleaned.length > 9) formatted += ' ' + cleaned.substring(9, 13);
    
    return formatted;
  };

  const handlePhoneChange = (e, field) => {
    const formatted = formatPhoneNumber(e.target.value);
    setFormData({ ...formData, [field]: formatted });
  };

  const handleFileChange = (type, file) => {
    if (file) {
      if (type === "certificates") {
        setDocuments((prev) => ({
          ...prev,
          certificates: [...prev.certificates, file],
        }));
      } else {
        setDocuments((prev) => ({
          ...prev,
          [type]: file,
        }));
      }
    }
  };

  const removeCertificate = (index) => {
    setDocuments((prev) => ({
      ...prev,
      certificates: prev.certificates.filter((_, i) => i !== index),
    }));
  };

  // Helper function to copy KTP address to domicile address
  const copyKTPAddressToDomicile = () => {
    const ktpAddress = `${formData.address_street || ""}, ${formData.address_subdistrict || ""}, ${formData.address_city || ""}, ${formData.address_state || ""} ${formData.address_postal_code || ""}`.trim();
    if (ktpAddress && ktpAddress !== ",") {
      setFormData({
        ...formData,
        address_domicile: ktpAddress,
      });
      toast.success("Alamat KTP telah disalin ke alamat domisili");
    } else {
      toast.error("Pastikan alamat KTP sudah diisi");
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (loading) return;

    try {
      setLoading(true);

      const formDataToSend = new FormData();
      
      Object.keys(formData).forEach((key) => {
        if (formData[key]) {
          formDataToSend.append(key, formData[key]);
        }
      });

      if (documents.id_card) formDataToSend.append("id_card", documents.id_card);
      if (documents.resume) formDataToSend.append("resume", documents.resume);
      if (documents.npwp_file) formDataToSend.append("npwp_file", documents.npwp_file);
      documents.certificates.forEach((cert) => {
        formDataToSend.append("certificates", cert);
      });

      const result = await register(formDataToSend);

      toast.success("Registrasi berhasil! Akun Anda sedang menunggu persetujuan HR.");
      
      // Reset form
      setFormData({
        email: "", password: "", full_name: "", phone: "", division_id: "",
        gender: "male", date_of_birth: "", national_id: "", npwp: "",
        address_domicile: "", address_street: "", address_city: "", address_state: "", address_subdistrict: "",
        address_postal_code: "", address_country: "Indonesia",
        emergency_contact_name: "", emergency_contact_phone: "", emergency_contact_relation: "",
      });
      setDocuments({ id_card: null, resume: null, npwp_file: null, certificates: [] });

      setTimeout(() => navigate("/"), 2000);
    } catch (err) {
      toast.error(err.message || "Gagal melakukan registrasi");
    } finally {
      setLoading(false);
    }
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
          className="max-w-4xl mx-auto relative z-10"
          variants={containerVariants}
          initial="hidden"
          animate="visible"
        >
          {/* Header */}
          <motion.div variants={itemVariants} className="text-center mb-12">
            <h1 className="text-5xl font-bold bg-gradient-to-r from-blue-400 to-indigo-400 bg-clip-text text-transparent flex items-center justify-center gap-5">
              <User className="w-14 h-14 text-blue-400" />
              Registrasi Akun Baru
            </h1>
            <p className="text-slate-400 mt-4 text-xl flex items-center justify-center gap-3">
              <Sparkles className="w-6 h-6" />
              Isi data lengkap dan unggah dokumen pendukung
            </p>
          </motion.div>

          {/* Form Card */}
          <motion.div 
            className="bg-slate-900/80 backdrop-blur-xl rounded-3xl shadow-2xl border border-blue-900/50 p-10"
            variants={itemVariants}
          >
            <form onSubmit={handleSubmit} className="space-y-8">
              {/* Account Info Section */}
              <motion.div variants={itemVariants}>
                <h3 className="text-2xl font-bold text-white mb-6 flex items-center gap-3">
                  <Lock className="w-8 h-8 text-indigo-400" />
                  Informasi Akun
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                  <div>
                    <label className="flex items-center gap-3 text-lg font-medium text-slate-300 mb-3">
                      <Mail className="w-6 h-6 text-blue-400" />
                      Email *
                    </label>
                    <input
                      type="email"
                      required
                      value={formData.email}
                      onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                      className="w-full px-6 py-4 bg-slate-800/50 border border-slate-700 rounded-2xl text-white placeholder-slate-500 focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all backdrop-blur-sm"
                      placeholder="email@contoh.com"
                    />
                  </div>

                  <div>
                      <label className="flex items-center gap-2 text-sm font-medium text-slate-300 mb-2">
                        <Lock className="w-4 h-4 text-blue-400" />
                        Password *
                      </label>
                
                      <div className="relative">
                        <input
                          required
                          type={showPassword ? "text" : "password"}
                          value={formData.password}
                          onChange={(e) =>
                            setFormData({ ...formData, password: e.target.value })
                          }
                          className="w-full px-4 py-3 pr-12 bg-slate-800/60 border border-slate-700 rounded-xl text-white focus:ring-2 focus:ring-blue-500"
                        />
                
                        <button
                          type="button"
                          onClick={() => setShowPassword(!showPassword)}
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white"
                        >
                          {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
                        </button>
                      </div>
                    </div>
                </div>
              </motion.div>

              {/* Personal Info */}
              <motion.div variants={itemVariants}>
                <h3 className="text-2xl font-bold text-white mb-6 flex items-center gap-3">
                  <User className="w-8 h-8 text-indigo-400" />
                  Informasi Pribadi
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                  <div>
                    <label className="flex items-center gap-3 text-lg font-medium text-slate-300 mb-3">
                      <User className="w-6 h-6 text-blue-400" />
                      Nama Lengkap *
                    </label>
                    <input
                      type="text"
                      required
                      value={formData.full_name}
                      onChange={(e) => setFormData({ ...formData, full_name: e.target.value })}
                      className="w-full px-6 py-4 bg-slate-800/50 border border-slate-700 rounded-2xl text-white placeholder-slate-500 focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all backdrop-blur-sm"
                      placeholder="Masukkan nama lengkap"
                    />
                  </div>

                  <div>
                    <label className="flex items-center gap-3 text-lg font-medium text-slate-300 mb-3">
                      <Phone className="w-6 h-6 text-blue-400" />
                      Nomor Telepon *
                    </label>
                    <input
                      type="tel"
                      required
                      value={formData.phone}
                      onChange={(e) => handlePhoneChange(e, 'phone')}
                      className="w-full px-6 py-4 bg-slate-800/50 border border-slate-700 rounded-2xl text-white placeholder-slate-500 focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all backdrop-blur-sm"
                      placeholder="+62 812 3456 7890"
                    />
                  </div>

                  <div>
                    <label className="flex items-center gap-3 text-lg font-medium text-slate-300 mb-3">
                      <Users className="w-6 h-6 text-indigo-400" />
                      Jenis Kelamin *
                    </label>
                    <select
                      required
                      value={formData.gender}
                      onChange={(e) => setFormData({ ...formData, gender: e.target.value })}
                      className="w-full px-6 py-4 bg-slate-800/50 border border-slate-700 rounded-2xl text-white focus:ring-2 focus:ring-blue-500 backdrop-blur-sm"
                    >
                      <option value="male">Laki-laki</option>
                      <option value="female">Perempuan</option>
                      <option value="other">Lainnya</option>
                    </select>
                  </div>

                  <div>
                    <label className="flex items-center gap-3 text-lg font-medium text-slate-300 mb-3">
                      <Calendar className="w-6 h-6 text-blue-400" />
                      Tanggal Lahir *
                    </label>
                    <input
                      type="date"
                      required
                      value={formData.date_of_birth}
                      onChange={(e) => setFormData({ ...formData, date_of_birth: e.target.value })}
                      className="w-full px-6 py-4 bg-slate-800/50 border border-slate-700 rounded-2xl text-white placeholder-slate-500 focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all backdrop-blur-sm"
                    />
                  </div>

                  <div>
                    <label className="flex items-center gap-3 text-lg font-medium text-slate-300 mb-3">
                      <FileText className="w-6 h-6 text-blue-400" />
                      NIK *
                    </label>
                    <input
                      required
                      type="text"
                      value={formData.national_id}
                      onChange={(e) => setFormData({ ...formData, national_id: e.target.value })}
                      className="w-full px-6 py-4 bg-slate-800/50 border border-slate-700 rounded-2xl text-white placeholder-slate-500 focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all backdrop-blur-sm"
                      placeholder="Contoh: 3173XXXXXXXXXXXX (sesuai KTP)"
                    />
                  </div>

                  <div>
                    <label className="flex items-center gap-3 text-lg font-medium text-slate-300 mb-3">
                      <FileText className="w-6 h-6 text-indigo-400" />
                      NPWP (Opsional)
                    </label>
                    <input
                      type="text"
                      value={formData.npwp}
                      onChange={(e) => setFormData({ ...formData, npwp: e.target.value })}
                      className="w-full px-6 py-4 bg-slate-800/50 border border-slate-700 rounded-2xl text-white placeholder-slate-500 focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all backdrop-blur-sm"
                      placeholder="Contoh: 12.345.678.9-012.000"
                    />
                  </div>


                  <div>
                    <label className="flex items-center gap-3 text-lg font-medium text-slate-300 mb-3">
                      <Building2 className="w-6 h-6 text-indigo-400" />
                      Divisi yang Diinginkan
                    </label>
                    <select
                      value={formData.division_id}
                      onChange={(e) => setFormData({ ...formData, division_id: e.target.value })}
                      className="w-full px-6 py-4 bg-slate-800/50 border border-slate-700 rounded-2xl text-white focus:ring-2 focus:ring-blue-500 backdrop-blur-sm"
                    >
                      <option value="">Pilih Divisi</option>
                      {divisions.map((div) => (
                        <option key={div._id} value={div._id}>
                          {div.name}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              </motion.div>
              
              {/* Address Section - DIPERBARUI */}
              <motion.div variants={itemVariants}>
                <h3 className="text-2xl font-bold text-white mb-6 flex items-center gap-3">
                  <MapPin className="w-8 h-8 text-indigo-400" />
                  Alamat sesuai KTP
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                  <div className="md:col-span-2">
                    <label className="block text-sm font-medium text-slate-300 mb-2">Jalan / Alamat Lengkap *</label>
                    <input
                      type="text"
                      required
                      value={formData.address_street}
                      onChange={(e) => setFormData({ ...formData, address_street: e.target.value })}
                      className="w-full px-6 py-4 bg-slate-800/50 border border-slate-700 rounded-2xl text-white placeholder-slate-500 focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all backdrop-blur-sm"
                      placeholder="Contoh: Jl. Sudirman No. 123 RT 02 RW 05"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-slate-300 mb-2">Provinsi *</label>
                    <select
                      value={formData.address_state}
                      onChange={handleProvinceChange}
                      disabled={loadingProvinces}
                      className="w-full px-6 py-4 bg-slate-800/50 border border-slate-700 rounded-2xl text-white focus:ring-2 focus:ring-blue-500 backdrop-blur-sm disabled:opacity-50"
                    >
                      <option value="">Pilih Provinsi</option>
                      {provinceOptions.map((prov) => (
                        <option key={prov.kode_wilayah} value={prov.nama_wilayah}>
                          {prov.nama_wilayah}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-slate-300 mb-2">Kabupaten / Kota *</label>
                    <select
                      required
                      value={formData.address_city}
                      onChange={handleCityChange}
                      disabled={loadingCities || cityOptions.length === 0}
                      className="w-full px-6 py-4 bg-slate-800/50 border border-slate-700 rounded-2xl text-white focus:ring-2 focus:ring-blue-500 backdrop-blur-sm disabled:opacity-50"
                    >
                      <option value="">Pilih Kabupaten/Kota</option>
                      {cityOptions.map((city) => (
                        <option key={city.kode_wilayah} value={city.nama_wilayah}>
                          {city.nama_wilayah}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-slate-300 mb-2">Kecamatan *</label>
                    <select
                      required
                      value={formData.address_subdistrict}
                      onChange={(e) => setFormData({ ...formData, address_subdistrict: e.target.value })}
                      disabled={loadingSubdistricts || subdistrictOptions.length === 0}
                      className="w-full px-6 py-4 bg-slate-800/50 border border-slate-700 rounded-2xl text-white focus:ring-2 focus:ring-blue-500 backdrop-blur-sm disabled:opacity-50"
                    >
                      <option value="">Pilih Kecamatan</option>
                      {subdistrictOptions.map((sub) => (
                        <option key={sub.kode_wilayah} value={sub.nama_wilayah}>
                          {sub.nama_wilayah}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-slate-300 mb-2">Kode Pos *</label>
                    <input
                      type="text"
                      required
                      value={formData.address_postal_code}
                      onChange={(e) => setFormData({ ...formData, address_postal_code: e.target.value })}
                      className="w-full px-6 py-4 bg-slate-800/50 border border-slate-700 rounded-2xl text-white placeholder-slate-500 focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all backdrop-blur-sm"
                      placeholder="12345"
                    />
                  </div>
                </div>
              </motion.div>
              <div className="md:col-span-2">
                    <div className="flex items-center justify-between mb-2">
                      <label className="block text-sm font-medium text-slate-300">Domisili / Alamat saat ini *</label>
                      <button
                        type="button"
                        onClick={copyKTPAddressToDomicile}
                        className="text-xs text-blue-400 hover:text-blue-300 flex items-center gap-1 px-3 py-1 rounded-lg hover:bg-blue-900/30 transition-all"
                      >
                        <span>📋</span>
                        Salin dari Alamat KTP
                      </button>
                    </div>
                    <input
                      required
                      type="text"
                      value={formData.address_domicile}
                      onChange={(e) => setFormData({ ...formData, address_domicile: e.target.value })}
                      className="w-full px-6 py-4 bg-slate-800/50 border border-slate-700 rounded-2xl text-white placeholder-slate-500 focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all backdrop-blur-sm"
                      placeholder="Contoh: Jl. Sudirman No. 12, Kel. Menteng, Kec. Menteng, Jakarta Pusat, DKI Jakarta 10310"
                    />
                  </div>
                  
              {/* Emergency Contact */}
              <motion.div variants={itemVariants}>
                <h3 className="text-2xl font-bold text-white mb-6 flex items-center gap-3">
                  <Users className="w-8 h-8 text-indigo-400" />
                  Kontak Darurat
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                  <div>
                    <label className="block text-sm font-medium text-slate-300 mb-2">Nama</label>
                    <input
                      type="text"
                      value={formData.emergency_contact_name}
                      onChange={(e) => setFormData({ ...formData, emergency_contact_name: e.target.value })}
                      className="w-full px-6 py-4 bg-slate-800/50 border border-slate-700 rounded-2xl text-white placeholder-slate-500 focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all backdrop-blur-sm"
                      placeholder="Nama kontak darurat"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-300 mb-2">Nomor Telepon</label>
                    <input
                      type="tel"
                      value={formData.emergency_contact_phone}
                      onChange={(e) => handlePhoneChange(e, 'emergency_contact_phone')}
                      className="w-full px-6 py-4 bg-slate-800/50 border border-slate-700 rounded-2xl text-white placeholder-slate-500 focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all backdrop-blur-sm"
                      placeholder="+62 812 3456 7890"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-300 mb-2">Hubungan</label>
                    <input
                      type="text"
                      value={formData.emergency_contact_relation}
                      onChange={(e) => setFormData({ ...formData, emergency_contact_relation: e.target.value })}
                      className="w-full px-6 py-4 bg-slate-800/50 border border-slate-700 rounded-2xl text-white placeholder-slate-500 focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all backdrop-blur-sm"
                      placeholder="Hubungan (contoh: Ibu, Ayah)"
                    />
                  </div>
                </div>
              </motion.div>

              {/* Documents Section */}
              <motion.div variants={itemVariants}>
                <h3 className="text-2xl font-bold text-white mb-6 flex items-center gap-3">
                  <Upload className="w-8 h-8 text-indigo-400" />
                  Dokumen Pendukung
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                  {/* ID Card */}
                  <div className="space-y-3">
                    <label className="flex items-center gap-3 text-lg font-medium text-slate-300">
                      <User className="w-6 h-6 text-blue-400" />
                      KTP / ID Card *
                    </label>
                    <div className="relative">
                      <input
                        required
                        type="file"
                        accept=".pdf,.jpg,.jpeg,.png"
                        onChange={(e) => handleFileChange("id_card", e.target.files[0])}
                        className="hidden"
                        id="file-id_card"
                      />
                      <label
                        htmlFor="file-id_card"
                        className="flex flex-col items-center justify-center w-full h-48 bg-slate-800/50 border-2 border-dashed border-slate-600 rounded-2xl cursor-pointer hover:border-blue-500 hover:bg-slate-800/70 transition-all group"
                      >
                        {documents.id_card ? (
                          <div className="flex flex-col items-center justify-center gap-2 text-center px-4">
                            <CheckCircle className="w-14 h-14 text-green-400" />
                            <p className="text-sm text-green-400 truncate w-full">{documents.id_card.name}</p>
                          </div>
                        ) : (
                          <>
                            <Upload className="w-12 h-12 text-slate-500 group-hover:text-blue-400 mb-3 transition-colors" />
                            <span className="text-slate-400 group-hover:text-white">Klik untuk unggah</span>
                            <span className="text-xs text-slate-500 mt-1">PDF, JPG, PNG</span>
                          </>
                        )}
                      </label>
                    </div>
                  </div>

                  {/* Resume */}
                  <div className="space-y-3">
                    <label className="flex items-center gap-3 text-lg font-medium text-slate-300">
                      <FileText className="w-6 h-6 text-blue-400" />
                      Resume / CV *
                    </label>
                    <div className="relative">
                      <input
                        required
                        type="file"
                        accept=".pdf,.doc,.docx"
                        onChange={(e) => handleFileChange("resume", e.target.files[0])}
                        className="hidden"
                        id="file-resume"
                      />
                      <label
                        htmlFor="file-resume"
                        className="flex flex-col items-center justify-center w-full h-48 bg-slate-800/50 border-2 border-dashed border-slate-600 rounded-2xl cursor-pointer hover:border-blue-500 hover:bg-slate-800/70 transition-all group"
                      >
                        {documents.resume ? (
                          <div className="flex flex-col items-center justify-center gap-2 text-center px-4">
                            <CheckCircle className="w-14 h-14 text-green-400" />
                            <p className="text-sm text-green-400 truncate w-full">{documents.resume.name}</p>
                          </div>
                        ) : (
                          <>
                            <Upload className="w-12 h-12 text-slate-500 group-hover:text-blue-400 mb-3 transition-colors" />
                            <span className="text-slate-400 group-hover:text-white">Klik untuk unggah</span>
                            <span className="text-xs text-slate-500 mt-1">PDF, DOC, DOCX</span>
                          </>
                        )}
                      </label>
                    </div>
                  </div>

                  {/* NPWP File */}
                  <div className="space-y-3">
                    <label className="flex items-center gap-3 text-lg font-medium text-slate-300">
                      <FileText className="w-6 h-6 text-indigo-400" />
                      Dokumen NPWP (Opsional)
                    </label>
                    <div className="relative">
                      <input
                        type="file"
                        accept=".pdf,.jpg,.jpeg,.png"
                        onChange={(e) => handleFileChange("npwp_file", e.target.files[0])}
                        className="hidden"
                        id="file-npwp"
                      />
                      <label
                        htmlFor="file-npwp"
                        className="flex flex-col items-center justify-center w-full h-48 bg-slate-800/50 border-2 border-dashed border-slate-600 rounded-2xl cursor-pointer hover:border-indigo-500 hover:bg-slate-800/70 transition-all group"
                      >
                        {documents.npwp_file ? (
                          <div className="flex flex-col items-center justify-center gap-2 text-center px-4">
                            <CheckCircle className="w-14 h-14 text-green-400" />
                            <p className="text-sm text-green-400 truncate w-full">{documents.npwp_file.name}</p>
                          </div>
                        ) : (
                          <>
                            <Upload className="w-12 h-12 text-slate-500 group-hover:text-indigo-400 mb-3 transition-colors" />
                            <span className="text-slate-400 group-hover:text-white">Klik untuk unggah</span>
                            <span className="text-xs text-slate-500 mt-1">PDF, JPG, PNG</span>
                          </>
                        )}
                      </label>
                    </div>
                  </div>
                </div>

                {/* Certificates (Multiple) */}
                <div className="mt-8 space-y-4">
                  <label className="flex items-center gap-3 text-lg font-medium text-slate-300">
                    <FileText className="w-6 h-6 text-blue-400" />
                    Sertifikat / Ijazah (Bisa lebih dari 1)
                  </label>
                  
                  {/* Certificate Upload Button */}
                  <div className="relative">
                    <input
                      type="file"
                      accept=".pdf,.jpg,.jpeg,.png"
                      onChange={(e) => handleFileChange("certificates", e.target.files[0])}
                      className="hidden"
                      id="file-certificate"
                    />
                    <label
                      htmlFor="file-certificate"
                      className="flex items-center justify-center gap-2 w-full px-6 py-4 bg-slate-800/50 border-2 border-dashed border-slate-600 rounded-2xl cursor-pointer hover:border-blue-500 hover:bg-slate-800/70 transition-all group"
                    >
                      <Plus className="w-6 h-6 text-slate-500 group-hover:text-blue-400 transition-colors" />
                      <span className="text-slate-400 group-hover:text-white">Tambah Sertifikat</span>
                    </label>
                  </div>

                  {/* Certificate List */}
                  {documents.certificates.length > 0 && (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
                      {documents.certificates.map((cert, index) => (
                        <div
                          key={index}
                          className="flex items-center justify-between p-4 bg-slate-800/50 border border-slate-700 rounded-xl"
                        >
                          <div className="flex items-center gap-3 flex-1 min-w-0">
                            <CheckCircle className="w-5 h-5 text-green-400 flex-shrink-0" />
                            <span className="text-sm text-slate-300 truncate">{cert.name}</span>
                          </div>
                          <button
                            type="button"
                            onClick={() => removeCertificate(index)}
                            className="p-2 hover:bg-red-900/30 rounded-lg transition-colors flex-shrink-0"
                          >
                            <X className="w-5 h-5 text-red-400" />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </motion.div>

              {/* Submit Button */}
              <motion.div 
                className="pt-8"
                variants={itemVariants}
              >
                <motion.button
                  type="submit"
                  disabled={loading}
                  className="w-full flex items-center justify-center gap-4 px-8 py-6 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white text-xl font-semibold rounded-3xl shadow-2xl disabled:opacity-50 disabled:cursor-not-allowed relative overflow-hidden group"
                  whileHover={{ scale: loading ? 1 : 1.03 }}
                  whileTap={{ scale: loading ? 1 : 0.98 }}
                >
                  <motion.div
                    className="absolute inset-0 bg-gradient-to-r from-transparent via-white to-transparent opacity-0 group-hover:opacity-20"
                    animate={{ x: ["-100%", "100%"] }}
                    transition={{ duration: 1.5, repeat: Infinity, ease: "linear" }}
                  />
                  {loading ? (
                    <>
                      <Loader2 className="w-8 h-8 animate-spin" />
                      Mengirim Registrasi...
                    </>
                  ) : (
                    <>
                      <Send className="w-8 h-8" />
                      Daftar Sekarang
                    </>
                  )}
                </motion.button>
              </motion.div>

              {/* Login Link */}
              <div className="text-center pt-4">
                <p className="text-slate-400">
                  Sudah punya akun?{" "}
                  <button
                    type="button"
                    onClick={() => navigate("/")}
                    className="text-blue-400 hover:text-blue-300 font-medium"
                  >
                    Login di sini
                  </button>
                </p>
              </div>
            </form>
          </motion.div>
        </motion.div>
      </div>
    </>
  );
};

export default Register;