# Design

Visual system for ISLOM OS. Dark mode only. Tokens live in
`src/app/globals.css` (`@theme`); this file is the source of truth for intent.

## Theme

A private studio at night. Near-black canvas, soft ambient brand glow, glass
surfaces used sparingly. Restrained color strategy: tinted-neutral surfaces with
a single blue accent and a green→blue gradient reserved for progress/momentum.

## Color

| Role | Token | Value | Notes |
|---|---|---|---|
| Background | `--color-bg` | `#0B0B0B` | Canvas; ambient radial glow via `body::before` |
| Surface | `--color-surface` | `rgba(255,255,255,0.05)` | Glass cards |
| Surface strong | `--color-surface-strong` | `rgba(255,255,255,0.08)` | Hover state |
| Line | `--color-line` | `rgba(255,255,255,0.08)` | Borders / dividers |
| Ink | `--color-fg` | `#FFFFFF` | Primary text |
| Muted | `--color-muted` | `#A0A0A0` | Secondary text (~9:1 on bg, AA-safe) |
| Accent | `--color-accent` | `#4F8CFF` | Single brand accent; ≤ ~10% of surface |
| Accent soft | `--color-accent-soft` | `rgba(79,140,255,0.15)` | Active nav / chips |
| Progress | gradient | `#22C55E → #4F8CFF` | Reserved for progress bars / rings only |

Accent stays scarce. Section tints (amber/emerald/fuchsia/rose) appear only as
very low-alpha card washes, never as solid fills.

## Typography

- Family: **Inter** (`--font-inter`), one family across weights. No second sans.
- Display headings: bold, tight tracking (≥ -0.02em), `text-wrap: balance`.
- Body ≤ 65–75ch. Numerals use `tabular-nums` for clocks, timers, percentages.
- Scale: hero `clamp` ≤ ~3rem (dashboard greeting), section titles ~1.75–2rem.

## Motion

- Framer Motion. Standard ease: cubic-bezier `[0.22, 1, 0.36, 1]` (ease-out-quint feel).
- Entrances: short fade + 12–18px rise; stagger lists by ~0.05–0.08s.
- Progress bars/rings animate width/offset with the standard ease.
- **Reduced motion**: every animation needs a `prefers-reduced-motion: reduce`
  fallback (instant / crossfade). This is enforced globally.

## Components

- **GlassCard** (`components/ui/GlassCard.tsx`): `.glass` + rounded-3xl, optional
  `hover` (lift + border brighten) and `reflect` (top sheen). The one sanctioned
  glass surface — don't nest glass in glass.
- **ProgressBar / focus ring**: green→blue gradient, soft accent glow.
- **Modal**: centered, backdrop blur, spring-in; shared `fieldClass` / `labelClass`
  / `primaryBtnClass` for forms.
- **Sidebar**: icon-only rail on desktop (left), bottom bar on mobile; active item
  uses a shared `layoutId` pill.
- **PageHeader + AddButton**: consistent section header with optional action.

## Layout

- App shell: `md:pl-20` for the rail; content `max-w-6xl`, generous vertical
  rhythm, `pb-28` on mobile to clear the bottom bar.
- Mobile-first. Grids use explicit breakpoints (`sm:grid-cols-2`,
  `lg:grid-cols-2`); ideas use CSS columns (masonry).
- Z-index: nav (40) < modal backdrop/modal (50). Keep a semantic scale.

## Bans (project-specific)

- No badges/confetti/gamified reward art (anti-ref: gamified apps).
- No toolbar/panel overload (anti-ref: dense productivity tools).
- No gradient text, no side-stripe borders, no glass-on-glass, no decorative
  emoji scaffolding (anti-ref: generic AI template).
