// utils/api.jsx

import { useAuthStore } from "../stores/useAuthStore";

const API_BASE = "http://localhost:3000/api/v1";

// Ambil token LANGSUNG dari Zustand (paling akurat & real-time)
const getToken = () => {
  return useAuthStore.getState().token;
};

const defaultHeaders = () => ({
  "Content-Type": "application/json",
  Authorization: `Bearer ${getToken()}`,
});

// Universal Response Handler
const handleResponse = async (response) => {
  if (response.status === 403) {
    alert("Akses ditolak! Kamu tidak punya izin untuk melakukan aksi ini.");
    return null;
  }

  if (response.status === 401) {
    alert("Sesi habis. Silakan login ulang.");
    localStorage.removeItem("token");
    window.location.href = "/";
    return null;
  }

  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(err.error?.message || `HTTP ${response.status}`);
  }

  return response.json();
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
    console.log("param : " + params)

    const response = await fetch(`${API_BASE}/users?${params.toString()}`, {
      method: "GET",
      headers: defaultHeaders(),
      credentials: "include",
    });
    console.log("response: " + JSON.stringify(response))
    const data = await handleResponse(response);

    if (!data) {
      return {
        data: [],
        meta: { pagination: { total_items: 0, total_pages: 1 } },
      };
    }

    console.log("dataaaanyaa : " + data)

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
    console.log("user data: " + JSON.stringify(userData))
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
  console.log("payload:", payload);

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
    method: "PUT",
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
