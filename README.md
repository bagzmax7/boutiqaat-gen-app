# Boutiqaat Gen-App

Dashboard AI Generation internal untuk tim Boutiqaat, ditenagai oleh RunningHub API.

## Features

- 🚀 **AI App Launcher** — Jalankan AI App apapun dari RunningHub
- 📊 **Real-time Task Monitor** — Polling otomatis setiap 3 detik
- 🖼️ **Output Viewer** — Preview & download hasil gambar/video
- 🔐 **Secure Auth** — Login berbasis JWT, API key tidak pernah ke browser
- 📱 **Responsive** — Bekerja di desktop dan tablet

## Local Development

### 1. Install dependencies

```bash
npm install
```

### 2. Setup environment variables

```bash
cp .env.example .env.local
```

Edit `.env.local` dan isi dengan nilai yang benar:
- `RUNNINGHUB_API_KEY` — Enterprise Shared API key dari RunningHub
- `AUTH_USERNAME` / `AUTH_PASSWORD` — Kredensial login tim
- `AUTH_SECRET` — Random string untuk signing JWT (buat yang panjang dan acak)
- `PINNED_APP_ID` — App ID ComfyUI workflow yang di-pin

### 3. Run development server

```bash
npm run dev
```

Buka [http://localhost:3000](http://localhost:3000) di browser.

**Login:** `editor` / `toTheMax`

---

## Deploy ke Vercel

### Step 1: Push ke GitHub

```bash
git init
git add .
git commit -m "feat: initial Boutiqaat Gen-App"
git remote add origin https://github.com/YOUR_ORG/boutiqaat-gen-app.git
git push -u origin main
```

> ⚠️ **PENTING**: Pastikan `.env.local` ada di `.gitignore` dan TIDAK ikut ter-push!

### Step 2: Import ke Vercel

1. Buka [vercel.com](https://vercel.com) → New Project
2. Import repo `boutiqaat-gen-app` dari GitHub
3. Framework: **Next.js** (auto-detected)
4. **Tambahkan Environment Variables** di Vercel dashboard:

| Variable | Description / Value |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | URL proyek Supabase Anda |
| `SUPABASE_SERVICE_ROLE_KEY` | Service role key Supabase (server-side only) |
| `RUNNINGHUB_API_KEY_ENTERPRISE` | Enterprise API key RunningHub |
| `RUNNINGHUB_API_KEY_CONSUMER` | Consumer API key RunningHub |
| `RUNNINGHUB_FORCE_KEY_TYPE` | (Optional) Paksa tipe key: `enterprise` atau `consumer` |
| `RUNNINGHUB_BASE_URL` | (Optional) `https://www.runninghub.ai` atau `https://www.runninghub.cn` |
| `RUNNINGHUB_UPLOAD_URL` | (Optional) `https://www.runninghub.cn` |
| `AUTH_USERNAME` | Username login tim (contoh: `editor`) |
| `AUTH_PASSWORD` | Password login tim |
| `AUTH_SECRET` | String acak panjang untuk menandatangani token JWT |
| `NEXT_PUBLIC_APP_NAME` | Nama aplikasi (contoh: `Boutiqaat Gen-App`) |
| `PINNED_APP_ID` | App ID workflow ComfyUI utama yang di-pin |
| `GEMINI_API_KEY` | API key Google Gemini untuk pembuatan dan analisis gambar |

5. Klik **Deploy** → Selesai!

### Step 3: Share URL ke tim

URL format: `https://boutiqaat-gen-app.vercel.app`

---

## Project Structure

```
boutiqaat-gen-app/
├── app/
│   ├── api/          # Server-side API routes (proxy)
│   ├── login/        # Login page
│   ├── apps/         # AI Apps catalog & launcher
│   ├── tasks/        # Task monitor
│   └── page.tsx      # Dashboard
├── components/
│   ├── layout/       # Sidebar, TopBar
│   ├── dashboard/    # Stats, ActiveTasks, RecentOutputs
│   ├── apps/         # AppLauncher, AppCard
│   └── tasks/        # TaskCard
├── hooks/
│   └── useTasks.ts   # Task state + polling hook
├── lib/
│   ├── auth.ts       # JWT auth utility
│   ├── runninghub.ts # RunningHub API client (server-only)
│   ├── types.ts      # TypeScript types
│   └── utils.ts      # Helper functions
└── middleware.ts      # Route protection
```

## Security Notes

- API key hanya ada di server (environment variable) — tidak pernah ke browser
- Session menggunakan httpOnly cookie (tidak bisa diakses JavaScript)
- Semua request ke RunningHub diproxikan melalui `/api/runninghub/*`
