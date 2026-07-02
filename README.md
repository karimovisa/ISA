# ISLOM OS — Personal Life Operating System

A premium, dark-mode personal dashboard — a "second brain" for goals, projects,
ideas, learning, journaling, and focus. Built to feel like a blend of Apple,
Linear, Notion, and Arc.

## Stack

- **Next.js 16** (App Router, Turbopack) · **React 19** · **TypeScript**
- **Tailwind CSS v4** · **Framer Motion** · **Recharts**
- **Supabase** (auth + Postgres with Row Level Security)

## Features

- **Dashboard** — time-aware greeting, live clock, quote of the day, overview cards.
- **Goals / Projects / Ideas** — full create / edit / delete, progress, deadlines.
- **Journal** — daily three-question reflection (one entry per day).
- **Focus** — circular-ring timer (25/50/90m) that logs sessions.
- **Progress** — charts driven by your real focus sessions and run logs.

Glassmorphism, mobile-first responsive (icon rail on desktop, bottom bar on
mobile), subtle Framer Motion throughout. Dark mode only.

## Getting started

See [SETUP.md](SETUP.md) — create a Supabase project, run `supabase/schema.sql`,
fill `.env.local`, then `npm run dev`.
