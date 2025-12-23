# Database Seeders

## Role Seeder

Seeder untuk mengisi database dengan semua role dan permission yang diperlukan.

### Cara Menjalankan

```bash
# Dari root backend directory
bun run seed:roles

# Atau langsung
bun run src/seeders/roleSeeder.js
```

### Yang Akan Dilakukan

Seeder akan:
1. Menghubungkan ke database MongoDB
2. Mengecek setiap role apakah sudah ada
3. Jika sudah ada, akan di-update dengan data terbaru
4. Jika belum ada, akan dibuat role baru
5. Menampilkan summary hasil seeding

### Role yang Akan Di-seed

1. **Superadmin** (hierarchy_level: 1)
   - Full access ke semua fitur

2. **Admin** (hierarchy_level: 2)
   - Full access kecuali delete user & manage roles

3. **Director** (hierarchy_level: 3)
   - Top management - full view & HR actions

4. **Investor** (hierarchy_level: 3)
   - Read-only investor access

5. **Manager HR** (hierarchy_level: 4)
   - HR Manager dengan akses approve

6. **General Manager** (hierarchy_level: 4)
   - General Manager dengan akses approve

7. **Finance** (hierarchy_level: 4)
   - Finance Manager dengan akses export

8. **Manager** (hierarchy_level: 5)
   - Division Manager - hanya divisi sendiri

9. **Team Lead** (hierarchy_level: 6)
   - Team Leader - hanya data diri sendiri

10. **Staff** (hierarchy_level: 7)
    - Regular employee - hanya data diri sendiri

### Catatan

- Pastikan environment variable `MONGO_URI` sudah di-set
- Seeder akan update role yang sudah ada jika nama sama
- Permission dan hierarchy_level akan selalu di-update ke versi terbaru

