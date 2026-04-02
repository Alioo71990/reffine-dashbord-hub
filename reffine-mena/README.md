# Reffine MENA Hub — React App

Internal dashboard for the Reffine JLR MENA team. Built with React + TypeScript + Vite + Tailwind CSS.

## 🔐 Authentication

Sign-in is **restricted to company email domains**:
- `@reffine.com`
- `@jaguarlandrover.com`

The login page shows a Google OAuth-style flow. In development it simulates sign-in by validating the email domain. For **production Google OAuth**, connect Supabase (see below).

## 🚀 Quick Start

```bash
npm install
npm run dev        # dev server at http://localhost:5173
npm run build      # production build → dist/
```

## 📦 Deploy to Netlify

1. Run `npm run build`
2. Drag the `dist/` folder to [app.netlify.com](https://app.netlify.com)
3. Or connect your GitHub repo — builds automatically on push

The included `netlify.toml` handles SPA routing.

## 🔧 Configuration

All config is managed in the **Admin panel** (`/admin`) and stored in `localStorage`:

| Setting | Key | Description |
|---------|-----|-------------|
| Supabase URL | `rf_admin_config.sbUrl` | For Week Planner database |
| Supabase Anon Key | `rf_admin_config.sbKey` | Supabase public key |
| Groq API Key | `rf_admin_config.groqKey` | For Translation Hub (free at console.groq.com) |
| Tasks CSV URL | `rf_tasks_csv_url` | Google Sheets CSV for Content Tasks |

## 🔑 Production Google OAuth (Supabase)

To enable real Google OAuth (instead of the simulated flow):

1. Create a project at [supabase.com](https://supabase.com)
2. Enable Google provider in Authentication → Providers
3. Set Authorized domains: `reffine.com`, `jaguarlandrover.com`
4. Update `src/pages/LoginPage.tsx` to use:
   ```ts
   import { getSupabase } from '../lib/supabase'
   const supabase = getSupabase(config.sbUrl, config.sbKey)
   await supabase.auth.signInWithOAuth({ provider: 'google' })
   ```
5. Add a callback handler in `App.tsx` using `supabase.auth.onAuthStateChange()`

## 📁 Pages

| Route | Description |
|-------|-------------|
| `/` | Dashboard — site links grid + Content Tasks |
| `/translate` | AI Translation Hub (Groq API) |
| `/translate-tool` | Excel phrase/specs sheet translator |
| `/seo` | SEO report analyser |
| `/offers` | Offer Studio — DOCX → CSV |
| `/retailers` | Retailer Locator editor |
| `/admin` | Admin panel — API keys & config |
| `/login` | Google sign-in (domain-restricted) |

## 🛠 Tech Stack

- **React 18** + TypeScript
- **Vite** (build tool)
- **React Router v6** (routing)
- **Zustand** (state management)
- **Tailwind CSS** (utility classes)
- **SheetJS** (Excel parsing)
- **PapaParse** (CSV parsing)
- **JSZip** (DOCX parsing)
- **Groq API** (AI translation)
- **Supabase** (database + auth)
