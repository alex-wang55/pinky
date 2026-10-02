/** All "days" are YYYY-MM-DD strings in the pact's timezone. */

export function todayIn(tz: string, now: Date = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: tz,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
}

export function localTz(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || "America/Toronto";
  } catch {
    return "America/Toronto";
  }
}

function parse(d: string): Date {
  const [y, m, dd] = d.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, dd));
}
function fmt(dt: Date): string {
  return dt.toISOString().slice(0, 10);
}

export function addDays(d: string, n: number): string {
  const x = parse(d);
  x.setUTCDate(x.getUTCDate() + n);
  return fmt(x);
}

/** a - b in days */
export function diffDays(a: string, b: string): number {
  return Math.round((parse(a).getTime() - parse(b).getTime()) / 86400000);
}

/** Monday of the week containing d */
export function weekStart(d: string): string {
  const x = parse(d);
  const dow = (x.getUTCDay() + 6) % 7;
  x.setUTCDate(x.getUTCDate() - dow);
  return fmt(x);
}

export const maxDay = (a: string, b: string) => (a > b ? a : b);
export const minDay = (a: string, b: string) => (a < b ? a : b);

export function eachDay(from: string, to: string): string[] {
  const out: string[] = [];
  for (let d = from; d <= to; d = addDays(d, 1)) out.push(d);
  return out;
}

const short = new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", timeZone: "UTC" });
const withDow = new Intl.DateTimeFormat("en-US", { weekday: "short", month: "short", day: "numeric", timeZone: "UTC" });

export function prettyDay(d: string, today?: string): string {
  if (today) {
    if (d === today) return "Today";
    if (d === addDays(today, -1)) return "Yesterday";
  }
  return withDow.format(parse(d));
}

export function shortDay(d: string): string {
  return short.format(parse(d));
}

export function timeAgo(iso: string, now = Date.now()): string {
  const s = Math.max(0, Math.round((now - new Date(iso).getTime()) / 1000));
  if (s < 60) return "just now";
  const m = Math.round(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.round(h / 24)}d ago`;
}

/** 0 = Sunday ... 6 = Saturday */
export function dayOfWeek(d: string): number {
  return parse(d).getUTCDay();
}
