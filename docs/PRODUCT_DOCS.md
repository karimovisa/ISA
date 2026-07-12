# ISA — Product Documentation

> ISA ("Run. Process. Aim.") — a personal life operating system.
> Stack: Next.js 16 (App Router, Turbopack) · React 19 · TypeScript · Tailwind v4 · Supabase (Postgres + Auth + RLS) · Vercel · Web Push.
> Live: https://islom-os.vercel.app · Repo: `karimovisa/ISA`

---

## Overview

### Purpose
ISA is a single, calm home for everything that moves one person forward: goals, projects, ideas, a daily journal, habits, deep-work focus sessions, running/health, prayer tracking, and personal finance. Instead of ten separate apps, ISA unifies them under one design language and one account, framed around a mountain-ascent metaphor — *you climb a little every day*.

### Target users
- Primarily a **single power user** (the creator) — a self-tracking individual who wants goals, money, habits, faith and reflection in one place.
- Secondarily, **friends/small circle** who sign up with their own account. Every table is row-level-security scoped, so multi-user works by design, but the product is currently tuned for one committed daily user.

### Core philosophy
- **One OS, not a toolbox.** Every module shares the same navigation, command palette, theming, i18n and notification system.
- **Ascent, not gamification.** Progress is shown as altitude/mountains, not points and badges.
- **Quiet and premium.** Glassmorphism, restrained motion, no clutter, AA-minded contrast, reduced-motion support.
- **Own your data.** Full JSON export/restore; all rows are the user's, scoped by RLS.
- **Honest "intelligence."** "AI" here is deterministic math over the user's own data (see [AI Module](#ai-module)), not a live LLM.

---

## Navigation

Navigation is provided by a **desktop left rail** (all pages) and a **mobile bottom bar** (6 user-orderable primary items + a **Menu** button that opens the command palette for everything else). A global **⌘K command palette** reaches every page and can quick-add items. A persistent **EN/UZ** language toggle and a **`?` Help** button sit top-right; a **theme day/night** toggle sits bottom (Girls theme only).

| Route | Page | One-line purpose |
|---|---|---|
| `/` | **Dashboard** | Your day at a glance — momentum, sleep, to-dos, quote. |
| `/goals` | **Goals** | Long-term goals as mountains, tracked in percent. |
| `/money` | **Money** | Personal finance: balance, transactions, savings goals, insights. |
| `/projects` | **Projects** | Active projects with task checklists and progress. |
| `/ideas` | **Ideas** (Notes) | Quick idea/notes capture in a sticky-note wall. |
| `/progress` | **Progress** | Charts + running (Strava/manual) + weekly reviews. |
| `/journal` | **Journal** | Free-write daily entry + mood. |
| `/focus` | **Focus** | Deep-work timer that logs sessions. |
| `/habits` | **Habits** | Daily habit check-ins and streaks. |
| `/calendar` | **Calendar** | Month grid colored by daily mood. |
| `/pray` | **Prayer** | Five daily prayers — track and get reminders. |
| `/settings` | **Settings** | Theme, language, notifications, reminders, data. |
| `/login` | **Login** | Sign in / sign up (outside the app shell). |

---

## Features (by page)

### Dashboard (`/`)
- **Greeting** — time-of-day greeting ("Good morning/afternoon/evening/night") + the user's first name (from signup metadata).
- **Live clock** — isolated component; real-time HH:MM:SS.
- **Momentum row** — three tiles: *Journaling streak* (consecutive journaled days), *Focus this week* (minutes), *Next deadline* (days until the nearest goal deadline, with its title). Numbers count up (`AnimatedNumber`).
- **Sleep card** — *Sleep* / *Wake* session buttons (live elapsed timer), or a "log hours" modal (hours + optional 1–5 quality). Shows 7-day average sleep and an **Energy Score** (crescent-moon turns warm when the score is low). Forgotten open sessions auto-close at a 16h cap.
- **Quote of the day** — deterministic daily motivational quote.
- **Quick idea capture** — one-line input; saves straight to Ideas with a "Saved ✓" flash.
- **Today's to-do** — the Tasks list (see [Tasks Module](#tasks-module)): add, check, delete; done items sink with a completion progress bar.
- **Four nav cards** — Goals / Projects / Ideas / Progress with live counts and a sub-stat; tap to navigate.
- **The Ascent** — overall progress across goals rendered as a climber ascending a mountain slope.
- **Weekly Review modal** — auto-shows the newest unseen weekly review, marks it seen.
- **First-run onboarding card / welcome modal** — see [Onboarding](#onboarding).

### Goals (`/goals`)
- Goal cards, each with an **AscentProgress** mini-mountain, current **percentage**, a **deadline chip** with urgency tone (red = overdue, amber = ≤30 days, muted otherwise) and days-left text.
- **±5% steppers** appear on hover to nudge progress quickly.
- **New goal** (AddButton) → modal: title, percentage, deadline (optional), motivation (optional).
- **Edit** (pencil) and **Delete** (trash, with confirm).
- **EmptyState** when there are no goals.

### Money (`/money`)
See [Money Module](#money-module) for the full breakdown. In short: hero balance card, income/expense/saving-rate stats, financial health score, rule-based insights, category breakdown, savings goals with ETA, recurring payments, one-tap quick-add presets, and a full transaction list.

### Projects (`/projects`)
- Project cards showing **status** (planning / active / paused / done), **percentage**, and task counts.
- **ProjectTasks** — a hybrid checklist: collapsed shows the "next step" + a quick check + N/M count; expanded shows a Linear-style checklist (circular checkboxes, strikethrough, inline "add a step", remove on hover). Project percentage auto-syncs from completed/total tasks.
- **New project** modal: title, status, percentage. **Edit** / **Delete** (confirm).
- **EmptyState** when empty.

### Ideas / Notes (`/ideas`)
- **Sticky-note masonry** wall of captured ideas.
- **New idea** modal (content + optional tag), delete on hover.
- Ideas can also be captured from the Dashboard quick-capture and from ⌘K.
- **EmptyState** ("Your vault is empty").

### Progress (`/progress`)
- **Running section** — unified Strava + manual runs on one timeline: *Connect Strava* / *Sync Strava* (subscriber-only Strava API), plus a permanent **manual "Log run"** fallback (date / km / min:sec). Insights: this-week km, vs-last-week trend, average pace, longest run; a 7-day area chart; a recent-runs list (orange dot = Strava, gray = manual, manual deletable).
- **Summary tiles** — Focus (7d) hours, focus sessions count, projects count.
- **Charts** (Recharts) — Focus hours (bar), Weekly productivity (area), Project progress (horizontal bar). Chart colors are theme-aware.
- **Weekly Review history** — list of past reviews + a "Generate this week" button.

### Journal (`/journal`)
- **"Today"** — a large free-write field for the day's events and thoughts (the primary field).
- **Optional reflection** — "What did I learn?" and "What will I do tomorrow?" (clearly optional, below).
- **MoodPicker** — five color dots (end-of-day mood), saved immediately.
- **Save entry** — upserts today's entry; error/success toasts.
- **Saved entries** — list of all entries (today labeled "Today", past dated); delete per entry.

### Focus (`/focus`)
- **Ring timer** with presets (25 / 50 / 90 min) and an editable session label.
- **Play / Pause / Reset / Save** — pausing reveals a "Save Nm" button; Reset discards.
- **Robust completion** — the countdown recomputes from an absolute wall-clock end time and resyncs on visibility/focus, so it still completes if the screen locks or the tab is backgrounded; requests a Screen Wake Lock while running; guards against double-logging.
- **Persistence** — a running/paused timer survives navigation and browser close (localStorage); a session that finishes while the app is closed is logged on reopen, and the server pushes a "Focus complete" notification.
- **"Focused today"** total + **Recent sessions** list.

### Habits (`/habits`)
- **Daily check-in** — a 7-day dot grid where **only today** is tappable; past unmarked days render as **missed** (red); a done day is filled. Marking today asks for confirmation and then **locks** for the day.
- **Streak** text + a **lifetime "done" count** badge (total days ever completed, via an RPC).
- **Per-habit reminder** — a toggle inside the add/edit modal with time + weekday chips; stays quiet on days already checked off.
- **Add / Edit / Archive-Delete** (confirm; logs and reminders cascade).
- The **Today's to-do** list is also embedded here.

### Calendar (`/calendar`)
- **Month grid** with each day colored by that day's logged mood.
- Tapping a day opens a modal to view that day's journal entry.

### Prayer (`/pray`)
See [Notifications](#notifications) for the reminder side. On the page:
- **Onboarding** (once): "Do you pray?" → optional "Get prayer reminders?".
- **Locked state** until activated; **Activate** button.
- **Five-prayer checklist** — only the **current window's** prayer is tappable; past prayers show ✅ with status (on time / late) or 🔴 **missed**; future prayers are grayed.
- **Masjid offset** — a per-prayer minute offset (e.g. Peshin +25) applied to displayed time, status window, and reminders, since the local jamoat azon differs from the fiqh-earliest time.
- **Next-prayer countdown** card ("Next · Asr — 2h 14m").
- **Statistics** — weekly / monthly on-time / late / missed counts.

### Settings (`/settings`)
See [Settings](#settings-1).

---

## User Flow

**1. Sign up / sign in.** Email + password. On signup the first name is captured; if email confirmation is on, the user confirms then signs in.

**2. First launch.** A blurred **Welcome to ISA** modal appears (**Start tour** / **Skip for now**). Starting the tour runs a spotlight walkthrough of the navigation. A **prayer onboarding** modal may also appear ("Do you pray?").

**3. Fill the frame.** The user sets a first goal, logs an expense (one-tap quick-add), captures an idea, adds a habit, writes a journal line, runs a focus timer. Empty states everywhere explain each page and give one clear action.

**4. Daily loop.** Open the Dashboard → check momentum, log sleep/wake, tick to-dos and habits, capture an idea, write the journal, tick prayers. Notifications nudge journaling, habits, prayers, custom reminders and recurring payments.

**5. Becoming advanced.** The user connects Strava, funds savings goals, builds streaks, watches the weekly review, tunes the bottom-nav order, switches theme (day/night) and language (EN/UZ), sets custom reminders, and relies on ⌘K for everything. The `?` button re-runs the tour anytime.

---

## Database

All 30 tables live in `public`, **all RLS-enabled** with an owner policy scoping rows to `auth.uid()`. `prayer_times` is shared reference data (readable by any authenticated user, written by the service role). Every user-owned table has a `user_id uuid → auth.users(id)` FK.

### Identity & profile
- **profiles** — `user_id` (PK), `theme_preference`, `nav_order` (jsonb array of hrefs), `onboarded_at`. Per-user app preferences.

### Productivity
- **goals** — `title`, `percentage`, `deadline`, `motivation`.
- **projects** — `title`, `status`, `percentage`, `tasks_total`, `tasks_done`.
- **project_tasks** — `project_id → projects(id)` (cascade), `title`, `done`. One project → many tasks.
- **ideas** — `content`, `tag`.
- **todos** — `title`, `done`, `date`. The Tasks module.
- **journal_entries** — unique `(user_id, entry_date)`; `did_today`, `learned`, `tomorrow`.
- **mood_logs** — unique `(user_id, date)`; `mood_score` (1–5). Drives the calendar colors.

### Focus & health
- **focus_sessions** — `label`, `duration_seconds`.
- **focus_alarms** — PK `user_id`; open timer's `end_at` so the server can push "Focus complete".
- **sleep_logs** — unique `(user_id, date)`; `sleep_start`, `sleep_end`, `duration_hours`, `quality`.
- **daily_energy_scores** — PK `(user_id, date)`; `score`. Computed from sleep + consistency.
- **weekly_reviews** — unique `(user_id, week_start_date)`; aggregate stats + `seen_at`.
- **habits** — `name`, `icon`, `is_active`.
- **habit_logs** — unique `(habit_id, date)`; `completed`. Many logs → one habit.

### Running / Strava
- **runs** — manual runs: `log_date`, `distance_km`, `duration_s`.
- **strava_connections** — PK `user_id`; OAuth tokens + `last_sync`.
- **strava_activities** — PK = Strava activity id; imported runs.
- **strava_oauth_states** — short-lived OAuth nonces.

### Prayer
- **prayer_preferences** — PK `user_id`; `wants_to_pray`, `notifications_enabled`, `activated`.
- **prayer_times** — unique `(city, date)`; the six daily times. Shared reference data.
- **prayer_logs** — unique `(user_id, date, prayer_name)`; `ticked_at`, `status` (`vaqtida`/`kechikkan`/`qazo`).
- **prayer_sent** — PK `(user_id, date, prayer_name)`; dedupes start-of-prayer pushes.
- **prayer_reminders_sent** — dedupes hourly "not yet prayed" nudges per slot.

### Money
- **transactions** — `type` (income/expense), `amount`, `category`, `note`, `date`.
- **finance_goals** — `name`, `target_amount`, `current_amount`, `target_date`, `is_active`.
- **recurring_payments** — `name`, `amount`, `category`, `day_of_month`, `is_active`.

### Notifications
- **push_subscriptions** — Web Push endpoint + keys (many per user, one per device).
- **notification_settings** — PK `user_id`; `push_enabled`.
- **reminders** — `kind` (`custom`/`habit`/`todo`/`recurring`), `habit_id` / `recurring_payment_id` (FKs, cascade), `title`, `body`, `remind_time`, `days` (int[]), `day_of_month`, `enabled`, `last_sent_date`. A recurring payment auto-creates a linked reminder.

---

## Money Module

A full personal-finance system in Uzbek so'm (`formatSom`).

**Capabilities**
- **Hero balance card** — all-time balance with an easeOutCubic **count-up** animation, this month's **net change** (up/down arrow, colored), an inline **health-score badge**, and an accent gradient.
- **Secondary stats** — this month's income, expenses, and saving rate.
- **Financial health score (0–100)** — up to 40 pts saving rate + 30 pts spending control (fewer category spikes vs last month) + 30 pts average goal progress; a label (Excellent / Good / Needs work / At risk), a colored bar, and up to two actionable suggestions.
- **Insights** — rule-based one-liners: week-over-week spend comparison, category spikes/drops vs last month, "reduce your top category by 10% → save X", low-saving-rate nudge, and per-goal ETA lines.
- **Category breakdown** — this month's expenses per category as proportional bars.
- **Savings goals (MoneyGoals)** — target/current/target-date, an ascent progress bar, and a **goalEta** motivation line ("Save X/month to reach this on time" or "…in about N months").
- **Recurring payments (MoneyRecurring)** — name, amount, category, day-of-month, due-date highlighting; each creates a linked reminder that pushes on its due day.
- **Quick Add** — six one-tap presets (Coffee, Food, Fuel, Taxi, Shopping, Education) → a single-field Amount modal that logs an expense in ~2 seconds with the mapped category.
- **Recent transactions** — add / edit / delete (income or expense), with **AI tags** per row ("Above your average", "Recurring expense").

---

## Tasks Module

ISA has no separate "Tasks" page; the task system is the **daily to-do list** (`todos` table), surfaced on the Dashboard and Habits page.
- **Add** a task (defaults to today), **check/uncheck**, **delete**.
- Completed items sink to the bottom with strikethrough and a completion **progress bar** (done/total).
- Tasks are date-scoped (today's list). A **to-do reminder** (bell) can push a daily nudge listing unfinished tasks (see [Notifications](#notifications)).
- Quick-add a task from **⌘K**.

---

## Notes Module

ISA has no separate "Notes" page; **Ideas** (`ideas` table) is the notes system.
- A **sticky-note masonry** wall of captured thoughts, each with optional **tag**.
- Capture from the Ideas page, the Dashboard quick-capture, or **⌘K**.
- Delete on hover. Lightweight and friction-free by design (no folders, no rich text yet).

---

## AI Module

**Important honesty note:** ISA's "AI"/"insights" are **deterministic, rule-based math over the user's own data — not a live LLM call.** They are framed as short assistant-style lines and are fast, private and offline-capable.

Current capabilities:
- **Money insights** (`generateInsights`) — week-over-week spend comparison, per-category spikes/drops, "reduce top category 10%" savings math, low-saving-rate nudge, goal ETAs.
- **Transaction tags** (`transactionTag`) — "Above your average" (≥130% of the category average) and "Recurring expense" (a similar amount seen in another month).
- **Financial health score** (`healthScore`) — the 0–100 model above with per-area suggestions.
- **Energy Score** — Postgres function combining sleep duration + 7-day bedtime consistency.
- **Weekly Review** — a Postgres job aggregates goals completed, journal entries, focus minutes, average energy and most-active day into a once-a-week card.

Wiring a real LLM on top of this data layer is a natural next step (see [Future roadmap](#future-roadmap)).

---

## Dashboard

Covered under [Features → Dashboard](#dashboard-). It is the home surface and the "at a glance" hub: greeting + clock, momentum tiles, sleep/energy, quote, quick idea, to-dos, nav cards, the Ascent, and any weekly-review / onboarding modals.

---

## Settings

- **Language** — the EN/UZ switch lives as an always-visible top-right pill (moved out of Settings by design).
- **Theme** — **Boys** (dark) or **Girls**. Girls is a **real-time day/night pair** (light 06:00–18:59, dark 19:00–05:59) with a manual Auto / Day / Night override (bottom toggle). Preference syncs to `profiles.theme_preference`.
- **Bottom menu order** — reorder the six mobile bottom-bar items with up/down arrows (stored in `profiles.nav_order`, synced across devices).
- **Push notifications** — Enable + Send test; a detailed **iPhone setup guide** appears automatically on iOS Safari (Add to Home Screen → open from the icon → Allow).
- **Reminders overview** — a single list of every reminder (habit / to-do / custom) with an on/off toggle and delete.
- **Backup & restore** — **Download JSON** of all the user's data, and **Restore** it from a backup file (re-owned to the current account, upserted per table, with a confirm dialog).

---

## Onboarding

Phase 1, tracked via `profiles.onboarded_at`:
- **Welcome modal** — on first sign-in, a blurred-background modal ("Welcome to ISA — your Personal Life Operating System") with **Start tour** / **Skip for now**. Either choice stamps `onboarded_at` so it never shows again.
- **Spotlight tour** — one interactive walkthrough of the real navigation (nav bar → Dashboard → Habits → Money → Prayer → Focus → Settings → Menu). Each step dims the screen except a spotlit element, with a glass tooltip and Back / Next / Skip. It **auto-skips steps whose target isn't on the current viewport** (so one config serves the mobile bar and the desktop rail) and is **resumable** across refresh.
- **`?` Help button** (top-right) re-launches the tour on demand.
- **Contextual empty states** — every page's empty state explains the page and offers one clear action (via a shared `EmptyState`), rather than a bare "No items".

*Deferred (intentionally not built yet):* per-module tours, learn-by-doing gating, a usage-observing "Smart Coach", a 15-day progressive feature unlock, an onboarding progress tracker, and confetti/haptics.

---

## Notifications

Web Push (VAPID) via a service worker; also powers the offline PWA cache. Delivery is scheduled by **Supabase pg_cron** (every-minute tick calling the app) and **Vercel Cron**.

- **Journal** — evening nudge if you haven't journaled today.
- **Habits** — evening nudge listing unfinished habits by name.
- **Weekly review** — Sunday, once a review is ready.
- **Prayer (start)** — pushes when each prayer's (masjid-adjusted) time arrives, with a 10-minute catch-up window and `prayer_sent` dedup.
- **Prayer (hourly)** — reminds each hour that a prayer is still un-ticked while its window is open, until ticked (deduped per slot).
- **Focus complete** — if a timer finishes while the app is closed.
- **Custom reminders** — per-habit, per-to-do, and free-form reminders with a time + weekdays; **recurring payments** fire monthly on their `day_of_month`.
- All times are handled for **UTC+5** (the user's timezone). Personalized with the user's first name.

---

## Search

The **command palette (⌘K / Ctrl+K)** is the universal search + quick-actor:
- **Jump to** any page (typeahead over all nav destinations + Settings).
- **Quick-add** a goal, to-do, habit or idea inline (pick → type → Enter inserts, with a toast).
- **Sign out** action.
- On mobile it opens from the **Menu** button in the bottom bar; on desktop from a bottom-left "Search ⌘K" pill or the shortcut.

---

## Authentication

- **Supabase Auth**, email + password. Signup captures `full_name` into user metadata (drives the greeting).
- **Client-side guard** — the app shell redirects unauthenticated users to `/login`; `/login` redirects authenticated users into the app. No middleware/proxy.
- **Row-Level Security everywhere** — every table has an `owner_all` policy (`auth.uid() = user_id`), so users only ever see their own rows; friends just sign up and get an isolated space.
- **Email confirmation** may be required for new signups (configurable in Supabase).

---

## Premium ideas already implemented

- **Mountain-ascent metaphor** — goals as peaks, an animated climber for overall progress, mountain backdrop atmosphere.
- **Two-theme system with real-time day/night** (Girls) and a cinematic one-time intro animation.
- **Bilingual (EN/UZ)** with an instant, always-visible toggle and graceful English fallback.
- **Command palette** for navigation + quick-add.
- **Financial health score + rule-based insights + one-tap expense presets + animated balance.**
- **Prayer tracking with masjid-adjusted times, on-time/late/missed status, and layered reminders.**
- **Robust focus timer** (wall-clock resync, wake lock, server-side completion push).
- **Energy Score** from sleep, **weekly auto-reviews**, **journaling streaks**.
- **Full data ownership** — JSON backup **and restore**.
- **Offline PWA** (installable, cached shell), **web push** across habits/journal/prayer/focus/finance.
- **Spotlight onboarding tour** + contextual empty states.
- **User-customizable mobile nav order.**

---

## Future roadmap

- **Real LLM layer** on top of the existing deterministic data (natural-language "ask your data", smarter coaching).
- **Onboarding Phase 2+** — per-module tours, learn-by-doing step gating, a usage-observing Smart Coach, progressive feature unlocking, an onboarding progress tracker, and celebratory micro-interactions (confetti/haptics).
- **Multi-user polish** — currently isolated per user, but no sharing/collaboration or admin surfaces.
- **More cities/localities for prayer times** (schema already has a `city` column; only Sirdaryo is wired).
- **Richer notes** (folders, rich text, links between ideas/goals/projects).
- **Budgets & recurring income**, multi-currency, and charts for Money.
- **Deeper analytics** across modules (cross-module correlations, trends).

---

## Technical architecture (high level)

- **Frontend** — Next.js 16 App Router (Turbopack), React 19, TypeScript, Tailwind v4 (theme tokens as CSS variables), Framer Motion, Recharts. Route group `(app)` wrapped by an `AppShell` (auth guard + Sidebar + palette + toggles + onboarding); `/login` is outside it.
- **State/data** — a generic `useCollection` hook over Supabase tables (RLS-scoped reads/writes) plus a few bespoke hooks (prayer, money, nav order). Providers for Auth, Theme, Language, Nav order.
- **Backend** — Supabase Postgres with RLS on every table, Postgres functions/`pg_cron` jobs (energy score, weekly review, prayer sync, reminder ticks), and Next.js Route Handlers (`/api/push/*`, `/api/prayer/*`, `/api/strava/*`) using the service role for privileged work.
- **Notifications** — Web Push (VAPID) + a service worker; scheduling split between Supabase pg_cron (frequent) and Vercel Cron (daily/weekly).
- **Deploy** — Vercel, git-connected to `main` (auto-deploy on push); Supabase cloud for DB/Auth. Prayer times are scraped from namozvaqti.uz (positional parse) with an Aladhan API fallback.

---

## Missing features

- **No real AI/LLM** — all "insights" are rule-based math (by design, for now).
- **No dedicated Tasks or Notes pages** — tasks = the to-do list, notes = Ideas.
- **No collaboration/sharing** — single-user spaces only.
- **No budgeting, recurring income, or multi-currency** in Money.
- **No sub-tasks, attachments, or rich text** in Ideas/Projects.
- **No calendar events/scheduling** — the calendar is mood/journal only.
- **Onboarding Phase 2 items** (per-module tours, smart coach, progress tracker, etc.) are deferred.
- **No in-app account management** (change email/password/delete account) — handled via Supabase directly.

---

## Current limitations

- **Single-city prayer times** — only Sirdaryo is populated; times depend on a scrape (with Aladhan fallback).
- **Timezone is hard-coded to UTC+5** for notification scheduling.
- **Cron cadence** — free-tier constraints mean some nudges run on fixed schedules rather than to-the-second.
- **Strava** requires a (subscriber-only) Strava API connection; manual run logging is the always-free fallback.
- **iOS push** requires installing the PWA to the Home Screen and opening it from there (iOS 16.4+).
- **Email confirmation** on signup can block first login until the address is verified.
- **Restore/import** upserts by primary key and re-owns rows to the current account; importing a backup that collides on secondary unique keys can skip that table.
- **A known lint exception** (`react-hooks/set-state-in-effect`) exists in a few provider files (theme/language) — intentional and tolerated.
