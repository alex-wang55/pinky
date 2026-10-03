"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { addDays, todayIn } from "@/lib/dates";
import { PactIcon } from "./pact-icon";
import { IconCheck, IconClock } from "./icons";
import { cx } from "./ui";

type SidePact = { id: string; name: string; emoji: string; timezone: string; pending: boolean; daily: boolean };

/** Seconds until midnight in a given timezone. */
function secondsToMidnight(tz: string, now = new Date()): number {
  const parts = new Intl.DateTimeFormat("en-US", { timeZone: tz, hour: "numeric", minute: "numeric", second: "numeric", hourCycle: "h23" }).formatToParts(now);
  const get = (t: string) => Number(parts.find((p) => p.type === t)?.value ?? 0);
  return 86400 - (get("hour") * 3600 + get("minute") * 60 + get("second"));
}

function left(sec: number) {
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}

/**
 * Sidebar extras on wider screens: your active pacts as quick links (with a dot
 * if you haven't checked in today) and a countdown to when check-ins close.
 */
export function SidebarPacts({ userId, path }: { userId: string; path: string }) {
  const [pacts, setPacts] = useState<SidePact[] | null>(null);
  const [, setTick] = useState(0);

  const load = useCallback(async () => {
    // The sidebar only shows on wider screens, so don't spend the queries on phones.
    if (!window.matchMedia("(min-width: 768px)").matches) return;
    const { data: mem } = await supabase.from("pact_members").select("pact_id, starts_on, status, hidden").eq("user_id", userId).eq("status", "active");
    const ids = (mem ?? []).map((m) => m.pact_id as string);
    if (!ids.length) return setPacts([]);
    const [{ data: ps }, { data: cs }] = await Promise.all([
      supabase.from("pacts").select("id, name, emoji, goal_type, timezone, start_date, end_date").in("id", ids),
      supabase.from("checkins").select("pact_id, day").eq("user_id", userId).gte("day", addDays(todayIn("UTC"), -2)),
    ]);
    const out: SidePact[] = [];
    for (const p of ps ?? []) {
      const today = todayIn(p.timezone);
      const m = (mem ?? []).find((x) => x.pact_id === p.id);
      const starts = (m?.starts_on as string | null) ?? p.start_date;
      if (today > p.end_date) continue; // finished pacts live on the home screen
      const running = today >= p.start_date && today >= starts;
      const daily = p.goal_type !== "weekly";
      const checked = (cs ?? []).some((c) => c.pact_id === p.id && c.day === today);
      out.push({ id: p.id, name: p.name, emoji: p.emoji, timezone: p.timezone, daily, pending: running && daily && !checked });
    }
    setPacts(out.sort((a, b) => Number(b.pending) - Number(a.pending) || a.name.localeCompare(b.name)));
  }, [userId]);

  useEffect(() => {
    load();
    const t = setInterval(() => setTick((n) => n + 1), 30_000);
    window.addEventListener("pinky:refresh", load);
    window.addEventListener("focus", load);
    const mq = window.matchMedia("(min-width: 768px)");
    mq.addEventListener("change", load);
    return () => {
      clearInterval(t);
      mq.removeEventListener("change", load);
      window.removeEventListener("pinky:refresh", load);
      window.removeEventListener("focus", load);
    };
  }, [load, path]);

  if (!pacts || pacts.length === 0) return null;
  const pending = pacts.filter((p) => p.pending);
  const soonest = pending.length ? Math.min(...pending.map((p) => secondsToMidnight(p.timezone))) : null;
  const hasDaily = pacts.some((p) => p.daily);

  return (
    <div className="mt-7 flex min-h-0 flex-1 flex-col">
      <p className="px-3 text-[11px] font-bold uppercase tracking-wider text-muted">Your pacts</p>
      <div className="mt-2 min-h-0 space-y-0.5 overflow-y-auto">
        {pacts.map((p) => {
          const here = path === `/pacts/${p.id}` || path.startsWith(`/pacts/${p.id}/`);
          return (
            <Link
              key={p.id}
              href={`/pacts/${p.id}`}
              className={cx("flex items-center gap-2.5 rounded-xl px-3 py-2 text-sm font-semibold transition", here ? "bg-surface-2 text-ink" : "text-muted hover:bg-surface-2 hover:text-ink")}
            >
              <PactIcon emoji={p.emoji} size={26} />
              <span className="min-w-0 flex-1 truncate">{p.name}</span>
              {p.pending ? <span className="h-2 w-2 shrink-0 rounded-full bg-pink" aria-label="Not checked in today" /> : null}
            </Link>
          );
        })}
      </div>

      {hasDaily ? (
        <div className={cx("mx-1 mt-4 rounded-2xl px-3 py-2.5 text-sm", soonest !== null ? "bg-pink-soft text-pink" : "bg-kept-soft text-kept")}>
          {soonest !== null ? (
            <p className="flex items-center gap-2 font-semibold">
              <IconClock size={16} className="shrink-0" />
              Check-ins close in {left(soonest)}
            </p>
          ) : (
            <p className="flex items-center gap-2 font-semibold">
              <IconCheck size={16} className="shrink-0" />
              Checked in everywhere today
            </p>
          )}
          {soonest !== null ? (
            <p className="mt-0.5 pl-6 text-xs opacity-80">
              {pending.length} {pending.length === 1 ? "pact is" : "pacts are"} waiting on you
            </p>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
