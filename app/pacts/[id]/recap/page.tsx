"use client";

import { useParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { Shell } from "@/components/shell";
import { Avatar, Card, PageLoader, useToast } from "@/components/ui";
import { LogoMark } from "@/components/logo";
import { errMsg } from "@/lib/supabase";
import { loadBundle, type Bundle } from "@/lib/data";
import { computePact, doubtExpired, goalLabel } from "@/lib/stats";
import { shortDay } from "@/lib/dates";
import { money } from "@/lib/money";
import { IconFlag, IconFlame, IconGhost, IconJar, IconSearch, IconTrophy } from "@/components/icons";

export default function RecapPage() {
  const { id } = useParams<{ id: string }>();
  return (
    <Shell title="Pact" back={`/pacts/${id}`}>
      <Recap id={id} />
    </Shell>
  );
}

function Recap({ id }: { id: string }) {
  const toast = useToast();
  const [b, setB] = useState<Bundle | null>(null);

  useEffect(() => {
    loadBundle([id], true).then(setB).catch((e) => toast(errMsg(e), "err"));
  }, [id, toast]);

  const data = useMemo(() => {
    if (!b || !b.pacts[0]) return null;
    const pact = b.pacts[0];
    const now = Date.now();
    const stats = computePact(pact, b.members, b.checkins, b.doubts, now);
    const people = b.members
      .filter((m) => m.status === "active" && stats.members[m.user_id])
      .map((m) => {
        const s = stats.members[m.user_id];
        const doubtsWon = b.doubts.filter(
          (d) => d.doubter_id === m.user_id && (d.status === "confessed" || doubtExpired(d, now)),
        ).length;
        const rate = s.decided ? s.kept / s.decided : 0;
        return { m, s, rate, doubtsWon };
      });

    const pick = <T,>(arr: T[], score: (x: T) => number, min = 1) => {
      const best = arr.reduce<T | null>((a, x) => (a === null || score(x) > score(a) ? x : a), null);
      return best && score(best) >= min ? best : null;
    };
    const awards = [
      { Icon: IconTrophy, title: "Iron will", who: pick(people, (p) => (p.s.decided ? p.rate : -1), 0), why: (p: (typeof people)[0]) => `${Math.round(p.rate * 100)}% kept` },
      { Icon: IconFlame, title: "Longest streak", who: pick(people, (p) => p.s.bestStreak), why: (p: (typeof people)[0]) => `${p.s.bestStreak} ${stats.unit}s` },
      { Icon: IconFlag, title: "Most honest", who: pick(people, (p) => p.s.confessions), why: (p: (typeof people)[0]) => `${p.s.confessions} confession${p.s.confessions === 1 ? "" : "s"}` },
      { Icon: IconSearch, title: "Detective", who: pick(people, (p) => p.doubtsWon), why: (p: (typeof people)[0]) => `${p.doubtsWon} doubt${p.doubtsWon === 1 ? "" : "s"} landed` },
      { Icon: IconGhost, title: "The ghost", who: pick(people, (p) => p.s.autoMisses), why: (p: (typeof people)[0]) => `${p.s.autoMisses} no-show${p.s.autoMisses === 1 ? "" : "s"}` },
      { Icon: IconJar, title: "Biggest donor", who: pick(people, (p) => p.s.owedCents), why: (p: (typeof people)[0]) => money(p.s.owedCents) },
    ].filter((a) => a.who);

    return { pact, stats, people: people.sort((x, y) => y.rate - x.rate || x.s.owedCents - y.s.owedCents), awards };
  }, [b]);

  if (!data) return <PageLoader />;
  const { pact, stats, people, awards } = data;

  return (
    <div>
      <p className="mb-3 px-1 text-center text-xs text-muted">{stats.ended ? "Final recap. Screenshot it." : "Recap so far. The pact's still going."}</p>
      <Card className="overflow-hidden">
        <div className="bg-pink px-5 pb-6 pt-5 text-pink-ink">
          <div className="flex items-center justify-between text-xs font-bold uppercase tracking-wider opacity-80">
            <span>Pinky recap</span>
            <span>
              {shortDay(pact.start_date)} to {shortDay(pact.end_date)}
            </span>
          </div>
          <div className="mt-4 text-5xl">{pact.emoji}</div>
          <h1 className="mt-1 font-display text-3xl font-extrabold leading-tight">{pact.name}</h1>
          <p className="text-sm opacity-80">{goalLabel(pact)}</p>
          <div className="mt-5 grid grid-cols-3 gap-2 text-center">
            <Big value={String(stats.bestGroupStreak)} label={`best group ${stats.unit}s`} />
            <Big value={`${stats.dayNumber}/${stats.totalDays}`} label="days in" />
            <Big value={money(stats.potCents)} label="in the pot" />
          </div>
          {pact.pot_destination ? <p className="mt-3 text-center text-sm">Pot goes to <b>{pact.pot_destination}</b></p> : null}
        </div>

        <div className="p-5">
          <div className="space-y-3">
            {people.map(({ m, s, rate }, i) => (
              <div key={m.user_id} className="flex items-center gap-3">
                <span className="w-5 text-center font-display font-bold text-muted">{i + 1}</span>
                <Avatar profile={m.profile} size={38} />
                <div className="min-w-0 flex-1">
                  <div className="truncate font-semibold">{m.profile.display_name}</div>
                  <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-surface-2">
                    <div className="h-full rounded-full bg-kept" style={{ width: `${Math.round(rate * 100)}%` }} />
                  </div>
                </div>
                <div className="text-right">
                  <div className="font-bold tabular">{Math.round(rate * 100)}%</div>
                  <div className="text-xs text-muted tabular">{money(s.owedCents)}</div>
                </div>
              </div>
            ))}
          </div>

          {awards.length ? (
            <div className="mt-6 grid grid-cols-2 gap-2">
              {awards.map((a) => (
                <div key={a.title} className="rounded-2xl bg-surface-2 p-3">
                  <a.Icon size={22} className="text-pink" />
                  <div className="mt-1 text-xs font-bold uppercase tracking-wide text-muted">{a.title}</div>
                  <div className="font-semibold">{a.who!.m.profile.display_name}</div>
                  <div className="text-xs text-muted">{a.why(a.who!)}</div>
                </div>
              ))}
            </div>
          ) : null}

          <div className="mt-6 flex items-center justify-center gap-2 text-sm text-muted">
            <LogoMark size={20} />
            <span className="font-display font-bold">pinky</span>
          </div>
        </div>
      </Card>
    </div>
  );
}

function Big({ value, label }: { value: string; label: string }) {
  return (
    <div className="rounded-2xl bg-white/15 px-2 py-2.5">
      <div className="font-display text-2xl font-extrabold tabular">{value}</div>
      <div className="text-[10px] font-semibold uppercase tracking-wide opacity-80">{label}</div>
    </div>
  );
}
