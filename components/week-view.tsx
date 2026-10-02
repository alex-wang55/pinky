"use client";

import Link from "next/link";
import { useMemo } from "react";
import { Avatar, Card, PageLoader, cx } from "@/components/ui";
import { Pet, petState } from "@/components/pet";
import { IconArrowLeft, IconArrowRight, IconFlag, IconGhost, IconRebound, IconTrophy } from "@/components/icons";
import type { Bundle } from "@/lib/data";
import { computePact, weekSummary, wrapWeek, type WeekMember } from "@/lib/stats";
import { addDays, shortDay, weekStart } from "@/lib/dates";
import { money } from "@/lib/money";

export function WeekView({ b, asked }: { b: Bundle; asked: string | null }) {
  const data = useMemo(() => {
    if (!b || !b.pacts[0]) return null;
    const pact = b.pacts[0];
    const now = Date.now();
    const stats = computePact(pact, b.members, b.checkins, b.doubts, now);
    const first = weekStart(pact.start_date);
    const last = weekStart(stats.ended ? pact.end_date : stats.today);
    let ws = asked && /^\d{4}-\d{2}-\d{2}$/.test(asked) ? weekStart(asked) : wrapWeek(stats.today);
    if (ws < first) ws = first;
    if (ws > last) ws = last;
    const sum = weekSummary(pact, stats, b.checkins, b.doubts, ws, now);
    const byId = Object.fromEntries(b.members.map((m) => [m.user_id, m]));
    return { pact, stats, ws, first, last, sum, byId, pet: petState(pact, stats) };
  }, [b, asked]);

  if (!data) return <PageLoader />;
  const { pact, stats, ws, first, last, sum, byId, pet } = data;
  const weekly = pact.goal_type === "weekly";
  // The header pet reflects how that week went, not how today is going.
  const ratio = weekly
    ? sum.members.filter((m) => m.target > 0 && m.logged >= m.target).length / Math.max(1, sum.members.length)
    : sum.countedDays
      ? sum.perfectDays / sum.countedDays
      : 0;
  const weekMood = !sum.complete ? pet.mood : ratio >= 0.7 ? "happy" : ratio >= 0.4 ? "waiting" : "sad";
  const score = (m: WeekMember) => (weekly ? (m.target ? m.logged / m.target : 0) : m.kept + m.broke ? m.kept / (m.kept + m.broke) : 0);
  const rows = [...sum.members].sort((x, y) => score(y) - score(x) || x.owedCents - y.owedCents);

  const top = <K extends keyof WeekMember>(k: K) => {
    const best = sum.members.reduce<WeekMember | null>((a, m) => (a === null || (m[k] as number) > (a[k] as number) ? m : a), null);
    return best && (best[k] as number) > 0 ? best : null;
  };
  const iron = rows[0] && score(rows[0]) > 0 ? rows[0] : null;
  const awards = [
    { Icon: IconTrophy, title: "Carried the group", who: iron, why: iron ? (weekly ? `${iron.logged}/${iron.target} sessions` : `${iron.kept} days kept`) : "" },
    { Icon: IconRebound, title: "Comeback kid", who: top("comebacks"), why: plural(top("comebacks")?.comebacks ?? 0, "comeback") },
    { Icon: IconFlag, title: "Most honest", who: top("confessions"), why: plural(top("confessions")?.confessions ?? 0, "confession") },
    { Icon: IconGhost, title: "The ghost", who: top("ghosts"), why: plural(top("ghosts")?.ghosts ?? 0, "no-show") },
  ].filter((a) => a.who);

  return (
    <div>
      <div className="mb-3 flex items-center justify-between px-1">
        {ws > first ? (
          <Link href={`/pacts/${pact.id}/week?w=${addDays(ws, -7)}`} className="flex items-center gap-1 text-sm font-semibold text-muted hover:text-ink">
            <IconArrowLeft size={16} /> Earlier
          </Link>
        ) : (
          <span />
        )}
        <span className="text-xs text-muted">{sum.complete ? "Week wrap" : "So far this week"}</span>
        {ws < last ? (
          <Link href={`/pacts/${pact.id}/week?w=${addDays(ws, 7)}`} className="flex items-center gap-1 text-sm font-semibold text-muted hover:text-ink">
            Later <IconArrowRight size={16} />
          </Link>
        ) : (
          <span />
        )}
      </div>

      <Card className="overflow-hidden">
        <div className="flex items-center gap-3 bg-pink-soft p-5">
          <Pet stage={pet.stage} mood={weekMood} size={84} />
          <div className="min-w-0 flex-1">
            <div className="text-xs font-bold uppercase tracking-wider text-pink">
              Week of {shortDay(ws)}
            </div>
            <h1 className="font-display text-2xl font-extrabold leading-tight">
              {pact.emoji} {pact.name}
            </h1>
            <p className="text-sm text-muted">
              {shortDay(sum.from)} to {shortDay(sum.to)}
            </p>
          </div>
        </div>
        <div className="grid grid-cols-3 divide-x divide-line border-y border-line">
          <Stat value={weekly ? `${sum.members.filter((m) => m.logged >= m.target && m.target > 0).length}/${sum.members.length}` : `${sum.perfectDays}/${sum.countedDays || 0}`} label={weekly ? "hit target" : "perfect days"} />
          <Stat value={money(sum.potCents)} label="into the pot" />
          <Stat value={String(stats.groupStreak)} label={`streak now`} />
        </div>

        <div className="space-y-3 p-5">
          {rows.map((m) => {
            const p = byId[m.userId]?.profile;
            const pct = Math.round(score(m) * 100);
            return (
              <div key={m.userId} className="flex items-center gap-3">
                <Avatar profile={p} size={36} />
                <div className="min-w-0 flex-1">
                  <div className="flex items-baseline justify-between gap-2">
                    <span className="truncate font-semibold">{p?.display_name}</span>
                    <span className="shrink-0 text-xs tabular text-muted">
                      {weekly ? `${m.logged}/${m.target} sessions` : `${m.kept} kept · ${m.broke} broke${m.off ? ` · ${m.off} off` : ""}`}
                    </span>
                  </div>
                  <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-surface-2">
                    <div className={cx("h-full rounded-full", pct >= 100 ? "bg-kept" : "bg-pink")} style={{ width: `${Math.min(100, pct)}%` }} />
                  </div>
                </div>
                <span className="w-12 shrink-0 text-right text-sm font-semibold tabular">{money(m.owedCents)}</span>
              </div>
            );
          })}
        </div>

        {awards.length ? (
          <div className="grid grid-cols-2 gap-2 px-5 pb-5">
            {awards.map((a) => (
              <div key={a.title} className="rounded-2xl bg-surface-2 p-3">
                <a.Icon size={20} className="text-pink" />
                <div className="mt-1 text-xs font-bold uppercase tracking-wide text-muted">{a.title}</div>
                <div className="font-semibold">{byId[a.who!.userId]?.profile.display_name}</div>
                <div className="text-xs text-muted">{a.why}</div>
              </div>
            ))}
          </div>
        ) : null}
      </Card>

      {!sum.complete ? <p className="mt-4 text-center text-sm text-muted">{pet.line}</p> : null}
    </div>
  );
}

function plural(n: number, word: string) {
  return `${n} ${word}${n === 1 ? "" : "s"}`;
}

function Stat({ value, label }: { value: string; label: string }) {
  return (
    <div className="px-2 py-3 text-center">
      <div className="font-display text-xl font-extrabold tabular">{value}</div>
      <div className="text-[10px] font-semibold uppercase tracking-wide text-muted">{label}</div>
    </div>
  );
}
