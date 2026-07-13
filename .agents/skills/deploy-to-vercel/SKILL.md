---
name: deploy-to-vercel
description: >
  Deploy the boutiqaat-gen-app project to Vercel. Use this skill when the user
  asks to deploy, push to Vercel, update the live site, or when local changes
  need to be published to production at boutiqaat-gen-app.vercel.app.
  Also handles env variable sync and redeploy triggers.
---

# Deploy boutiqaat-gen-app to Vercel

## Overview

This project deploys automatically to Vercel via **GitHub Git Integration** on the `main` branch.
Every `git push` to `main` triggers a new Vercel build.

- **Live URL:** https://boutiqaat-gen-app.vercel.app
- **Vercel Project:** https://vercel.com/maxlumagas-projects/boutiqaat-gen-app
- **GitHub Repo:** https://github.com/bagzmax7/boutiqaat-gen-app
- **Branch:** `main`

---

## ⚠️ CRITICAL: Git Author Must Match Vercel Account Email

**The commit author email MUST be `bagzmax21@gmail.com` (the Vercel account email).**
If commits use a different email (e.g. `dev@boutiqaat.com`), Vercel will `BLOCK` the deployment with error `COMMIT_AUTHOR_REQUIRED`.

Before making any commits, ensure git is configured correctly:

```powershell
git config user.email "bagzmax21@gmail.com"
git config user.name "bagzmax7"

# Verify:
git config user.email   # Must output: bagzmax21@gmail.com
```

If you already committed with the wrong email, fix it:
```powershell
git commit --amend --reset-author --no-edit
git push --force-with-lease origin main
```

---

## Standard Deploy Workflow

Run these commands in order from the project root `c:\Jenna\Antigravity\Runninghub Api\boutiqaat-gen-app`:

```powershell
# 1. Check what changed
git status

# 2. Stage all changes (ignore .env, node_modules, appDataDir — already in .gitignore)
git add .

# 3. Commit with a descriptive message
git commit -m "feat: <describe what changed>"

# 4. Push to GitHub — Vercel auto-deploys on push to main
git push
```

After `git push`, Vercel automatically starts building. Monitor at:
https://vercel.com/maxlumagas-projects/boutiqaat-gen-app/deployments

---

## Important: .gitignore Rules

These files are intentionally NEVER committed:
- `.env` / `.env.local` (contain secrets)
- `appDataDir/` (agent conversation artifacts)
- `node_modules/` 
- `.next/`

---

## Environment Variables in Vercel

The app requires these environment variables configured in Vercel Dashboard.
**These are NOT in Git** — they must be set manually in Vercel Settings → Environment Variables.

Go to: https://vercel.com/maxlumagas-projects/boutiqaat-gen-app/settings/environment-variables

| Variable | Description |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase project URL |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase service role key (secret) |
| `RUNNINGHUB_API_KEY_ENTERPRISE` | RunningHub enterprise API key |
| `RUNNINGHUB_API_KEY_CONSUMER` | RunningHub consumer API key |
| `RUNNINGHUB_BASE_URL` | `https://www.runninghub.cn` |
| `AUTH_USERNAME` | Login username for the app |
| `AUTH_PASSWORD` | Login password for the app |
| `AUTH_SECRET` | JWT signing secret |
| `NEXT_PUBLIC_APP_NAME` | `Boutiqaat Gen-App` |
| `PINNED_APP_ID` | Pinned RunningHub app ID |
| `HF_TOKEN` | Hugging Face token (Vision analysis) |
| `GEMINI_API_KEY` | Google Gemini API key |
| `GEMINI_IMAGE_MODEL` | `gemini-3.1-flash-image-preview` |

> **If you add a new env variable locally to `.env.local`, you MUST also add it to Vercel manually.**

---

## Force Redeploy Without Code Changes

If you need to redeploy without making code changes:

```powershell
# Create an empty commit to trigger Vercel build
git commit --allow-empty -m "chore: trigger redeploy"
git push
```

Or use the Vercel Dashboard → Deployments → "..." menu → "Redeploy".

---

## Verify Build Locally Before Pushing

Always verify the production build works before pushing:

```powershell
npm run build
```

If this succeeds with no errors (warnings about bcryptjs Edge Runtime are OK), the Vercel build will also succeed.

---

## Troubleshooting

### Updates not showing on live site
1. Check deployment status at https://vercel.com/maxlumagas-projects/boutiqaat-gen-app/deployments
2. If status is **Error** → check build logs for missing env variables
3. If status is **Ready** → hard refresh browser (`Ctrl+Shift+R`) or clear cache
4. If status is still old → push an empty commit to re-trigger

### Deployment status is "BLOCKED" (seatBlock: COMMIT_AUTHOR_REQUIRED)
**Root cause:** The commit author email does not match the Vercel account email.

Fix:
```powershell
git config user.email "bagzmax21@gmail.com"
git config user.name "bagzmax7"
git commit --amend --reset-author --no-edit
git push --force-with-lease origin main
```

### Build fails on Vercel but works locally
Most likely cause: **Missing environment variables in Vercel**.
All 13 env vars are already configured in Vercel. If you add new ones locally to `.env.local`, you must also add them at:
https://vercel.com/maxlumagas-projects/boutiqaat-gen-app/settings/environment-variables

### Supabase schema changes
If you add new database tables or columns:
1. Apply the SQL manually in Supabase Dashboard → SQL Editor
2. Update `supabase/schema.sql` with the changes
3. Commit and push normally

---

## Supabase Direct Access

- **Dashboard:** https://supabase.com/dashboard/project/aszmkbbwliopbybawqco
- **SQL Editor:** https://supabase.com/dashboard/project/aszmkbbwliopbybawqco/sql/new
- **Tables:** https://supabase.com/dashboard/project/aszmkbbwliopbybawqco/editor

To apply schema changes manually, paste the SQL from `supabase/schema.sql` into the SQL Editor.
