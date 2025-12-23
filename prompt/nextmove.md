# TODO List - Kekurangan & Step Selanjutnya

## 📋 RINGKASAN ANALISIS PROJECT

### ✅ Yang Sudah Ada
1. **Model Database**: Lengkap (User, Role, Division, AccountRequest, Approval, Document, Notification, EmployeeHistory, AuditLog)
2. **Authentication & Authorization**: JWT auth, permission-based access control dengan middleware
3. **Core Features**: 
   - User CRUD dengan permission filtering (any/own_division/self)
   - Account Request dengan approval workflow multi-level
   - Approval system dengan guard middleware
   - Document upload dengan Cloudinary
   - Notification system (in-app, email placeholder)
   - Employee History tracking
4. **Role System**: 10 roles dengan hierarchy_level dan permissions yang jelas
5. **Services**: ApprovalService, EmployeeHistoryService, DocumentService, NotificationService

### ❌ Yang Masih Kurang / Perlu Diperbaiki

---

## 🔴 PRIORITAS TINGGI (Critical)

### 1. **Salary Management System**
**Status**: ❌ Belum ada sama sekali
**Masalah**:
- Model `User` tidak punya field `salary` (hanya ada di EmployeeHistory)
- Permission `user:view_salary:any`, `user:view_salary:own_division`, `user:view_salary:self` sudah ada di role tapi tidak ada endpoint
- Tidak ada cara untuk set/update salary user
- Frontend sudah ada menu "Salary Report" tapi backend belum ada

**Yang Perlu Dibuat**:
- [ ] Tambahkan field `salary` (Decimal128) ke model User
- [ ] Buat endpoint `GET /api/v1/users/:id/salary` dengan permission check
- [ ] Buat endpoint `PATCH /api/v1/users/:id/salary` dengan permission `employee:promote:any` atau `employee:promote:own_division`
- [ ] Auto-create EmployeeHistory dengan event_type `salary_change` saat salary diupdate
- [ ] Buat endpoint `GET /api/v1/salary-report` untuk export laporan gaji (permission `user:export`)
- [ ] Implementasi di frontend untuk view salary berdasarkan permission

---

### 2. **Audit Logging System**
**Status**: ❌ Model ada, tapi tidak ada implementasi
**Masalah**:
- Model `AuditLog` sudah ada tapi tidak ada service/controller
- Permission `system:view_audit_logs` ada di role (Superadmin, Admin, Director) tapi tidak ada endpoint
- Tidak ada middleware untuk auto-log actions (create, update, delete)
- Frontend sudah ada menu "Audit Logs" tapi backend belum ada

**Yang Perlu Dibuat**:
- [ ] Buat `services/auditLogService.js` dengan fungsi:
  - `createAuditLog(userId, action, resourceType, resourceId, oldValue, newValue, ipAddress, userAgent)`
  - `getAuditLogs(filters, pagination)`
- [ ] Buat `controllers/auditLog.js` dengan endpoint:
  - `GET /api/v1/audit-logs` (permission `system:view_audit_logs`)
  - `GET /api/v1/audit-logs/:id`
- [ ] Buat `routes/auditLog.js`
- [ ] Buat middleware `auditAction()` untuk auto-log di controller:
  - User CRUD operations
  - Account Request operations
  - Approval operations
  - Document operations
- [ ] Implementasi di frontend untuk view audit logs

---

### 3. **Account Request Auto-Create User**
**Status**: ⚠️ Partial - Approval sudah finalize tapi tidak create user
**Masalah**:
- Di `approvalController.js` line 108-115, ketika account_request approved, hanya notify user tapi tidak create user account
- Harus auto-create user dengan:
  - Email dari request.email
  - Role dari request.requested_role
  - Division dari request.division_id
  - Status "active"
  - Generate password random atau kirim email untuk set password

**Yang Perlu Dibuat**:
- [ ] Di `approvalController.approveRequestStep()`, tambahkan logic untuk create user ketika `request_type === "account_request"` dan semua approval approved
- [ ] Generate random password atau kirim email untuk user set password sendiri
- [ ] Create EmployeeHistory dengan event_type "hired"
- [ ] Update notification untuk include login credentials (jika password auto-generated)

---

### 4. **Role Management CRUD**
**Status**: ❌ Permission ada, tapi tidak ada endpoint
**Masalah**:
- Permission `system:manage_roles` ada di Superadmin tapi tidak ada endpoint untuk CRUD role
- Role seeder ada tapi tidak ada controller/route untuk manage role
- Tidak ada cara untuk update role permissions atau hierarchy_level via API

**Yang Perlu Dibuat**:
- [ ] Buat `controllers/role.js` dengan:
  - `GET /api/v1/roles` (list semua role)
  - `GET /api/v1/roles/:id` (detail role)
  - `POST /api/v1/roles` (create role - permission `system:manage_roles`)
  - `PATCH /api/v1/roles/:id` (update role - permission `system:manage_roles`)
  - `DELETE /api/v1/roles/:id` (delete role - permission `system:manage_roles`, dengan validasi tidak boleh delete role yang masih dipakai user)
- [ ] Buat `routes/role.js`
- [ ] Implementasi di frontend untuk manage roles (hanya Superadmin)

---

## 🟡 PRIORITAS SEDANG (Important)

### 5. **Permission Inconsistencies di Routes**
**Status**: ⚠️ Route dan Controller tidak sinkron
**Masalah**:
- `routes/user.js` line 47: authorize dengan `["user:update:any", "user:update:own_division", "user:update"]` tapi controller hanya cek `user:update`
- `routes/user.js` line 38: authorize dengan `["user:create", "user:create:own_division"]` tapi controller hanya cek `user:create`
- `routes/user.js` line 62: authorize dengan `["user:delete:any", "user:delete:own_division", "user:delete"]` tapi controller hanya cek `user:delete`
- `routes/user.js` line 54: `change-password` route tidak menggunakan `authenticate()` dengan benar (harus `authenticate()` bukan `authenticate`)

**Yang Perlu Diperbaiki**:
- [ ] Update `userController.createUser()` untuk handle `user:create:own_division` (hanya bisa create user di division sendiri)
- [ ] Update `userController.updateUser()` untuk handle `user:update:own_division` (hanya bisa update user di division sendiri)
- [ ] Update `userController.deleteUser()` untuk handle `user:delete:own_division` (hanya bisa delete user di division sendiri)
- [ ] Fix `routes/user.js` line 54: ganti `authenticate` menjadi `authenticate()`
- [ ] Update permission check di controller untuk match dengan route permissions

---

### 6. **Salary Change Request Workflow**
**Status**: ❌ Belum ada
**Masalah**:
- Model `Approval` support `salary_change` di request_type enum (line 13)
- Model `AccountRequest` tidak support `salary_change` di request_type enum (hanya: account_request, promotion, termination, transfer)
- Tidak ada workflow untuk request salary change dengan approval

**Yang Perlu Dibuat**:
- [ ] Tambahkan `salary_change` ke enum `request_type` di model AccountRequest
- [ ] Update `approvalWorkflows.js` untuk handle `salary_change` workflow (contoh: Manager → HR Manager → Director)
- [ ] Buat endpoint `POST /api/v1/account-requests` dengan request_type `salary_change` (permission `account:create`)
- [ ] Update `approvalController.approveRequestStep()` untuk handle salary_change (update user salary + create history)
- [ ] Implementasi di frontend untuk create salary change request

---

### 7. **Export Functionality**
**Status**: ❌ Permission ada, tapi tidak ada endpoint
**Masalah**:
- Permission `user:export` ada di role (Superadmin, Admin, Finance) tapi tidak ada endpoint
- Tidak ada cara untuk export data user ke CSV/Excel/PDF

**Yang Perlu Dibuat**:
- [ ] Install library untuk export (contoh: `xlsx` untuk Excel, `csv-writer` untuk CSV)
- [ ] Buat endpoint `GET /api/v1/users/export` dengan:
  - Query params: `format` (csv/excel/pdf), `filter[division_id]`, `filter[status]`, dll
  - Permission `user:export`
  - Filter berdasarkan permission user (any/own_division/self)
- [ ] Buat endpoint `GET /api/v1/salary-report/export` untuk export laporan gaji (permission `user:export`)
- [ ] Implementasi di frontend untuk export button

---

### 8. **Dashboard & Report Endpoints**
**Status**: ❌ Permission ada, tapi tidak ada endpoint
**Masalah**:
- Permission `dashboard:read` ada di role Investor
- Permission `report:financial:read` ada di role Investor
- Tidak ada endpoint untuk dashboard data atau financial report

**Yang Perlu Dibuat**:
- [ ] Buat `controllers/dashboard.js` dengan endpoint:
  - `GET /api/v1/dashboard/stats` (permission `dashboard:read` atau `user:read:any`)
  - `GET /api/v1/dashboard/recent-activities`
- [ ] Buat `controllers/report.js` dengan endpoint:
  - `GET /api/v1/reports/financial` (permission `report:financial:read`)
  - `GET /api/v1/reports/employee` (permission `user:read:any`)
- [ ] Buat `routes/dashboard.js` dan `routes/report.js`
- [ ] Implementasi di frontend untuk dashboard dan report pages

---

## 🟢 PRIORITAS RENDAH (Nice to Have)

### 9. **Email Integration**
**Status**: ⚠️ Placeholder ada, tapi belum diimplementasikan
**Masalah**:
- `notificationService.js` punya fungsi `notifyEmail()` tapi hanya console.log
- Tidak ada email service integration (nodemailer, sendgrid, dll)

**Yang Perlu Dibuat**:
- [ ] Install email service library (contoh: `nodemailer` atau `@sendgrid/mail`)
- [ ] Setup email service di `utils/email.js`
- [ ] Update `notificationService.notifyEmail()` untuk kirim email real
- [ ] Setup environment variables untuk email config (SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS)
- [ ] Test email untuk semua notification types

---

### 10. **Investor Role Special Access**
**Status**: ⚠️ Role ada, tapi tidak ada endpoint khusus
**Masalah**:
- Role Investor punya permission `dashboard:read` dan `report:financial:read` tapi tidak ada endpoint khusus
- Investor seharusnya hanya bisa lihat financial report, tidak bisa akses user data atau approval

**Yang Perlu Dibuat**:
- [ ] Buat endpoint khusus untuk Investor di `controllers/report.js`
- [ ] Pastikan Investor tidak bisa akses endpoint lain (selain dashboard dan financial report)
- [ ] Buat frontend khusus untuk Investor role

---

### 11. **User Model - Missing Fields Validation**
**Status**: ⚠️ Field ada tapi tidak ada validation
**Masalah**:
- Field `national_id` (NIK) tidak ada validation format
- Field `phone` tidak ada validation format
- Field `date_of_birth` tidak ada validation (harus valid date, tidak boleh future date)

**Yang Perlu Diperbaiki**:
- [ ] Tambahkan validation untuk `national_id` (format NIK Indonesia: 16 digit)
- [ ] Tambahkan validation untuk `phone` (format Indonesia: +62 atau 08xx)
- [ ] Tambahkan validation untuk `date_of_birth` (tidak boleh future date, minimal 17 tahun untuk hire)

---

### 12. **Approval Workflow - Dynamic Approver Selection**
**Status**: ⚠️ Hardcoded, tidak dinamis
**Masalah**:
- `approvalService.js` line 82: hanya ambil first approver (`approverUsers[0]`)
- Tidak ada logic untuk handle multiple approvers dengan role yang sama
- Tidak ada logic untuk handle approver yang tidak available (sick leave, dll)

**Yang Perlu Diperbaiki**:
- [ ] Buat logic untuk select approver berdasarkan:
  - Division manager untuk division-specific requests
  - Availability (status active, tidak sedang leave)
  - Workload (prioritize approver dengan pending approvals lebih sedikit)
- [ ] Handle case ketika tidak ada approver available (notify admin)

---

### 13. **Document Soft Delete**
**Status**: ⚠️ Hard delete, tidak ada soft delete
**Masalah**:
- `documentService.deleteDocument()` melakukan hard delete (line 112)
- Tidak ada field `deleted_at` di model Document
- Tidak ada cara untuk restore deleted document

**Yang Perlu Diperbaiki**:
- [ ] Tambahkan field `deleted_at` (Date, default null) ke model Document
- [ ] Update `deleteDocument()` untuk soft delete (set deleted_at)
- [ ] Update query di `getUserDocuments()` untuk exclude deleted documents
- [ ] Buat endpoint untuk restore deleted document (permission khusus)

---

### 14. **Account Request - Auto-assign Division Manager**
**Status**: ⚠️ Tidak otomatis
**Masalah**:
- Ketika create account request, tidak auto-assign division manager sebagai approver level 1
- Harus manual cari approver berdasarkan role

**Yang Perlu Diperbaiki**:
- [ ] Update `approvalService.createApprovalsForRequest()` untuk:
  - Account request: auto-assign division manager sebagai approver level 1
  - Promotion/Transfer: auto-assign current division manager sebagai approver level 1
  - Termination: auto-assign division manager sebagai approver level 1

---

### 15. **Employee History - Salary Change Tracking**
**Status**: ⚠️ Partial - bisa track tapi tidak otomatis
**Masalah**:
- Ketika update salary via endpoint (yang akan dibuat di TODO #1), harus auto-create EmployeeHistory
- Saat ini tidak ada auto-tracking untuk salary change

**Yang Perlu Diperbaiki**:
- [ ] Ketika endpoint salary update dibuat, auto-call `autoCreateHistory()` dengan event_type `salary_change`
- [ ] Pastikan old_salary dan new_salary tersimpan dengan benar

---

## 🔧 PERBAIKAN TEKNIS

### 16. **Error Handling & Validation**
**Status**: ⚠️ Partial
**Masalah**:
- Beberapa controller tidak handle error dengan konsisten
- Tidak ada global error handler untuk validation errors
- Tidak ada custom error classes

**Yang Perlu Diperbaiki**:
- [ ] Buat custom error classes (`utils/errors.js`): `ValidationError`, `NotFoundError`, `ForbiddenError`, dll
- [ ] Update semua controller untuk use custom error classes
- [ ] Buat global error handler middleware untuk format error response konsisten

---

### 17. **API Response Format Standardization**
**Status**: ⚠️ Tidak konsisten
**Masalah**:
- Beberapa endpoint return `{ success: true, data: ... }`
- Beberapa endpoint return `{ message: ..., data: ... }`
- Tidak ada standard format

**Yang Perlu Diperbaiki**:
- [ ] Buat standard response format:
  ```js
  {
    success: boolean,
    data?: any,
    message?: string,
    error?: { code: string, message: string },
    meta?: { pagination: {...} }
  }
  ```
- [ ] Update semua controller untuk use standard format
- [ ] Buat helper function `sendSuccess()` dan `sendError()`

---

### 18. **Environment Variables Validation**
**Status**: ⚠️ Tidak ada validation
**Masalah**:
- `process.env.JWT_SECRET` wajib tapi tidak ada validation saat startup
- Tidak ada check untuk required env variables

**Yang Perlu Diperbaiki**:
- [ ] Buat `utils/env.js` untuk validate required env variables saat startup
- [ ] Throw error jika required env variables tidak ada
- [ ] Document semua env variables di `.env.example`

---

### 19. **Database Indexes Optimization**
**Status**: ⚠️ Sudah ada tapi perlu review
**Masalah**:
- Beberapa query mungkin tidak optimal
- Perlu review indexes untuk query yang sering dipanggil

**Yang Perlu Diperbaiki**:
- [ ] Review semua indexes di models
- [ ] Tambahkan compound indexes untuk query yang sering digunakan
- [ ] Monitor slow queries dan optimize

---

### 20. **Testing**
**Status**: ❌ Belum ada
**Masalah**:
- Tidak ada unit test
- Tidak ada integration test
- Tidak ada test untuk permission checking

**Yang Perlu Dibuat**:
- [ ] Setup testing framework (Vitest atau Jest)
- [ ] Buat unit test untuk services
- [ ] Buat integration test untuk API endpoints
- [ ] Buat test untuk permission checking
- [ ] Setup CI/CD untuk run tests

---

## 📝 CATATAN PENTING

1. **Role Hierarchy**: Pastikan semua permission check mengikuti hierarchy_level (lower = higher authority)
2. **Permission Format**: 
   - `resource:action:scope` (contoh: `user:read:any`, `user:read:own_division`, `user:read:self`)
   - Scope: `any` = semua, `own_division` = divisi sendiri, `self` = data diri sendiri
3. **Approval Workflow**: Multi-level approval dengan sequential processing (level 1 → 2 → 3)
4. **Employee History**: Immutable record, tidak bisa diupdate atau delete
5. **Audit Log**: Harus log semua critical actions (create, update, delete, approve, reject)

---

## 🎯 REKOMENDASI PRIORITAS PENGERJAAN

1. **Week 1**: TODO #1 (Salary Management), TODO #2 (Audit Logging), TODO #3 (Account Request Auto-Create)
2. **Week 2**: TODO #4 (Role Management), TODO #5 (Permission Fixes), TODO #6 (Salary Change Request)
3. **Week 3**: TODO #7 (Export), TODO #8 (Dashboard/Report), TODO #9 (Email Integration)
4. **Week 4**: TODO #10-15 (Nice to Have), TODO #16-19 (Technical Improvements), TODO #20 (Testing)

---

**Last Updated**: 2025-01-XX
**Status**: Ready for Implementation

