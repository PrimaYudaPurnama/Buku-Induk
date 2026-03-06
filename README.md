# BUKU INDUK

Aplikasi manajemen data induk siswa dengan arsitektur decoupled (frontend + backend).

## Arsitektur

- **Frontend**: React + Vite → di-deploy ke **Cloudflare Pages**
- **Backend**: Node.js → di-deploy ke **Railway**

---

## Deployment

### Railway (Backend)

1. Push code ke repository GitHub
2. Hubungkan repository ke Railway dashboard
3. Tambahkan environment variables di Railway Settings → Variables
4. Railway akan otomatis build dan deploy saat ada push ke branch utama

### Cloudflare Pages (Frontend)

1. GitHub Actions workflow sudah dikonfigurasi di `.github/workflows/deploy.yml`
2. Workflow otomatis trigger saat push ke `main`
3. Setup Secrets di Repository Settings:
   - `VITE_API_URL` - URL backend Railway
   - `VITE_API_BASE_URL` - Base URL API
   - `CLOUDFLARE_API_TOKEN` - API token dari Cloudflare dashboard
   - `CLOUDFLARE_ACCOUNT_ID` - Account ID dari Cloudflare dashboard

---

## Environment Variables

Copy `.env.example` ke `.env` dan isi:

```
VITE_API_URL=https://your-railway-app.up.railway.app
VITE_API_BASE_URL=/api/v1
```
