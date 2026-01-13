## Ringkasan Proyek

Aplikasi ini adalah sistem manajemen SDM/internal perusahaan yang mengelola **data karyawan**, **divisi**, **role & permission**, **proses approval (workflow)**, **dokumen**, **notifikasi**, **riwayat pekerjaan (employee history)**, dan **gaji**.

### Backend (folder `backend/`)
- **Teknologi utama**: Hono (HTTP framework), MongoDB (via Mongoose), Argon2 (hash password), JWT auth (cookie `access_token`), CORS untuk frontend Vite (`http://localhost:5173`).
- **Entry point**: `src/index.js`
  - Koneksi database (`lib/db.js`).
  - Registrasi route: `users`, `auth`, `account-requests`, `approvals`, `documents`, `notifications`, `audit-logs`, `roles`, `divisions`, `analytics`, `org-chart`, `files`.
  - Health check `/health` dan handler 404 / error global.

#### Autentikasi & Otorisasi
- Middleware `middleware/auth.js`:
  - **`authenticate`**: baca JWT dari cookie, load `User` (beserta `role_id`) dan set ke context `c.set("user", user)`.
  - **`authorize`**: cek izin berbasis permission string pada role (`user:create`, `user:update:any`, dst). Menyimpan izin yang match di `currentPermission` dan seluruh permission di `userPermissions`.
  - **`approvalGuard`**: memastikan user yang memanggil endpoint approval adalah approver yang benar dan approval masih `pending`.
  - Helper `canAccessResource` & `canApprove` untuk logika akses berbasis division/self.
  - `authorizeByLevel` memakai **hierarchy level** role (semakin kecil = semakin tinggi, didefinisikan di `lib/roleHierarchy.js`).

#### Model Inti (`src/models`)
- **User**: data karyawan (email, password, role, division, status, employee_code, alamat, kontak darurat, data pribadi, employment_type, dll).
- **Role**: nama role, `hierarchy_level`, daftar `permissions`.
- **Division**: nama divisi, `manager_id`, dsb.
- **AccountRequest**: permintaan akun / perubahan karyawan (field utama: requester_name, email, requested_role, division_id, request_type, user_id, status, notes, requested_by, approved_by, setup_token).
- **Approval**: tiap langkah persetujuan (request_type, request_id, user_id yang terdampak, approver_id, status, approval_level, processed_at).
- **EmployeeHistory**: jejak peristiwa seperti `hired`, `promotion`, `transfer`, `salary_change`, `terminated`, dll.
- **Salary**: gaji berbasis snapshot (base_salary, allowances, deductions, total_allowance, total_deduction, take_home_pay, bank_account, note, status).
- **Document** & **file_metaData**: metadata file (id_card, resume, certificate, contract, termination, npwp, dsb).
- **Notification**: notifikasi in-app (type, title, message, is_read).
- **AuditLog**: pencatatan aktivitas (action, resource_type, resource_id, old_value, new_value, ip, user_agent).

#### Service & Utility Penting
- **`lib/roleHierarchy.js`**: mapping urutan hirarki (Superadmin=1, Admin=2, Director/Investor=3, Manager HR/GM/Finance=4, Manager=5, Team Lead=6, Staff=7).
- **`lib/permissions.js`**: katalog dasar permission (`BASE_PERMISSIONS`) dan builder untuk gabung dengan permission di database.
- **`services/userService.js`**:
  - `populateSalaryForUsers`: join data Salary ke list user.
  - `maskSalaryForUsers`: masking salary sesuai permission (`user:view_salary:any/own_division/self`).
- **`services/approvalService.js`**:
  - `createApprovalsForRequest`: buat dokumen Approval berdasarkan workflow yang didefinisikan di `lib/approvalWorkflows.js` (promotion, termination, transfer, account_request).
  - `approveStep` / `rejectStep`: update status approval, cek urutan level, dan memanggil `finalizeRequest`.
  - `getPendingApprovalsForUser`: daftar approval `pending` yang benar-benar boleh dilihat user (hanya level yang giliran dia).
- **`services/notificationService.js`**:
  - `notifyUser` + `notifyEmail` (Resend) dan handler spesifik event: `handleAccountRequestApproved`, `handleAccountSetupCompleted`, `handlePromotion`, `handleTransfer`, `handleTerminationNotice`, dsb.
- **`utils/auditLogger.js`**: helper `logAudit` untuk menulis AuditLog dengan otomatis capture IP address dan user agent dari request context.

#### Workflow Approval (`src/lib/approvalWorkflows.js`)
- Konfigurasi langkah approval berdasarkan `request_type`:
  - `promotion`, `termination`, `transfer`: saat ini dikonfigurasi hanya punya langkah ke **Director** (level 3) karena level-level lain (Manager, Manager HR) sedang di-comment.
  - `account_request`: default langkah ke **Director** (level 2), langkah Manager HR di-comment.
- `generateApprovalSteps(requestType, userData, payload)` menghasilkan array `{ level, approver_role }`.
- `getRequestTypes` dan `isValidRequestType` untuk validasi.

#### Alur Account Request & Approval
- **Membuat request** (`AccountRequestController.createAccountRequest` via `POST /api/v1/account-requests`):
  - Menerima `request_type` (`account_request`, `promotion`, `termination`, `transfer`), `requested_role`, `division_id`, `user_id` (untuk perubahan user yang sudah ada), `notes`.
  - Normalisasi: kalau `user_id` ada, fallback ke data user (nama, email, role/division saat ini).
  - Validasi:
    - Wajib: `requester_name`, `email`, `requested_role`.
    - `division_id` wajib untuk `account_request` dan `transfer`.
    - `request_type` harus termasuk konfigurasi `approvalWorkflows`.
    - Role pemohon tidak boleh mengajukan role yang lebih tinggi dari otoritasnya (pakai `hierarchy_level`).
    - Kalau target user ada, pemohon harus punya level lebih tinggi dari target; untuk `transfer`, tidak boleh mengajukan untuk manager divisi.
  - Membuat dokumen `AccountRequest` (status awal `pending`, mengisi `requested_by` dari user login).
  - Memanggil `createApprovalsForRequest(request)` → generate satu atau lebih `Approval` berdasarkan workflow.
  - **Khusus Director**: bila `requested_by` memiliki role `"Director"`, sistem langsung:
    - Menandai semua Approval terkait request tersebut sebagai **approved** dengan `processed_at` sekarang.
    - Menjalankan efek bisnis yang biasanya terjadi setelah semua approval selesai:
      - `promotion`: ganti `role_id` user target, buat `EmployeeHistory` event `promotion`, kirim notifikasi via `handlePromotion`.
      - `transfer`: ubah `division_id` user target, buat history `transfer`, kirim notifikasi via `handleTransfer`.
      - `termination`: set status user menjadi `terminated`, isi `termination_date`, buat history `terminated`, kirim notifikasi via `handleTerminationNotice`.
    - Menandai `AccountRequest.status = "approved"` dan mengisi `processed_at`.
    - Dengan demikian, **tidak ada Approval yang tersisa dengan status `pending`**, sehingga tidak akan muncul di kotak masuk (`ApprovalInbox` di frontend).
- **Kotak masuk approval** (`ApprovalController.getMyPendingApprovals` + `GET /approvals/mine`):
  - Mengambil semua Approval `pending` untuk user saat ini, mem-populate `request_id`, `user_id`, `approver_id`, dan membangun `timeline` seluruh approval untuk request tersebut.
- **Menyetujui/menolak langkah** (`POST /approvals/:id/approve` / `reject`):
  - Guard `approvalGuard` memastikan hanya approver yang benar yang dapat bertindak.
  - `approveRequestStep`:
    - Memanggil `approveStep`, log audit, lalu jika semua approval sudah approved:
      - Memanggil `finalizeRequest` → set status request ke `approved` dan `processed_at`.
      - Menjalankan efek bisnis sesuai `request_type` (account_request: setup token / aktivasi user; promotion/transfer/termination: update user + employeeHistory + notifikasi).
    - Jika belum semua, memanggil `handleApprovalStepApproved` untuk memberi notifikasi ke level berikutnya.
  - `rejectRequestStep`: `rejectStep` + set request.status = `rejected` dan kirim berbagai notifikasi penolakan.

#### User & Salary
- **`UserController.getUsers`** (`GET /users`):
  - Pagination + filter (status, role, division, search), serta pembatasan akses berdasar permission (`user:read:any/own_division/self`).
  - Menghindari menampilkan Superadmin untuk non-superadmin.
  - Populate role/division, join salary, lalu masking salary berdasarkan permission.
- **`UserController.createUser`** (`POST /users`):
  - Hanya bila permission cocok (`user:create` / `user:create:own_division` di router).
  - Hash password, generate employee_code, simpan user (tanpa gaji) dan buat history `hired`.
- **`UserController.updateUser`** (`PATCH /users/:id`):
  - Cek permission (`user:update*`), validasi email unik.
  - Update data non-salary; bila role/division/status berubah, otomatis menulis `EmployeeHistory` (promotion/transfer/termination) dan log audit.
- **`UserController.deleteUser`**: soft delete (status → `terminated` + history).
- **Gaji**:
  - `getUserSalary` dan `updateUserSalary` menggunakan model `Salary`, terikat dengan permission `user:view_salary*` & `user:update_salary*`.
  - Update gaji juga menulis history `salary_change` dan audit log `salary_update`.
- **Password Management**:
  - `changePassword`: mengubah password user (self atau admin), mencatat audit log `password_change` untuk tracking keamanan.
- **Audit Logging**:
  - Semua operasi penting dicatat ke `AuditLog` untuk compliance dan security tracking:
    - **User operations**: `user_create`, `user_update`, `user_delete`, `user_approve`, `user_reject`, `password_change`, `salary_update`
    - **Account Request**: `account_request_create`, `account_setup_complete`
    - **Approval**: `approve`, `reject` (sudah ada sebelumnya)
    - **Authentication**: `login_success`, `login_failed`, `logout`, `password_reset_request`, `user_register`
    - **Document**: `document_upload`, `file_metadata_upload`
    - **Role**: `role_create`, `role_update`, `role_delete`
    - **Division**: `division_create`, `division_update`, `division_delete`
  - Setiap audit log menyimpan: `user_id`, `action`, `resource_type`, `resource_id`, `old_value`, `new_value`, `ip_address`, `user_agent`, `created_at`.

### Frontend (folder `frontend/`)
- **Teknologi utama**: React + Vite, Tailwind-like utility class, Framer Motion untuk animasi, `lucide-react` untuk ikon, `react-hot-toast` untuk notifikasi.
- **`src/utils/api.jsx`**:
  - Abstraksi seluruh panggilan API ke backend (`fetchUsers`, `createUser`, `updateUser`, `deleteUser`, `createAccountRequest`, `fetchMyPendingApprovals`, `approveStep`, `rejectStep`, `uploadDocument`, `fetchUserDocuments`, `fetchRoles`, `fetchDivisions`, salary APIs, audit log, analytics, org chart, dsb).
  - Handler umum `handleResponse` menangani 401/403 dan error lain.

#### Manajemen User (`src/subs/UserList.jsx`)
- Halaman utama untuk **User Management**:
  - Tabel karyawan dengan pencarian, filter (status, role, division), pagination.
  - Aksi:
    - Tambah user (modal **Tambah User Baru**) – hanya jika punya permission `user:create`.
    - Edit user langsung – hanya **Superadmin** (via API `updateUser`).
    - Ajukan perubahan (Promosi/Demosi, Transfer, Terminasi) via modal **Ajukan Perubahan** → mengirim **AccountRequest** dengan `request_type` yang sesuai (promotion/transfer/termination) untuk role selain Superadmin.
    - Soft delete user (Superadmin) → `deleteUser` (status jadi `terminated` + history).
    - Lihat history user (modal timeline), lihat/set/edit gaji (modal gaji), export CSV, lihat detail, ID card, kartu nama.
- Logika perizinan di frontend:
  - `isSuperadmin` berdasar `user.role_id.name === "Superadmin"`.
  - `canCreateUser` dari permission `user:create`.
  - `canUpdateDirect` dan `canDeleteDirect` hanya untuk Superadmin (frontend memaksa semua role lain menggunakan mekanisme approval).
  - `canProposeChange` untuk role yang punya permission mulai dengan `employee:promote*`, `employee:terminate*`, `employee:transfer*`.
  - `requesterCanTargetUser` dan `requesterCanTargetRole` memanfaatkan `roles` dan `hierarchy_level` untuk mencegah pengajuan ke user/role yang setara atau di atas.
- Pembuatan request approval:
  - Fungsi `openRequestModal(user, type)` mengisi `selectedUser`, `requestType` (promotion/transfer/termination) dan form default.
  - `handleRequestSubmit` memanggil `createAccountRequest` dengan payload:
    - `request_type`: `promotion` / `transfer` / `termination`.
    - `user_id`: user yang akan diubah.
    - `requested_role` (untuk promotion) dan/atau `division_id` (untuk transfer).
    - `notes` dan upload dokumen termination (tipe dokumen `termination`) bila perlu.
  - Setelah backend perubahan di atas, bila pengaju adalah Director, request ini langsung disetujui otomatis di backend, sehingga **tidak muncul di ApprovalInbox**.

#### Kotak Masuk Approval (`src/pages/ApprovalInbox.jsx` + `src/components/ApprovalCard.jsx`)
- Hook `useApprovalInbox` memanggil `fetchMyPendingApprovals` setiap 30 detik untuk menampilkan semua approval `pending` bagi user saat ini.
- `ApprovalInbox`:
  - Menampilkan kartu (`ApprovalCard`) per approval yang harus diproses.
  - Saat approver klik **Setujui/Tolak**, akan membuka modal konfirmasi:
    - Bisa melihat detail pemohon, target role/division, timeline approval, dan dokumen pendukung (KTP, resume, sertifikat).
    - Khusus `account_request`:
      - Manager HR pada level 1 diwajibkan upload dokumen **contract** sebelum approve; dokumen ini lalu bisa dilihat Director di level berikutnya.
  - Tombol konfirmasi memanggil hook `approve` / `reject` yang memanggil API `/approvals/:id/approve|reject`.
- `ApprovalCard` merender:
  - Header jenis request (promotion/termination/transfer/account_request) dengan warna berbeda.
  - Informasi pemohon (`requester_name`, email), `requested_by`, perubahan role/division bila ada.
  - Dokumen pendukung account_request (KTP, resume, sertifikat) dengan link view ke backend.
  - Mini timeline status level-level approval.

### Perubahan Khusus yang Ditambahkan
- **Auto-approval bila pengaju adalah Director**:
  - Di `AccountRequestController.createAccountRequest` (backend), setelah membuat `AccountRequest` dan `Approval`, sistem sekarang:
    - Mengecek role pemohon (`requesterRoleName`) dan bila `"Director"`:
      - Menandai semua `Approval` terkait sebagai `approved` secara otomatis.
      - Menjalankan operasi bisnis (update user + `EmployeeHistory` + notifikasi) untuk `promotion`, `transfer`, dan `termination` persis seperti ketika semua approval selesai secara manual.
      - Menandai `AccountRequest` sebagai `approved` dan mengisi `processed_at`.
  - Dampak di frontend:
    - Dari sisi `UserList.jsx`, Director tetap menggunakan alur **Ajukan Perubahan** yang sama (panggilan `createAccountRequest`), tetapi request-nya akan langsung diproses tanpa perlu tindakan manual di `ApprovalInbox.jsx`, sehingga memenuhi requirement “jika yang mengajukan perubahan langsung directornya maka langsung approved, jadi tidak perlu disetujui manual di ApprovalInbox.jsx`.

- **Comprehensive Audit Logging**:
  - Semua operasi penting di seluruh controller sekarang dicatat ke `AuditLog` untuk compliance dan security tracking:
    - **AccountRequestController**: `account_request_create` (saat membuat request), `account_setup_complete` (saat setup akun selesai)
    - **UserController**: `password_change` (perubahan password), `salary_update` (update gaji)
    - **AuthController**: `logout` (keluar sistem), `password_reset_request` (permintaan reset password)
    - **DocumentController**: `document_upload` (upload dokumen), `file_metadata_upload` (upload metadata file)
    - **RoleController**: `role_delete` (hapus role)
    - **DivisionController**: `division_create`, `division_update`, `division_delete` (CRUD divisi)
  - Setiap audit log menyimpan informasi lengkap: user yang melakukan aksi, action type, resource yang diubah, old/new values, IP address, dan user agent untuk forensic analysis.

File ini hanya ringkasan arsitektur & alur utama berdasarkan kode saat ini; detail implementasi bisa dilihat langsung di masing-masing file di `backend/src` dan `frontend/src`.

