import type { Checkin, Member, Pact, Profile, Reaction } from "./types";
import type { MemberStats, PactStats, WeekSummary } from "./stats";
import { dayOfWeek, shortDay } from "./dates";
import { money } from "./money";

/*
 * Plain-English summaries for the weekly wrap and the recap.
 * Written the way a friend would sum it up in the group chat.
 */

const LONG = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const SHORT = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const WORDS = ["zero", "one", "two", "three", "four", "five", "six", "seven", "eight", "nine", "ten"];

export const weekday = (d: string, short = false) => (short ? SHORT : LONG)[dayOfWeek(d)];
export const word = (n: number) => WORDS[n] ?? String(n);
export const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
export const times = (n: number) => (n === 1 ? "once" : n === 2 ? "twice" : `${n} times`);
export const firstName = (p?: Pick<Profile, "display_name"> | null) => p?.display_name.trim().split(/\s+/)[0] || "Someone";

export function joinAnd(xs: string[]): string {
  if (xs.length <= 1) return xs[0] ?? "";
  if (xs.length === 2) return `${xs[0]} and ${xs[1]}`;
  return `${xs.slice(0, -1).join(", ")} and ${xs[xs.length - 1]}`;
}

function listDays(days: string[]) {
  return joinAnd(days.map((d) => weekday(d, days.length >= 3)));
}

/* ------------------------------------------------------------------ */
/* Group state per day (or per week, for weekly pacts)                 */
/* ------------------------------------------------------------------ */
export type GroupKey = { key: string; state: "kept" | "broke" | "pending" | "none"; broke: string[] };

export function groupStates(stats: PactStats, keys: string[]): GroupKey[] {
  const ms = Object.values(stats.members);
  return keys.map((key) => {
    const broke: string[] = [];
    let pending = false;
    let any = false;
    for (const s of ms) {
      const st = s.days[key];
      if (!st) continue;
      any = true;
      if (st === "broke") broke.push(s.userId);
      else if (st === "pending") pending = true;
    }
    return { key, broke, state: !any ? "none" : broke.length ? "broke" : pending ? "pending" : "kept" };
  });
}

export function bestRun(g: GroupKey[]): { len: number; from: string; to: string } {
  let best = { len: 0, from: "", to: "" };
  let len = 0;
  let from = "";
  for (const x of g) {
    if (x.state === "kept") {
      if (len === 0) from = x.key;
      len++;
      if (len > best.len) best = { len, from, to: x.key };
    } else if (x.state === "broke") len = 0;
  }
  return best;
}

/** Keys the pact has used so far: days, or week starts for weekly pacts. */
export function pactKeys(stats: PactStats): string[] {
  const keys = new Set<string>();
  for (const s of Object.values(stats.members)) for (const k of Object.keys(s.days)) keys.add(k);
  return [...keys].sort();
}

/* ------------------------------------------------------------------ */
/* Weekly wrap                                                          */
/* ------------------------------------------------------------------ */
export function weekStory(o: {
  pact: Pact;
  stats: PactStats;
  sum: WeekSummary;
  names: Record<string, string>;
  latest: boolean;
}): string[] {
  const { pact, stats, sum, names } = o;
  const out: string[] = [];
  const inWeek = (d: string) => d >= sum.from && d <= sum.to;

  if (pact.goal_type === "weekly") {
    const ms = sum.members.filter((m) => m.target > 0);
    const n = (m: { userId: string }) => names[m.userId] ?? "Someone";
    if (!ms.length) out.push("Nobody was counting this week.");
    else if (sum.complete) {
      const hit = ms.filter((m) => m.logged >= m.target);
      const short = ms.filter((m) => m.logged < m.target);
      if (!short.length) out.push(ms.length === 1 ? "Hit the number this week." : "Clean week. Everyone hit their number.");
      else {
        out.push(hit.length ? `${joinAnd(hit.map(n))} hit their number.` : "Rough week. Nobody hit their number.");
        out.push(`${cap(joinAnd(short.map((m) => (m.logged ? `${n(m)} got ${word(m.logged)} of ${word(m.target)}` : `${n(m)} didn't log any`))))}.`);
      }
    } else {
      out.push(
        `So far, ${joinAnd(
          ms.map((m) => (m.logged >= m.target ? `${n(m)} is already done` : `${n(m)} has ${word(m.logged)} of ${word(m.target)}`)),
        )}.`,
      );
    }
  } else {
    const n = sum.countedDays;
    const p = sum.perfectDays;
    if (!n) out.push(sum.complete ? "Nobody had anything to log this week." : "Nothing's in yet this week.");
    else if (!sum.complete)
      out.push(
        p === n
          ? `So far so good. Everyone's kept it ${n === 1 ? "the one day that's done" : `all ${word(n)} days`}.`
          : `So far, ${word(p)} of ${word(n)} days have been clean for everyone.`,
      );
    else if (p === n) out.push(`Clean week. Everyone kept it all ${word(n)} days.`);
    else {
      const r = p / n;
      out.push(
        r >= 0.7
          ? `Good week. Everyone kept it on ${word(p)} of ${word(n)} days.`
          : r >= 0.4
            ? `Up and down week. ${cap(word(p))} of ${word(n)} days were clean for everyone.`
            : p
              ? `Rough week. Only ${word(p)} of ${word(n)} days were clean for everyone.`
              : "Rough week. Not one day where everyone kept it.",
      );
    }

    const slipVerb = pact.goal_type === "count" ? "came up short" : "slipped";
    const slippers = Object.values(stats.members)
      .map((s) => ({ s, ms: s.misses.filter((m) => inWeek(m.day)) }))
      .filter((x) => x.ms.length)
      .sort((a, b) => b.ms.length - a.ms.length);
    for (const { s, ms } of slippers.slice(0, 4)) {
      const of = (k: string) => ms.filter((m) => m.kind === k).map((m) => m.day);
      const c = of("confessed");
      const a = of("auto");
      const d = of("doubt");
      const parts: string[] = [];
      if (c.length) parts.push(`${slipVerb} on ${listDays(c)}`);
      if (a.length) parts.push(`didn't check in on ${listDays(a)}`);
      if (d.length) parts.push(`lost a doubt on ${listDays(d)}`);
      let line = `${names[s.userId] ?? "Someone"} ${joinAnd(parts)}.`;
      const cb = ms.filter((m) => m.comeback).length;
      const eligible = c.length + a.length;
      if (cb) {
        line +=
          eligible === 1
            ? " Kept it the next day, so that one was half off."
            : cb === eligible
              ? eligible === 2
                ? " Kept it the next day both times, so both were half off."
                : " Kept it the next day every time, so they were all half off."
              : ` Kept it the day after ${word(cb)} of those, so ${cb === 1 ? "that one was" : "those were"} half off.`;
      }
      out.push(line);
    }
    if (slippers.length > 4) out.push("A few others slipped too.");

    const clean = sum.members.filter((m) => m.broke === 0 && m.kept > 0).map((m) => names[m.userId] ?? "Someone");
    if (slippers.length && clean.length) out.push(`${joinAnd(clean)} didn't miss a day.`);
  }

  if (sum.potCents) out.push(sum.complete ? `${money(sum.potCents)} went in the pot.` : `${money(sum.potCents)} in the pot so far.`);

  if (o.latest && stats.started && !stats.ended && stats.groupStreak >= 2) {
    out.push(`Right now the group streak is at ${stats.groupStreak} ${stats.unit}s.`);
  }
  return out;
}

/* ------------------------------------------------------------------ */
/* Whole-pact recap                                                     */
/* ------------------------------------------------------------------ */
export function recapStory(o: {
  pact: Pact;
  stats: PactStats;
  names: Record<string, string>;
  people: { userId: string; s: MemberStats }[];
  pet: { name: string; stage: number; stageName: string };
}): string[] {
  const { pact, stats, names, people, pet } = o;
  if (!stats.started) return [`Starts ${shortDay(pact.start_date)}. Nothing to look back on yet.`];
  const weekly = pact.goal_type === "weekly";
  const unit = stats.unit;
  const g = groupStates(stats, pactKeys(stats));
  const counted = g.filter((x) => x.state === "kept" || x.state === "broke");
  const kept = counted.filter((x) => x.state === "kept").length;
  const all = counted.length > 0 && kept === counted.length;
  const out: string[] = [];

  if (weekly) {
    if (stats.ended) out.push(all ? `${cap(word(counted.length))} weeks, and everyone hit their number every single one.` : `${cap(word(counted.length))} weeks, and everyone hit their number in ${word(kept)} of them.`);
    else out.push(counted.length ? `Everyone's hit their number in ${word(kept)} of ${word(counted.length)} weeks so far.` : "The first week isn't done yet.");
  } else {
    if (stats.ended) out.push(all ? `${stats.totalDays} days, and everyone kept it every single one.` : `${stats.totalDays} days, and everyone kept it on ${kept} of them.`);
    else
      out.push(
        counted.length
          ? `${stats.dayNumber} days in, ${stats.daysLeft} to go. Everyone's kept it on ${kept} of ${counted.length} days so far.`
          : "Day one. Nothing's done yet.",
      );
  }

  const run = bestRun(g);
  const label = (k: string) => (weekly ? `the week of ${shortDay(k)}` : shortDay(k));
  if (run.len >= 2 && !all) {
    const live = !stats.ended && stats.groupStreak === run.len;
    out.push(
      live
        ? `The best run is the one going right now, ${run.len} ${unit}s and counting.`
        : weekly
          ? `The best run was ${run.len} weeks straight, starting ${label(run.from)}.`
          : `The best run was ${run.len} days straight, ${label(run.from)} to ${label(run.to)}.`,
    );
  } else if (run.len < 2 && counted.length >= 4) out.push(`The group never put two clean ${unit}s together.`);

  if (people.length > 1 && !all) {
    const ranked = people.filter((p) => p.s.decided).sort((a, b) => b.s.kept / b.s.decided - a.s.kept / a.s.decided);
    const perfect = ranked.filter((p) => p.s.kept === p.s.decided);
    if (perfect.length) out.push(`${joinAnd(perfect.map((p) => names[p.userId]))} never missed${weekly ? " a week" : ""}.`);
    else if (ranked[0]) out.push(`${names[ranked[0].userId]} was the most solid, ${ranked[0].s.kept} of ${ranked[0].s.decided} ${unit}s kept.`);
  }

  if (stats.potCents > 0) {
    const top = [...people].sort((a, b) => b.s.owedCents - a.s.owedCents)[0];
    const share = top ? top.s.owedCents / stats.potCents : 0;
    let line = `${money(stats.potCents)} ${stats.ended ? "went in" : "is in"} the pot`;
    if (people.length > 1 && share === 1) line += `, all of it from ${names[top.userId]}`;
    else if (people.length > 1 && share >= 0.5) line += `, ${money(top.s.owedCents)} of it from ${names[top.userId]}`;
    out.push(line + ".");
  } else if (counted.length) out.push("Not a cent in the pot.");

  if (pet.stage === 0) out.push(stats.ended ? `${pet.name} never hatched.` : `${pet.name} hasn't hatched yet.`);
  else out.push(stats.ended ? `${pet.name} grew into a ${pet.stageName}.` : `${pet.name} is a ${pet.stageName} so far.`);
  return out;
}

/** One line per person for "How everyone did". */
export function personLine(pact: Pact, s: MemberStats, doubtsWon: number): string {
  const unit = pact.goal_type === "weekly" ? "week" : "day";
  if (!s.decided) return s.active ? "Nothing's done yet." : `Starts ${shortDay(s.startsOn)}.`;
  const parts: string[] = [];
  const verb = unit === "week" ? "Hit the number" : "Kept it";
  let first =
    s.kept === s.decided
      ? s.decided === 1
        ? `${verb} the one ${unit} so far.`
        : `${verb} all ${s.decided} ${unit}s.`
      : `${verb} ${s.kept} of ${s.decided} ${unit}s.`;
  if (s.bestStreak >= 3 && s.kept !== s.decided) first = `${first.slice(0, -1)}, longest run ${s.bestStreak}.`;
  parts.push(first);
  const bits: string[] = [];
  if (s.confessions) bits.push(`owned up ${times(s.confessions)}`);
  if (s.autoMisses) bits.push(`missed ${s.autoMisses === 1 ? "a check-in" : `${s.autoMisses} check-ins`}`);
  if (s.doubtMisses) bits.push(`got caught ${times(s.doubtMisses)}`);
  if (s.comebacks) bits.push(`came back the next day ${times(s.comebacks)}`);
  if (doubtsWon) bits.push(`caught ${doubtsWon === 1 ? "a fib" : `${doubtsWon} fibs`}`);
  if (bits.length) parts.push(`${cap(joinAnd(bits))}.`);
  parts.push(s.owedCents ? `Owes ${money(s.owedCents)}.` : "Owes nothing.");
  return parts.join(" ");
}

/* ------------------------------------------------------------------ */
/* Confessions worth quoting                                            */
/* ------------------------------------------------------------------ */
export type Quote = { id: string; text: string; who: Profile; day: string; reacts: { e: string; n: number }[]; total: number };

export function collectQuotes(checkins: Checkin[], reactions: Reaction[], members: Member[], from: string, to: string, limit: number): Quote[] {
  const byId = new Map(members.map((m) => [m.user_id, m.profile]));
  return checkins
    .filter((c) => c.status === "broke" && c.note?.trim() && c.day >= from && c.day <= to && byId.has(c.user_id))
    .map((c) => {
      const mine = reactions.filter((r) => r.checkin_id === c.id);
      const counts = new Map<string, number>();
      for (const r of mine) counts.set(r.emoji, (counts.get(r.emoji) ?? 0) + 1);
      const reacts = [...counts].map(([e, n]) => ({ e, n })).sort((a, b) => b.n - a.n).slice(0, 3);
      return { id: c.id, text: c.note!.trim(), who: byId.get(c.user_id)!, day: c.day, reacts, total: mine.length };
    })
    .sort((a, b) => b.total - a.total || (a.day < b.day ? 1 : -1))
    .slice(0, limit);
}

