"use client";

import Link from "next/link";
import { useMemo } from "react";
import { PageLoader } from "@/components/ui";
import { Pet, petState } from "@/components/pet";
import { IconArrowLeft, IconArrowRight } from "@/components/icons";
import {
  Heading,
  Legend,
  Notes,
  Receipt,
  Superlatives,
  WeekChart,
  dayMark,
  leaders,
  type ChartRow,
  type MarkKind,
  type ReceiptLine,
  type Superlative,
} from "@/components/wrap-bits";
import type { Bundle } from "@/lib/data";
import { computePact, effectiveStatus, weekSummary, wrapWeek, type WeekMember } from "@/lib/stats";
import { collectQuotes, firstName, times, weekStory, weekday } from "@/lib/wrap-story";
import { addDays, eachDay, shortDay, weekStart } from "@/lib/dates";
import { PactGlyph, pactTint } from "@/components/pact-icon";

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
    const people = b.members.filter((m) => m.status === "active" && stats.members[m.user_id]);
    const names = Object.fromEntries(people.map((m) => [m.user_id, firstName(m.profile)]));
    const latest = ws >= addDays(weekStart(stats.today), -7);
    const story = weekStory({ pact, stats, sum, names, latest });
    const quotes = collectQuotes(b.checkins, b.reactions, people, sum.from, sum.to, 4);
    return { pact, stats, ws, first, last, sum, people, names, story, quotes, now, pet: petState(pact, stats) };
  }, [b, asked]);

  if (!data) return <PageLoader />;
  const { pact, stats, ws, first, last, sum, people, names, story, quotes, now, pet } = data;
  const weekly = pact.goal_type === "weekly";
  const byUser = Object.fromEntries(sum.members.map((m) => [m.userId, m]));
  const profileOf = (id: string) => people.find((m) => m.user_id === id)!.profile;

  // The pet reflects how that week went, not how today is going.
  const ratio = weekly
    ? sum.members.filter((m) => m.target > 0 && m.logged >= m.target).length / Math.max(1, sum.members.length)
    : sum.countedDays
      ? sum.perfectDays / sum.countedDays
      : 0;
  const weekMood = !sum.complete ? pet.mood : ratio >= 0.7 ? "happy" : ratio >= 0.4 ? "waiting" : "sad";

  /* chart */
  const days = eachDay(ws, addDays(ws, 6));
  const inRange = (d: string) => d >= sum.from && d <= sum.to;
  const heads = days.map((d) => ({ key: d, label: weekday(d, true).slice(0, 1), faint: !inRange(d) }));
  const seen = new Set<MarkKind>();
  let anyHalf = false;
  const rows: ChartRow[] = people.map((m) => {
    const s = stats.members[m.user_id];
    const w = byUser[m.user_id];
    const cells = days.map((d) => {
      let kind: MarkKind = "blank";
      let half = false;
      if (!inRange(d)) kind = "blank";
      else if (weekly) {
        const logged = b.checkins.some((c) => c.user_id === m.user_id && c.day === d && effectiveStatus(c, b.doubts, now).status === "kept");
        kind = logged ? "kept" : d <= stats.today && d >= s.startsOn ? "open" : "blank";
      } else ({ kind, half } = dayMark(s, d));
      seen.add(kind);
      if (half) anyHalf = true;
      return { key: d, kind, half, label: weekday(d) };
    });
    const tally = weekly ? `${w.logged}/${w.target}` : `${w.kept + w.off}/${w.kept + w.broke + w.off}`;
    const done = weekly ? w.target > 0 && w.logged >= w.target : w.broke === 0 && w.kept + w.off > 0;
    return { id: m.user_id, profile: m.profile, cells, tally, done };
  });
  if (weekly) seen.delete("open");

  /* pot receipt */
  const lines: ReceiptLine[] = [];
  if (weekly) {
    for (const m of people) {
      const ms = stats.members[m.user_id].misses.filter((x) => x.day === ws);
      if (ms.length) lines.push({ left: names[m.user_id], mid: `${ms.length} short`, cents: ms.reduce((a, x) => a + x.cents, 0) });
    }
  } else {
    const items = people
      .flatMap((m) => stats.members[m.user_id].misses.filter((x) => inRange(x.day)).map((x) => ({ x, name: names[m.user_id] })))
      .sort((a, b2) => (a.x.day < b2.x.day ? -1 : a.x.day > b2.x.day ? 1 : a.name.localeCompare(b2.name)));
    for (const { x, name } of items) {
      const what = x.kind === "auto" ? "no check-in" : x.kind === "doubt" ? "lost doubt" : pact.goal_type === "count" ? "short" : "broke it";
      lines.push({ left: weekday(x.day, true), mid: `${name}, ${what}`, cents: x.fullCents ?? x.cents });
      if (x.comeback && x.fullCents) lines.push({ left: "", mid: "comeback, half off", cents: x.fullCents - x.cents, minus: true, sub: true });
    }
  }
  const foot = [pact.pot_destination ? `Goes to: ${pact.pot_destination}` : "", "Thanks for being honest."].filter(Boolean);

  /* superlatives */
  const score = (m: WeekMember) => (weekly ? (m.target ? m.logged / m.target : 0) : m.kept + m.broke ? m.kept / (m.kept + m.broke) : 0);
  const awards: Superlative[] = [];
  const add = (title: string, who: WeekMember[] | null, why: (m: WeekMember) => string) => {
    if (who) awards.push({ title, who: who.map((m) => profileOf(m.userId)), why: why(who[0]) });
  };
  add("Carried the group", leaders(sum.members, score, 0.01, false), (m) =>
    weekly ? `${m.logged} session${m.logged === 1 ? "" : "s"}` : m.broke === 0 ? "didn't miss a day" : `kept it ${m.kept} of ${m.kept + m.broke} days`,
  );
  add("Bounced back", leaders(sum.members, (m) => m.comebacks), (m) => `came back the next day ${times(m.comebacks)}`);
  add("Most honest", leaders(sum.members, (m) => m.confessions), (m) => `owned up ${times(m.confessions)}`);
  add("Went quiet", leaders(sum.members, (m) => m.ghosts), (m) => (m.ghosts === 1 ? "missed a check-in" : `missed ${m.ghosts} check-ins`));

  const thisWeek = ws === weekStart(stats.today) && !stats.ended;

  return (
    <div className="lg:grid lg:grid-cols-2 lg:items-start lg:gap-10">
      <div>
      <div className="mb-5 flex items-center justify-between px-1 text-sm">
        {ws > first ? (
          <Link href={`/pacts/${pact.id}/week?w=${addDays(ws, -7)}`} className="flex items-center gap-1 font-semibold text-muted hover:text-ink">
            <IconArrowLeft size={16} /> Earlier
          </Link>
        ) : (
          <span />
        )}
        <span className="text-muted">
          {shortDay(sum.from)} to {shortDay(sum.to)}
        </span>
        {ws < last ? (
          <Link href={`/pacts/${pact.id}/week?w=${addDays(ws, 7)}`} className="flex items-center gap-1 font-semibold text-muted hover:text-ink">
            Later <IconArrowRight size={16} />
          </Link>
        ) : (
          <span />
        )}
      </div>

      <div className="flex items-end gap-2 px-1">
        <Pet stage={pet.stage} mood={weekMood} size={76} />
        <div className="min-w-0 pb-2">
          <p className="flex items-center gap-1.5 truncate text-sm text-muted">
            <PactGlyph emoji={pact.emoji} size={15} className={pactTint(pact.emoji)} />
            {pact.name}
          </p>
          <h1 className="font-display text-[28px] font-bold leading-tight">{thisWeek ? "This week so far" : `Week of ${shortDay(ws)}`}</h1>
        </div>
      </div>
      <p className="mt-3 px-1 text-[17px] leading-relaxed">{story.join(" ")}</p>

      <Heading>Day by day</Heading>
      <WeekChart heads={heads} rows={rows} />
      <Legend
        kinds={[...seen]}
        labels={weekly ? { kept: "logged a session" } : undefined}
        extra={
          anyHalf ? (
            <span className="flex items-center gap-1">
              <b className="text-[11px]">½</b> came back next day
            </span>
          ) : weekly ? (
            <span>{pact.target}x a week each</span>
          ) : null
        }
      />

      </div>

      <div className="lg:[&>*:first-child]:mt-0 lg:[&>*:first-child>*:first-child]:mt-0">
      {quotes.length ? (
        <>
          <Heading>In their own words</Heading>
          <Notes items={quotes} when={(d) => weekday(d)} />
        </>
      ) : null}

      <Heading>The pot</Heading>
      <Receipt
        head={[`Week of ${shortDay(ws)}`, pact.name]}
        lines={lines}
        totalLabel={sum.complete ? "TOTAL" : "SO FAR"}
        total={sum.potCents}
        empty={sum.complete ? "Nothing owed. Clean week." : "Nothing owed yet."}
        foot={foot}
        seed={pact.id + ws}
      />

      {awards.length ? (
        <>
          <Heading>Superlatives</Heading>
          <Superlatives items={awards} />
        </>
      ) : null}

      {thisWeek ? <p className="mt-10 text-center text-sm text-muted">This week wraps up Sunday.</p> : null}
      </div>
    </div>
  );
}
