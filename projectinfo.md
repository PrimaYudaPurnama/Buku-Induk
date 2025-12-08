# Ringkasan Project
- Monorepo sederhana: backend (Bun + Hono + MongoDB/Mongoose) dan frontend (Vite + React 19, zustand).
- Fokus fitur: autentikasi JWT, manajemen user/divisi, riwayat karyawan, upload file (Cloudinary), dashboard UI dengan hak akses berbasis permission.

# Backend (bun)
- Stack: Hono router/middleware, Mongoose untuk schema User/Role/Division/History/Audit/Notif/File, bcrypt untuk hash, jwt untuk token, cors+logger default.
- Entrypoint `src/index.js` memanggil `connectDB()` (env `MONGO_URI`, dbName `buku_induk`), set CORS `http://localhost:5173`, mount routes `/api/v1/{auth,users,divisions,files}` dan health/404/error handler.
- Middleware:
  - `authenticate()` mengambil Bearer token, verify dengan `JWT_SECRET`, load user+role → set `c.set("user")`.
  - `authorize({permissions})` cocokkan string permission dari `role.permissions`, simpan `currentPermission`.
  - Ada helper `authorizeByLevel` dan `restrictUserAccess` (Express-style, belum dipakai).
- Auth controller: login (cek status=active, compare bcrypt, issue JWT expires `JWT_EXPIRES_IN` default 7d), me/check/refresh/logout, forgotPassword (generate token saja, TODO kirim email).
- User controller: paginated list/filter/sort, get by id, create (hash, history “hired”), update (email uniqueness, history events), delete (likely soft-delete—lihat lanjutan file), change password route ada di router.
- Division controller: CRUD dengan permission `system:manage_divisions` (lihat `routes/division.js`).
- Cloudinary controller/route ada (belum dibaca detail).
- Scripts: `bun run dev` (hot). Env wajib: `MONGO_URI`, `JWT_SECRET`, opsional `JWT_EXPIRES_IN`, `BUN_ENV`.

# Core Domain & Skema
- Role: nama unik, `permissions` (array string), `hierarchy_level` (angka kecil = otoritas tinggi), timestamps.
- User: email unik + text index, `full_name`, hashed `password`, `role_id` wajib, `division_id` opsional, status enum (active/inactive/pending/terminated), hire/termination date, profil & kontak darurat, alamat, DOB/NIK; timestamps.
- Division: nama unik + deskripsi, `manager_id`, `active_general_id`; timestamps.
- EmployeeHistory: event enum (hired/promotion/demotion/transfer/salary_change/resignation/terminated/status_change/role_change) dengan old/new role/division/salary, `effective_date` wajib, reason/notes, `created_by`; created_at only, index di user/event/effective_date/created_at.
- AccountRequest: request akun (requester_name, email, phone, requested_role, division_id) status enum pending/approved/rejected, notes/comments, requested_by/approved_by, processed_at; timestamps, index email/division/status/created_at.
- Approval: mengikat request (type enum, request_id) dengan user_id/approver_id, status enum, comments, approval_level, processed_at; created_at only; index request_type+request_id, user/approver/status/created_at.
- Document: user_id + document_type enum (contract/id_card/dll), file_name/url/size/mime, cloudinary_public_id, description, uploaded_by; created_at only; index user/type/created_at.
- file_metaData: user_id, uploaded_by, cloudinary_public_id, url, original_filename, size, mime_type; timestamps.
- Notification: user_id, type enum (account_approved/promotion/dsb), title/message/action_url, is_read/read_at; created_at only; index user/is_read/created_at.
- AuditLog: user_id opsional, action, resource_type/id, old_value/new_value (Mixed), ip_address, user_agent; created_at only; index resource_type+resource_id, action, created_at.

# Frontend (vite-react)
- Router: `/` login, `/dashboard`, `/profile/:userId`.
- State: `useAuthStore` (zustand + localStorage) simpan `user` & `token`.
- Login page: POST ke `http://localhost:3000/api/v1/auth/login`, simpan token+user, redirect ke `/dashboard`.
- Dashboard: Sidebar + Header; konten Home/UserList/DivisionList (subs). Sidebar menu di-filter berdasarkan permission array dari `user.role_id.permissions`.
- API util `src/utils/api.jsx`: helper fetch dengan Bearer token, handle 401/403 dengan alert + redirect, fungsi CRUD user & division, history fetch, dll. Base URL `http://localhost:3000/api/v1`.

# Catatan & Potensi Isu
- Router `routes/user.js` campur pemanggilan middleware: sebagian memakai `authenticate()` (benar), tapi `PUT /:id/change-password` memakai `authenticate` tanpa eksekusi → middleware tidak jalan.
- Permission enforcement di controller: `createUser`/`updateUser` hanya menerima permission exact `"user:create"`/`"user:update"` padahal authorize menerima beberapa string. Konsistensi perlu dicek agar sesuai role permission.
- CORS origin hardcoded ke `http://localhost:5173`; butuh penyesuaian saat deploy.
- `process.env.JWT_SECRET` wajib; tidak ada fallback → server gagal start jika lupa set.
- Frontend: token hanya disimpan di zustand/localStorage, tidak ada auto-refresh; error handling pakai `alert`.
- Tidak ada docker/compose; setup manual env MongoDB diperlukan.

# Cara Jalan Cepat
- Backend: `cd backend && bun install && bun run dev` (set env `MONGO_URI`, `JWT_SECRET`, opsional `JWT_EXPIRES_IN`, `BUN_ENV`).
- Frontend: `cd frontend && npm install && npm run dev` (Vite default port 5173, sesuai CORS backend).
