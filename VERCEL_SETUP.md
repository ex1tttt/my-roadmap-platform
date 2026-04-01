# 🚀 Vercel Deployment Guide

## Error: 403 at `/api/auth/login` on Vercel

**Problem:** Login/Register fails with error 403 on https://my-roadmap-platform.vercel.app

**Cause:** `RECAPTCHA_SECRET_KEY` environment variable is not set on Vercel

---

## Solution: Add Environment Variables

### Step 1: Go to Vercel Dashboard
1. Open https://vercel.com/dashboard
2. Select project **my-roadmap-platform**
3. Click **Settings** (top left)
4. Click **Environment Variables** (left menu)

### Step 2: Add Required Environment Variables

Add these 4 variables:

```
RECAPTCHA_SECRET_KEY = 6Lc3C5YsAAAAAHpmupRdN8U5lgIqTsE3Hx75pWDa
```
- Scope: ✓ Production, ✓ Preview, ✓ Development

```  
NEXT_PUBLIC_RECAPTCHA_SITE_KEY = 6Lc3C5YsAAAAAB83b41EHk-XQ0o9ulM8TBHqIdjz
```
- Scope: ✓ Production, ✓ Preview, ✓ Development

```
NEXT_PUBLIC_SUPABASE_URL = https://gnszmgjxmwoosxnxiyoh.supabase.co
```
- Scope: ✓ Production, ✓ Preview

```
NEXT_PUBLIC_SUPABASE_ANON_KEY = [get from Supabase Dashboard]
```
- Scope: ✓ Production, ✓ Preview

### Step 3: Redeploy

**Option 1: Quick Redeploy**
- Settings → Deployments → Latest → ... → Redeploy

**Option 2: Git Push**
```bash
git commit --allow-empty -m "trigger vercel"
git push origin main
```

### Step 4: Test
1. Wait 2-5 minutes
2. Open https://my-roadmap-platform.vercel.app/login
3. Try login/register
4. ✅ Should work!

---

## Troubleshooting

### Still getting 403?
1. Check variables don't have extra spaces
2. Confirm Scopes are set correctly (Production + Preview)
3. Wait for redeploy to complete (Status: Ready)
4. Clear browser cache (Ctrl+Shift+Delete)
5. Check Vercel Logs: Deployments → Latest → Logs

Looking for: `[reCAPTCHA] Verifying token...`

If you see: `RECAPTCHA_SECRET_KEY не установлен` → variable not set yet

---

💡 For detailed Russian instructions: see `VERCEL_SETUP_RU.md`
