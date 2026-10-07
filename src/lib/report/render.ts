// ISA — Life report · rendering. The weekly / monthly report as a dark, on-brand
// 2-page A4 PDF and a 1080×1920 story image. Pages are laid out as HTML off-screen
// and rasterised (html2canvas-pro → any script renders exactly as the browser
// draws it), so the design uses the app's own font and the mountain photo. The
// story deliberately leaves out money and the person's name — it's for sharing.

import { windowDays, type DomainKey } from "@/lib/progressCompare";
import { formatSom } from "@/lib/money";
import { formatLocalDate } from "@/lib/datetime";
import type { ReportData } from "./data";

type T = (key: string, vars?: Record<string, string | number>) => string;

const C = {
  bg: "#0D131A",
  fg: "#F5F0E8",
  muted: "#8B8578",
  line: "rgba(245,240,232,0.09)",
  card: "rgba(245,240,232,0.04)",
  accent: "#6E93C7",
  up: "#86A97F",
  down: "#D9A55B",
};
const PHOTO = "/themes/dark.webp";
const LOGO = "/icons/icon-192.png";

const AREA: Record<DomainKey, string> = {
  focus: "Focus", habits: "Habits", tasks: "Tasks", journal: "Journal",
  running: "Running", sleep: "Sleep", prayer: "Prayer",
};

const esc = (s: unknown) =>
  String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c] as string);

// ─────────────────────────── wording ───────────────────────────

function periodTitle(d: ReportData, lang: string): string {
  const from = new Date(`${d.current.from}T00:00:00`);
  const to = new Date(`${d.current.to}T00:00:00`);
  if (d.period === "month") return formatLocalDate(from, lang, "monthYear");
  return `${formatLocalDate(from, lang, "dayMonthShort")} – ${formatLocalDate(to, lang, "dayMonthShort")}`;
}

function verdictCopy(d: ReportData, t: T): { title: string; color: string; summary: string } {
  const n = d.domains.length;
  const week = d.period === "week";
  switch (d.verdict) {
    case "improving":
      return { title: t(week ? "A week of growth" : "A month of growth"), color: C.up, summary: t("{up} of {n} areas improved", { up: d.ups, n }) };
    case "softening":
      return { title: t(week ? "A slower week" : "A slower month"), color: C.down, summary: t("{down} of {n} areas dipped — small steps bring them back", { down: d.downs, n }) };
    case "steady":
      return { title: t(week ? "A steady week" : "A steady month"), color: C.fg, summary: t("Holding your level across {n} areas", { n }) };
    default:
      return { title: t(week ? "Your week in ISA" : "Your month in ISA"), color: C.fg, summary: t("No activity to compare yet for this period.") };
  }
}

const delta = (d: ReportData, key: DomainKey) => d.domains.find((x) => x.key === key);

function deltaChip(d: ReportData, key: DomainKey, t: T, size = 12): string {
  const r = delta(d, key);
  if (!r) return "";
  const color = r.direction === "up" ? C.up : r.direction === "down" ? C.down : C.muted;
  const text = r.changePct == null ? t("new") : `${r.changePct > 0 ? "+" : ""}${r.changePct}%`;
  return `<span style="color:${color};font-size:${size}px;font-weight:600">${esc(text)}</span>`;
}

/** Headline stats: the four most telling areas that have data. */
function headline(d: ReportData, t: T) {
  const c = d.totals.current;
  const all: { key: DomainKey; value: string; label: string; has: boolean }[] = [
    { key: "focus", value: `${(c.focus / 60).toFixed(1)}${t("h")}`, label: t("Focus"), has: c.focus > 0 },
    { key: "habits", value: `${c.habits}`, label: t("Habit check-ins"), has: c.habits > 0 },
    { key: "tasks", value: `${c.tasks}`, label: t("Tasks done"), has: c.tasks > 0 },
    { key: "running", value: `${c.running.toFixed(1)} km`, label: t("Running"), has: c.running > 0 },
    { key: "journal", value: `${c.journal}`, label: t("Journal days"), has: c.journal > 0 },
    { key: "prayer", value: `${c.prayer}`, label: t("Prayers"), has: c.prayer > 0 },
    { key: "sleep", value: c.sleep != null ? `${c.sleep.toFixed(1)}${t("h")}` : "—", label: t("Avg sleep"), has: c.sleep != null },
  ];
  const withData = all.filter((s) => s.has);
  return (withData.length >= 4 ? withData : all).slice(0, 4);
}

function nextFocus(d: ReportData, t: T): string {
  const weakest = d.domains.filter((x) => x.direction === "down").sort((a, b) => (a.changePct ?? 0) - (b.changePct ?? 0))[0];
  const period = t(d.period === "week" ? "week" : "month");
  if (weakest) return t("Next {period}: give {area} a little more room — one small step a day is enough.", { period, area: t(AREA[weakest.key]).toLowerCase() });
  if (d.verdict === "improving") return t("Next {period}: keep the rhythm that worked — don't add, protect it.", { period });
  return t("Next {period}: pick one area and give it ten minutes a day.", { period });
}

// ─────────────────────────── shared pieces ───────────────────────────

const BASE_CSS = `
.isa-rp, .isa-rp * { box-sizing: border-box; margin: 0; padding: 0; }
.isa-rp { font-family: var(--font-sans), "Segoe UI", Roboto, Arial, sans-serif; color: ${C.fg}; -webkit-font-smoothing: antialiased; }
.isa-rp .muted { color: ${C.muted}; }
.isa-rp .cap { font-size: 11px; letter-spacing: 0.16em; text-transform: uppercase; color: ${C.muted}; }
`;

const brand = (size = 30) =>
  `<div style="display:flex;align-items:center;gap:${Math.round(size / 3)}px">
     <img src="${LOGO}" style="width:${size}px;height:${size}px;border-radius:${Math.round(size * 0.24)}px" />
     <span style="font-size:${Math.round(size * 0.5)}px;letter-spacing:0.42em;font-weight:500">ISA</span>
   </div>`;

const footer = (page: number, total: number, t: T) =>
  `<div style="position:absolute;left:56px;right:56px;bottom:36px;display:flex;justify-content:space-between;font-size:11px;color:${C.muted};border-top:1px solid ${C.line};padding-top:14px">
     <span>ISA · Run. Process. Aim.</span><span>${esc(t("Page {n} of {total}", { n: page, total }))}</span>
   </div>`;

// ─────────────────────────── PDF ───────────────────────────

function pdfPages(d: ReportData, t: T, lang: string): string {
  const v = verdictCopy(d, t);
  const kind = t(d.period === "week" ? "Weekly report" : "Monthly report");
  const gain = d.domains.filter((x) => x.direction === "up" && x.changePct != null).sort((a, b) => (b.changePct ?? 0) - (a.changePct ?? 0))[0];

  const tiles = headline(d, t)
    .map(
      (s) => `<div style="flex:1;min-width:0;background:${C.card};border:1px solid ${C.line};border-radius:18px;padding:18px 18px 16px">
        <div style="display:flex;justify-content:space-between;align-items:baseline;gap:8px">
          <span style="font-size:28px;font-weight:700;letter-spacing:-0.02em;white-space:nowrap">${esc(s.value)}</span>${deltaChip(d, s.key, t)}
        </div>
        <div class="muted" style="font-size:12px;margin-top:6px">${esc(s.label)}</div>
      </div>`
    )
    .join("");

  const days = windowDays(d.current);
  const prevDays = windowDays(d.previous);
  const areaRows = d.domains
    .map((r) => {
      const pct = r.changePct ?? 100;
      const w = Math.min(50, Math.abs(pct) / 2);
      const color = r.direction === "up" ? C.up : r.direction === "down" ? C.down : C.muted;
      const fmt = (v: number, n: number) =>
        r.key === "sleep" ? `${v.toFixed(1)}${t("h")}` : r.key === "focus" ? `${((v * n) / 60).toFixed(1)}${t("h")}` : r.key === "running" ? `${(v * n).toFixed(1)} km` : `${Math.round(v * n)}`;
      return `<div style="display:flex;align-items:center;gap:16px;padding:11px 0;border-bottom:1px solid ${C.line}">
        <div style="width:120px;font-size:14px">${esc(t(AREA[r.key]))}</div>
        <div style="width:150px;font-size:12px" class="muted">${esc(fmt(r.current, days))} · ${esc(t("before"))} ${esc(fmt(r.previous, prevDays))}</div>
        <div style="flex:1;position:relative;height:6px;background:${C.line};border-radius:3px">
          <div style="position:absolute;left:50%;top:-4px;width:1px;height:14px;background:${C.muted};opacity:.5"></div>
          <div style="position:absolute;top:0;height:6px;border-radius:3px;background:${color};${pct >= 0 ? `left:50%;width:${w}%` : `right:50%;width:${w}%`}"></div>
        </div>
        <div style="width:56px;text-align:right">${deltaChip(d, r.key, t, 13)}</div>
      </div>`;
    })
    .join("");

  const page1 = `<div class="page" style="position:relative;width:794px;height:1123px;background:${C.bg};overflow:hidden">
    <div style="position:absolute;inset:0 0 auto 0;height:470px;background:linear-gradient(180deg, rgba(13,19,26,0.10) 0%, rgba(13,19,26,0.35) 55%, ${C.bg} 100%), url(${PHOTO}) center 38% / cover no-repeat"></div>
    <div style="position:relative;padding:44px 56px 0">
      <div style="display:flex;justify-content:space-between;align-items:center">
        ${brand(30)}
        <span style="font-size:11px;letter-spacing:0.18em;text-transform:uppercase;border:1px solid rgba(245,240,232,0.25);border-radius:999px;padding:6px 14px">${esc(kind)}</span>
      </div>
      <div style="margin-top:250px">
        <div class="cap">${esc(d.name ? t("Prepared for {name}", { name: d.name }) : t("Your life report"))}</div>
        <div style="font-size:46px;font-weight:700;letter-spacing:-0.03em;margin-top:8px">${esc(periodTitle(d, lang))}</div>
      </div>
      <div style="margin-top:34px">
        <div style="font-size:30px;font-weight:700;color:${v.color};letter-spacing:-0.02em">${esc(v.title)}</div>
        <div style="font-size:15px;margin-top:6px;color:rgba(245,240,232,0.85)">${esc(v.summary)}${
          gain ? ` · ${esc(t("Biggest gain: {area} {pct}", { area: t(AREA[gain.key]).toLowerCase(), pct: `+${gain.changePct}%` }))}` : ""
        }</div>
      </div>
      <div style="display:flex;gap:12px;margin-top:28px">${tiles}</div>
      <div style="margin-top:34px">
        <div class="cap" style="margin-bottom:6px">${esc(t(d.period === "week" ? "Last 7 days vs the 7 before" : "This month vs the same days last month"))}</div>
        ${areaRows || `<div class="muted" style="font-size:14px;padding:12px 0">${esc(t("No activity to compare yet for this period."))}</div>`}
      </div>
    </div>
    ${footer(1, 2, t)}
  </div>`;

  const goalRows = d.goals.length
    ? d.goals
        .map((g) => {
          let line = "";
          if (g.forecast?.kind === "date") {
            const date = formatLocalDate(g.forecast.finish, lang, "dayMonth");
            line = t("At this pace you'll finish on {date}", { date });
            const v = g.forecast.vsDeadline;
            if (v != null)
              line += ` — ${v > 0 ? t("{n} days after your deadline", { n: v }) : v < 0 ? t("{n} days before your deadline", { n: -v }) : t("right on your deadline")}`;
          } else if (g.forecast?.kind === "stalled") line = t("Not enough movement to predict yet.");
          return `<div style="background:${C.card};border:1px solid ${C.line};border-radius:16px;padding:16px 18px;margin-bottom:10px">
            <div style="display:flex;justify-content:space-between;gap:16px;align-items:baseline">
              <span style="font-size:15px;font-weight:600">${esc(g.title)}</span><span style="font-size:20px;font-weight:700">${g.pct}%</span>
            </div>
            <div style="height:5px;background:${C.line};border-radius:3px;margin-top:10px"><div style="height:5px;width:${g.pct}%;background:${C.accent};border-radius:3px"></div></div>
            ${line ? `<div class="muted" style="font-size:12px;margin-top:8px">${esc(line)}</div>` : ""}
          </div>`;
        })
        .join("")
    : `<div class="muted" style="font-size:14px">${esc(t("No active goals."))}</div>`;

  const maxCat = Math.max(1, ...d.money.topCategories.map((c) => c.amount));
  const catRows = d.money.topCategories
    .map(
      (c) => `<div style="margin-top:12px">
        <div style="display:flex;justify-content:space-between;font-size:13px"><span>${esc(t(c.category))}</span><span class="muted">${esc(formatSom(c.amount))}</span></div>
        <div style="height:5px;background:${C.line};border-radius:3px;margin-top:6px"><div style="height:5px;width:${Math.round((c.amount / maxCat) * 100)}%;background:${C.down};border-radius:3px;opacity:.85"></div></div>
      </div>`
    )
    .join("");

  const dayDots = [
    ...Array(d.days.good).fill(C.up),
    ...Array(d.days.ok).fill(C.accent),
    ...Array(d.days.off).fill(C.down),
  ]
    .map((c) => `<span style="display:inline-block;width:14px;height:14px;border-radius:50%;background:${c};margin:0 6px 6px 0"></span>`)
    .join("");
  const bestDay = d.bestDay
    ? formatLocalDate(new Date(`${d.bestDay.date}T00:00:00`), lang, "weekdayDayMonth")
    : null;

  const card = (title: string, body: string) =>
    `<div style="background:${C.card};border:1px solid ${C.line};border-radius:20px;padding:22px 22px 20px;flex:1"><div class="cap" style="margin-bottom:12px">${esc(title)}</div>${body}</div>`;

  const page2 = `<div class="page" style="position:relative;width:794px;height:1123px;background:${C.bg};overflow:hidden">
    <div style="position:absolute;inset:auto 0 0 0;height:320px;background:linear-gradient(0deg, rgba(13,19,26,0.55), ${C.bg}), url(${PHOTO}) center 75% / cover no-repeat;opacity:.55"></div>
    <div style="position:relative;padding:44px 56px 0">
      <div style="display:flex;justify-content:space-between;align-items:center">
        ${brand(26)}<span class="muted" style="font-size:13px">${esc(periodTitle(d, lang))}</span>
      </div>
      <div style="margin-top:36px">
        <div class="cap" style="margin-bottom:12px">${esc(t("Goals"))}</div>
        ${goalRows}
      </div>
      <div style="display:flex;gap:14px;margin-top:22px">
        ${card(
          t("Money"),
          `<div style="display:flex;justify-content:space-between;align-items:baseline;gap:12px">
             <span class="muted" style="font-size:12px">${esc(t("Income"))}</span>
             <span style="font-size:17px;font-weight:700;color:${C.up};white-space:nowrap">${esc(formatSom(d.money.income))}</span>
           </div>
           <div style="display:flex;justify-content:space-between;align-items:baseline;gap:12px;margin-top:4px">
             <span class="muted" style="font-size:12px">${esc(t("Expenses"))}</span>
             <span style="font-size:17px;font-weight:700;color:${C.down};white-space:nowrap">${esc(formatSom(d.money.expense))}</span>
           </div>${catRows}`
        )}
        ${card(
          t("How the days felt"),
          `${dayDots || `<div class="muted" style="font-size:13px">${esc(t("No evening check-ins yet."))}</div>`}
           ${dayDots ? `<div class="muted" style="font-size:11px;margin-top:2px;display:flex;gap:12px">
             <span><span style="color:${C.up}">●</span> ${esc(t("Good day"))}</span>
             <span><span style="color:${C.accent}">●</span> ${esc(t("It was okay"))}</span>
             <span><span style="color:${C.down}">●</span> ${esc(t("Not my best"))}</span>
           </div>` : ""}
           <div style="font-size:13px;margin-top:10px;line-height:1.7">
             <div>${esc(t("{n} active days", { n: d.activeDays }))}</div>
             ${bestDay ? `<div class="muted">${esc(t("Most active: {day}", { day: bestDay }))}</div>` : ""}
           </div>`
        )}
      </div>
      <div style="margin-top:26px;border-left:2px solid ${C.accent};padding:4px 0 4px 18px">
        <div class="cap" style="margin-bottom:8px">${esc(t("ISA's note"))}</div>
        <div style="font-size:17px;line-height:1.55">${esc(nextFocus(d, t))}</div>
      </div>
    </div>
    ${footer(2, 2, t)}
  </div>`;

  return page1 + page2;
}

// ─────────────────────────── Story ───────────────────────────

function storyHtml(d: ReportData, t: T, lang: string): string {
  const v = verdictCopy(d, t);
  const tiles = headline(d, t)
    .map(
      (s) => `<div style="background:rgba(13,19,26,0.55);border:1px solid rgba(245,240,232,0.14);border-radius:36px;padding:38px 40px">
        <div style="font-size:76px;font-weight:700;letter-spacing:-0.03em;line-height:1">${esc(s.value)}</div>
        <div style="display:flex;justify-content:space-between;align-items:baseline;margin-top:18px">
          <span style="font-size:30px;color:rgba(245,240,232,0.75)">${esc(s.label)}</span>${deltaChip(d, s.key, t, 32)}
        </div>
      </div>`
    )
    .join("");
  return `<div class="story" style="position:relative;width:1080px;height:1920px;overflow:hidden;background:${C.bg}">
    <div style="position:absolute;inset:0;background:url(${PHOTO}) center / cover no-repeat"></div>
    <div style="position:absolute;inset:0;background:linear-gradient(180deg, rgba(13,19,26,0.92) 0%, rgba(13,19,26,0.55) 30%, rgba(13,19,26,0.25) 48%, rgba(13,19,26,0.80) 70%, rgba(13,19,26,0.96) 100%)"></div>
    <div style="position:relative;padding:110px 90px 0">
      <div style="display:flex;justify-content:space-between;align-items:center">
        ${brand(64)}
        <span style="font-size:24px;letter-spacing:0.18em;text-transform:uppercase;border:2px solid rgba(245,240,232,0.3);border-radius:999px;padding:12px 28px">${esc(t(d.period === "week" ? "My week" : "My month"))}</span>
      </div>
      <div style="margin-top:120px;font-size:44px;color:rgba(245,240,232,0.75)">${esc(periodTitle(d, lang))}</div>
      <div style="margin-top:14px;font-size:96px;font-weight:700;letter-spacing:-0.035em;line-height:1.02;color:${v.color}">${esc(v.title)}</div>
      <div style="margin-top:26px;font-size:38px;line-height:1.35;color:rgba(245,240,232,0.88)">${esc(v.summary)}</div>
    </div>
    <div style="position:absolute;left:90px;right:90px;bottom:260px;display:grid;grid-template-columns:1fr 1fr;gap:26px">${tiles}</div>
    <div style="position:absolute;left:90px;right:90px;bottom:110px;display:flex;justify-content:space-between;font-size:28px;color:rgba(245,240,232,0.6)">
      <span>Run. Process. Aim.</span><span>ISA</span>
    </div>
  </div>`;
}

// ─────────────────────────── rasterise ───────────────────────────

async function mount(html: string): Promise<HTMLDivElement> {
  // Make sure the photo, logo and font are ready before the snapshot.
  await Promise.all(
    [PHOTO, LOGO].map(
      (src) =>
        new Promise<void>((resolve) => {
          const img = new Image();
          img.onload = img.onerror = () => resolve();
          img.src = src;
        })
    )
  );
  await document.fonts?.ready;
  const host = document.createElement("div");
  host.setAttribute("aria-hidden", "true");
  host.className = "isa-rp";
  host.style.cssText = "position:fixed;left:-20000px;top:0;";
  host.innerHTML = `<style>${BASE_CSS}</style>${html}`;
  document.body.appendChild(host);
  await Promise.all(
    [...host.querySelectorAll("img")].map((i) => (i.complete ? Promise.resolve() : new Promise((r) => (i.onload = i.onerror = r))))
  );
  return host;
}

export async function renderReportPdf(d: ReportData, t: T, lang: string): Promise<Blob> {
  const [{ jsPDF }, { default: html2canvas }] = await Promise.all([import("jspdf"), import("html2canvas-pro")]);
  const host = await mount(pdfPages(d, t, lang));
  try {
    const pdf = new jsPDF({ unit: "pt", format: "a4", compress: true });
    const w = pdf.internal.pageSize.getWidth();
    const h = pdf.internal.pageSize.getHeight();
    const pages = [...host.querySelectorAll<HTMLElement>(".page")];
    for (let i = 0; i < pages.length; i++) {
      const canvas = await html2canvas(pages[i], { scale: 2, backgroundColor: C.bg, logging: false });
      if (i > 0) pdf.addPage();
      pdf.addImage(canvas.toDataURL("image/jpeg", 0.9), "JPEG", 0, 0, w, h);
    }
    return pdf.output("blob");
  } finally {
    host.remove();
  }
}

export async function renderStoryPng(d: ReportData, t: T, lang: string): Promise<Blob> {
  const { default: html2canvas } = await import("html2canvas-pro");
  const host = await mount(storyHtml(d, t, lang));
  try {
    const el = host.querySelector<HTMLElement>(".story")!;
    const canvas = await html2canvas(el, { scale: 1, width: 1080, height: 1920, backgroundColor: C.bg, logging: false });
    return await new Promise<Blob>((resolve, reject) =>
      canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("story render failed"))), "image/png")
    );
  } finally {
    host.remove();
  }
}

/** Save a blob as a file (works in installed PWAs too). */
export function saveBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}

/** Share the story straight to Instagram & co. where the OS supports it;
 *  otherwise download it. Returns how it was delivered. */
export async function shareOrSave(blob: Blob, filename: string): Promise<"shared" | "saved" | "cancelled"> {
  const file = new File([blob], filename, { type: blob.type });
  const nav = navigator as Navigator & { canShare?: (d: { files: File[] }) => boolean };
  if (nav.canShare?.({ files: [file] })) {
    try {
      await nav.share({ files: [file] });
      return "shared";
    } catch (e) {
      if ((e as Error).name === "AbortError") return "cancelled";
    }
  }
  saveBlob(blob, filename);
  return "saved";
}
