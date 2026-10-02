import type { Checkin, Doubt, Member, Pact } from "./types";
import { addDays, diffDays, eachDay, maxDay, minDay, shortDay, todayIn, weekStart } from "./dates";

export type DayState = "kept" | "broke" | "off" | "pending";
export type MissKind = "confessed" | "auto" | "doubt" | "short";
export type Miss = { day: string; kind: MissKind; cents: number; label: string };

export const DOUBT_WINDOW_MS = 24 * 3600 * 1000;

export function doubtExpired(d: Doubt, now: number): boolean {
  return d.status === "open" && now - new Date(d.created_at).getTime() > DOUBT_WINDOW_MS;
}

/** What a check-in actually counts as, after doubts are applied. */
export function effectiveStatus(
  c: Checkin,
  doubts: Doubt[],
  now: number,
): { status: "kept" | "broke" | "off"; viaDoubt: boolean } {
  const mine = doubts.filter((d) => d.checkin_id === c.id);
  if (c.status === "kept" && mine.some((d) => doubtExpired(d, now))) return { status: "broke", viaDoubt: true };
  if (c.status === "broke" && mine.some((d) => d.status === "confessed")) return { status: "broke", viaDoubt: true };
  return { status: c.status, viaDoubt: false };
}

/** nth miss within a week (0-based) costs this much. Escalating doubles each time, capped at 4x. */
export function missCost(pact: Pact, nthInWeek: number): number {
  const mult = pact.escalating ? Math.min(2 ** nthInWeek, 4) : 1;
  return pact.stake_cents * mult;
}

export type MemberStats = {
  userId: string;
  startsOn: string;
  active: boolean; // has the pact started for them
  today: DayState | null; // null = not applicable today (not started / ended)
  todayCheckin: Checkin | null;
  days: Record<string, DayState>; // daily/count: per-day state; weekly: keyed by week start
  misses: Miss[];
  owedCents: number;
  kept: number;
  decided: number; // kept + broke (off excluded)
  streak: number;
  bestStreak: number;
  confessions: number;
  autoMisses: number;
  doubtMisses: number;
  offUsedThisWeek: number;
  offLeftThisWeek: number;
  weekCount: number; // weekly: sessions logged this week
  weekTarget: number; // weekly: target this week (prorated)
};

export type PactStats = {
  today: string;
  started: boolean;
  ended: boolean;
  dayNumber: number;
  totalDays: number;
  daysLeft: number;
  unit: "day" | "week";
  members: Record<string, MemberStats>;
  groupToday: DayState | null;
  groupStreak: number;
  bestGroupStreak: number;
  potCents: number;
};

function runs(states: DayState[]): { current: number; best: number } {
  // states are oldest -> newest. A trailing "pending" doesn't break the current streak.
  let best = 0;
  let run = 0;
  for (const s of states) {
    if (s === "kept" || s === "off") {
      run++;
      best = Math.max(best, run);
    } else if (s === "broke") run = 0;
  }
  let current = 0;
  for (let i = states.length - 1; i >= 0; i--) {
    const s = states[i];
    if (s === "pending" && i === states.length - 1) continue;
    if (s === "kept" || s === "off") current++;
    else break;
  }
  return { current, best };
}

export function computePact(
  pact: Pact,
  members: Member[],
  checkins: Checkin[],
  doubts: Doubt[],
  now: number = Date.now(),
): PactStats {
  const today = todayIn(pact.timezone, new Date(now));
  const started = today >= pact.start_date;
  const ended = today > pact.end_date;
  const lastDay = minDay(today, pact.end_date);
  const totalDays = diffDays(pact.end_date, pact.start_date) + 1;
  const dayNumber = started ? Math.min(diffDays(lastDay, pact.start_date) + 1, totalDays) : 0;
  const daysLeft = Math.max(0, diffDays(pact.end_date, today));
  const active = members.filter((m) => m.status === "active");

  const byKey = new Map<string, Checkin>();
  for (const c of checkins) byKey.set(`${c.user_id}|${c.day}`, c);

  const out: Record<string, MemberStats> = {};
  const isWeekly = pact.goal_type === "weekly";

  for (const m of active) {
    const startsOn = maxDay(m.starts_on ?? pact.start_date, pact.start_date);
    const mine = checkins.filter((c) => c.user_id === m.user_id);
    const s: MemberStats = {
      userId: m.user_id,
      startsOn,
      active: today >= startsOn,
      today: null,
      todayCheckin: byKey.get(`${m.user_id}|${today}`) ?? null,
      days: {},
      misses: [],
      owedCents: 0,
      kept: 0,
      decided: 0,
      streak: 0,
      bestStreak: 0,
      confessions: 0,
      autoMisses: 0,
      doubtMisses: 0,
      offUsedThisWeek: 0,
      offLeftThisWeek: 0,
      weekCount: 0,
      weekTarget: 0,
    };

    for (const c of mine) {
      if (c.status === "broke" && !effectiveStatus(c, doubts, now).viaDoubt) s.confessions++;
    }

    if (!isWeekly) {
      const days = startsOn <= lastDay ? eachDay(startsOn, lastDay) : [];
      const states: DayState[] = [];
      const perWeek = new Map<string, number>();
      for (const d of days) {
        const c = byKey.get(`${m.user_id}|${d}`);
        let st: DayState;
        let kind: MissKind | null = null;
        if (c) {
          const eff = effectiveStatus(c, doubts, now);
          st = eff.status;
          if (st === "broke") kind = eff.viaDoubt ? "doubt" : "confessed";
        } else if (d < today) {
          st = "broke";
          kind = "auto";
        } else {
          st = "pending";
        }
        s.days[d] = st;
        states.push(st);
        if (st === "kept") s.kept++;
        if (st === "kept" || st === "broke") s.decided++;
        if (kind) {
          const wk = weekStart(d);
          const n = perWeek.get(wk) ?? 0;
          perWeek.set(wk, n + 1);
          const cents = missCost(pact, n);
          s.misses.push({
            day: d,
            kind,
            cents,
            label:
              kind === "auto" ? "No check-in" : kind === "doubt" ? "Lost a doubt" : pact.goal_type === "count" ? "Missed the number" : "Broke it",
          });
          if (kind === "auto") s.autoMisses++;
          if (kind === "doubt") s.doubtMisses++;
        }
      }
      const r = runs(states);
      s.streak = r.current;
      s.bestStreak = r.best;
      if (!ended && s.active) {
        s.today = s.days[today] ?? "pending";
        const wk = weekStart(today);
        s.offUsedThisWeek = mine.filter((c) => c.status === "off" && weekStart(c.day) === wk && c.day !== today).length;
        s.offLeftThisWeek = Math.max(0, pact.off_days_per_week - s.offUsedThisWeek);
      }
    } else {
      // Weekly: X sessions per Mon-Sun week, prorated for partial weeks.
      const target = pact.target ?? 1;
      const weeks: string[] = [];
      if (startsOn <= lastDay) {
        for (let w = weekStart(startsOn); w <= weekStart(lastDay); w = addDays(w, 7)) weeks.push(w);
      }
      const states: DayState[] = [];
      for (const w of weeks) {
        const from = maxDay(w, startsOn);
        const to = minDay(addDays(w, 6), pact.end_date);
        if (from > to) continue;
        const activeDays = diffDays(to, from) + 1;
        const wTarget = Math.ceil((target * activeDays) / 7);
        const sessions = mine.filter(
          (c) => c.day >= from && c.day <= to && effectiveStatus(c, doubts, now).status === "kept",
        );
        const count = sessions.length;
        const closed = today > to;
        let st: DayState;
        if (closed) {
          const short = Math.max(0, wTarget - count);
          st = short === 0 ? "kept" : "broke";
          for (let i = 0; i < short; i++) {
            const cents = missCost(pact, i);
            s.misses.push({ day: w, kind: "short", cents, label: `Week of ${shortDay(w)}: ${count}/${wTarget}` });
          }
          s.decided++;
          if (short === 0) s.kept++;
        } else {
          st = count >= wTarget ? "kept" : "pending";
          s.weekCount = count;
          s.weekTarget = wTarget;
        }
        s.days[w] = st;
        states.push(st);
      }
      for (const c of mine) {
        const eff = effectiveStatus(c, doubts, now);
        if (eff.viaDoubt) s.doubtMisses++;
      }
      const r = runs(states);
      s.streak = r.current;
      s.bestStreak = r.best;
      if (!ended && s.active) {
        s.today = s.todayCheckin && effectiveStatus(s.todayCheckin, doubts, now).status === "kept" ? "kept" : "pending";
      }
    }
    s.owedCents = s.misses.reduce((a, b) => a + b.cents, 0);
    out[m.user_id] = s;
  }

  // Group streak: a day (or week) only counts if everyone kept it.
  const keys = new Set<string>();
  for (const s of Object.values(out)) for (const k of Object.keys(s.days)) keys.add(k);
  const sorted = [...keys].sort();
  const groupStates: DayState[] = sorted.map((k) => {
    let anyPending = false;
    for (const s of Object.values(out)) {
      const st = s.days[k];
      if (!st) continue;
      if (st === "broke") return "broke";
      if (st === "pending") anyPending = true;
    }
    return anyPending ? "pending" : "kept";
  });
  const g = runs(groupStates);
  const currentKey = isWeekly ? weekStart(today) : today;
  const groupToday = !ended && started ? (groupStates[sorted.indexOf(currentKey)] ?? null) : null;

  return {
    today,
    started,
    ended,
    dayNumber,
    totalDays,
    daysLeft,
    unit: isWeekly ? "week" : "day",
    members: out,
    groupToday,
    groupStreak: g.current,
    bestGroupStreak: g.best,
    potCents: Object.values(out).reduce((a, s) => a + s.owedCents, 0),
  };
}

export function goalLabel(p: Pact): string {
  if (p.goal_type === "count") return `${Number(p.target).toLocaleString()} ${p.unit ?? ""} a day`.trim();
  if (p.goal_type === "weekly") return `${p.target}x a week`;
  return "Every day";
}
