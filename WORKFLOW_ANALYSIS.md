# Analisis Alur Kerja Account Request & Approval Workflow

## Overview
Dokumen ini menjelaskan alur kerja lengkap untuk berbagai jenis request dan sistem approval yang digunakan dalam aplikasi.

## Request Types

### 1. Account Request (Hire Akun Baru)
**Workflow Steps:**
1. **Level 1**: Manager HR → Review dan validasi data
2. **Level 2**: Director → Final approval

**Alur:**
- User membuat account request dengan data: nama, email, phone, role, division
- Sistem generate approval steps sesuai workflow
- Setiap approver mendapat notifikasi
- Setelah semua approved → generate setup token
- User menerima email dengan link setup
- User menyelesaikan setup akun (password, profile, dll)
- Akun aktif dan user bisa login

### 2. Promotion (Promosi)
**Workflow Steps:**
1. **Level 1**: Manager (Direct Manager) → Review performa
2. **Level 2**: Manager HR → Validasi HR
3. **Level 3**: Director → Final approval

**Alur:**
- Request dibuat untuk user yang sudah ada (user_id)
- Setelah semua approved → update role user
- Create employee history dengan event "promotion"
- Notifikasi ke user yang dipromosi

### 3. Termination (Terminasi)
**Workflow Steps:**
1. **Level 1**: Manager (Division Manager) → Review alasan
2. **Level 2**: Manager HR → Final approval

**Alur:**
- Request dibuat untuk user yang akan di-terminate
- Setelah semua approved → update status user menjadi "terminated"
- Set termination_date
- Create employee history dengan event "terminated"
- Notifikasi ke user yang di-terminate

### 4. Transfer (Transfer Divisi)
**Workflow Steps:**
1. **Level 1**: Manager (Current Division Manager) → Release approval
2. **Level 2**: Manager (Target Division Manager) → Accept approval
3. **Level 3**: Manager HR → Final approval

**Alur:**
- Request dibuat dengan target division_id baru
- Step 1: Manager divisi lama harus approve release
- Step 2: Manager divisi target harus approve accept
- Step 3: HR final approval
- Setelah semua approved → update division_id user
- Create employee history dengan event "transfer"
- Notifikasi ke user yang di-transfer

### 5. Salary Change (Perubahan Gaji)
**Status:** Workflow belum sepenuhnya diimplementasikan di backend, tapi model mendukung
**Expected Workflow:**
1. **Level 1**: Manager (Division Manager)
2. **Level 2**: Manager HR
3. **Level 3**: Director

### 6. Status Change (Perubahan Status)
**Status:** Workflow belum sepenuhnya diimplementasikan
**Note:** Bisa digunakan untuk mengubah status user (active, inactive, dll)

### 7. Role Change (Perubahan Role)
**Status:** Workflow belum sepenuhnya diimplementasikan
**Note:** Mirip dengan promotion tapi bisa untuk naik atau turun level

### 8. Demotion (Penurunan Jabatan)
**Status:** Workflow belum sepenuhnya diimplementasikan
**Note:** Kebalikan dari promotion, untuk menurunkan level/jabatan

## Approval Flow Logic

### Sequential Approval
- Approval dilakukan secara berurutan (sequential)
- Level 1 harus approved dulu sebelum level 2 bisa di-approve
- Jika salah satu level di-reject, semua level berikutnya otomatis di-reject
- Request status otomatis menjadi "rejected" jika ada rejection

### Approval Status
- **Pending**: Menunggu approval
- **Approved**: Sudah di-approve
- **Rejected**: Ditolak (auto-reject semua level berikutnya)

### Finalization
- Setelah semua level approved → request status menjadi "approved"
- Sistem execute action sesuai request_type:
  - Account Request → Generate setup token
  - Promotion → Update user role
  - Termination → Update user status
  - Transfer → Update user division

## Analytics Features

### 1. Overview
- Total requests
- Breakdown by status (pending, approved, rejected)
- Breakdown by request type
- Recent requests list

### 2. Workflow Details
- Detail setiap request dengan workflow steps
- Progress percentage per request
- Current step information
- Approver information per step
- Filter by type, status, division, search

### 3. Statistics
- Approval rate
- Rejection rate
- Average approval time
- Statistics by request type
- Date range filtering

### 4. Timeline
- Complete timeline per request
- All events (request created, approvals, rejections, finalization)
- Actor information
- Timestamps
- Comments

## Permission-Based Access

### user:read:any
- Bisa melihat semua requests
- Full access ke analytics

### user:read:own_division
- Hanya bisa melihat requests di divisinya
- Analytics terbatas ke divisinya

### user:read:self
- Hanya bisa melihat requests yang dibuatnya sendiri
- Analytics terbatas ke requests sendiri

## Database Models

### AccountRequest
- `requester_name`: Nama requester
- `email`: Email requester
- `phone`: Phone requester
- `requested_role`: Role yang diminta
- `division_id`: Divisi yang diminta
- `request_type`: Jenis request
- `user_id`: User yang terpengaruh (untuk promotion/termination/transfer)
- `status`: pending/approved/rejected
- `requested_by`: User yang membuat request
- `approved_by`: User yang final approve
- `setup_token`: Token untuk account setup (account_request only)
- `setup_token_expires_at`: Expiry token

### Approval
- `request_type`: Jenis request
- `request_id`: ID AccountRequest
- `user_id`: User yang terpengaruh
- `approver_id`: User yang harus approve
- `status`: pending/approved/rejected
- `approval_level`: Level approval (1, 2, 3, ...)
- `comments`: Komentar dari approver
- `processed_at`: Waktu diproses

## API Endpoints

### Analytics
- `GET /api/v1/analytics/workflow-overview` - Overview statistics
- `GET /api/v1/analytics/workflow-details` - Detailed workflow list
- `GET /api/v1/analytics/workflow-timeline/:id` - Timeline untuk request tertentu
- `GET /api/v1/analytics/workflow-statistics` - Aggregated statistics

## Frontend Features

### Workflow Analytics Page
1. **Overview Tab**
   - Summary cards (total, pending, approved, rejected)
   - Request breakdown by type
   - Recent requests list

2. **Details Tab**
   - List semua requests dengan workflow progress
   - Filter by type, status, search
   - Progress bar per request
   - Current step indicator
   - View timeline button

3. **Statistics Tab**
   - Approval/rejection rates
   - Average approval time
   - Statistics by request type
   - Date range filtering

4. **Timeline Modal**
   - Complete event timeline
   - Actor information
   - Comments
   - Timestamps

## Future Enhancements

1. **Salary Change Workflow**
   - Implement full workflow untuk salary_change
   - Integration dengan salary management

2. **Status Change Workflow**
   - Workflow untuk mengubah status user
   - Support multiple status types

3. **Role Change Workflow**
   - Workflow untuk perubahan role (bukan promotion)
   - Support untuk role change tanpa hierarchy change

4. **Demotion Workflow**
   - Separate workflow untuk demotion
   - Different approval chain dari promotion

5. **Advanced Analytics**
   - Charts dan graphs
   - Export to PDF/Excel
   - Custom date ranges
   - Department/division comparisons

