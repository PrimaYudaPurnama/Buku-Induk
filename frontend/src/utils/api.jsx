// utils/api.jsx

import { useAuthStore } from "../stores/useAuthStore";
import toast from "react-hot-toast";

const API_BASE = import.meta.env.VITE_API_BASE_URL || "http://localhost:3000/api/v1";

// Ambil token LANGSUNG dari Zustand (paling akurat & real-time)
// const getToken = () => {
//   return useAuthStore.getState().token;
// };

const defaultHeaders = () => ({
  "Content-Type": "application/json",
});

// Universal Response Handler
const handleResponse = async (response) => {
  // 403: Forbidden / tidak punya izin
  if (response.status === 403) {
    toast.error("Akses ditolak! Kamu tidak punya izin untuk melakukan aksi ini.");
    return null;
  }

  // 401: Unauthorized / sesi habis
  if (response.status === 401) {
    toast.error("Sesi habis. Silakan login ulang.");
    localStorage.removeItem("token");
    window.location.href = "/";
    return null;
  }

  // Error lain (4xx / 5xx)
  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    const message = err.error?.message || err.message || `HTTP ${response.status}`;
    toast.error(message);
    throw new Error(message);
  }

  return response.json();
};

// ==================== IMPORT / MIGRATION (EXCEL) ====================
/**
 * Upload attendance Excel to backend importer.
 * @param {File} file
 */
export const importAttendanceExcel = async (file) => {
  if (!file) throw new Error("File Excel belum dipilih");

  const form = new FormData();
  form.append("file", file);

  const response = await fetch(`${API_BASE}/import/attendance`, {
    method: "POST",
    credentials: "include",
    body: form,
  });

  const data = await handleResponse(response);
  if (!data) throw new Error("Gagal import presensi");
  return data;
};

/**
 * Upload project Excel to backend importer.
 * @param {File} file
 */
export const importProjectsExcel = async (file) => {
  if (!file) throw new Error("File Excel belum dipilih");

  const form = new FormData();
  form.append("file", file);

  const response = await fetch(`${API_BASE}/import/projects`, {
    method: "POST",
    credentials: "include",
    body: form,
  });

  const data = await handleResponse(response);
  if (!data) throw new Error("Gagal import proyek");
  return data;
};

// ==================== AUTH ====================
export const fetchCurrentUser = async () => {

  const response = await fetch(`${API_BASE}/auth/me`, {
    method: "GET",
    headers: defaultHeaders(),
    credentials: "include",
  });

  const data = await handleResponse(response);
  return data?.user || null;
};

/**
 * Register new user (public endpoint)
 * @param {FormData} formData - Form data with user info and documents
 * @returns {Promise<object>} Created user data
 */
export const register = async (formData) => {
  const response = await fetch(`${API_BASE}/auth/register`, {
    method: "POST",
    credentials: "include",
    body: formData,
  });

  const data = await handleResponse(response);
  if (!data) throw new Error("Gagal melakukan registrasi");
  return data;
};

// ==================== GET USERS ====================
export const fetchPendingUsers = async ({
  page = 1,
  pageSize = 10,
  search = "",
} = {}) => {
  try {
    const params = new URLSearchParams();
    params.append("page[number]", page);
    params.append("page[size]", pageSize);
    if (search) params.append("search", search.trim());

    const response = await fetch(`${API_BASE}/users/pending?${params.toString()}`, {
      method: "GET",
      headers: defaultHeaders(),
      credentials: "include",
    });
    const data = await handleResponse(response);

    if (!data) {
      return {
        data: [],
        meta: { pagination: { total_items: 0, total_pages: 1 } },
      };
    }

    return data;
  } catch (error) {
    console.error("fetchPendingUsers error:", error);
    toast.error("Gagal memuat data pengguna pending");
    return {
      data: [],
      meta: { pagination: { total_items: 0, total_pages: 1 } },
    };
  }
};

export const approveUser = async (userId, approvalData) => {
  const response = await fetch(`${API_BASE}/users/${userId}/approve`, {
    method: "POST",
    headers: defaultHeaders(),
    credentials: "include",
    body: JSON.stringify(approvalData),
  });

  const data = await handleResponse(response);
  if (!data) throw new Error("Gagal menyetujui pengguna");
  return data;
};

export const rejectUser = async (userId, reason) => {
  const response = await fetch(`${API_BASE}/users/${userId}/reject`, {
    method: "POST",
    headers: defaultHeaders(),
    credentials: "include",
    body: JSON.stringify({ reason }),
  });

  const data = await handleResponse(response);
  if (!data) throw new Error("Gagal menolak pengguna");
  return data;
};

export const fetchUsers = async ({
  page = 1,
  pageSize = 15,
  search = "",
  divisionId = "",
  status = "",
  roleId = "",
  sort = "-created_at",
} = {}) => {
  try {
    const params = new URLSearchParams();

    params.append("page[number]", page);
    params.append("page[size]", pageSize);

    if (search) params.append("search", search.trim());
    if (status) params.append("filter[status]", status);
    if (roleId) params.append("filter[role_id]", roleId);
    if (divisionId) params.append("filter[division_id]", divisionId);
    if (sort) params.append("sort", sort);

    const response = await fetch(`${API_BASE}/users?${params.toString()}`, {
      method: "GET",
      headers: defaultHeaders(),
      credentials: "include",
    });
    const data = await handleResponse(response);

    if (!data) {
      return {
        data: [],
        meta: { pagination: { total_items: 0, total_pages: 1 } },
      };
    }

    return data;
  } catch (error) {
    console.error("fetchUsers error:", error);
    toast.error("Gagal memuat data karyawan");
    return {
      data: [],
      meta: { pagination: { total_items: 0, total_pages: 1 } },
    };
  }
};


// ==================== CREATE USER ====================
export const createUser = async (userData) => {
  const response = await fetch(`${API_BASE}/users`, {
    method: "POST",
    headers: defaultHeaders(),
    credentials: "include",
    body: JSON.stringify(userData),
  });

  const data = await handleResponse(response);
  if (!data) throw new Error("Gagal membuat user");
  return data;
};

// ==================== UPDATE USER ====================
export const updateUser = async (userId, userData) => {
  // Password boleh kosong saat edit → hapus dari payload kalau kosong
  const payload = { ...userData };

  if (!payload.password) delete payload.password;

  const response = await fetch(`${API_BASE}/users/${userId}`, {
    method: "PATCH",
    headers: defaultHeaders(),
    credentials: "include",
    body: JSON.stringify(payload),
  });

  const data = await handleResponse(response);
  if (!data) throw new Error("Gagal update user");
  return data;
};

// ==================== DELETE USER (soft-delete) ====================
export const deleteUser = async (userId) => {
  const response = await fetch(`${API_BASE}/users/${userId}`, {
    method: "DELETE",
    headers: defaultHeaders(),
    credentials: "include",
  });

  const data = await handleResponse(response);
  if (!data) throw new Error("Gagal menghapus user");
  return data;
};

// ==================== BONUS: Get Single User (untuk detail nanti) ====================
export const fetchUserById = async (userId) => {
  const response = await fetch(`${API_BASE}/users/${userId}`, {
    method: "GET",
    headers: defaultHeaders(),
    credentials: "include",
  });

  const data = await handleResponse(response);
  if (!data) throw new Error("User tidak ditemukan");
  return data;
};

export const fetchUserHistory = async (userId, params = {}) => {
  const { page = 1, pageSize = 10, eventType = "" } = params;

  const query = new URLSearchParams({
    "page[number]": page,
    "page[size]": pageSize,
  });

  if (eventType) {
    query.append("filter[event_type]", eventType);
  }

  const res = await fetch(`${API_BASE}/users/${userId}/history?${query.toString()}`, {
    method: "GET",
    headers: defaultHeaders(),
    credentials: "include",
  });

  if (!res.ok) {
    throw new Error(`Request failed: ${res.status}`);
  }

  return res.json();
};
// ==================== DIVISIONS ====================

export const fetchDivisions = async ({
  page = 1,
  limit = 15,
  search = "",
  manager_id = "",
  active_general_id = "",
  sort = "-created_at",
  include = "manager,active_general"
} = {}) => {
  try {
    const params = new URLSearchParams();

    params.append("page", page);
    params.append("limit", limit);
    if (search) params.append("search", search.trim());
    if (manager_id) params.append("manager_id", manager_id);
    if (active_general_id) params.append("active_general_id", active_general_id);
    if (sort) params.append("sort", sort);
    if (include) params.append("include", include);

    const response = await fetch(`${API_BASE}/divisions?${params.toString()}`, {
      method: "GET",
      headers: defaultHeaders(),
      credentials: "include",
    });

    const data = await handleResponse(response);

    if (!data) {
      return {
        data: [],
        total: 0,
        total_pages: 1,
        page: page,
        limit: limit,
      };
    }

    return data;
  } catch (error) {
    console.error("fetchDivisions error:", error);
    toast.error("Gagal memuat data divisi");
    return {
      data: [],
      total: 0,
      total_pages: 1,
      page,
      limit,
    };
  }
};

export const createDivision = async (divisionData) => {
  const response = await fetch(`${API_BASE}/divisions`, {
    method: "POST",
    headers: defaultHeaders(),
    credentials: "include",
    body: JSON.stringify(divisionData),
  });

  const data = await handleResponse(response);
  if (!data) throw new Error("Gagal membuat divisi");
  return data;
};

export const updateDivision = async (divisionId, divisionData) => {
  const response = await fetch(`${API_BASE}/divisions/${divisionId}`, {
    method: "PATCH",
    headers: defaultHeaders(),
    credentials: "include",
    body: JSON.stringify(divisionData),
  });

  const data = await handleResponse(response);
  if (!data) throw new Error("Gagal update divisi");
  return data;
};

export const deleteDivision = async (divisionId) => {
  const response = await fetch(`${API_BASE}/divisions/${divisionId}`, {
    method: "DELETE",
    headers: defaultHeaders(),
    credentials: "include",
  });

  const data = await handleResponse(response);
  if (!data) throw new Error("Gagal menghapus divisi");
  return data;
};

// ==================== ACTIVITIES (CRUD) ====================
export const fetchActivitiesList = async ({
  page = 1,
  limit = 20,
  search = "",
  sort = "-created_at",
} = {}) => {
  const params = new URLSearchParams();
  params.append("page", page);
  params.append("limit", limit);
  if (search) params.append("search", search);
  if (sort) params.append("sort", sort);

  const response = await fetch(`${API_BASE}/activities?${params.toString()}`, {
    method: "GET",
    headers: defaultHeaders(),
    credentials: "include",
  });

  const data = await handleResponse(response);
  if (!data) throw new Error("Gagal memuat aktivitas");
  return data;
};

export const createActivity = async (activityData) => {
  const response = await fetch(`${API_BASE}/activities`, {
    method: "POST",
    headers: defaultHeaders(),
    credentials: "include",
    body: JSON.stringify(activityData),
  });

  const data = await handleResponse(response);
  if (!data) throw new Error("Gagal membuat aktivitas");
  return data;
};

export const updateActivity = async (activityId, activityData) => {
  const response = await fetch(`${API_BASE}/activities/${activityId}`, {
    method: "PATCH",
    headers: defaultHeaders(),
    credentials: "include",
    body: JSON.stringify(activityData),
  });

  const data = await handleResponse(response);
  if (!data) throw new Error("Gagal memperbarui aktivitas");
  return data;
};

export const deleteActivity = async (activityId) => {
  const response = await fetch(`${API_BASE}/activities/${activityId}`, {
    method: "DELETE",
    headers: defaultHeaders(),
    credentials: "include",
  });

  const data = await handleResponse(response);
  if (!data) throw new Error("Gagal menghapus aktivitas");
  return data;
};

// ==================== PROJECTS (CRUD) ====================
export const fetchProjectsList = async ({
  page = 1,
  limit = 20,
  search = "",
  sort = "-created_at",
  work_type = "",
  status = "",
} = {}) => {
  const params = new URLSearchParams();
  params.append("page", page);
  params.append("limit", limit);
  if (search) params.append("search", search);
  if (sort) params.append("sort", sort);
  if (work_type) params.append("work_type", work_type);
  if (status) params.append("status", status);

  const response = await fetch(`${API_BASE}/projects?${params.toString()}`, {
    method: "GET",
    headers: defaultHeaders(),
    credentials: "include",
  });

  const data = await handleResponse(response);
  if (!data) throw new Error("Gagal memuat proyek");
  return data;
};

export const createProject = async (projectData) => {
  const response = await fetch(`${API_BASE}/projects`, {
    method: "POST",
    headers: defaultHeaders(),
    credentials: "include",
    body: JSON.stringify(projectData),
  });

  const data = await handleResponse(response);
  if (!data) throw new Error("Gagal membuat proyek");
  return data;
};

export const updateProject = async (projectId, projectData) => {
  const response = await fetch(`${API_BASE}/projects/${projectId}`, {
    method: "PATCH",
    headers: defaultHeaders(),
    credentials: "include",
    body: JSON.stringify(projectData),
  });

  const data = await handleResponse(response);
  if (!data) throw new Error("Gagal memperbarui proyek");
  return data;
};

export const deleteProject = async (projectId) => {
  const response = await fetch(`${API_BASE}/projects/${projectId}`, {
    method: "DELETE",
    headers: defaultHeaders(),
    credentials: "include",
  });

  const data = await handleResponse(response);
  if (!data) throw new Error("Gagal menghapus proyek");
  return data;
};

// Optional: Get single division
export const fetchDivisionById = async (divisionId, include = "manager,active_general") => {
  const params = new URLSearchParams();
  if (include) params.append("include", include);

  const response = await fetch(`${API_BASE}/divisions/${divisionId}?${params.toString()}`, {
    method: "GET",
    headers: defaultHeaders(),
    credentials: "include",
  });

  const data = await handleResponse(response);
  if (!data) throw new Error("Divisi tidak ditemukan");
  return data;
};

// ==================== ACCOUNT REQUESTS ====================
export const createAccountRequest = async (requestData) => {
  const response = await fetch(`${API_BASE}/account-requests`, {
    method: "POST",
    headers: defaultHeaders(),
    credentials: "include",
    body: JSON.stringify(requestData),
  });

  const data = await handleResponse(response);
  if (!data) throw new Error("Gagal membuat permintaan akun");
  return data;
};

export const fetchAccountRequests = async ({ page = 1, limit = 20, status, request_type, division_id, search } = {}) => {
  const params = new URLSearchParams();
  params.append("page", page);
  params.append("limit", limit);
  if (status) params.append("status", status);
  if (request_type) params.append("request_type", request_type);
  if (division_id) params.append("division_id", division_id);
  if (search) params.append("search", search);

  const response = await fetch(`${API_BASE}/account-requests?${params.toString()}`, {
    method: "GET",
    headers: defaultHeaders(),
    credentials: "include",
  });

  const data = await handleResponse(response);
  if (!data) throw new Error("Gagal memuat permintaan akun");
  return data;
};

export const fetchAccountRequestById = async (requestId) => {
  const response = await fetch(`${API_BASE}/account-requests/${requestId}`, {
    method: "GET",
    headers: defaultHeaders(),
    credentials: "include",
  });

  const data = await handleResponse(response);
  if (!data) throw new Error("Permintaan akun tidak ditemukan");
  return data;
};

// ==================== APPROVALS ====================
export const fetchMyPendingApprovals = async () => {
  const response = await fetch(`${API_BASE}/approvals/mine`, {
    method: "GET",
    headers: defaultHeaders(),
    credentials: "include",
  });

  const data = await handleResponse(response);
  if (!data) throw new Error("Gagal memuat persetujuan");
  return data;
};

export const approveStep = async (approvalId, comments = "") => {
  const response = await fetch(`${API_BASE}/approvals/${approvalId}/approve`, {
    method: "POST",
    headers: defaultHeaders(),
    credentials: "include",
    body: JSON.stringify({ comments }),
  });

  const data = await handleResponse(response);
  if (!data) throw new Error("Gagal menyetujui");
  return data;
};

export const rejectStep = async (approvalId, comments = "") => {
  const response = await fetch(`${API_BASE}/approvals/${approvalId}/reject`, {
    method: "POST",
    headers: defaultHeaders(),
    credentials: "include",
    body: JSON.stringify({ comments }),
  });

  const data = await handleResponse(response);
  if (!data) throw new Error("Gagal menolak");
  return data;
};

// ==================== DOCUMENTS ====================
export const uploadDocument = async (formData) => {
  const response = await fetch(`${API_BASE}/documents/upload`, {
    method: "POST",
    credentials: "include",
    body: formData,
  });

  const data = await handleResponse(response);
  if (!data) throw new Error("Gagal mengunggah dokumen");
  return data;
};

export const fetchUserDocuments = async (userId, { type, limit = 50, offset = 0 } = {}) => {
  const params = new URLSearchParams();
  if (type) params.append("type", type);
  params.append("limit", limit);
  params.append("offset", offset);

  const response = await fetch(`${API_BASE}/documents/user/${userId}?${params.toString()}`, {
    method: "GET",
    headers: defaultHeaders(),
    credentials: "include",
  });

  const data = await handleResponse(response);
  if (!data) throw new Error("Gagal memuat dokumen");
  return data;
};

export const fetchDocumentById = async (documentId) => {
  const response = await fetch(`${API_BASE}/documents/${documentId}`, {
    method: "GET",
    headers: defaultHeaders(),
    credentials: "include",
  });

  const data = await handleResponse(response);
  if (!data) throw new Error("Dokumen tidak ditemukan");
  return data;
};

// ==================== NOTIFICATIONS ====================
export const fetchNotifications = async ({ limit = 20, offset = 0, unread_only = false } = {}) => {
  const params = new URLSearchParams();
  params.append("limit", limit);
  params.append("offset", offset);
  if (unread_only) params.append("unread_only", "true");

  const response = await fetch(`${API_BASE}/notifications?${params.toString()}`, {
    method: "GET",
    headers: defaultHeaders(),
    credentials: "include",
  });

  const data = await handleResponse(response);
  if (!data) throw new Error("Gagal memuat notifikasi");
  return data;
};

export const markNotificationAsRead = async (notificationId) => {
  const response = await fetch(`${API_BASE}/notifications/mark-read`, {
    method: "POST",
    headers: defaultHeaders(),
    credentials: "include",
    body: JSON.stringify({ notification_id: notificationId }),
  });

  const data = await handleResponse(response);
  if (!data) throw new Error("Gagal menandai notifikasi");
  return data;
};

export const markAllNotificationsAsRead = async () => {
  const response = await fetch(`${API_BASE}/notifications/mark-read`, {
    method: "POST",
    headers: defaultHeaders(),
    credentials: "include",
    body: JSON.stringify({ mark_all: true }),
  });

  const data = await handleResponse(response);
  if (!data) throw new Error("Gagal menandai semua notifikasi");
  return data;
};

// ==================== SALARY ====================
export const fetchUserSalary = async (userId) => {
  const response = await fetch(`${API_BASE}/users/${userId}/salary`, {
    method: "GET",
    headers: defaultHeaders(),
    credentials: "include",
  });

  const data = await handleResponse(response);
  if (!data) throw new Error("Gagal memuat data gaji");
  return data;
};

export const updateUserSalary = async (userId, salaryData) => {
  const response = await fetch(`${API_BASE}/users/${userId}/salary`, {
    method: "PATCH",
    headers: defaultHeaders(),
    credentials: "include",
    body: JSON.stringify(salaryData),
  });

  const data = await handleResponse(response);
  if (!data) throw new Error("Gagal mengupdate gaji");
  return data;
};

export const fetchSalaryReport = async ({ page = 1, limit = 50, division_id, status, search } = {}) => {
  const params = new URLSearchParams();
  params.append("page", page);
  params.append("limit", limit);
  if (division_id) params.append("division_id", division_id);
  if (status) params.append("status", status);
  if (search) params.append("search", search);

  const response = await fetch(`${API_BASE}/users/salary-report?${params.toString()}`, {
    method: "GET",
    headers: defaultHeaders(),
    credentials: "include",
  });

  const data = await handleResponse(response);
  if (!data) throw new Error("Gagal memuat laporan gaji");
  return data;
};

// ==================== AUDIT LOGS ====================
export const fetchAuditLogs = async ({ page = 1, limit = 50, user_id, action, resource_type, resource_id, start_date, end_date } = {}) => {
  const params = new URLSearchParams();
  params.append("page", page);
  params.append("limit", limit);
  if (user_id) params.append("user_id", user_id);
  if (action) params.append("action", action);
  if (resource_type) params.append("resource_type", resource_type);
  if (resource_id) params.append("resource_id", resource_id);
  if (start_date) params.append("start_date", start_date);
  if (end_date) params.append("end_date", end_date);

  const response = await fetch(`${API_BASE}/audit-logs?${params.toString()}`, {
    method: "GET",
    headers: defaultHeaders(),
    credentials: "include",
  });

  const data = await handleResponse(response);
  if (!data) throw new Error("Gagal memuat audit logs");
  return data;
};

export const fetchAuditLogById = async (logId) => {
  const response = await fetch(`${API_BASE}/audit-logs/${logId}`, {
    method: "GET",
    headers: defaultHeaders(),
    credentials: "include",
  });

  const data = await handleResponse(response);
  if (!data) throw new Error("Audit log tidak ditemukan");
  return data;
};

export const fetchResourceAuditLogs = async (resourceType, resourceId, { limit = 50, offset = 0 } = {}) => {
  const params = new URLSearchParams();
  params.append("limit", limit);
  params.append("offset", offset);

  const response = await fetch(`${API_BASE}/audit-logs/resource/${resourceType}/${resourceId}?${params.toString()}`, {
    method: "GET",
    headers: defaultHeaders(),
    credentials: "include",
  });

  const data = await handleResponse(response);
  if (!data) throw new Error("Gagal memuat audit logs");
  return data;
};

// ==================== ROLES ====================
export const fetchRoles = async ({ search } = {}) => {
  const params = new URLSearchParams();
  if (search) params.append("search", search);

  const response = await fetch(`${API_BASE}/roles?${params.toString()}`, {
    method: "GET",
    headers: defaultHeaders(),
    credentials: "include",
  });

  const data = await handleResponse(response);
  if (!data) throw new Error("Gagal memuat roles");
  return data;
};

export const fetchRoleById = async (roleId) => {
  const response = await fetch(`${API_BASE}/roles/${roleId}`, {
    method: "GET",
    headers: defaultHeaders(),
    credentials: "include",
  });

  const data = await handleResponse(response);
  if (!data) throw new Error("Role tidak ditemukan");
  return data;
};

export const createRole = async (roleData) => {
  const response = await fetch(`${API_BASE}/roles`, {
    method: "POST",
    headers: defaultHeaders(),
    credentials: "include",
    body: JSON.stringify(roleData),
  });

  const data = await handleResponse(response);
  if (!data) throw new Error("Gagal membuat role");
  return data;
};

export const updateRole = async (roleId, roleData) => {
  const response = await fetch(`${API_BASE}/roles/${roleId}`, {
    method: "PATCH",
    headers: defaultHeaders(),
    credentials: "include",
    body: JSON.stringify(roleData),
  });

  const data = await handleResponse(response);
  if (!data) throw new Error("Gagal mengupdate role");
  return data;
};

export const deleteRole = async (roleId) => {
  const response = await fetch(`${API_BASE}/roles/${roleId}`, {
    method: "DELETE",
    headers: defaultHeaders(),
    credentials: "include",
  });

  const data = await handleResponse(response);
  if (!data) throw new Error("Gagal menghapus role");
  return data;
};

export const fetchPermissionCatalog = async () => {
  const response = await fetch(`${API_BASE}/roles/permissions`, {
    method: "GET",
    headers: defaultHeaders(),
    credentials: "include",
  });

  const data = await handleResponse(response);
  if (!data) throw new Error("Gagal memuat daftar permission");
  return data;
};

// ==================== ACCOUNT SETUP ====================
/**
 * Verify setup token and get account request data
 * @param {string} token - Setup token from URL
 * @returns {Promise<object>} Account request data
 */
export const verifySetupToken = async (token) => {
  const response = await fetch(`${API_BASE}/account-requests/setup/${token}`, {
    method: "GET",
    headers: {
      "Content-Type": "application/json",
    },
    credentials: "include",
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(error.message || "Token tidak valid atau sudah kedaluwarsa");
  }

  return response.json();
};

/**
 * Submit account setup form
 * @param {string} token - Setup token from URL
 * @param {object} formData - Form data (password, profile_photo_url, etc.)
 * @returns {Promise<object>} Created user data
 */
export const submitAccountSetup = async (token, formData) => {
  const response = await fetch(`${API_BASE}/account-requests/setup/${token}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    credentials: "include",
    body: JSON.stringify(formData),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(error.message || "Gagal menyelesaikan setup akun");
  }

  return response.json();
};

// ==================== ANALYTICS ====================
export const fetchWorkflowOverview = async () => {
  const response = await fetch(`${API_BASE}/analytics/workflow-overview`, {
    method: "GET",
    headers: defaultHeaders(),
    credentials: "include",
  });

  const data = await handleResponse(response);
  if (!data) throw new Error("Gagal memuat overview workflow");
  return data;
};

export const fetchWorkflowDetails = async ({ page = 1, limit = 20, request_type, status, division_id, search } = {}) => {
  const params = new URLSearchParams();
  params.append("page", page);
  params.append("limit", limit);
  if (request_type) params.append("request_type", request_type);
  if (status) params.append("status", status);
  if (division_id) params.append("division_id", division_id);
  if (search) params.append("search", search);

  const response = await fetch(`${API_BASE}/analytics/workflow-details?${params.toString()}`, {
    method: "GET",
    headers: defaultHeaders(),
    credentials: "include",
  });

  const data = await handleResponse(response);
  if (!data) throw new Error("Gagal memuat detail workflow");
  return data;
};

export const fetchWorkflowTimeline = async (requestId) => {
  const response = await fetch(`${API_BASE}/analytics/workflow-timeline/${requestId}`, {
    method: "GET",
    headers: defaultHeaders(),
    credentials: "include",
  });

  const data = await handleResponse(response);
  if (!data) throw new Error("Gagal memuat timeline workflow");
  return data;
};

export const fetchWorkflowStatistics = async ({ start_date, end_date, request_type } = {}) => {
  const params = new URLSearchParams();
  if (start_date) params.append("start_date", start_date);
  if (end_date) params.append("end_date", end_date);
  if (request_type) params.append("request_type", request_type);

  const response = await fetch(`${API_BASE}/analytics/workflow-statistics?${params.toString()}`, {
    method: "GET",
    headers: defaultHeaders(),
    credentials: "include",
  });

  const data = await handleResponse(response);
  if (!data) throw new Error("Gagal memuat statistik workflow");
  return data;
};

// ==================== ATTENDANCE ANALYTICS ====================
export const fetchAttendanceOverview = async ({ start_date, end_date, user_id, division_id } = {}) => {
  const params = new URLSearchParams();
  if (start_date) params.append("start_date", start_date);
  if (end_date) params.append("end_date", end_date);
  if (user_id) params.append("user_id", user_id);
  if (division_id) params.append("division_id", division_id);

  const response = await fetch(`${API_BASE}/analytics/attendance-overview?${params.toString()}`, {
    method: "GET",
    headers: defaultHeaders(),
    credentials: "include",
  });

  const data = await handleResponse(response);
  if (!data) throw new Error("Gagal memuat overview presensi");
  return data;
};

export const fetchAttendanceDetails = async ({ page = 1, limit = 20, start_date, end_date, user_id, division_id, status } = {}) => {
  const params = new URLSearchParams();
  params.append("page", page);
  params.append("limit", limit);
  if (start_date) params.append("start_date", start_date);
  if (end_date) params.append("end_date", end_date);
  if (user_id) params.append("user_id", user_id);
  if (division_id) params.append("division_id", division_id);
  if (status) params.append("status", status);

  const response = await fetch(`${API_BASE}/analytics/attendance-details?${params.toString()}`, {
    method: "GET",
    headers: defaultHeaders(),
    credentials: "include",
  });

  const data = await handleResponse(response);
  if (!data) throw new Error("Gagal memuat detail presensi");
  return data;
};

export const fetchAttendanceDrilldown = async ({
  metric,
  value,
  page = 1,
  limit = 20,
  start_date,
  end_date,
  user_id,
  division_id,
} = {}) => {
  const params = new URLSearchParams();
  if (metric) params.append("metric", metric);
  if (value) params.append("value", value);
  params.append("page", page);
  params.append("limit", limit);
  if (start_date) params.append("start_date", start_date);
  if (end_date) params.append("end_date", end_date);
  if (user_id) params.append("user_id", user_id);
  if (division_id) params.append("division_id", division_id);

  const response = await fetch(`${API_BASE}/analytics/attendance-drilldown?${params.toString()}`, {
    method: "GET",
    headers: defaultHeaders(),
    credentials: "include",
  });

  const data = await handleResponse(response);
  if (!data) throw new Error("Gagal memuat drilldown presensi");
  return data;
};

// ==================== PROJECT ANALYTICS ====================
export const fetchProjectOverview = async ({ work_type, status } = {}) => {
  const params = new URLSearchParams();
  if (work_type) params.append("work_type", work_type);
  if (status) params.append("status", status);

  const response = await fetch(`${API_BASE}/analytics/project-overview?${params.toString()}`, {
    method: "GET",
    headers: defaultHeaders(),
    credentials: "include",
  });

  const data = await handleResponse(response);
  if (!data) throw new Error("Gagal memuat overview proyek");
  return data;
};

export const fetchProjectDetails = async (projectId) => {
  const response = await fetch(`${API_BASE}/analytics/project-details/${projectId}`, {
    method: "GET",
    headers: defaultHeaders(),
    credentials: "include",
  });

  const data = await handleResponse(response);
  if (!data) throw new Error("Gagal memuat detail proyek");
  return data;
};

// ==================== ORG CHART (SILSILAH PERUSAHAAN) ====================
export const fetchOrgChart = async () => {
  const response = await fetch(`${API_BASE}/org-chart`, {
    method: "GET",
    headers: defaultHeaders(),
    credentials: "include",
  });

  const data = await handleResponse(response);
  if (!data) throw new Error("Gagal memuat silsilah perusahaan");
  return data;
};

// ==================== ATTENDANCE ====================
/**
 * Get daily tasks (ongoing / carry-over) for current user. Shown before check-in.
 */
export const getDailyTasks = async () => {
  const response = await fetch(`${API_BASE}/attendance/tasks/daily`, {
    method: "GET",
    headers: defaultHeaders(),
    credentials: "include",
  });

  const data = await handleResponse(response);
  if (!data) throw new Error("Gagal memuat daily tasks");
  return data;
};

/**
 * Create a new daily task (title, optional description).
 */
export const createTask = async (payload) => {
  const response = await fetch(`${API_BASE}/attendance/tasks`, {
    method: "POST",
    headers: defaultHeaders(),
    credentials: "include",
    body: JSON.stringify(payload),
  });

  const data = await handleResponse(response);
  if (!data) throw new Error("Gagal membuat task");
  return data;
};

/**
 * Update task (progress 0-100, or title/description).
 */
export const updateTask = async (taskId, payload) => {
  const response = await fetch(`${API_BASE}/attendance/tasks/${taskId}`, {
    method: "PATCH",
    headers: defaultHeaders(),
    credentials: "include",
    body: JSON.stringify(payload),
  });

  const data = await handleResponse(response);
  if (!data) throw new Error("Gagal mengupdate task");
  return data;
};

export const fetchProjectTasks = async (projectId) => {
  const response = await fetch(
    `${API_BASE}/attendance/tasks/by-project/${projectId}`,
    {
      method: "GET",
      headers: defaultHeaders(),
      credentials: "include",
    }
  );

  const data = await handleResponse(response);
  if (!data) throw new Error("Gagal memuat task proyek");
  return data;
};

export const checkIn = async (taskIds = []) => {
  const response = await fetch(`${API_BASE}/attendance/check-in`, {
    method: "POST",
    headers: defaultHeaders(),
    credentials: "include",
    body: JSON.stringify({
      user_consent: { checkIn: true },
      task_ids: Array.isArray(taskIds) ? taskIds : [],
    }),
  });

  const data = await handleResponse(response);
  if (!data) throw new Error("Gagal melakukan check-in");
  return data;
};

export const updateDailyWork = async (payload) => {
  const response = await fetch(`${API_BASE}/attendance/work`, {
    method: "PATCH",
    headers: defaultHeaders(),
    credentials: "include",
    body: JSON.stringify(payload),
  });

  const data = await handleResponse(response);
  if (!data) throw new Error("Gagal mengupdate pekerjaan harian");
  return data;
};

export const checkOut = async (tasks = []) => {
  const response = await fetch(`${API_BASE}/attendance/check-out`, {
    method: "POST",
    headers: defaultHeaders(),
    credentials: "include",
    body: JSON.stringify({
      user_consent: { checkOut: true },
      tasks: Array.isArray(tasks) ? tasks : [],
    }),
  });

  const data = await handleResponse(response);
  if (!data) throw new Error("Gagal melakukan check-out");
  return data;
};

export const getTodayAttendance = async () => {
  const response = await fetch(`${API_BASE}/attendance/today`, {
    method: "GET",
    headers: defaultHeaders(),
    credentials: "include",
  });

  const data = await handleResponse(response);
  return data;
};

export const getAttendanceHistory = async ({ from, to } = {}) => {
  const params = new URLSearchParams();
  if (from) params.append("from", from);
  if (to) params.append("to", to);

  const response = await fetch(`${API_BASE}/attendance/history?${params.toString()}`, {
    method: "GET",
    headers: defaultHeaders(),
    credentials: "include",
  });

  const data = await handleResponse(response);
  if (!data) throw new Error("Gagal memuat riwayat presensi");
  return data;
};

export const getMyAttendanceCalendar = async ({ month } = {}) => {
  const params = new URLSearchParams();
  if (month) params.append("month", month);
  const response = await fetch(`${API_BASE}/attendance/my-calendar?${params.toString()}`, {
    method: "GET",
    headers: defaultHeaders(),
    credentials: "include",
  });

  const data = await handleResponse(response);
  if (!data) throw new Error("Gagal memuat kalender riwayat presensi");
  return data;
};

export const requestLateAttendance = async ({ date, reason }) => {
  const response = await fetch(`${API_BASE}/attendance/late-request`, {
    method: "POST",
    headers: defaultHeaders(),
    credentials: "include",
    body: JSON.stringify({ date, late_reason: reason }),
  });

  const data = await handleResponse(response);
  if (!data) throw new Error("Gagal mengajukan presensi terlambat");
  return data;
};

export const listMyLateAttendanceRequests = async () => {
  const response = await fetch(`${API_BASE}/attendance/late-requests/mine`, {
    method: "GET",
    headers: defaultHeaders(),
    credentials: "include",
  });

  const data = await handleResponse(response);
  if (!data) throw new Error("Gagal memuat pengajuan presensi terlambat");
  return data;
};

export const listPendingLateAttendanceRequests = async () => {
  const response = await fetch(`${API_BASE}/attendance/late-requests/pending`, {
    method: "GET",
    headers: defaultHeaders(),
    credentials: "include",
  });

  const data = await handleResponse(response);
  if (!data) throw new Error("Gagal memuat pengajuan pending");
  return data;
};

export const requestAbsence = async (payload) => {
  const response = await fetch(`${API_BASE}/attendance/absence-request`, {
    method: "POST",
    headers: defaultHeaders(),
    credentials: "include",
    body: JSON.stringify(payload),
  });
  const data = await handleResponse(response);
  if (!data) throw new Error("Gagal mengajukan izin/cuti/sakit");
  return data;
};

export const uploadAbsenceAttachment = async ({ userId, file }) => {
  if (!userId) throw new Error("userId is required");
  if (!file) throw new Error("file is required");

  const formData = new FormData();
  formData.append("file", file);

  const response = await fetch(`${API_BASE}/files/${userId}/upload-absence`, {
    method: "POST",
    credentials: "include",
    body: formData,
  });
  const data = await handleResponse(response);
  if (!data) throw new Error("Gagal upload lampiran absence");
  return data;
};

export const uploadAbsenceDocument = async ({ userId, file, description = "" }) => {
  if (!userId) throw new Error("userId is required");
  if (!file) throw new Error("file is required");

  const formData = new FormData();
  formData.append("file", file);
  formData.append("user_id", userId);
  formData.append("document_type", "other");
  if (description) formData.append("description", description);

  const response = await fetch(`${API_BASE}/documents/upload`, {
    method: "POST",
    credentials: "include",
    body: formData,
  });
  const data = await handleResponse(response);
  if (!data) throw new Error("Gagal upload dokumen absence");
  return data;
};

export const listMyAbsenceRequests = async () => {
  const response = await fetch(`${API_BASE}/attendance/absence-requests/mine`, {
    method: "GET",
    headers: defaultHeaders(),
    credentials: "include",
  });
  const data = await handleResponse(response);
  if (!data) throw new Error("Gagal memuat pengajuan izin/cuti/sakit");
  return data;
};

export const listPendingAbsenceRequests = async () => {
  const response = await fetch(`${API_BASE}/attendance/absence-requests/pending`, {
    method: "GET",
    headers: defaultHeaders(),
    credentials: "include",
  });
  const data = await handleResponse(response);
  if (!data) throw new Error("Gagal memuat pengajuan izin/cuti/sakit pending");
  return data;
};

export const approveAbsenceRequest = async (requestId) => {
  const response = await fetch(`${API_BASE}/attendance/absence-approve/${requestId}`, {
    method: "POST",
    headers: defaultHeaders(),
    credentials: "include",
  });
  const data = await handleResponse(response);
  if (!data) throw new Error("Gagal menyetujui pengajuan izin/cuti/sakit");
  return data;
};

export const rejectAbsenceRequest = async (requestId) => {
  const response = await fetch(`${API_BASE}/attendance/absence-reject/${requestId}`, {
    method: "POST",
    headers: defaultHeaders(),
    credentials: "include",
    body: JSON.stringify({}),
  });
  const data = await handleResponse(response);
  if (!data) throw new Error("Gagal menolak pengajuan izin/cuti/sakit");
  return data;
};

export const rejectAbsenceRequestWithReason = async (requestId, rejected_reason = "") => {
  const response = await fetch(`${API_BASE}/attendance/absence-reject/${requestId}`, {
    method: "POST",
    headers: defaultHeaders(),
    credentials: "include",
    body: JSON.stringify({ rejected_reason }),
  });
  const data = await handleResponse(response);
  if (!data) throw new Error("Gagal menolak pengajuan izin/cuti/sakit");
  return data;
};

export const approveLateAttendance = async (requestId) => {
  const response = await fetch(`${API_BASE}/attendance/late-approve/${requestId}`, {
    method: "POST",
    headers: defaultHeaders(),
    credentials: "include",
  });

  const data = await handleResponse(response);
  if (!data) throw new Error("Gagal menyetujui pengajuan presensi terlambat");
  return data;
};

export const rejectLateAttendance = async (requestId, rejected_reason) => {
  const response = await fetch(`${API_BASE}/attendance/late-reject/${requestId}`, {
    method: "POST",
    headers: defaultHeaders(),
    credentials: "include",
    body: JSON.stringify({ rejected_reason }),
  });

  const data = await handleResponse(response);
  if (!data) throw new Error("Gagal menolak pengajuan presensi terlambat");
  return data;
};

export const createLateAttendance = async (requestId, payload = {}) => {
  const response = await fetch(`${API_BASE}/attendance/late-create/${requestId}`, {
    method: "POST",
    headers: defaultHeaders(),
    credentials: "include",
    body: JSON.stringify(payload),
  });

  const data = await handleResponse(response);
  if (!data) throw new Error("Gagal membuat presensi terlambat");
  return data;
};

export const submitLateAttendance = async (attendanceId) => {
  const response = await fetch(`${API_BASE}/attendance/late-submit/${attendanceId}`, {
    method: "POST",
    headers: defaultHeaders(),
    credentials: "include",
  });

  const data = await handleResponse(response);
  if (!data) throw new Error("Gagal submit presensi terlambat");
  return data;
};

export const getAttendanceByDate = async (date) => {
  const params = new URLSearchParams();
  params.append("date", date);
  const response = await fetch(`${API_BASE}/attendance/by-date?${params.toString()}`, {
    method: "GET",
    headers: defaultHeaders(),
    credentials: "include",
  });

  const data = await handleResponse(response);
  if (!data) throw new Error("Gagal memuat presensi berdasarkan tanggal");
  return data;
};

export const updateDailyWorkById = async (attendanceId, payload) => {
  const response = await fetch(`${API_BASE}/attendance/work/${attendanceId}`, {
    method: "PATCH",
    headers: defaultHeaders(),
    credentials: "include",
    body: JSON.stringify(payload),
  });

  const data = await handleResponse(response);
  if (!data) throw new Error("Gagal mengupdate pekerjaan harian");
  return data;
};

export const approveTask = async (taskId, payload = {}) => {
  const response = await fetch(
    `${API_BASE}/attendance/tasks/${taskId}/approve`,
    {
      method: "POST",
      headers: defaultHeaders(),
      credentials: "include",
      body: JSON.stringify(payload),
    }
  );

  const data = await handleResponse(response);
  if (!data) throw new Error("Gagal menyetujui task");
  return data;
};

export const rejectTask = async (taskId) => {
  const response = await fetch(
    `${API_BASE}/attendance/tasks/${taskId}/reject`,
    {
      method: "POST",
      headers: defaultHeaders(),
      credentials: "include",
    }
  );

  const data = await handleResponse(response);
  if (!data) throw new Error("Gagal menolak task");
  return data;
};

export const deleteTask = async (taskId) => {
  const response = await fetch(`${API_BASE}/attendance/tasks/${taskId}`, {
    method: "DELETE",
    headers: defaultHeaders(),
    credentials: "include",
  });

  const data = await handleResponse(response);
  if (!data) throw new Error("Gagal menghapus task");
  return data;
};

// Legacy endpoints for attendance dropdowns (keep for backward compatibility)
export const fetchActivities = async () => {
  const response = await fetch(`${API_BASE}/attendance/activities`, {
    method: "GET",
    headers: defaultHeaders(),
    credentials: "include",
  });

  const data = await handleResponse(response);
  if (!data) throw new Error("Gagal memuat aktivitas");
  return data;
};

export const fetchProjects = async () => {
  const response = await fetch(`${API_BASE}/attendance/projects`, {
    method: "GET",
    headers: defaultHeaders(),
    credentials: "include",
  });

  const data = await handleResponse(response);
  if (!data) throw new Error("Gagal memuat proyek");
  return data;
};

export const getWorkingConfig = async ({ date } = {}) => {
  const params = new URLSearchParams();
  if (date) params.append("date", date);
  const response = await fetch(`${API_BASE}/attendance/working-config?${params.toString()}`, {
    method: "GET",
    headers: defaultHeaders(),
    credentials: "include",
  });
  const data = await handleResponse(response);
  return data;
};

// ==================== ADMIN: SCHEDULE (WeeklySchedule & WorkDay) ====================
export const fetchWeeklySchedule = async () => {
  const response = await fetch(`${API_BASE}/admin/schedule/weekly`, {
    method: "GET",
    headers: defaultHeaders(),
    credentials: "include",
  });
  const data = await handleResponse(response);
  return data?.data || [];
};

export const seedWeeklySchedule = async () => {
  const response = await fetch(`${API_BASE}/admin/schedule/weekly/seed`, {
    method: "POST",
    headers: defaultHeaders(),
    credentials: "include",
  });
  const data = await handleResponse(response);
  return data?.data || [];
};

export const updateWeeklyScheduleDay = async (dayOfWeek, payload) => {
  const response = await fetch(`${API_BASE}/admin/schedule/weekly/${dayOfWeek}`, {
    method: "PUT",
    headers: defaultHeaders(),
    credentials: "include",
    body: JSON.stringify(payload),
  });
  const data = await handleResponse(response);
  return data?.data || null;
};

export const fetchWorkDaysRange = async ({ from, to }) => {
  const params = new URLSearchParams();
  if (from) params.append("from", from);
  if (to) params.append("to", to);
  const response = await fetch(`${API_BASE}/admin/schedule/workdays?${params.toString()}`, {
    method: "GET",
    headers: defaultHeaders(),
    credentials: "include",
  });
  const data = await handleResponse(response);
  return data?.data || [];
};

export const upsertWorkDay = async (date, payload) => {
  const response = await fetch(`${API_BASE}/admin/schedule/workdays/${date}`, {
    method: "PUT",
    headers: defaultHeaders(),
    credentials: "include",
    body: JSON.stringify(payload),
  });
  const data = await handleResponse(response);
  return data?.data || null;
};

export const seedWorkDays = async ({ days = 30, from, to } = {}) => {
  const params = new URLSearchParams();
  if (from && to) {
    params.append("from", from);
    params.append("to", to);
  } else {
    params.append("days", String(days));
  }
  const response = await fetch(`${API_BASE}/admin/schedule/workdays/seed?${params.toString()}`, {
    method: "POST",
    headers: defaultHeaders(),
    credentials: "include",
  });
  const data = await handleResponse(response);
  return data?.data || { created: 0 };
};