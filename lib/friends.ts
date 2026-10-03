import type { Bundle } from "./data";
import type { Pact } from "./types";
import { computePact, type MemberStats, type PactStats } from "./stats";

/*
 * What the Friends tab can say about each friend. Everything here comes from
 * pacts you share with them, since that's all you can see.
 */

export type Shared = { pact: Pact; s: MemberStats; stats: PactStats; nudgeable: boolean };
export type FriendInfo = {
  shared: Shared[];
  streak: number; // best current streak across shared pacts that are still going
  today: "in" | "slipped" | "pending" | "none";
};

export function statsFor(b: Bundle, now = Date.now()): Record<string, PactStats> {
  const out: Record<string, PactStats> = {};
  for (const p of b.pacts) {
    out[p.id] = computePact(
      p,
      b.members.filter((m) => m.pact_id === p.id),
      b.checkins.filter((c) => c.pact_id === p.id),
      b.doubts.filter((d) => d.pact_id === p.id),
      now,
    );
  }
  return out;
}

/** `nudged` holds "pactId|userId" for nudges you've already sent today. */
export function friendInfo(b: Bundle, stats: Record<string, PactStats>, me: string, friend: string, nudged: Set<string>): FriendInfo {
  const shared: Shared[] = [];
  for (const p of b.pacts) {
    const active = (u: string) => b.members.some((m) => m.pact_id === p.id && m.user_id === u && m.status === "active");
    const both = active(me) && active(friend);
    const st = stats[p.id];
    const s = st?.members[friend];
    if (!both || !st || !s) continue;
    const nudgeable = !st.ended && s.active && s.today === "pending" && !nudged.has(`${p.id}|${friend}`);
    shared.push({ pact: p, s, stats: st, nudgeable });
  }
  // Pacts still going first, then by name.
  shared.sort((x, y) => Number(x.stats.ended) - Number(y.stats.ended) || x.pact.name.localeCompare(y.pact.name));

  const live = shared.filter((x) => !x.stats.ended && x.s.active);
  const daily = live.filter((x) => x.pact.goal_type !== "weekly");
  const streak = live.reduce((a, x) => Math.max(a, x.s.streak), 0);
  let today: FriendInfo["today"] = "none";
  if (daily.length) {
    if (daily.some((x) => x.s.today === "pending")) today = "pending";
    else if (daily.some((x) => x.s.today === "broke")) today = "slipped";
    else today = "in";
  }
  return { shared, streak, today };
}

export type BoardRow = { userId: string; kept: number; decided: number };

/**
 * Days kept this month, for you and each friend. Yours counts every daily pact
 * you're in; a friend's counts only the daily pacts you share with them.
 */
export function monthBoard(b: Bundle, stats: Record<string, PactStats>, me: string, friends: string[], today: string): BoardRow[] {
  const monthStart = today.slice(0, 8) + "01";
  const activeIn = (pactId: string, user: string) => b.members.some((m) => m.pact_id === pactId && m.user_id === user && m.status === "active");
  const tally = (user: string, pacts: Pact[]): BoardRow => {
    let kept = 0;
    let decided = 0;
    for (const p of pacts) {
      if (p.goal_type === "weekly") continue;
      const s = stats[p.id]?.members[user];
      if (!s) continue;
      for (const [d, st] of Object.entries(s.days)) {
        if (d < monthStart || d > today) continue;
        if (st === "kept") kept++;
        if (st === "kept" || st === "broke") decided++;
      }
    }
    return { userId: user, kept, decided };
  };
  const mine = b.pacts.filter((p) => activeIn(p.id, me));
  const rows = [tally(me, mine), ...friends.map((f) => tally(f, mine.filter((p) => activeIn(p.id, f))))];
  return rows
    .filter((r) => r.decided > 0)
    .sort((x, y) => y.kept / y.decided - x.kept / x.decided || y.kept - x.kept);
}
