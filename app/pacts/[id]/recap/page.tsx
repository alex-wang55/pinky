"use client";

import { useParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { Shell } from "@/components/shell";
import { Avatar, PageLoader, useToast } from "@/components/ui";
import { LogoMark } from "@/components/logo";
import { Pet, petState } from "@/components/pet";
import {
  Calendar,
  Heading,
  Legend,
  Mark,
  Notes,
  Receipt,
  Superlatives,
  WeeksGrid,
  leaders,
  type CalCell,
  type MarkKind,
  type ReceiptLine,
  type Superlative,
} from "@/components/wrap-bits";
import { errMsg } from "@/lib/supabase";
import { loadBundle, type Bundle } from "@/lib/data";
import { computePact, doubtExpired, goalLabel } from "@/lib/stats";
import { collectQuotes, firstName, groupStates, personLine, recapStory, times } from "@/lib/wrap-story";
import { addDays, eachDay, minDay, shortDay, weekStart } from "@/lib/dates";
import { money } from "@/lib/money";

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
    const members = b.members.filter((m) => m.status === "active" && stats.members[m.user_id]);
    const people = members.map((m) => {
      const s = stats.members[m.user_id];
      const doubtsWon = b.doubts.filter((d) => d.doubter_id === m.user_id && (d.status === "confessed" || doubtExpired(d, now))).length;
      return { userId: m.user_id, m, s, doubtsWon, rate: s.decided ? s.kept / s.decided : 0 };
    });
    const names = Object.fromEntries(people.map((p) => [p.userId, firstName(p.m.profile)]));
    const pet = petState(pact, stats);
    const story = recapStory({ pact, stats, names, people, pet });
    const lastDay = minDay(stats.today, pact.end_date);
    const quotes = collectQuotes(b.checkins, b.reactions, members, pact.start_date, lastDay, 5);
    return { pact, stats, people, names, pet, story, quotes, lastDay };
  }, [b]);

  if (!data) return <PageLoader />;
  const { pact, stats, people, names, pet, story, quotes, lastDay } = data;
  const weekly = pact.goal_type === "weekly";
  const unit = stats.unit;

  /* the chart */
  const initials = initialMap(people.map((p) => ({ id: p.userId, name: names[p.userId] })));
  let chart: React.ReactNode = null;
  const seen = new Set<MarkKind>();
  if (!weekly) {
    const g = new Map(groupStates(stats, stats.started ? eachDay(pact.start_date, lastDay) : []).map((x) => [x.key, x]));
    const weeks: CalCell[][] = [];
    for (let w = weekStart(pact.start_date); w <= weekStart(pact.end_date); w = addDays(w, 7)) {
      weeks.push(
        eachDay(w, addDays(w, 6)).map((d): CalCell => {
          const dom = Number(d.slice(8));
          const num = dom === 1 || d === pact.start_date ? shortDay(d) : String(dom);
          if (d < pact.start_date || d > pact.end_date) return { day: d, num, kind: "out", who: [] };
          if (d > stats.today) return { day: d, num, kind: "future", who: [] };
          const x = g.get(d);
          if (!x || x.state === "none") return { day: d, num, kind: "none", who: [] };
          if (x.state === "pending") return { day: d, num, kind: "open", who: [] };
          if (x.state === "kept") return { day: d, num, kind: "kept", who: [] };
          return {
            day: d,
            num,
            kind: "broke",
            who: x.broke.map((uid) => ({ initial: initials[uid], color: people.find((p) => p.userId === uid)!.m.profile.color, name: names[uid] })),
          };
        }),
      );
    }
    chart = (
      <>
        <Calendar weeks={weeks} />
        <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 px-1 text-xs text-muted">
          <span className="flex items-center gap-1">
            <Mark kind="kept" seed="legend" size={16} /> everyone kept it
          </span>
          <span>letters are whoever slipped that day</span>
        </div>
      </>
    );
  } else {
    const keys: string[] = [];
    if (stats.started) for (let w = weekStart(pact.start_date); w <= weekStart(lastDay); w = addDays(w, 7)) keys.push(w);
    const rows = keys.map((w) => ({
      key: w,
      label: shortDay(w),
      cells: people.map((p) => {
        const st = p.s.days[w];
        const kind: MarkKind = st === "kept" ? "kept" : st === "broke" ? "broke" : st === "pending" ? "open" : "blank";
        seen.add(kind);
        return { id: p.userId, kind, label: names[p.userId] };
      }),
    }));
    chart = (
      <>
        <WeeksGrid people={people.map((p) => ({ id: p.userId, profile: p.m.profile }))} rows={rows} />
        <Legend kinds={[...seen]} labels={{ kept: "hit the number", broke: "came up short" }} extra={<span>{goalLabel(pact)} each</span>} />
      </>
    );
  }

  /* receipt */
  const lines: ReceiptLine[] = [];
  for (const p of [...people].sort((a, c) => c.s.owedCents - a.s.owedCents)) {
    const full = p.s.misses.reduce((a, x) => a + (x.fullCents ?? x.cents), 0);
    const n = p.s.misses.length;
    lines.push({ left: names[p.userId], mid: !n ? "clean" : weekly ? `${n} short` : `${n} miss${n === 1 ? "" : "es"}`, cents: full });
    if (full > p.s.owedCents) lines.push({ left: "", mid: `${p.s.comebacks} comeback${p.s.comebacks === 1 ? "" : "s"}, half off`, cents: full - p.s.owedCents, minus: true, sub: true });
  }
  const foot = [pact.pot_destination ? `Goes to: ${pact.pot_destination}` : "", stats.ended ? "Settle up." : "Still counting."].filter(Boolean);

  /* superlatives */
  type P = (typeof people)[number];
  const awards: Superlative[] = [];
  const add = (title: string, who: P[] | null, why: (p: P) => string) => {
    if (who) awards.push({ title, who: who.map((p) => p.m.profile), why: why(who[0]) });
  };
  if (people.length > 1) {
    add("Most likely to keep a promise", leaders(people.filter((p) => p.s.decided), (p) => p.rate, 0.01, false), (p) =>
      p.rate === 1 ? "never missed" : `kept it ${Math.round(p.rate * 100)}% of the time`,
    );
    add("Longest run", leaders(people, (p) => p.s.bestStreak, 2), (p) => `${p.s.bestStreak} ${unit}s straight`);
    add("Best bounce back", leaders(people, (p) => p.s.comebacks), (p) => `came back the next day ${times(p.s.comebacks)}`);
    add("Most honest", leaders(people, (p) => p.s.confessions), (p) => `owned up ${times(p.s.confessions)}`);
    add("Sharpest eye", leaders(people, (p) => p.doubtsWon), (p) => `caught ${p.doubtsWon === 1 ? "a fib" : `${p.doubtsWon} fibs`}`);
    add("Hardest to reach", leaders(people, (p) => p.s.autoMisses), (p) => (p.s.autoMisses === 1 ? "missed a check-in" : `missed ${p.s.autoMisses} check-ins`));
    add("Biggest donor", leaders(people, (p) => p.s.owedCents), (p) => `${money(p.s.owedCents)} into the pot`);
  }

  const order = [...people].sort((a, c) => c.rate - a.rate || a.s.owedCents - c.s.owedCents);

  return (
    <div>
      <div className="flex items-end justify-between gap-2 px-1">
        <div className="min-w-0 pb-1">
          <p className="text-sm text-muted">{stats.ended ? "Final recap" : "Recap so far"}</p>
          <h1 className="mt-0.5 font-display text-[30px] font-extrabold leading-[1.1]">
            {pact.emoji} {pact.name}
          </h1>
        </div>
        <Pet stage={pet.stage} mood={stats.ended ? "sleeping" : pet.mood} size={76} />
      </div>
      <p className="mt-1 px-1 text-sm text-muted">
        {shortDay(pact.start_date)} to {shortDay(pact.end_date)}. {goalLabel(pact)}, {money(pact.stake_cents)} a miss
        {pact.escalating ? " and it doubles" : ""}.
      </p>
      <p className="mt-4 px-1 text-[17px] leading-relaxed">{story.join(" ")}</p>

      {stats.started ? (
        <>
          <Heading>{weekly ? "Week by week" : "The whole calendar"}</Heading>
          {chart}
        </>
      ) : null}

      <Heading>How everyone did</Heading>
      <div className="space-y-4 px-1">
        {order.map((p) => (
          <div key={p.userId} className="flex gap-3">
            <Avatar profile={p.m.profile} size={34} />
            <div className="min-w-0 flex-1">
              <div className="font-semibold">{p.m.profile.display_name}</div>
              <p className="text-[15px] leading-snug text-muted">{personLine(pact, p.s, p.doubtsWon)}</p>
            </div>
          </div>
        ))}
      </div>

      {quotes.length ? (
        <>
          <Heading>In their own words</Heading>
          <Notes items={quotes} when={(d) => shortDay(d)} />
        </>
      ) : null}

      <Heading>The pot</Heading>
      <Receipt
        head={[pact.name, `${shortDay(pact.start_date)} to ${shortDay(pact.end_date)}`]}
        lines={lines}
        totalLabel={stats.ended ? "TOTAL" : "SO FAR"}
        total={stats.potCents}
        empty="Nobody's in yet."
        foot={foot}
        seed={pact.id}
      />

      {awards.length ? (
        <>
          <Heading>Superlatives</Heading>
          <Superlatives items={awards} />
        </>
      ) : null}

      <p className="mt-12 text-center text-sm text-muted">
        {stats.ended ? "That's the pact. Screenshot this for the group chat." : `Still going, ${stats.daysLeft} ${stats.daysLeft === 1 ? "day" : "days"} left.`}
      </p>
      <div className="mt-3 flex items-center justify-center gap-2 text-sm text-muted">
        <LogoMark size={18} />
        <span className="font-display font-bold">pinky</span>
      </div>
    </div>
  );
}

/** First letter of each name, or two letters where first letters clash. */
function initialMap(people: { id: string; name: string }[]): Record<string, string> {
  const out: Record<string, string> = {};
  for (const p of people) {
    const one = p.name.charAt(0).toUpperCase();
    const clash = people.some((q) => q.id !== p.id && q.name.charAt(0).toUpperCase() === one);
    out[p.id] = clash ? p.name.slice(0, 2).charAt(0).toUpperCase() + p.name.slice(1, 2).toLowerCase() : one;
  }
  return out;
}

