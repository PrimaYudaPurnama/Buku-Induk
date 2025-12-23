// utils/api.jsx

import { useAuthStore } from "../stores/useAuthStore";
import toast from "react-hot-toast";

const API_BASE = "http://localhost:3000/api/v1";

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

// ==================== GET USERS ====================
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