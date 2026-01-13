import { useState, useEffect } from "react";
import {
  Search, Download, Filter, X, UserPlus, Edit, Trash2, History,
  ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight,
  Loader2, Save, AlertCircle, TrendingUp, TrendingDown, 
  Briefcase, Users, DollarSign, UserX, Clock, ArrowRight, Sparkles,
  Mail, Phone, Calendar, MapPin, Lock, CreditCard, User, FileText, Eye, EyeOff
} from "lucide-react";
import { motion } from "framer-motion";
import toast, { Toaster } from "react-hot-toast";
import { useAuthStore } from "../stores/useAuthStore";

// API functions
import { 
  fetchUsers, 
  createUser, 
  updateUser, 
  deleteUser,
  fetchUserHistory,
  fetchDivisions,
  fetchRoles,
  createAccountRequest,
  uploadDocument,
  updateUserSalary
} from "../utils/api.jsx";

// Components
import IDCard from "../components/IDCard.jsx";
import NameCard from "../components/NameCard.jsx";

const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { delayChildren: 0.25, staggerChildren: 0.08 }
  }
};

const itemVariants = {
  hidden: { y: 18, opacity: 0 },
  visible: { y: 0, opacity: 1, transition: { type: "spring", stiffness: 120 } }
};

export default function UserList() {
  const { user } = useAuthStore();
  const permissions = user?.role_id?.permissions || [];
  const isSuperadmin = user?.role_id?.name === "Superadmin";
  const isDirector = user?.role_id?.name === "Director";
  const currentRoleLevel = user?.role_id?.hierarchy_level ?? null;
  
  const canCreateUser = permissions.includes("user:create");
  const canUpdateDirect = isSuperadmin; // direct update only by Superadmin
  const canDeleteDirect = isSuperadmin; // direct delete only by Superadmin
  // Roles that can propose changes (even without direct update permission)
  const canProposeChange = isSuperadmin || permissions.some((p) =>
    p.startsWith("employee:promote") ||
    p.startsWith("employee:terminate") ||
    p.startsWith("employee:transfer")
  );
  const canViewSalary =
    isSuperadmin ||
    permissions.includes("user:view_salary:any") ||
    permissions.includes("user:view_salary:own_division");
  const canUpdateSalary =
    isSuperadmin ||
    permissions.includes("user:update_salary:any") ||
    permissions.includes("user:update_salary:own_division");
  // const canViewHistoryUser = permissions.includes("user:view_history");
  const canViewHistoryUser = permissions.some(p => p.startsWith("user:view_history"));

  const [users, setUsers] = useState([]);
  const [divisions, setDivisions] = useState([]);
  const [roles, setRoles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(15);
  const [totalPages, setTotalPages] = useState(1);
  const [totalItems, setTotalItems] = useState(0);
  const [showPassword, setShowPassword] = useState(false);

  // Filters
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [roleFilter, setRoleFilter] = useState("");
  const [divisionFilter, setDivisionFilter] = useState("");
  const [sortBy, setSortBy] = useState("-created_at");
  const [showFilters, setShowFilters] = useState(false);

  // Modal states
  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [showHistoryModal, setShowHistoryModal] = useState(false);
  const [showRequestModal, setShowRequestModal] = useState(false);
  const [showIDCardModal, setShowIDCardModal] = useState(false);
  const [showNameCardModal, setShowNameCardModal] = useState(false);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [requestType, setRequestType] = useState("promotion");
  const [requestForm, setRequestForm] = useState({
    requested_role: "",
    division_id: "",
    notes: ""
  });
  const [terminationDocument, setTerminationDocument] = useState(null);
  const [selectedUser, setSelectedUser] = useState(null);
  const [processing, setProcessing] = useState(false);

  // History state
  const [userHistory, setUserHistory] = useState([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyPage, setHistoryPage] = useState(1);
  const [historyPageSize, setHistoryPageSize] = useState(10);
  const [historyTotalPages, setHistoryTotalPages] = useState(1);
  const [historyEventFilter, setHistoryEventFilter] = useState("");

  // Form state
  const [formData, setFormData] = useState({
    email: "", password: "", full_name: "", phone: "", role_id: null,
    division_id: null, status: "pending", hire_date: "", expired_date: "",
    gender: "male", date_of_birth: "", national_id: "", npwp: "",
    employment_type: "unspecified",
    address_domicile: "", address_street: "", address_city: "",
    address_state: "", address_subdistrict: "", address_postal_code: "", address_country: "Indonesia",
    emergency_contact_name: "", emergency_contact_phone: "", emergency_contact_relation: ""
  });
  const [npwpFile, setNpwpFile] = useState(null);
  const [documents, setDocuments] = useState({
    id_card: null,
    resume: null,
    certificates: [],
  });

  // Salary modal state
  const [showSalaryModal, setShowSalaryModal] = useState(false);
  const [salaryProcessing, setSalaryProcessing] = useState(false);
  const [salaryUser, setSalaryUser] = useState(null);
  const [salaryForm, setSalaryForm] = useState({
    base_salary: "",
    currency: "IDR",
    allowances: [],
    deductions: [],
    bank_account: {
      bank_name: "",
      account_number: "",
      account_holder_name: "",
    },
    note: "",
    effective_date: "",
    reason: "",
  });
  
  // State untuk wilayah Indonesia (api.datawilayah.com)
  const [provinceOptions, setProvinceOptions] = useState([]);
  const [cityOptions, setCityOptions] = useState([]);
  const [subdistrictOptions, setSubdistrictOptions] = useState([]);
  const [loadingProvinces, setLoadingProvinces] = useState(false);
  const [loadingCities, setLoadingCities] = useState(false);
  const [loadingSubdistricts, setLoadingSubdistricts] = useState(false);

  const activeFiltersCount = [search, statusFilter, roleFilter, divisionFilter].filter(Boolean).length;

  useEffect(() => {
    loadUsers();
    loadDivisions();
    loadRoles();
    if (showAddModal || showEditModal) {
      loadProvinces();
    }
  }, [page, pageSize, search, statusFilter, roleFilter, divisionFilter, sortBy, showAddModal, showEditModal]);

  // Load Provinsi
  const loadProvinces = async () => {
    setLoadingProvinces(true);
    try {
      const response = await fetch('https://api.datawilayah.com/api/provinsi.json');
      const result = await response.json();
      if (result.status === "success" && Array.isArray(result.data)) {
        setProvinceOptions(result.data);
      } else {
        setProvinceOptions([]);
      }
    } catch (error) {
      console.error('Error loading provinces:', error);
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
        setCityOptions(result.data);
      } else {
        setCityOptions([]);
      }
    } catch (error) {
      console.error('Error loading cities:', error);
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
        setSubdistrictOptions(result.data);
      } else {
        setSubdistrictOptions([]);
      }
    } catch (error) {
      console.error('Error loading subdistricts:', error);
      setSubdistrictOptions([]);
    } finally {
      setLoadingSubdistricts(false);
    }
  };

  // Document upload handlers (add modal)
  const handleDocChange = (type, file) => {
    if (!file) return;
    if (type === "certificates") {
      setDocuments((prev) => ({
        ...prev,
        certificates: [...prev.certificates, file],
      }));
      return;
    }
    setDocuments((prev) => ({ ...prev, [type]: file }));
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

  const removeCertificate = (index) => {
    setDocuments((prev) => ({
      ...prev,
      certificates: prev.certificates.filter((_, i) => i !== index),
    }));
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

  const loadDivisions = async () => {
    setLoading(true);
    try {
      const res = await fetchDivisions();

      setDivisions(res.data || []);
    } catch (err) {
      toast.error("Gagal memuat data divisi");
    } finally {
      setLoading(false);
    }
  };

  const loadRoles = async () => {
    try {
      const res = await fetchRoles();
      setRoles(res.data || []);
    } catch (err) {
      toast.error("Gagal memuat data role");
    }
  };

  const loadUsers = async () => {
    setLoading(true);
    try {
      const res = await fetchUsers({
        page,
        pageSize,
        search,
        status: statusFilter,
        roleId: roleFilter,
        divisionId: divisionFilter,
        sort: sortBy,
      });

      setUsers(res.data || []);
      const meta = res.meta?.pagination || {};
      setTotalPages(meta.total_pages || 1);
      setTotalItems(meta.total_items || 0);
    } catch (err) {
      toast.error("Gagal memuat data user");
      // Set default values on error to prevent pagination from disappearing
      setUsers([]);
      setTotalPages(1);
      setTotalItems(0);
    } finally {
      setLoading(false);
    }
  };

  const loadUserHistory = async (userId) => {
    setHistoryLoading(true);
    try {
      const res = await fetchUserHistory(userId, {
        page: historyPage,
        pageSize: historyPageSize,
        eventType: historyEventFilter
      });

      setUserHistory(res.data || []);
      const meta = res.meta?.pagination || {};
      setHistoryTotalPages(meta.total_pages || 1);
    } catch (err) {
      toast.error("Gagal memuat history user");
      setShowHistoryModal(false);
    } finally {
      setHistoryLoading(false);
    }
  };

  const openHistoryModal = (user) => {
    setSelectedUser(user);
    setShowHistoryModal(true);
    setHistoryPage(1);
    setHistoryEventFilter("");
  };

  const openSalaryModal = (user) => {
    setSelectedUser(user);
    setSalaryUser(user);
    const salaryData = user.salary_data || null;
    setSalaryForm({
      base_salary: salaryData?.base_salary || "",
      currency: salaryData?.currency || "IDR",
      allowances: (salaryData?.allowances || []).map((a) => ({
        name: a.name || "",
        amount: a.amount || "",
      })),
      deductions: (salaryData?.deductions || []).map((d) => ({
        name: d.name || "",
        amount: d.amount || "",
        category: d.category || "other",
      })),
      bank_account: salaryData?.bank_account || {
        bank_name: "",
        account_number: "",
        account_holder_name: "",
      },
      note: salaryData?.note || "",
      effective_date: "",
      reason: "",
    });
    setShowSalaryModal(true);
  };

  const addAllowanceRow = () => {
    setSalaryForm((prev) => ({
      ...prev,
      allowances: [...(prev.allowances || []), { name: "", amount: "" }],
    }));
  };

  const addDeductionRow = () => {
    setSalaryForm((prev) => ({
      ...prev,
      deductions: [...(prev.deductions || []), { name: "", amount: "", category: "other" }],
    }));
  };

  const updateAllowance = (index, field, value) => {
    setSalaryForm((prev) => {
      const next = [...(prev.allowances || [])];
      next[index] = { ...next[index], [field]: value };
      return { ...prev, allowances: next };
    });
  };

  const removeAllowance = (index) => {
    setSalaryForm((prev) => ({
      ...prev,
      allowances: (prev.allowances || []).filter((_, i) => i !== index),
    }));
  };

  const updateDeduction = (index, field, value) => {
    setSalaryForm((prev) => {
      const next = [...(prev.deductions || [])];
      next[index] = { ...next[index], [field]: value };
      return { ...prev, deductions: next };
    });
  };

  const removeDeduction = (index) => {
    setSalaryForm((prev) => ({
      ...prev,
      deductions: (prev.deductions || []).filter((_, i) => i !== index),
    }));
  };

  const handleSalarySave = async (e) => {
    e?.preventDefault();
    if (!salaryUser) return;
    if (!salaryForm.base_salary) {
      toast.error("Base salary wajib diisi");
      return;
    }
    setSalaryProcessing(true);
    try {
      // Clean empty rows
      const allowancesClean = (salaryForm.allowances || []).filter(
        (a) => a.name && a.amount !== ""
      );
      const deductionsClean = (salaryForm.deductions || []).filter(
        (d) => d.name && d.amount !== ""
      );

      await updateUserSalary(salaryUser._id, {
        base_salary: salaryForm.base_salary,
        currency: salaryForm.currency,
        allowances: allowancesClean,
        deductions: deductionsClean,
        bank_account: salaryForm.bank_account,
        note: salaryForm.note,
        reason: salaryForm.reason,
        effective_date: salaryForm.effective_date,
      });
      toast.success("Gaji berhasil disimpan");
      setShowSalaryModal(false);
      setSalaryUser(null);
      await loadUsers();
    } catch (err) {
      toast.error(err.message || "Gagal menyimpan gaji");
    } finally {
      setSalaryProcessing(false);
    }
  };

  useEffect(() => {
    if (showHistoryModal && selectedUser) {
      loadUserHistory(selectedUser._id);
    }
  }, [showHistoryModal, historyPage, historyPageSize, historyEventFilter]);

  const resetForm = () => {
    setFormData({
      email: "", password: "", full_name: "", phone: "", role_id: "",
      division_id: "", status: "pending", hire_date: "", expired_date: "",
      gender: "male", date_of_birth: "", national_id: "", npwp: "",
      employment_type: "unspecified",
      address_domicile: "", address_street: "", address_city: "",
      address_state: "", address_subdistrict: "", address_postal_code: "", address_country: "Indonesia",
      emergency_contact_name: "", emergency_contact_phone: "", emergency_contact_relation: ""
    });
    setNpwpFile(null);
    setDocuments({ id_card: null, resume: null, certificates: [] });
  };

  const openAddModal = () => {
    resetForm();
    setShowAddModal(true);
  };

  const openEditModal = (user) => {
    if (!canUpdateDirect) {
      openRequestModal(user, "promotion");
      return;
    }
    setSelectedUser(user);
    setFormData({
      email: user.email,
      password: "",
      full_name: user.full_name,
      phone: user.phone || "",
      role_id: user.role_id?._id || null,
      division_id: user.division_id?._id || null,
      status: user.status,
      hire_date: user.hire_date ? user.hire_date.split("T")[0] : "",
      expired_date: user.expired_date ? user.expired_date.split("T")[0] : "",
      gender: user.gender || "male",
      date_of_birth: user.date_of_birth ? user.date_of_birth.split("T")[0] : "",
      national_id: user.national_id || "",
      npwp: user.npwp || "",
      employment_type: user.employment_type || "unspecified",
      address_domicile: user.address?.domicile || "",
      address_street: user.address?.street || "",
      address_city: user.address?.city || "",
      address_state: user.address?.state || "",
      address_subdistrict: user.address?.subdistrict || "",
      address_postal_code: user.address?.postal_code || "",
      address_country: user.address?.country || "Indonesia",
      emergency_contact_name: user.emergency_contact_name || "",
      emergency_contact_phone: user.emergency_contact_phone || "",
      emergency_contact_relation: user.emergency_contact_relation || ""
    });
    setNpwpFile(null);
    setShowEditModal(true);
  };

  // Load cities and subdistricts when edit modal opens with existing address
  useEffect(() => {
    if (showEditModal && selectedUser && selectedUser.address?.state && provinceOptions.length > 0) {
      const selectedProvince = provinceOptions.find(p => p.nama_wilayah === selectedUser.address.state);
      if (selectedProvince) {
        loadCities(selectedProvince.kode_wilayah).then(() => {
          if (selectedUser.address?.city && cityOptions.length > 0) {
            const selectedCity = cityOptions.find(c => c.nama_wilayah === selectedUser.address.city);
            if (selectedCity) {
              loadSubdistricts(selectedCity.kode_wilayah);
            }
          }
        });
      }
    }
  }, [showEditModal, provinceOptions.length]);

  const openDeleteConfirm = (user) => {
    if (!canDeleteDirect) {
      openRequestModal(user, "termination");
      return;
    }
    setSelectedUser(user);
    setShowDeleteConfirm(true);
  };

  const openRequestModal = (user, type = "promotion") => {
    setSelectedUser(user);
    setRequestType(type);
    setRequestForm({
      requested_role: user?.role_id?._id || "",
      division_id: user?.division_id?._id || "",
      notes: ""
    });
    setTerminationDocument(null);
    setShowRequestModal(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (processing) return;
    setProcessing(true);

    try {
      if (showAddModal) {
        // if (isSuperadmin) {
          // Prepare data for createUser API
          const userData = {
            email: formData.email,
            password: formData.password,
            full_name: formData.full_name,
            phone: formData.phone || null,
            role_id: formData.role_id,
            division_id: formData.division_id || null,
            status: formData.status || "pending",
            employment_type: formData.employment_type || "unspecified",
            hire_date: formData.hire_date || null,
            expired_date: formData.employment_type !== "full-time" && formData.expired_date ? formData.expired_date : null,
            gender: formData.gender || "male",
            date_of_birth: formData.date_of_birth || null,
            national_id: formData.national_id || null,
            npwp: formData.npwp || null,
            address: {
              domicile: formData.address_domicile || null,
              street: formData.address_street || null,
              subdistrict: formData.address_subdistrict || null,
              city: formData.address_city || null,
              state: formData.address_state || null,
              postal_code: formData.address_postal_code || null,
              country: formData.address_country || "Indonesia",
            },
            emergency_contact_name: formData.emergency_contact_name || null,
            emergency_contact_phone: formData.emergency_contact_phone || null,
            emergency_contact_relation: formData.emergency_contact_relation || null,
          };
          const createdUser = await createUser(userData);
          
          // Upload supporting documents if provided
          if (createdUser?.data?._id) {
            const uploadTasks = [];
            const uid = createdUser.data._id;

            if (documents.id_card) {
              const formDataUpload = new FormData();
              formDataUpload.append("file", documents.id_card);
              formDataUpload.append("document_type", "id_card");
              formDataUpload.append("user_id", uid);
              formDataUpload.append("description", "KTP/ID card uploaded during user creation");
              uploadTasks.push(uploadDocument(formDataUpload));
            }

            if (documents.resume) {
              const formDataUpload = new FormData();
              formDataUpload.append("file", documents.resume);
              formDataUpload.append("document_type", "resume");
              formDataUpload.append("user_id", uid);
              formDataUpload.append("description", "Resume uploaded during user creation");
              uploadTasks.push(uploadDocument(formDataUpload));
            }

            if (documents.certificates?.length) {
              documents.certificates.forEach((cert) => {
                const formDataUpload = new FormData();
                formDataUpload.append("file", cert);
                formDataUpload.append("document_type", "certificate");
                formDataUpload.append("user_id", uid);
                formDataUpload.append("description", "Certificate uploaded during user creation");
                uploadTasks.push(uploadDocument(formDataUpload));
              });
            }

            try {
              if (uploadTasks.length) {
                await Promise.all(uploadTasks);
              }
            } catch (docErr) {
              console.error("Failed to upload supporting documents:", docErr);
              toast.error("User dibuat, namun ada dokumen yang gagal diunggah");
            }
          }

          // Upload NPWP file if provided
          if (npwpFile && createdUser?.data?._id) {
            try {
              const formDataUpload = new FormData();
              formDataUpload.append("file", npwpFile);
              formDataUpload.append("document_type", "npwp");
              formDataUpload.append("user_id", createdUser.data._id);
              formDataUpload.append("description", "NPWP document uploaded during user creation");
              await uploadDocument(formDataUpload);
            } catch (docErr) {
              console.error("Failed to upload NPWP document:", docErr);
              toast.error("User berhasil dibuat, namun upload dokumen NPWP gagal");
            }
          }
          toast.success("User berhasil ditambahkan");
          setShowAddModal(false);
        // } else {
        //   if (!formData.role_id || !formData.division_id) {
        //     toast.error("Role dan divisi wajib diisi");
        //     setProcessing(false);
        //     return;
        //   }
        //   await createAccountRequest({
        //     requester_name: formData.full_name,
        //     email: formData.email,
        //     phone: formData.phone,
        //     requested_role: formData.role_id,
        //     division_id: formData.division_id,
        //     request_type: "account_request",
        //     notes: formData.notes || ""
        //   });
        //   toast.success("Permintaan akun dikirim untuk persetujuan");
        //   setShowAddModal(false);
        // }
      } else if (showEditModal) {
        if (!isSuperadmin) {
          toast.error("Update langsung hanya untuk Superadmin. Gunakan tombol Ajukan.");
        } else {
          // Prepare data for updateUser API
          const userData = {
            email: formData.email,
            full_name: formData.full_name,
            phone: formData.phone || null,
            role_id: formData.role_id,
            division_id: formData.division_id || null,
            status: formData.status,
            employment_type: formData.employment_type || "unspecified",
            hire_date: formData.hire_date || null,
            expired_date: formData.employment_type !== "full-time" && formData.expired_date ? formData.expired_date : null,
            gender: formData.gender || "male",
            date_of_birth: formData.date_of_birth || null,
            national_id: formData.national_id || null,
            npwp: formData.npwp || null,
            address: {
              domicile: formData.address_domicile || null,
              street: formData.address_street || null,
              subdistrict: formData.address_subdistrict || null,
              city: formData.address_city || null,
              state: formData.address_state || null,
              postal_code: formData.address_postal_code || null,
              country: formData.address_country || "Indonesia",
            },
            emergency_contact_name: formData.emergency_contact_name || null,
            emergency_contact_phone: formData.emergency_contact_phone || null,
            emergency_contact_relation: formData.emergency_contact_relation || null,
          };
          if (formData.password) {
            userData.password = formData.password;
          }
          await updateUser(selectedUser._id, userData);
          
          // Upload NPWP file if provided
          if (npwpFile) {
            try {
              const formDataUpload = new FormData();
              formDataUpload.append("file", npwpFile);
              formDataUpload.append("document_type", "npwp");
              formDataUpload.append("user_id", selectedUser._id);
              formDataUpload.append("description", "NPWP document uploaded during user update");
              await uploadDocument(formDataUpload);
            } catch (docErr) {
              console.error("Failed to upload NPWP document:", docErr);
              toast.error("User berhasil diperbarui, namun upload dokumen NPWP gagal");
            }
          }
          toast.success("User berhasil diperbarui");
          setShowEditModal(false);
        }
      }
      loadUsers();
      resetForm();
    } catch (err) {
      const msg = err.response?.data?.error?.message || "Terjadi kesalahan";
      toast.error(msg);
    } finally {
      setProcessing(false);
    }
  };

  const handleRequestSubmit = async (e) => {
    e.preventDefault();
    if (!selectedUser) return;
    if (processing) return;

    const targetRoleId =
      requestType === "transfer"
        ? selectedUser.role_id?._id
        : requestForm.requested_role || selectedUser.role_id?._id;

    if (!requesterCanTargetUser(selectedUser)) {
      toast.error("Anda tidak bisa mengajukan untuk user dengan level sama/lebih tinggi");
      return;
    }

    if (!requesterCanTargetRole(targetRoleId)) {
      toast.error("Role tujuan melebihi otoritas Anda");
      return;
    }

    if (!targetRoleId) {
      toast.error("Pilih role tujuan");
      return;
    }

    const targetDivisionId =
      requestType === "transfer"
        ? requestForm.division_id || selectedUser.division_id?._id
        : selectedUser.division_id?._id;

    if (requestType === "transfer" && !targetDivisionId) {
      toast.error("Pilih divisi tujuan");
      return;
    }

    setProcessing(true);
    try {
      const requestResult = await createAccountRequest({
        requester_name: selectedUser.full_name,
        email: selectedUser.email,
        phone: selectedUser.phone || "",
        requested_role: targetRoleId,
        division_id: targetDivisionId,
        request_type: requestType,
        user_id: selectedUser._id,
        notes: requestForm.notes,
      });

      const requestId = requestResult.data?._id;

      // Upload termination document if provided
      if (requestType === "termination" && terminationDocument && requestId) {
        try {
          const formData = new FormData();
          formData.append("file", terminationDocument);
          formData.append("document_type", "termination");
          formData.append("user_id", selectedUser._id);
          formData.append("description", "Dokumen termination untuk user");
          
          await uploadDocument(formData);
        } catch (docErr) {
          console.error("Failed to upload termination document:", docErr);
          // Don't fail the whole request if document upload fails
          toast.error("Permintaan berhasil dibuat, namun upload dokumen gagal");
        }
      }

      toast.success("Permintaan dikirim untuk persetujuan");
      setShowRequestModal(false);
      setRequestForm({ requested_role: "", division_id: "", notes: "" });
      setTerminationDocument(null);
      loadUsers();
    } catch (err) {
      const msg = err.response?.data?.message || err.message || "Gagal mengirim permintaan";
      toast.error(msg);
    } finally {
      setProcessing(false);
    }
  };

  const handleDelete = async () => {
    if (processing) return;
    setProcessing(true);
    try {
      await deleteUser(selectedUser._id);
      toast.success("User berhasil dihapus (soft-delete)");
      setShowDeleteConfirm(false);
      loadUsers();
    } catch (err) {
      toast.error(err.response?.data?.error?.message || "Gagal menghapus user");
    } finally {
      setProcessing(false);
    }
  };

  const exportToCSV = () => {
    const headers = ["Full Name","Email","Status","Role","Division","Phone","Hire Date","Salary"];
    const rows = users.map(u => [
      u.full_name,
      u.email,
      u.status,
      u.role_id?.name || "-",
      u.division_id?.name || "-",
      u.phone || "-",
      u.hire_date ? new Date(u.hire_date).toLocaleDateString("id-ID") : "-",
      u.salary ? formatCurrency(u.salary) : "-" // salary is now take_home_pay from salary_data
    ]);
    const csv = [headers, ...rows].map(r => r.map(c => `"${c}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `users_${new Date().toISOString().slice(0,10)}.csv`;
    a.click();
  };

  const getStatusBadge = (status) => {
    const map = {
      active: "bg-green-500/15 text-green-200 border-green-500/30",
      pending: "bg-amber-500/15 text-amber-200 border-amber-500/30",
      inactive: "bg-slate-500/15 text-slate-200 border-slate-500/30",
      terminated: "bg-red-500/15 text-red-200 border-red-500/30",
    };
    return map[status] || "bg-slate-500/15 text-slate-200 border-slate-500/30";
  };

  const getEventIcon = (eventType) => {
    const icons = {
      hired: <UserPlus className="w-5 h-5 text-green-600" />,
      promotion: <TrendingUp className="w-5 h-5 text-blue-600" />,
      demotion: <TrendingDown className="w-5 h-5 text-orange-600" />,
      transfer: <ArrowRight className="w-5 h-5 text-purple-600" />,
      salary_change: <DollarSign className="w-5 h-5 text-emerald-600" />,
      resignation: <UserX className="w-5 h-5 text-gray-600" />,
      terminated: <AlertCircle className="w-5 h-5 text-red-600" />,
      status_change: <Clock className="w-5 h-5 text-yellow-600" />,
      role_change: <Briefcase className="w-5 h-5 text-indigo-600" />,
    };
    return icons[eventType] || <Clock className="w-5 h-5 text-gray-600" />;
  };

  const getEventColor = (eventType) => {
    const colors = {
      hired: "bg-green-100 border-green-300",
      promotion: "bg-blue-100 border-blue-300",
      demotion: "bg-orange-100 border-orange-300",
      transfer: "bg-purple-100 border-purple-300",
      salary_change: "bg-emerald-100 border-emerald-300",
      resignation: "bg-gray-100 border-gray-300",
      terminated: "bg-red-100 border-red-300",
      status_change: "bg-yellow-100 border-yellow-300",
      role_change: "bg-indigo-100 border-indigo-300",
    };
    return colors[eventType] || "bg-gray-100 border-gray-300";
  };

  const formatEventType = (type) => {
    const labels = {
      hired: "Hired",
      promotion: "Promosi",
      demotion: "Demosi",
      transfer: "Transfer",
      salary_change: "Perubahan Gaji",
      resignation: "Pengunduran Diri",
      terminated: "Terminated",
      status_change: "Perubahan Status",
      role_change: "Perubahan Role",
    };
    return labels[type] || type;
  };

  const getRoleNameById = (roleId) => {
    if (!roleId) return "-";
    const r = roles.find((r) => r._id === roleId || r._id === String(roleId));
    return r ? r.name : roleId;
  };

  const getRoleLevelById = (roleId) => {
    const r = roles.find((r) => r._id === roleId || r._id === String(roleId));
    return r?.hierarchy_level ?? null;
  };

  const isDivisionManagerUser = (targetUser) => {
    if (!targetUser?._id || !divisions?.length) return false;
    return divisions.some((d) => d.manager_id === targetUser._id);
  };

  const requesterCanTargetRole = (targetRoleId) => {
    if (isSuperadmin || !currentRoleLevel) return true;
    const targetLevel = getRoleLevelById(targetRoleId);
    if (!targetLevel) return true;
    return targetLevel >= currentRoleLevel;
  };

  const requesterCanTargetUser = (targetUser) => {
    if (isSuperadmin || !currentRoleLevel) return true;
    const targetLevel =
      targetUser?.role_id?.hierarchy_level ??
      getRoleLevelById(targetUser?.role_id?._id);
    if (!targetLevel) return true;
    return currentRoleLevel < targetLevel;
  };

  const renderRoleChangeHint = () => {
    if (!showEditModal || !selectedUser) return null;
    const oldRoleId = selectedUser.role_id?._id;
    const newRoleId = formData.role_id;
    if (!newRoleId || newRoleId === oldRoleId) return null;

    const oldLevel = getRoleLevelById(oldRoleId);
    const newLevel = getRoleLevelById(newRoleId);
    if (oldLevel == null || newLevel == null) return null;

    let label = "Perubahan role";
    if (newLevel < oldLevel) label = "Promosi";
    else if (newLevel > oldLevel) label = "Demosi";

    return (
      <div className={`mt-2 text-sm ${newLevel < oldLevel ? "text-blue-700" : "text-orange-700"}`}>
        {label}: {getRoleNameById(oldRoleId)} → {getRoleNameById(newRoleId)} (level {oldLevel} → {newLevel})
      </div>
    );
  };

  const renderDivisionChangeHint = () => {
    if (!showEditModal || !selectedUser) return null;
    const oldDiv = selectedUser.division_id?._id;
    const newDiv = formData.division_id;
    if (!newDiv || newDiv === oldDiv) return null;

    const oldDivName = divisions.find((d) => d._id === oldDiv)?.name || "-";
    const newDivName = divisions.find((d) => d._id === newDiv)?.name || "-";

    return (
      <div className="mt-2 text-sm text-purple-700">
        Perpindahan divisi: {oldDivName} → {newDivName}
      </div>
    );
  };

  const formatCurrency = (value) => {
    if (!value) return "-";
    return new Intl.NumberFormat("id-ID", {
      style: "currency",
      currency: "IDR",
      minimumFractionDigits: 0
    }).format(parseFloat(value));
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

  return (
    <>
      <Toaster position="top-center" />
      <div className="min-h-screen bg-gradient-to-br from-slate-950 via-blue-950 to-slate-900 p-6 relative overflow-hidden">
        {/* Animated Background */}
        <div className="absolute inset-0 overflow-hidden">
          <motion.div
            className="absolute top-16 left-16 w-72 h-72 bg-blue-600 rounded-full mix-blend-multiply filter blur-3xl opacity-20"
            animate={{ scale: [1, 1.2, 1], x: [0, 60, 0], y: [0, 40, 0] }}
            transition={{ duration: 8, repeat: Infinity, ease: "easeInOut" }}
          />
          <motion.div
            className="absolute bottom-16 right-16 w-96 h-96 bg-indigo-600 rounded-full mix-blend-multiply filter blur-3xl opacity-20"
            animate={{ scale: [1, 1.25, 1], x: [0, -60, 0], y: [0, -40, 0] }}
            transition={{ duration: 10, repeat: Infinity, ease: "easeInOut" }}
          />
        </div>

        <motion.div 
          className="max-w-7xl mx-auto relative z-10"
          variants={containerVariants}
          initial="hidden"
          animate="visible"
        >
          {/* Header */}
          <motion.div variants={itemVariants} className="mb-8">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 bg-gradient-to-br from-blue-600 to-indigo-700 rounded-2xl flex items-center justify-center shadow-lg">
                <Sparkles className="w-7 h-7 text-white" />
              </div>
              <div>
                <h1 className="text-4xl font-bold bg-gradient-to-r from-blue-400 to-indigo-400 bg-clip-text text-transparent">
                  User Management
                </h1>
                <p className="text-slate-400 mt-1">Kelola akun karyawan dan hak akses</p>
              </div>
            </div>
          </motion.div>

          {/* Toolbar */}
          <motion.div 
            className="bg-slate-900/80 backdrop-blur-xl rounded-3xl shadow-2xl border border-blue-900/50 p-6 mb-8"
            variants={itemVariants}
          >
            <div className="flex flex-col lg:flex-row gap-6">
              <div className="flex-1 relative">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-blue-400 w-6 h-6" />
                <input
                  type="text"
                  placeholder="Cari nama atau email..."
                  value={search}
                  onChange={(e) => { setSearch(e.target.value); setPage(1); }}
                  className="w-full pl-14 pr-6 py-4 bg-slate-800/50 border border-slate-700 rounded-2xl text-white placeholder-slate-500 focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all backdrop-blur-sm"
                />
              </div>
              <div className="flex gap-4">
                <motion.button 
                  onClick={() => setShowFilters(!showFilters)}
                  className="relative flex items-center gap-3 px-6 py-4 bg-slate-800/50 backdrop-blur-sm rounded-2xl border border-slate-700 hover:bg-slate-700/70 transition-all text-white"
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                >
                  <Filter className="w-6 h-6 text-blue-400" />
                  Filter
                  {activeFiltersCount > 0 && (
                    <span className="absolute -top-2 -right-2 bg-blue-600 text-white text-xs rounded-full w-6 h-6 flex items-center justify-center">
                      {activeFiltersCount}
                    </span>
                  )}
                </motion.button>
                <motion.button 
                  onClick={exportToCSV}
                  className="flex items-center gap-3 px-6 py-4 bg-gradient-to-r from-emerald-600 to-green-600 hover:from-emerald-700 hover:to-green-700 text-white rounded-2xl transition-all shadow-lg"
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                >
                  <Download className="w-6 h-6" />
                  Export CSV
                </motion.button>
                {canCreateUser && (
                  <motion.button 
                    onClick={openAddModal} 
                    className="flex items-center gap-3 px-6 py-4 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white rounded-2xl transition-all shadow-lg"
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                  >
                    <UserPlus className="w-6 h-6" /> Tambah User
                  </motion.button>
                )}
              </div>
            </div>

            {showFilters && (
              <motion.div 
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                className="mt-8 pt-8 border-t border-slate-700/50"
              >
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  <div>
                    <label className="block text-sm font-medium text-slate-300 mb-2">Status</label>
                    <select value={statusFilter} onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }} className="w-full px-5 py-4 bg-slate-800/50 border border-slate-700 rounded-2xl text-white focus:ring-2 focus:ring-blue-500 backdrop-blur-sm">
                      <option value="">Semua</option>
                      <option value="active">Active</option>
                      <option value="pending">Pending</option>
                      <option value="inactive">Inactive</option>
                      <option value="terminated">Terminated</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-300 mb-2">Role</label>
                    <select value={roleFilter} onChange={(e) => { setRoleFilter(e.target.value); setPage(1); }} className="w-full px-5 py-4 bg-slate-800/50 border border-slate-700 rounded-2xl text-white focus:ring-2 focus:ring-blue-500 backdrop-blur-sm">
                      <option value="">Semua</option>
                      {roles.map((role) => (
                        <option key={role._id} value={role._id}>
                          {role.name} (Level {role.hierarchy_level})
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-300 mb-2">Division</label>
                    <select value={divisionFilter} onChange={(e) => { setDivisionFilter(e.target.value); setPage(1); }} className="w-full px-5 py-4 bg-slate-800/50 border border-slate-700 rounded-2xl text-white focus:ring-2 focus:ring-blue-500 backdrop-blur-sm">
                      <option value="">Semua</option>
                      {divisions.map((division) => (
                        <option key={division._id} value={division._id}>
                          {division.name}
                        </option>
                      ))}
                    </select>
                  </div>
                  {/* <div>
                    <label className="block text-sm font-medium text-slate-300 mb-2">Urutkan</label>
                    <select value={sortBy} onChange={(e) => { setSortBy(e.target.value); setPage(1); }} className="w-full px-5 py-4 bg-slate-800/50 border border-slate-700 rounded-2xl text-white focus:ring-2 focus:ring-blue-500 backdrop-blur-sm">
                      <option value="-created_at">Terbaru</option>
                      <option value="created_at">Terlama</option>
                      <option value="full_name">Nama A-Z</option>
                      <option value="-full_name">Nama Z-A</option>
                    </select>
                  </div> */}
                </div>
                {activeFiltersCount > 0 && (
                  <button onClick={() => { setSearch(""); setStatusFilter(""); setRoleFilter(""); setDivisionFilter(""); setSortBy("-created_at"); setPage(1); }} className="mt-4 text-sm text-blue-400 hover:text-blue-300 flex items-center gap-1">
                    <X className="w-4 h-4" /> Hapus semua filter
                  </button>
                )}
              </motion.div>
            )}
          </motion.div>

          {/* Table */}
          <motion.div 
            className="bg-slate-900/80 backdrop-blur-xl rounded-3xl shadow-2xl border border-blue-900/50 overflow-hidden"
            variants={itemVariants}
          >
            {loading ? (
              <div className="flex justify-center py-16">
                <motion.div animate={{ rotate: 360 }} transition={{ duration: 1, repeat: Infinity, ease: "linear" }} className="w-14 h-14 border-4 border-blue-500 border-t-transparent rounded-full" />
              </div>
            ) : users.length === 0 ? (
              <div className="text-center py-16 text-slate-400 text-lg">Tidak ada data user</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full table-fixed">
                  <thead className="bg-slate-800/70 backdrop-blur-sm border-b border-slate-700/50 sticky top-0 z-20">
                    <tr>
                      <th className="w-72 px-8 py-5 text-left text-xs font-semibold text-slate-300 uppercase tracking-wide">Karyawan</th>
                      <th className="px-8 py-5 text-left text-xs font-semibold text-slate-300 uppercase tracking-wide">Status</th>
                      <th className="px-8 py-5 text-left text-xs font-semibold text-slate-300 uppercase tracking-wide">Role</th>
                      <th className="px-8 py-5 text-left text-xs font-semibold text-slate-300 uppercase tracking-wide">Divisi</th>
                      <th className="px-8 py-5 text-left text-xs font-semibold text-slate-300 uppercase tracking-wide">Tgl Masuk</th>
                      <th className="px-8 py-5 text-left text-xs font-semibold text-slate-300 uppercase tracking-wide">Gaji</th>
                      <th className="w-40 px-8 py-5 text-right text-xs font-semibold text-slate-300 uppercase tracking-wide sticky right-0 bg-slate-800/90 backdrop-blur-sm">Aksi</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-700/50">
                    {users.map((user) => (
                      <motion.tr 
                        key={user._id} 
                        onClick={() => { setSelectedUser(user); setShowDetailModal(true); }} 
                        className="hover:bg-slate-800/50 transition-all"
                        whileHover={{ x: 4, cursor: "pointer" }}
                      >
                        <td className="px-8 py-6">
                        <div className="flex items-center gap-4">
                          <div className="w-12 h-12 rounded-2xl overflow-hidden bg-gradient-to-br from-blue-600 to-indigo-700 flex items-center justify-center text-white font-semibold shadow-lg">
                            {user.profile_photo_url ? (
                              <img
                                src={user.profile_photo_url}
                                alt={user.full_name}
                                className="w-full h-full object-cover"
                              />
                            ) : (
                              <span className="text-lg">
                                {user.full_name?.[0]?.toUpperCase()}
                              </span>
                            )}
                          </div>

                          <div>
                            <div className="text-base font-semibold text-white">
                              {user.full_name}
                            </div>
                            <div className="text-sm text-slate-400">
                              {user.email}
                            </div>
                          </div>
                        </div>
                      </td>

                        <td className="px-8 py-6">
                          <span className={`inline-flex px-3 py-1 rounded-full text-xs font-medium border ${getStatusBadge(user.status)}`}>
                            {user.status}
                          </span>
                        </td>
                        <td className="px-8 py-6 text-sm">
                          <div className="font-medium text-white">{user.role_id?.name || "-"}</div>
                          <div className="text-xs text-slate-400">Level {user.role_id?.hierarchy_level || "-"}</div>
                        </td>
                        <td className="px-8 py-6 text-sm text-slate-200">{user.division_id?.name || "-"}</td>
                        <td className="px-8 py-6 text-sm text-slate-300">
                          {user.hire_date ? new Date(user.hire_date).toLocaleDateString("id-ID") : "-"}
                        </td>
                        <td className="px-8 py-6 text-sm text-white">
                          {formatCurrency(user.salary)}
                        </td>
                        <td className="px-8 py-6 text-right sticky right-0 bg-slate-900/85 backdrop-blur-sm">
                          <div className="flex justify-end gap-3">
                            {/* <motion.button 
                              onClick={() => { setSelectedUser(user); setShowDetailModal(true); }} 
                              className="text-blue-400 hover:text-blue-300" 
                              title="Detail User" 
                              whileHover={{ scale: 1.1 }}
                            >
                              <User className="w-5 h-5" />
                            </motion.button> */}
                            <motion.button 
                              onClick={(e) => { e.stopPropagation(); setSelectedUser(user); setShowIDCardModal(true); }} 
                              className="text-cyan-400 hover:text-cyan-300" 
                              title="ID Card" 
                              whileHover={{ scale: 1.1 }}
                            >
                              <CreditCard className="w-5 h-5" />
                            </motion.button>
                            <motion.button 
                              onClick={(e) => { e.stopPropagation(); setSelectedUser(user); setShowNameCardModal(true); }} 
                              className="text-indigo-400 hover:text-indigo-300" 
                              title="Kartu Nama" 
                              whileHover={{ scale: 1.1 }}
                            >
                              <User className="w-5 h-5" />
                            </motion.button>
                            {canViewHistoryUser && (
                              <motion.button onClick={(e) => { e.stopPropagation(); openHistoryModal(user); }} className="text-purple-400 hover:text-purple-300" title="Lihat History" whileHover={{ scale: 1.1 }}>
                                <History className="w-5 h-5" />
                              </motion.button>
                            )}
                            {canViewSalary && (
                              <motion.button
                                onClick={(e) => { e.stopPropagation(); setSalaryUser(user); openSalaryModal(user); }}
                                className="text-emerald-400 hover:text-emerald-300"
                                title={user.salary_data ? "Edit gaji" : "Set gaji"}
                                whileHover={{ scale: 1.1 }}
                              >
                                <DollarSign className="w-5 h-5" />
                              </motion.button>
                            )}
                            {canUpdateDirect && (
                              <motion.button onClick={(e) => { e.stopPropagation(); openEditModal(user); }} className="text-slate-300 hover:text-white" title="Edit langsung" whileHover={{ scale: 1.1 }}>
                                <Edit className="w-5 h-5" />
                              </motion.button>
                            )}
                            {!canUpdateDirect && canProposeChange && requesterCanTargetUser(user) && (
                              <motion.button onClick={(e) => { e.stopPropagation(); openRequestModal(user, "promotion"); }} className="text-blue-400 hover:text-blue-300" title={isDirector ? "Ajukan perubahan (langsung approved)" : "Ajukan perubahan (butuh persetujuan)"} whileHover={{ scale: 1.1 }}>
                                <Edit className="w-5 h-5" />
                              </motion.button>
                            )}
                            {canDeleteDirect && (
                              <motion.button onClick={(e) => { e.stopPropagation(); openDeleteConfirm(user); }} className="text-red-400 hover:text-red-300" title="Hapus langsung" whileHover={{ scale: 1.1 }}>
                                <Trash2 className="w-5 h-5" />
                              </motion.button>
                            )}
                            {/* {!canDeleteDirect && canProposeChange && requesterCanTargetUser(user) && (
                              <motion.button onClick={() => openRequestModal(user, "termination")} className="text-red-400 hover:text-red-300" title="Ajukan terminasi (butuh persetujuan)" whileHover={{ scale: 1.1 }}>
                                <Trash2 className="w-5 h-5" />
                              </motion.button>
                            )} */}
                          </div>
                        </td>
                      </motion.tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </motion.div>

          {/* Pagination */}
          {!loading && totalItems > 0 && (
            <motion.div 
              className="mt-8 flex flex-col sm:flex-row items-center justify-between gap-6 bg-slate-900/80 backdrop-blur-xl rounded-3xl p-6 border border-blue-900/50"
              
            >
              <p className="text-slate-400">
                Halaman <strong className="text-white">{page}</strong> dari <strong className="text-white">{totalPages}</strong> ({totalItems} total)
              </p>
              <div className="flex items-center gap-4">
                <motion.button whileHover={{ scale: 1.1 }} disabled={page === 1} onClick={() => setPage(1)} className="p-3 bg-slate-800/50 rounded-2xl disabled:opacity-50"><ChevronsLeft className="w-6 h-6 text-slate-300" /></motion.button>
                <motion.button whileHover={{ scale: 1.1 }} disabled={page === 1} onClick={() => setPage(p => Math.max(1, p-1))} className="p-3 bg-slate-800/50 rounded-2xl disabled:opacity-50"><ChevronLeft className="w-6 h-6 text-slate-300" /></motion.button>
                <span className="text-white font-medium">{page} / {totalPages}</span>
                <motion.button whileHover={{ scale: 1.1 }} disabled={page === totalPages} onClick={() => setPage(p => Math.min(totalPages, p+1))} className="p-3 bg-slate-800/50 rounded-2xl disabled:opacity-50"><ChevronRight className="w-6 h-6 text-slate-300" /></motion.button>
                <motion.button whileHover={{ scale: 1.1 }} disabled={page === totalPages} onClick={() => setPage(totalPages)} className="p-3 bg-slate-800/50 rounded-2xl disabled:opacity-50"><ChevronsRight className="w-6 h-6 text-slate-300" /></motion.button>
              </div>
              <select value={pageSize} onChange={(e) => { setPageSize(+e.target.value); setPage(1); }} className="px-5 py-3 bg-slate-800/50 border border-slate-700 rounded-2xl text-white">
                {[10,15,25,50].map(s => <option key={s} value={s}>{s}/hal</option>)}
              </select>
            </motion.div>
          )}
        </motion.div>
      </div>

      {/* MODAL HISTORY */}
      {showHistoryModal && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-lg flex items-center justify-center z-50 p-4">
          <div className="bg-slate-900/90 rounded-3xl shadow-2xl w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col border border-blue-900/50">
            <div className="p-6 border-b border-slate-800/60 flex items-center justify-between">
              <div>
                <h2 className="text-2xl font-bold text-white">History Karyawan</h2>
                <p className="text-slate-400 mt-1">{selectedUser?.full_name}</p>
              </div>
              <button onClick={() => setShowHistoryModal(false)} className="text-slate-400 hover:text-white">
                <X className="w-6 h-6" />
              </button>
            </div>

            <div className="p-6 border-b border-slate-800/60 bg-slate-900/70">
              <div className="flex gap-4">
                <select 
                  value={historyEventFilter} 
                  onChange={(e) => { setHistoryEventFilter(e.target.value); setHistoryPage(1); }}
                  className="px-4 py-2 bg-slate-800/60 border border-slate-700 rounded-xl text-white focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">Semua Event</option>
                  <option value="hired">Hired</option>
                  <option value="promotion">Promosi</option>
                  <option value="demotion">Demosi</option>
                  <option value="transfer">Transfer</option>
                  <option value="salary_change">Perubahan Gaji</option>
                  <option value="resignation">Resign</option>
                  <option value="terminated">Terminated</option>
                  <option value="status_change">Perubahan Status</option>
                  <option value="role_change">Perubahan Role</option>
                </select>
                {historyEventFilter && (
                  <button onClick={() => { setHistoryEventFilter(""); setHistoryPage(1); }} className="text-sm text-blue-400 hover:text-blue-300 flex items-center gap-1">
                    <X className="w-4 h-4" /> Reset Filter
                  </button>
                )}
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-6">
              {historyLoading ? (
                <div className="flex justify-center py-12">
                  <Loader2 className="animate-spin w-10 h-10 text-blue-500" />
                </div>
              ) : userHistory.length === 0 ? (
                <div className="text-center py-12 text-slate-400">
                  <History className="w-16 h-16 mx-auto mb-4 text-slate-600" />
                  <p>Tidak ada history untuk user ini</p>
                </div>
              ) : (
                <div className="relative">
                  <div className="absolute left-6 top-0 bottom-0 w-0.5 bg-slate-800"></div>
                  
                  <div className="space-y-8">
                    {userHistory.map((item) => (
                      <div key={item._id} className="relative flex gap-6">
                        <div className={`relative z-10 flex-shrink-0 w-12 h-12 rounded-full border-4 border-slate-900 flex items-center justify-center ${getEventColor(item.event_type)}`}>
                          {getEventIcon(item.event_type)}
                        </div>

                        <div className="flex-1 bg-slate-900/80 border border-slate-800 rounded-2xl p-4 shadow-sm hover:shadow-lg transition-shadow">
                          <div className="flex items-start justify-between mb-3">
                            <div>
                              <h3 className="text-lg font-semibold text-white">
                                {formatEventType(item.event_type)}
                              </h3>
                              <p className="text-sm text-slate-400">
                                {new Date(item.effective_date).toLocaleDateString("id-ID", {
                                  day: "numeric",
                                  month: "long",
                                  year: "numeric"
                                })}
                              </p>
                            </div>
                            <span className={`px-3 py-1 rounded-full text-xs font-medium border ${getEventColor(item.event_type)}`}>
                              {formatEventType(item.event_type)}
                            </span>
                          </div>

                          <div className="space-y-2 text-slate-200">
                            {(item.old_role || item.new_role) && (
                              <div className="flex items-center gap-2 text-sm">
                                <Briefcase className="w-4 h-4 text-slate-400" />
                                <span className="text-slate-300">Role:</span>
                                {item.old_role && <span className="text-slate-400 line-through">{item.old_role.name}</span>}
                                {item.old_role && item.new_role && <ArrowRight className="w-4 h-4 text-slate-500" />}
                                {item.new_role && <span className="font-medium text-white">{item.new_role.name}</span>}
                              </div>
                            )}

                            {(item.old_division || item.new_division) && (
                              <div className="flex items-center gap-2 text-sm">
                                <Users className="w-4 h-4 text-slate-400" />
                                <span className="text-slate-300">Divisi:</span>
                                {item.old_division && <span className="text-slate-400 line-through">{item.old_division.name}</span>}
                                {item.old_division && item.new_division && <ArrowRight className="w-4 h-4 text-slate-500" />}
                                {item.new_division && <span className="font-medium text-white">{item.new_division.name}</span>}
                              </div>
                            )}

                            {(item.old_salary || item.new_salary) && (
                              <div className="flex items-center gap-2 text-sm">
                                <DollarSign className="w-4 h-4 text-slate-400" />
                                <span className="text-slate-300">Gaji:</span>
                                {item.old_salary && <span className="text-slate-400 line-through">{formatCurrency(item.old_salary)}</span>}
                                {item.old_salary && item.new_salary && <ArrowRight className="w-4 h-4 text-slate-500" />}
                                {item.new_salary && <span className="font-medium text-white">{formatCurrency(item.new_salary)}</span>}
                              </div>
                            )}

                            {item.reason && (
                              <div className="mt-3 p-3 bg-slate-800/60 rounded text-sm text-slate-200">
                                <span className="font-medium text-white">Alasan: </span>
                                <span className="text-slate-200">{item.reason}</span>
                              </div>
                            )}

                            {item.notes && (
                              <div className="mt-2 p-3 bg-blue-900/40 rounded text-sm text-slate-100 border border-blue-800/40">
                                <span className="font-medium text-white">Catatan: </span>
                                <span className="text-slate-100">{item.notes}</span>
                              </div>
                            )}

                            <div className="mt-3 pt-3 border-t border-slate-800 flex items-center justify-between text-xs text-slate-400">
                              <span>
                                Dibuat oleh: <span className="font-medium text-white">{item.created_by?.full_name || "System"}</span>
                              </span>
                              <span>
                                {new Date(item.created_at).toLocaleString("id-ID", {
                                  day: "numeric",
                                  month: "short",
                                  year: "numeric",
                                  hour: "2-digit",
                                  minute: "2-digit"
                                })}
                              </span>
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {!historyLoading && userHistory.length > 0 && (
              <div className="p-4 border-t border-slate-800/60 bg-slate-900/70 flex items-center justify-between">
                <div className="text-sm text-slate-300">
                  Halaman <strong className="text-white">{historyPage}</strong> dari <strong className="text-white">{historyTotalPages}</strong>
                </div>
                <div className="flex items-center gap-2">
                  <button 
                    onClick={() => setHistoryPage(p => Math.max(1, p-1))} 
                    disabled={historyPage === 1} 
                    className="p-2 bg-slate-800/60 border border-slate-700 rounded-xl disabled:opacity-50 hover:bg-slate-700/60"
                  >
                    <ChevronLeft className="w-5 h-5 text-slate-200" />
                  </button>
                  <span className="px-3 text-white">{historyPage} / {historyTotalPages}</span>
                  <button 
                    onClick={() => setHistoryPage(p => Math.min(historyTotalPages, p+1))} 
                    disabled={historyPage === historyTotalPages} 
                    className="p-2 bg-slate-800/60 border border-slate-700 rounded-xl disabled:opacity-50 hover:bg-slate-700/60"
                  >
                    <ChevronRight className="w-5 h-5 text-slate-200" />
                  </button>
                </div>
                <select 
                  value={historyPageSize} 
                  onChange={(e) => { setHistoryPageSize(+e.target.value); setHistoryPage(1); }} 
                  className="px-3 py-2 bg-slate-800/60 border border-slate-700 rounded-xl text-white text-sm"
                >
                  {[5,10,15,20].map(s => <option key={s} value={s}>{s}/hal</option>)}
                </select>
              </div>
            )}
          </div>
        </div>
      )}

      {/* MODAL TAMBAH / EDIT */}
      {(showAddModal || showEditModal) && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-lg flex items-center justify-center z-50 p-4">
          <div className="bg-slate-900/90 rounded-3xl shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-y-auto border border-blue-900/50">
            <div className="p-6 border-b border-slate-800/60">
              <h2 className="text-2xl font-bold text-white mb-2">{showAddModal ? "Tambah User Baru" : "Edit User"}</h2>
              <p className="text-slate-400 text-sm">Lengkapi informasi user</p>
            </div>
            <div className="p-6">
              <form onSubmit={handleSubmit} className="space-y-6">
                {/* Account Info */}
                <div>
                  <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                    <Lock className="w-5 h-5 text-blue-400" />
                    Informasi Akun
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="flex items-center gap-2 text-sm font-medium text-slate-300 mb-2">
                        <Mail className="w-4 h-4 text-blue-400" />
                        Email *
                      </label>
                      <input required type="email" value={formData.email} onChange={(e) => setFormData({...formData, email: e.target.value})} className="w-full px-4 py-3 bg-slate-800/60 border border-slate-700 rounded-xl text-white focus:ring-2 focus:ring-blue-500" />
                    </div>
                    {showAddModal && (
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
                    )}
                  </div>
                </div>

                {/* Personal Info */}
                <div>
                  <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                    <Users className="w-5 h-5 text-indigo-400" />
                    Informasi Pribadi
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-slate-300 mb-2">Nama Lengkap *</label>
                      <input required type="text" value={formData.full_name} onChange={(e) => setFormData({...formData, full_name: e.target.value})} className="w-full px-4 py-3 bg-slate-800/60 border border-slate-700 rounded-xl text-white" />
                    </div>
                    <div>
                      <label className="flex items-center gap-2 text-sm font-medium text-slate-300 mb-2">
                        <Phone className="w-4 h-4 text-blue-400" />
                        No. HP
                      </label>
                      <input type="tel" value={formData.phone} onChange={(e) => handlePhoneChange(e, 'phone')} className="w-full px-4 py-3 bg-slate-800/60 border border-slate-700 rounded-xl text-white" />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-slate-300 mb-2">Jenis Kelamin</label>
                      <select value={formData.gender} onChange={(e) => setFormData({...formData, gender: e.target.value})} className="w-full px-4 py-3 bg-slate-800/60 border border-slate-700 rounded-xl text-white">
                        <option value="male">Laki-laki</option>
                        <option value="female">Perempuan</option>
                        <option value="other">Lainnya</option>
                      </select>
                    </div>
                    <div>
                      <label className="flex items-center gap-2 text-sm font-medium text-slate-300 mb-2">
                        <Calendar className="w-4 h-4 text-blue-400" />
                        Tanggal Lahir
                      </label>
                      <input type="date" value={formData.date_of_birth} onChange={(e) => setFormData({...formData, date_of_birth: e.target.value})} className="w-full px-4 py-3 bg-slate-800/60 border border-slate-700 rounded-xl text-white" />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-slate-300 mb-2">NIK</label>
                      <input type="text" value={formData.national_id} onChange={(e) => setFormData({...formData, national_id: e.target.value})} className="w-full px-4 py-3 bg-slate-800/60 border border-slate-700 rounded-xl text-white" />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-slate-300 mb-2">NPWP (Opsional)</label>
                      <input type="text" value={formData.npwp} onChange={(e) => setFormData({...formData, npwp: e.target.value})} className="w-full px-4 py-3 bg-slate-800/60 border border-slate-700 rounded-xl text-white" placeholder="Contoh: 12.345.678.9-012.000" />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-slate-300 mb-1">Tipe Karyawan</label>
                      <select value={formData.employment_type} onChange={(e) => setFormData({...formData, employment_type: e.target.value})} className="w-full px-4 py-3 bg-slate-800/60 border border-slate-700 rounded-xl text-white">
                        <option value="unspecified">Tidak Diketahui</option>
                        <option value="full-time">Full-time</option>
                        <option value="contract">Kontrak</option>
                        <option value="intern">Magang</option>
                        <option value="freelance">Freelance</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-slate-300 mb-1">Role *</label>
                      <select
                        required
                        value={formData.role_id || ""}
                        onChange={(e) =>
                          setFormData({ ...formData, role_id: e.target.value || null })
                        }
                        className="w-full px-4 py-3 bg-slate-800/60 border border-slate-700 rounded-xl text-white"
                      >
                        <option value="">Pilih role…</option>
                        {roles.map((r) => (
                          <option key={r._id} value={r._id}>
                            {r.name} (Level {r.hierarchy_level})
                          </option>
                        ))}
                      </select>
                      {renderRoleChangeHint()}
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-slate-300 mb-1">Division</label>
                      <select
                        className="w-full px-4 py-3 bg-slate-800/60 border border-slate-700 rounded-xl text-white"
                        value={formData.division_id ?? ""} 
                        onChange={(e) => {
                          const val = e.target.value;
                          setFormData({
                            ...formData,
                            division_id: val === "" ? null : val, 
                          });
                        }}
                      >
                        <option value="">Pilih division…</option>
                        {divisions.map((option) => {
                          const manager = users.find(u => u._id === option.manager_id);
                          const managerName = manager ? manager.full_name : "";
                          return (
                            <option key={option._id} value={option._id}>
                              {managerName ? `${option.name} — managed by ${managerName}` : option.name}
                            </option>
                          );
                        })}
                      </select>
                      {renderDivisionChangeHint()}
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-slate-300 mb-1">Status</label>
                      <select value={formData.status} onChange={(e) => setFormData({...formData, status: e.target.value})} className="w-full px-4 py-3 bg-slate-800/60 border border-slate-700 rounded-xl text-white">
                        <option value="pending">Pending</option>
                        <option value="active">Active</option>
                        <option value="inactive">Inactive</option>
                        <option value="terminated">Terminated</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-slate-300 mb-1">
                        Tanggal Masuk {formData.employment_type !== "full-time" && "*"}
                      </label>
                      <input 
                        type="date" 
                        required={formData.employment_type !== "full-time"}
                        value={formData.hire_date} 
                        onChange={(e) => setFormData({...formData, hire_date: e.target.value})} 
                        className="w-full px-4 py-3 bg-slate-800/60 border border-slate-700 rounded-xl text-white" 
                      />
                    </div>
                    {formData.employment_type !== "full-time" && (
                      <div>
                        <label className="block text-sm font-medium text-slate-300 mb-1">Tanggal Berakhir Kontrak *</label>
                        <input 
                          type="date" 
                          required
                          value={formData.expired_date || ""} 
                          onChange={(e) => setFormData({...formData, expired_date: e.target.value})} 
                          min={formData.hire_date}
                          className="w-full px-4 py-3 bg-slate-800/60 border border-slate-700 rounded-xl text-white" 
                        />
                      </div>
                    )}
                  </div>
                </div>

                {/* Address */}
                <div>
                  <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                    <MapPin className="w-5 h-5 text-indigo-400" />
                    Alamat
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="md:col-span-2">
                      <h4 className="text-sm font-semibold text-slate-200 mb-3">Alamat sesuai KTP</h4>
                    </div>
                    <div className="md:col-span-2">
                      <label className="block text-sm font-medium text-slate-300 mb-2">Jalan / Alamat Lengkap</label>
                      <input type="text" value={formData.address_street} onChange={(e) => setFormData({...formData, address_street: e.target.value})} className="w-full px-4 py-3 bg-slate-800/60 border border-slate-700 rounded-xl text-white" placeholder="Contoh: Jl. Sudirman No. 123 RT 02 RW 05" />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-slate-300 mb-2">Provinsi</label>
                      <select
                        value={formData.address_state}
                        onChange={handleProvinceChange}
                        disabled={loadingProvinces}
                        className="w-full px-4 py-3 bg-slate-800/60 border border-slate-700 rounded-xl text-white focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
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
                      <label className="block text-sm font-medium text-slate-300 mb-2">Kabupaten / Kota</label>
                      <select
                        value={formData.address_city}
                        onChange={handleCityChange}
                        disabled={loadingCities || cityOptions.length === 0}
                        className="w-full px-4 py-3 bg-slate-800/60 border border-slate-700 rounded-xl text-white focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
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
                      <label className="block text-sm font-medium text-slate-300 mb-2">Kecamatan</label>
                      <select
                        value={formData.address_subdistrict}
                        onChange={(e) => setFormData({ ...formData, address_subdistrict: e.target.value })}
                        disabled={loadingSubdistricts || subdistrictOptions.length === 0}
                        className="w-full px-4 py-3 bg-slate-800/60 border border-slate-700 rounded-xl text-white focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
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
                      <label className="block text-sm font-medium text-slate-300 mb-2">Kode Pos</label>
                      <input type="text" value={formData.address_postal_code} onChange={(e) => setFormData({...formData, address_postal_code: e.target.value})} className="w-full px-4 py-3 bg-slate-800/60 border border-slate-700 rounded-xl text-white" placeholder="12345" />
                    </div>
                    <div className="md:col-span-2">
                      <h4 className="text-sm font-semibold text-slate-200 mb-3">Domisili</h4>
                    </div>
                    <div className="md:col-span-2">
                      <div className="flex items-center justify-between mb-2">
                        <label className="block text-sm font-medium text-slate-300">Alamat saat ini</label>
                        <button
                          type="button"
                          onClick={copyKTPAddressToDomicile}
                          className="text-xs text-blue-400 hover:text-blue-300 flex items-center gap-1 px-3 py-1 rounded-lg hover:bg-blue-900/30 transition-all"
                        >
                          <span>📋</span>
                          Salin dari Alamat KTP
                        </button>
                      </div>
                      <input type="text" value={formData.address_domicile} onChange={(e) => setFormData({...formData, address_domicile: e.target.value})} className="w-full px-4 py-3 bg-slate-800/60 border border-slate-700 rounded-xl text-white" placeholder="Alamat domisili saat ini" />
                    </div>
                  </div>
                </div>

                {/* Emergency Contact */}
                <div>
                  <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                    <Users className="w-5 h-5 text-indigo-400" />
                    Kontak Darurat
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-slate-300 mb-2">Nama</label>
                      <input type="text" value={formData.emergency_contact_name} onChange={(e) => setFormData({...formData, emergency_contact_name: e.target.value})} className="w-full px-4 py-3 bg-slate-800/60 border border-slate-700 rounded-xl text-white" />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-slate-300 mb-2">Nomor Telepon</label>
                      <input type="tel" value={formData.emergency_contact_phone} onChange={(e) => handlePhoneChange(e, 'emergency_contact_phone')} className="w-full px-4 py-3 bg-slate-800/60 border border-slate-700 rounded-xl text-white" />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-slate-300 mb-2">Hubungan</label>
                      <input type="text" value={formData.emergency_contact_relation} onChange={(e) => setFormData({...formData, emergency_contact_relation: e.target.value})} className="w-full px-4 py-3 bg-slate-800/60 border border-slate-700 rounded-xl text-white" />
                    </div>
                  </div>
                </div>

                {/* Dokumen Pendukung */}
                <div>
                  <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                    <FileText className="w-5 h-5 text-indigo-400" />
                    Dokumen Pendukung
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <label className="block text-sm font-medium text-slate-300">KTP / ID Card</label>
                      <input
                        type="file"
                        accept=".pdf,.jpg,.jpeg,.png"
                        onChange={(e) => handleDocChange("id_card", e.target.files?.[0] || null)}
                        className="w-full text-sm text-slate-200 file:mr-4 file:px-4 file:py-2 file:rounded-lg file:border-0 file:bg-slate-700 file:text-slate-100 bg-slate-800/60 border border-slate-700 rounded-xl"
                      />
                      {documents.id_card && <p className="text-xs text-green-400">✓ {documents.id_card.name}</p>}
                    </div>
                    <div className="space-y-2">
                      <label className="block text-sm font-medium text-slate-300">Resume / CV</label>
                      <input
                        type="file"
                        accept=".pdf,.doc,.docx"
                        onChange={(e) => handleDocChange("resume", e.target.files?.[0] || null)}
                        className="w-full text-sm text-slate-200 file:mr-4 file:px-4 file:py-2 file:rounded-lg file:border-0 file:bg-slate-700 file:text-slate-100 bg-slate-800/60 border border-slate-700 rounded-xl"
                      />
                      {documents.resume && <p className="text-xs text-green-400">✓ {documents.resume.name}</p>}
                    </div>
                  </div>

                  <div className="mt-4 space-y-2">
                    <div className="flex items-center justify-between">
                      <label className="block text-sm font-medium text-slate-300">Sertifikat (bisa lebih dari 1)</label>
                      <button
                        type="button"
                        onClick={() => document.getElementById("userlist-certificate-input")?.click()}
                        className="text-xs px-3 py-1 bg-slate-800/70 border border-slate-700 rounded-lg text-slate-200 hover:bg-slate-700"
                      >
                        Tambah Sertifikat
                      </button>
                    </div>
                    <input
                      id="userlist-certificate-input"
                      type="file"
                      accept=".pdf,.jpg,.jpeg,.png"
                      onChange={(e) => handleDocChange("certificates", e.target.files?.[0] || null)}
                      className="hidden"
                    />
                    {documents.certificates.length > 0 && (
                      <div className="space-y-2">
                        {documents.certificates.map((cert, idx) => (
                          <div key={idx} className="flex items-center justify-between bg-slate-800/60 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-200">
                            <span className="truncate">{cert.name}</span>
                            <button
                              type="button"
                              onClick={() => removeCertificate(idx)}
                              className="text-red-400 hover:text-red-300"
                            >
                              Hapus
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>

                {/* NPWP File Upload */}
                <div>
                  <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                    <FileText className="w-5 h-5 text-indigo-400" />
                    Dokumen NPWP (Opsional)
                  </h3>
                  <div>
                    <label className="block text-sm font-medium text-slate-300 mb-2">File NPWP</label>
                    <input
                      type="file"
                      accept=".pdf,.jpg,.jpeg,.png"
                      onChange={(e) => setNpwpFile(e.target.files[0])}
                      className="w-full px-4 py-3 bg-slate-800/60 border border-slate-700 rounded-xl text-white file:text-slate-200 file:mr-4 file:px-4 file:py-2 file:rounded-lg file:border-0 file:bg-slate-700 file:cursor-pointer"
                    />
                    {npwpFile && (
                      <p className="text-sm text-green-400 mt-2">✓ {npwpFile.name}</p>
                    )}
                  </div>
                </div>

                <div className="mt-6 flex justify-end gap-3 pt-4 border-t border-slate-800/60">
                  <button type="button" onClick={() => { setShowAddModal(false); setShowEditModal(false); }} className="px-6 py-3 bg-slate-800/60 border border-slate-700 rounded-xl text-slate-200 hover:bg-slate-700/60">
                    Batal
                  </button>
                  <button type="submit" disabled={processing} className="flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white rounded-xl shadow-lg disabled:opacity-70">
                    {processing ? <Loader2 className="animate-spin w-5 h-5" /> : <Save className="w-5 h-5" />}
                    {showAddModal ? "Simpan" : "Update"}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* MODAL PERMINTAAN PERUBAHAN (APPROVAL) */}
      {showRequestModal && selectedUser && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-lg flex items-center justify-center z-50 p-4">
          <div className="bg-slate-900/90 rounded-3xl shadow-2xl max-w-xl w-full max-h-[90vh] overflow-y-auto border border-blue-900/50">
            <div className="p-6 border-b border-slate-800/60">
              <h2 className="text-2xl font-bold text-white">Ajukan Perubahan</h2>
              <p className="text-slate-400 mt-1">
                {selectedUser.full_name} ({selectedUser.role_id?.name || "-"}) — {selectedUser.division_id?.name || "-"}
              </p>
              {!isSuperadmin && (
                <p className="text-xs text-amber-400 mt-2">
                  Perubahan akan mengikuti alur persetujuan sesuai hirarki.
                </p>
              )}
            </div>
            <form onSubmit={handleRequestSubmit} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1">Jenis Permintaan</label>
                <select
                  value={requestType}
                  onChange={(e) => setRequestType(e.target.value)}
                  className="w-full px-4 py-3 bg-slate-800/60 border border-slate-700 rounded-xl text-white"
                >
                  <option value="promotion">Perubahan Role (Promosi/Demosi)</option>
                  {!isDivisionManagerUser(selectedUser) && (
                    <option value="transfer">Perpindahan Divisi</option>
                  )}
                  <option value="termination">Terminasi</option>
                </select>
              </div>

              {requestType === "promotion" && (
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-1">Role Tujuan</label>
                  <select
                    value={requestForm.requested_role || ""}
                    onChange={(e) =>
                      setRequestForm({ ...requestForm, requested_role: e.target.value })
                    }
                    className="w-full px-4 py-3 bg-slate-800/60 border border-slate-700 rounded-xl text-white"
                  >
                    <option value="">Pilih role…</option>
                    {roles.map((r) => (
                      <option key={r._id} value={r._id} disabled={!requesterCanTargetRole(r._id)}>
                        {r.name} (Level {r.hierarchy_level})
                      </option>
                    ))}
                  </select>
                  {!requesterCanTargetRole(requestForm.requested_role) && (
                    <p className="text-xs text-red-400 mt-1">Role tujuan melebihi otoritas Anda.</p>
                  )}
                </div>
              )}

              {requestType === "transfer" && (
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-1">Divisi Tujuan</label>
                  <select
                    value={requestForm.division_id || ""}
                    onChange={(e) =>
                      setRequestForm({ ...requestForm, division_id: e.target.value })
                    }
                    className="w-full px-4 py-3 bg-slate-800/60 border border-slate-700 rounded-xl text-white"
                  >
                    <option value="">Pilih division…</option>
                    {divisions.map((option) => (
                      <option key={option._id} value={option._id}>
                        {option.name}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {requestType === "termination" && (
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-1">
                    Dokumen Termination (Opsional)
                  </label>
                  <input
                    type="file"
                    accept=".pdf,.doc,.docx"
                    onChange={(e) => setTerminationDocument(e.target.files[0])}
                    className="w-full px-4 py-3 bg-slate-800/60 border border-slate-700 rounded-xl text-white file:text-slate-200"
                  />
                  {terminationDocument && (
                    <p className="text-sm text-slate-400 mt-1">{terminationDocument.name}</p>
                  )}
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1">Catatan</label>
                <textarea
                  value={requestForm.notes}
                  onChange={(e) =>
                    setRequestForm({ ...requestForm, notes: e.target.value })
                  }
                  rows={3}
                  className="w-full px-4 py-3 bg-slate-800/60 border border-slate-700 rounded-xl text-white"
                  placeholder="Alasan pengajuan / konteks"
                />
              </div>

              <div className="flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowRequestModal(false)}
                  className="px-4 py-3 bg-slate-800/60 border border-slate-700 rounded-xl text-slate-200 hover:bg-slate-700/60"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={processing}
                  className="flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white rounded-xl shadow-lg disabled:opacity-70"
                >
                  {processing ? <Loader2 className="animate-spin w-5 h-5" /> : <Save className="w-5 h-5" />}
                  Kirim Permintaan
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL KONFIRMASI HAPUS */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-lg flex items-center justify-center z-50 p-4">
          <div className="bg-slate-900/90 rounded-3xl shadow-2xl p-6 max-w-md w-full border border-red-900/50">
            <div className="flex items-center gap-3 text-red-300 mb-4">
              <AlertCircle className="w-10 h-10" />
              <h3 className="text-xl font-bold text-white">Konfirmasi Hapus</h3>
            </div>
            <p className="text-slate-200 mb-6">
              Apakah Anda yakin ingin menghapus akun <strong className="text-white">{selectedUser?.full_name}</strong>? 
              Akun akan di-soft-delete (status menjadi "terminated").
            </p>
            <div className="flex justify-end gap-3">
              <button onClick={() => setShowDeleteConfirm(false)} className="px-4 py-3 bg-slate-800/60 border border-slate-700 rounded-xl text-slate-200 hover:bg-slate-700/60">
                Batal
              </button>
              <button onClick={handleDelete} disabled={processing} className="flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-red-600 to-red-700 hover:from-red-700 hover:to-red-800 text-white rounded-xl shadow-lg disabled:opacity-70">
                {processing ? <Loader2 className="animate-spin w-5 h-5" /> : null}
                Hapus
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL ID CARD */}
      {showIDCardModal && selectedUser && (
        <IDCard user={selectedUser} onClose={() => setShowIDCardModal(false)} />
      )}

      {/* MODAL KARTU NAMA */}
      {showNameCardModal && selectedUser && (
        <NameCard user={selectedUser} onClose={() => setShowNameCardModal(false)} />
      )}

      {/* MODAL DETAIL USER */}
      {showDetailModal && selectedUser && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-lg flex items-center justify-center z-50 p-4">
          <div className="bg-slate-900/90 rounded-3xl shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-y-auto border border-blue-900/50">
            <div className="p-6 border-b border-slate-800/60 flex items-center justify-between">
              <div>
                <h2 className="text-2xl font-bold text-white">Detail User</h2>
                <p className="text-slate-400 mt-1">{selectedUser.full_name}</p>
              </div>
              <button onClick={() => setShowDetailModal(false)} className="text-slate-400 hover:text-white">
                <X className="w-6 h-6" />
              </button>
            </div>
            <div className="p-6 space-y-6">
              {/* Account Info */}
              <div>
                <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                  <Lock className="w-5 h-5 text-blue-400" />
                  Informasi Akun
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-400 mb-1">Email</label>
                    <p className="text-white">{selectedUser.email}</p>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-400 mb-1">Status</label>
                    <span className={`inline-flex px-3 py-1 rounded-full text-xs font-medium border ${getStatusBadge(selectedUser.status)}`}>
                      {selectedUser.status}
                    </span>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-400 mb-1">Role</label>
                    <p className="text-white">{selectedUser.role_id?.name || "-"} (Level {selectedUser.role_id?.hierarchy_level || "-"})</p>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-400 mb-1">Divisi</label>
                    <p className="text-white">{selectedUser.division_id?.name || "-"}</p>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-400 mb-1">Tipe Karyawan</label>
                    <p className="text-white">{selectedUser.employment_type || "-"}</p>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-400 mb-1">Tanggal Masuk</label>
                    <p className="text-white">{selectedUser.hire_date ? new Date(selectedUser.hire_date).toLocaleDateString("id-ID") : "-"}</p>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-400 mb-1">Gaji (Take Home Pay)</label>
                    <p className="text-white">{formatCurrency(selectedUser.salary)}</p>
                    {selectedUser.salary_data && (
                      <div className="mt-2 text-xs text-slate-400">
                        <p>Base Salary: {formatCurrency(selectedUser.salary_data.base_salary)}</p>
                        <p>Total Allowance: {formatCurrency(selectedUser.salary_data.total_allowance)}</p>
                        <p>Total Deduction: {formatCurrency(selectedUser.salary_data.total_deduction)}</p>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Personal Info */}
              <div>
                <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                  <Users className="w-5 h-5 text-indigo-400" />
                  Informasi Pribadi
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-400 mb-1">Nama Lengkap</label>
                    <p className="text-white">{selectedUser.full_name}</p>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-400 mb-1">No. HP</label>
                    <p className="text-white">{selectedUser.phone || "-"}</p>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-400 mb-1">Jenis Kelamin</label>
                    <p className="text-white">{selectedUser.gender === "male" ? "Laki-laki" : selectedUser.gender === "female" ? "Perempuan" : "Lainnya"}</p>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-400 mb-1">Tanggal Lahir</label>
                    <p className="text-white">{selectedUser.date_of_birth ? new Date(selectedUser.date_of_birth).toLocaleDateString("id-ID") : "-"}</p>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-400 mb-1">NIK</label>
                    <p className="text-white">{selectedUser.national_id || "-"}</p>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-400 mb-1">NPWP</label>
                    <p className="text-white">{selectedUser.npwp || "-"}</p>
                  </div>
                </div>
              </div>

              {/* Address */}
              <div>
                <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                  <MapPin className="w-5 h-5 text-indigo-400" />
                  Alamat
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="md:col-span-2">
                    <label className="block text-sm font-medium text-slate-400 mb-1">Domisili</label>
                    <p className="text-white">{selectedUser.address?.domicile || "-"}</p>
                  </div>
                  <div className="md:col-span-2">
                    <h4 className="text-sm font-semibold text-slate-200 mb-3">Alamat sesuai KTP</h4>
                  </div>
                  <div className="md:col-span-2">
                    <label className="block text-sm font-medium text-slate-400 mb-1">Jalan</label>
                    <p className="text-white">{selectedUser.address?.street || "-"}</p>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-400 mb-1">Provinsi</label>
                    <p className="text-white">{selectedUser.address?.state || "-"}</p>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-400 mb-1">Kabupaten/Kota</label>
                    <p className="text-white">{selectedUser.address?.city || "-"}</p>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-400 mb-1">Kecamatan</label>
                    <p className="text-white">{selectedUser.address?.subdistrict || "-"}</p>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-400 mb-1">Kode Pos</label>
                    <p className="text-white">{selectedUser.address?.postal_code || "-"}</p>
                  </div>
                </div>
              </div>

              {/* Emergency Contact */}
              <div>
                <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                  <Users className="w-5 h-5 text-indigo-400" />
                  Kontak Darurat
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-400 mb-1">Nama</label>
                    <p className="text-white">{selectedUser.emergency_contact_name || "-"}</p>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-400 mb-1">Nomor Telepon</label>
                    <p className="text-white">{selectedUser.emergency_contact_phone || "-"}</p>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-400 mb-1">Hubungan</label>
                    <p className="text-white">{selectedUser.emergency_contact_relation || "-"}</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MODAL GAJI */}
      {showSalaryModal && salaryUser && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-lg flex items-center justify-center z-50 p-4">
          <div className="bg-slate-900/90 rounded-3xl shadow-2xl max-w-3xl w-full max-h-[90vh] overflow-y-auto border border-emerald-900/50">
            <div className="p-6 border-b border-slate-800/60 flex items-center justify-between">
              <div>
                <h2 className="text-2xl font-bold text-white flex items-center gap-3">
                  <DollarSign className="w-6 h-6 text-emerald-400" />
                  {salaryUser.full_name} — {salaryUser.salary_data ? "Edit Gaji" : "Atur Gaji"}
                </h2>
                <p className="text-slate-400 text-sm">Nilai akan tersimpan sebagai snapshot Salary terbaru</p>
              </div>
              <button onClick={() => setShowSalaryModal(false)} className="text-slate-400 hover:text-white">
                <X className="w-6 h-6" />
              </button>
            </div>

            <form onSubmit={handleSalarySave} className="p-6 space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-2">Base Salary *</label>
                  <input
                    type="number"
                    min="0"
                    disabled={!canUpdateSalary}
                    required
                    value={salaryForm.base_salary}
                    onChange={(e) => setSalaryForm({ ...salaryForm, base_salary: e.target.value })}
                    className="w-full px-4 py-3 bg-slate-800/60 border border-slate-700 rounded-xl text-white"
                    placeholder="5000000"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-2">Currency</label>
                  <select
                    disabled={!canUpdateSalary}
                    value={salaryForm.currency}
                    onChange={(e) => setSalaryForm({ ...salaryForm, currency: e.target.value })}
                    className="w-full px-4 py-3 bg-slate-800/60 border border-slate-700 rounded-xl text-white"
                  >
                    <option value="IDR">IDR</option>
                    <option value="USD">USD</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <h4 className="text-sm font-semibold text-slate-200">Allowances</h4>
                    <button type="button" disabled={!canUpdateSalary} onClick={addAllowanceRow} className="text-xs text-emerald-400 hover:text-emerald-300">Tambah</button>
                  </div>
                  {(salaryForm.allowances || []).map((a, idx) => (
                    <div key={idx} className="flex gap-2">
                      <input
                        type="text"
                        value={a.name}
                        disabled={!canUpdateSalary}
                        onChange={(e) => updateAllowance(idx, "name", e.target.value)}
                        placeholder="Nama"
                        className="flex-1 px-3 py-2 bg-slate-800/60 border border-slate-700 rounded-lg text-white text-sm"
                      />
                      <input
                        type="number"
                        value={a.amount}
                        disabled={!canUpdateSalary}
                        onChange={(e) => updateAllowance(idx, "amount", e.target.value)}
                        placeholder="Jumlah"
                        className="w-28 px-3 py-2 bg-slate-800/60 border border-slate-700 rounded-lg text-white text-sm"
                      />
                      <button type="button" disabled={!canUpdateSalary} onClick={() => removeAllowance(idx)} className="text-red-400 hover:text-red-300 px-2">x</button>
                    </div>
                  ))}
                  {(!salaryForm.allowances || salaryForm.allowances.length === 0) && (
                    <p className="text-xs text-slate-500">Tidak ada allowance</p>
                  )}
                </div>

                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <h4 className="text-sm font-semibold text-slate-200">Deductions</h4>
                    <button type="button" disabled={!canUpdateSalary} onClick={addDeductionRow} className="text-xs text-emerald-400 hover:text-emerald-300">Tambah</button>
                  </div>
                  {(salaryForm.deductions || []).map((d, idx) => (
                    <div key={idx} className="flex gap-2">
                      <input
                        type="text"
                        value={d.name}
                        disabled={!canUpdateSalary}
                        onChange={(e) => updateDeduction(idx, "name", e.target.value)}
                        placeholder="Nama"
                        className="flex-1 px-3 py-2 bg-slate-800/60 border border-slate-700 rounded-lg text-white text-sm"
                      />
                      <input
                        type="number"
                        value={d.amount}
                        disabled={!canUpdateSalary}
                        onChange={(e) => updateDeduction(idx, "amount", e.target.value)}
                        placeholder="Jumlah"
                        className="w-28 px-3 py-2 bg-slate-800/60 border border-slate-700 rounded-lg text-white text-sm"
                      />
                      <select
                        value={d.category || "other"}
                        disabled={!canUpdateSalary}
                        onChange={(e) => updateDeduction(idx, "category", e.target.value)}
                        className="px-2 py-2 bg-slate-800/60 border border-slate-700 rounded-lg text-white text-sm"
                      >
                        <option value="other">Other</option>
                        <option value="bpjs">BPJS</option>
                        <option value="insurance">Insurance</option>
                      </select>
                      <button type="button" disabled={!canUpdateSalary} onClick={() => removeDeduction(idx)} className="text-red-400 hover:text-red-300 px-2">x</button>
                    </div>
                  ))}
                  {(!salaryForm.deductions || salaryForm.deductions.length === 0) && (
                    <p className="text-xs text-slate-500">Tidak ada deduction</p>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-2">Bank Name</label>
                  <input
                    type="text"
                    value={salaryForm.bank_account?.bank_name || ""}
                    disabled={!canUpdateSalary}
                    onChange={(e) => setSalaryForm({ ...salaryForm, bank_account: { ...salaryForm.bank_account, bank_name: e.target.value } })}
                    className="w-full px-4 py-3 bg-slate-800/60 border border-slate-700 rounded-xl text-white"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-2">Account Number</label>
                  <input
                    type="text"
                    value={salaryForm.bank_account?.account_number || ""}
                    disabled={!canUpdateSalary}
                    onChange={(e) => setSalaryForm({ ...salaryForm, bank_account: { ...salaryForm.bank_account, account_number: e.target.value } })}
                    className="w-full px-4 py-3 bg-slate-800/60 border border-slate-700 rounded-xl text-white"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-2">Account Holder</label>
                  <input
                    type="text"
                    value={salaryForm.bank_account?.account_holder_name || ""}
                    disabled={!canUpdateSalary}
                    onChange={(e) => setSalaryForm({ ...salaryForm, bank_account: { ...salaryForm.bank_account, account_holder_name: e.target.value } })}
                    className="w-full px-4 py-3 bg-slate-800/60 border border-slate-700 rounded-xl text-white"
                  />
                </div>
                <div className="grid grid-cols-1 gap-2">
                  <label className="block text-sm font-medium text-slate-300 mb-2">Effective Date</label>
                  <input
                    type="date"
                    value={salaryForm.effective_date}
                    disabled={!canUpdateSalary}
                    onChange={(e) => setSalaryForm({ ...salaryForm, effective_date: e.target.value })}
                    className="w-full px-4 py-3 bg-slate-800/60 border border-slate-700 rounded-xl text-white"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-2">Reason</label>
                  <input
                    type="text"
                    value={salaryForm.reason}
                    disabled={!canUpdateSalary}
                    onChange={(e) => setSalaryForm({ ...salaryForm, reason: e.target.value })}
                    className="w-full px-4 py-3 bg-slate-800/60 border border-slate-700 rounded-xl text-white"
                    placeholder="Misal: penyesuaian"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-2">Catatan</label>
                  <textarea
                    rows={3}
                    value={salaryForm.note}
                    disabled={!canUpdateSalary}
                    onChange={(e) => setSalaryForm({ ...salaryForm, note: e.target.value })}
                    className="w-full px-4 py-3 bg-slate-800/60 border border-slate-700 rounded-xl text-white"
                    placeholder="Catatan tambahan"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowSalaryModal(false)}
                  className="px-4 py-3 bg-slate-800/60 border border-slate-700 rounded-xl text-slate-200 hover:bg-slate-700/60"
                >
                  Batal
                </button>
                {canUpdateSalary && (
                  <button
                  type="submit"
                  disabled={salaryProcessing}
                  className="flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-emerald-600 to-green-600 hover:from-emerald-700 hover:to-green-700 text-white rounded-xl shadow-lg disabled:opacity-70"
                >
                  {salaryProcessing ? <Loader2 className="animate-spin w-5 h-5" /> : <Save className="w-5 h-5" />}
                  Simpan Gaji
                </button>
                )}
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}