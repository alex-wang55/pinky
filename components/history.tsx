"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "@/lib/supabase";
import { loadBundle, type Bundle } from "@/lib/data";
import { computePact, effectiveStatus, type MemberStats, type PactStats } from "@/lib/stats";
import { addDays, localTz, shortDay, todayIn, weekStart } from "@/lib/dates";
import { money } from "@/lib/money";
import { collectQuotes, type Quote } from "@/lib/wrap-story";
import type { Pact } from "@/lib/types";
import { PactIcon } from "./pact-icon";
import { Notes } from "./wrap-bits";
import { IconArrowRight } from "./icons";
import { Button, cx } from "./ui";

type DayMark = "kept" | "broke" | "off" | "pending";
export type TrackRecord = {
  days: Map<string, DayMark>;
  today: string;
  kept: number;
  decided: number;
  longest: number;
  past: { pact: Pact; s: MemberStats; stats: PactStats }[];
  confessions: Quote[];
};

/** Everything the Me page needs about your track record, across every pact you're in. */
export function useHistory(userId: string) {
  const [b, setB] = useState<Bundle | null>(null);

  useEffect(() => {
    (async () => {
      const { data } = await supabase.from("pact_members").select("pact_id").eq("user_id", userId).eq("status", "active");
      setB(await loadBundle((data ?? []).map((m) => m.pact_id as string), true));
    })().catch(() => setB({ pacts: [], members: [], checkins: [], doubts: [], reactions: [], hypes: [] }));
  }, [userId]);

  return useMemo<TrackRecord | null>(() => {
    if (!b) return null;
    const now = Date.now();
    const today = todayIn(localTz());
    const days = new Map<string, DayMark>();
    const rank: Record<DayMark, number> = { pending: 0, off: 1, kept: 2, broke: 3 };
    const mark = (d: string, m: DayMark) => {
      const cur = days.get(d);
      if (!cur || rank[m] > rank[cur]) days.set(d, m);
    };
    const past: TrackRecord["past"] = [];

    for (const pact of b.pacts) {
      const members = b.members.filter((m) => m.pact_id === pact.id);
      const checkins = b.checkins.filter((c) => c.pact_id === pact.id);
      const doubts = b.doubts.filter((d) => d.pact_id === pact.id);
      const stats = computePact(pact, members, checkins, doubts, now);
      const s = stats.members[userId];
      if (!s) continue;
      if (pact.goal_type === "weekly") {
        for (const c of checkins) if (c.user_id === userId && effectiveStatus(c, doubts, now).status === "kept") mark(c.day, "kept");
      } else {
        for (const [d, st] of Object.entries(s.days)) mark(d, st);
      }
      if (stats.ended) past.push({ pact, s, stats });
    }

    // Totals and longest run, counting days you had at least one pact going.
    let kept = 0;
    let decided = 0;
    let run = 0;
    let longest = 0;
    const sorted = [...days.keys()].sort();
    let prev = "";
    for (const d of sorted) {
      const m = days.get(d)!;
      if (prev && addDays(prev, 1) !== d) run = 0;
      if (m === "kept" || m === "off") {
        run++;
        longest = Math.max(longest, run);
      } else if (m === "broke") run = 0;
      if (m === "kept") kept++;
      if (m === "kept" || m === "broke") decided++;
      prev = d;
    }

    const mine = b.checkins.filter((c) => c.user_id === userId);
    const confessions = collectQuotes(mine, b.reactions, b.members.filter((m) => m.user_id === userId), "0000-01-01", "9999-12-31", 50).sort((x, y) => (x.day < y.day ? 1 : -1));
    past.sort((x, y) => (x.pact.end_date < y.pact.end_date ? 1 : -1));
    return { days, today, kept, decided, longest, past, confessions };
  }, [b, userId]);
}

/* ------------------------------------------------------------------ */
const CELL = 11;
const GAP = 3;
const COLOR: Record<DayMark, string> = { kept: "bg-kept", broke: "bg-broke", off: "bg-off", pending: "bg-surface-2 ring-1 ring-inset ring-pink" };
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/** A year of check-ins, one square per day, newest on the right. */
export function YearGrid({ h }: { h: TrackRecord }) {
  const ref = useRef<HTMLDivElement>(null);
  const last = weekStart(h.today);
  const first = addDays(last, -7 * 52);
  const weeks: string[] = [];
  for (let w = first; w <= last; w = addDays(w, 7)) weeks.push(w);

  useEffect(() => {
    if (ref.current) ref.current.scrollLeft = ref.current.scrollWidth;
  }, []);

  const label = (d: string, m?: DayMark) => `${shortDay(d)}: ${m === "kept" ? "kept it" : m === "broke" ? "broke it" : m === "off" ? "off-day" : m === "pending" ? "not in yet" : "no pact"}`;

  return (
    <div ref={ref} className="no-scrollbar overflow-x-auto">
      <div className="inline-flex flex-col" style={{ gap: GAP }}>
        <div className="flex pl-5" style={{ gap: GAP }} aria-hidden="true">
          {(() => {
            // Label a column when its month starts, as long as there's room since the last label.
            let lastAt = -9;
            return weeks.map((w, i) => {
              const mo = Number(w.slice(5, 7)) - 1;
              const changed = i === 0 || Number(weeks[i - 1].slice(5, 7)) - 1 !== mo;
              const show = changed && i - lastAt >= 3 && i < weeks.length - 2 && !(i === 0 && Number(weeks[1].slice(5, 7)) - 1 !== mo) && !(i === 0 && Number(addDays(w, 7 * 2).slice(5, 7)) - 1 !== mo);
              if (show) lastAt = i;
              return (
                <span key={w} className="relative h-3 text-[10px] leading-3 text-muted" style={{ width: CELL }}>
                  {show ? <span className="absolute left-0 whitespace-nowrap">{MONTHS[mo]}</span> : null}
                </span>
              );
            });
          })()}
        </div>
        {[0, 1, 2, 3, 4, 5, 6].map((dow) => (
          <div key={dow} className="flex items-center" style={{ gap: GAP }}>
            <span className="w-4 shrink-0 text-[9px] leading-none text-muted" aria-hidden="true">
              {dow === 0 ? "M" : dow === 2 ? "W" : dow === 4 ? "F" : ""}
            </span>
            {weeks.map((w) => {
              const d = addDays(w, dow);
              const m = h.days.get(d);
              const future = d > h.today;
              return (
                <span
                  key={d}
                  title={future ? undefined : label(d, m)}
                  className={cx("shrink-0 rounded-[3px]", future ? "opacity-0" : m ? COLOR[m] : "bg-surface-2")}
                  style={{ width: CELL, height: CELL }}
                />
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
}

export function HistorySummary({ h }: { h: TrackRecord }) {
  if (!h.decided) return <p className="text-sm text-muted">Nothing yet. Your check-ins land here as you go.</p>;
  const pct = Math.round((h.kept / h.decided) * 100);
  return (
    <p className="text-sm">
      You&apos;ve kept it on <b>{h.kept}</b> of {h.decided} days, so {pct}%. Your longest run is <b>{h.longest}</b> {h.longest === 1 ? "day" : "days"}.
    </p>
  );
}

export function PastPacts({ h }: { h: TrackRecord }) {
  if (!h.past.length) return <p className="px-1 text-sm text-muted">Finished pacts show up here with how you did.</p>;
  return (
    <div className="space-y-2">
      {h.past.map(({ pact, s, stats }) => (
        <Link key={pact.id} href={`/pacts/${pact.id}/recap`} className="flex items-center gap-3 rounded-2xl bg-surface p-3 shadow-card ring-1 ring-line transition hover:ring-pink/30">
          <PactIcon emoji={pact.emoji} size={40} />
          <span className="min-w-0 flex-1">
            <span className="block truncate font-semibold">{pact.name}</span>
            <span className="block text-xs text-muted">
              {stats.unit === "week" ? `Hit it ${s.kept} of ${s.decided} weeks` : `Kept it ${s.kept} of ${s.decided} days`} · {s.owedCents ? `owed ${money(s.owedCents)}` : "owed nothing"}
            </span>
          </span>
          <IconArrowRight size={16} className="shrink-0 text-muted" />
        </Link>
      ))}
    </div>
  );
}

export function MyConfessions({ h }: { h: TrackRecord }) {
  const [all, setAll] = useState(false);
  if (!h.confessions.length) return <p className="px-1 text-sm text-muted">Nothing to confess. Yet.</p>;
  const shown = all ? h.confessions : h.confessions.slice(0, 4);
  return (
    <div>
      <Notes items={shown} when={(d) => shortDay(d)} />
      {h.confessions.length > 4 ? (
        <div className="mt-4 text-center">
          <Button size="sm" variant="soft" onClick={() => setAll((v) => !v)}>
            {all ? "Show fewer" : `Show all ${h.confessions.length}`}
          </Button>
        </div>
      ) : null}
    </div>
  );
}

