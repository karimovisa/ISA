# ISLOM OS — Setup

A premium personal dashboard (Next.js 16 · TypeScript · Tailwind v4 · Framer Motion · Supabase).

## 1. Create a Supabase project

1. Go to [supabase.com](https://supabase.com) → **New project** (free tier is fine).
2. Wait for it to finish provisioning.

## 2. Create the database

1. In your project, open **SQL Editor → New query**.
2. Paste the entire contents of [`supabase/schema.sql`](supabase/schema.sql) and **Run**.
   This creates the tables and Row Level Security (each user sees only their own data).

## 3. Connect the app

1. In Supabase: **Settings → API**. Copy the **Project URL** and the **anon public** key.
2. Open `.env.local` in this folder and fill them in:

   ```
   NEXT_PUBLIC_SUPABASE_URL=https://xxxx.supabase.co
   NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGci...
   ```

## 4. Run

```bash
npm run dev
```

Open http://localhost:3000.

## 5. Create your account

- On the login screen, choose **Create one**, enter an email + password.
- By default Supabase sends a confirmation email. To skip it (single-user app),
  go to **Authentication → Sign In / Providers → Email** and turn **Confirm email** off.
- Sign in. Your dashboard is seeded with the starter goals, projects, and ideas
  the first time — edit or delete them freely.

## Notes

- **Dark mode only**, mobile-first, glassmorphism throughout.
- All data is editable in-app (goals, projects, ideas, journal, focus sessions, runs).
- Charts on the **Progress** page are driven by your real focus sessions and run logs.
- Deploy on **Vercel**: import the repo, add the two `NEXT_PUBLIC_*` env vars, deploy.
