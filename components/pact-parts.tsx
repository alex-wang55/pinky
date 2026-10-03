"use client";

import { useMemo, useState } from "react";
import { supabase, errMsg } from "@/lib/supabase";
import { action } from "@/lib/api";
import type { Checkin, Doubt, Hype, Member, Pact, Reaction } from "@/lib/types";
import { DOUBT_WINDOW_MS, doubtExpired, effectiveStatus, streakMilestone, type PactStats } from "@/lib/stats";
import { addDays, prettyDay, shortDay, timeAgo, weekStart, todayIn } from "@/lib/dates";
import { money } from "@/lib/money";
import { Avatar, Button, StatusPill, cx, useToast } from "./ui";
import { ProofButton } from "./checkin";
import { IconCamera, IconClock, IconEmpty, IconEye, IconFlag, IconFlame, IconNudge, IconSmilePlus, IconSpark, IconX } from "./icons";

export const EMOJIS = ["😂", "🫡", "💀", "🫶", "😤", "🔥"];

/* ------------------------------------------------------------------ */
/* Squad: who's checked in today, with nudge buttons                   */
/* ------------------------------------------------------------------ */
export function Squad({
  pact,
  stats,
  members,
  userId,
  nudgedToday,
  hypes,
  onNudged,
}: {
  pact: Pact;
  stats: PactStats;
  members: Member[];
  userId: string;
  nudgedToday: Set<string>;
  hypes: Hype[];
  onNudged: () => void;
}) {
  const toast = useToast();
  const [busy, setBusy] = useState<string | null>(null);
  const active = members.filter((m) => m.status === "active");
  const invited = members.filter((m) => m.status === "invited");

  async function nudge(to: string, name: string) {
    setBusy(to);
    try {
      await action({ action: "nudge", pactId: pact.id, toUser: to });
      toast(`Nudged ${name}`);
      onNudged();
    } catch (e) {
      toast(errMsg(e), "err");
    } finally {
      setBusy(null);
    }
  }

  async function hype(to: string, name: string, streak: number) {
    setBusy(`h-${to}`);
    try {
      await action({ action: "hype", pactId: pact.id, toUser: to, streak, unit: stats.unit });
      toast(`Hyped ${name}`);
      onNudged();
    } catch (e) {
      toast(errMsg(e), "err");
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="divide-y divide-line">
      {active.map((m) => {
        const s = stats.members[m.user_id];
        if (!s) return null;
        const isMe = m.user_id === userId;
        const canNudge = !isMe && !stats.ended && s.active && s.today === "pending" && !nudgedToday.has(m.user_id);
        const milestone = streakMilestone(s.streak, stats.unit);
        const hypesHere = milestone ? hypes.filter((h) => h.to_user === m.user_id && h.streak === milestone) : [];
        const canHype = !isMe && !canNudge && milestone !== null && !hypesHere.some((h) => h.from_user === userId);
        return (
          <div key={m.user_id} className="flex items-center gap-3 py-3 first:pt-0 last:pb-0">
            <Avatar profile={m.profile} size={40} />
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-1.5">
                <span className="truncate font-semibold">{m.profile.display_name}</span>
                {isMe ? <span className="text-xs text-muted">(you)</span> : null}
              </div>
              <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-muted">
                <span className={cx("flex items-center gap-0.5 whitespace-nowrap", milestone !== null && "font-semibold text-pink")}>
                  <IconFlame size={13} />
                  {s.streak} {stats.unit === "week" ? "wk" : "day"}
                  {s.streak === 1 ? "" : "s"}
                </span>
                <span>·</span>
                <span className="tabular whitespace-nowrap">{money(s.owedCents)} owed</span>
                {hypesHere.length ? (
                  <>
                    <span>·</span>
                    <span className="flex items-center gap-0.5 whitespace-nowrap font-semibold text-pink">
                      <IconSpark size={12} />
                      {hypesHere.length} hype{hypesHere.length === 1 ? "" : "s"}
                    </span>
                  </>
                ) : null}
                {pact.goal_type === "weekly" && s.active && !stats.ended ? (
                  <>
                    <span>·</span>
                    <span className="tabular">
                      {s.weekCount}/{s.weekTarget} this week
                    </span>
                  </>
                ) : null}
              </div>
            </div>
            {canNudge ? (
              <Button size="sm" variant="soft" loading={busy === m.user_id} onClick={() => nudge(m.user_id, m.profile.display_name)}>
                <IconNudge size={16} />
                Nudge
              </Button>
            ) : canHype && milestone ? (
              <Button size="sm" variant="primary" loading={busy === `h-${m.user_id}`} onClick={() => hype(m.user_id, m.profile.display_name, milestone)}>
                <IconSpark size={16} />
                Hype
              </Button>
            ) : !s.active ? (
              <span className="text-xs text-muted">Starts {shortDay(s.startsOn)}</span>
            ) : s.today ? (
              <StatusPill status={s.today} small />
            ) : null}
          </div>
        );
      })}
      {invited.length ? (
        <div className="pt-3 text-xs text-muted">
          Invited: {invited.map((m) => m.profile.display_name).join(", ")}
        </div>
      ) : null}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Feed                                                                 */
/* ------------------------------------------------------------------ */
type FeedItem =
  | { kind: "checkin"; day: string; c: Checkin; sort: string }
  | { kind: "ghost"; day: string; userId: string; sort: string };

export function Feed({
  pact,
  stats,
  members,
  checkins,
  doubts,
  reactions,
  userId,
  proofUrls,
  onChange,
}: {
  pact: Pact;
  stats: PactStats;
  members: Member[];
  checkins: Checkin[];
  doubts: Doubt[];
  reactions: Reaction[];
  userId: string;
  proofUrls: Record<string, string>;
  onChange: () => void;
}) {
  const [limit, setLimit] = useState(30);
  const byId = useMemo(() => Object.fromEntries(members.map((m) => [m.user_id, m])), [members]);

  const items = useMemo(() => {
    const out: FeedItem[] = checkins.map((c) => ({ kind: "checkin", day: c.day, c, sort: `${c.day}|${c.updated_at}` }));
    if (pact.goal_type !== "weekly") {
      const cutoff = addDays(stats.today, -14);
      for (const s of Object.values(stats.members)) {
        for (const m of s.misses) {
          if (m.kind === "auto" && m.day >= cutoff) out.push({ kind: "ghost", day: m.day, userId: s.userId, sort: `${m.day}|0` });
        }
      }
    }
    return out.sort((a, b) => (a.sort < b.sort ? 1 : -1));
  }, [checkins, stats, pact.goal_type]);

  // How many doubts I've used this week in this pact
  const myWeek = weekStart(stats.today);
  const usedDoubt = doubts.some((d) => d.doubter_id === userId && todayIn(pact.timezone, new Date(d.created_at)) >= myWeek);

  if (items.length === 0) {
    return <p className="py-6 text-center text-sm text-muted">Nothing yet. Check-ins and confessions show up here.</p>;
  }

  let lastDay = "";
  return (
    <div>
      {items.slice(0, limit).map((it) => {
        const header = it.day !== lastDay ? (
          <div className="mb-2 mt-5 text-xs font-bold uppercase tracking-wider text-muted first:mt-0">{prettyDay(it.day, stats.today)}</div>
        ) : null;
        lastDay = it.day;
        if (it.kind === "ghost") {
          const m = byId[it.userId];
          return (
            <div key={`g-${it.userId}-${it.day}`}>
              {header}
              <div className="mb-2 flex items-center gap-3 rounded-2xl border border-dashed border-line px-3 py-2.5 text-sm text-muted">
                <IconEmpty size={20} className="shrink-0" />
                <span>
                  <b className="text-ink">{m?.profile.display_name ?? "Someone"}</b> didn&apos;t check in. Counts as broke.
                </span>
              </div>
            </div>
          );
        }
        return (
          <div key={it.c.id}>
            {header}
            <FeedCard
              pact={pact}
              stats={stats}
              c={it.c}
              member={byId[it.c.user_id]}
              byId={byId}
              doubts={doubts.filter((d) => d.checkin_id === it.c.id)}
              reactions={reactions.filter((r) => r.checkin_id === it.c.id)}
              userId={userId}
              proofUrl={it.c.proof_path ? proofUrls[it.c.proof_path] : undefined}
              canDoubtThisWeek={!usedDoubt}
              onChange={onChange}
            />
          </div>
        );
      })}
      {items.length > limit ? (
        <div className="mt-3 text-center">
          <Button variant="soft" size="sm" onClick={() => setLimit((l) => l + 30)}>
            Show more
          </Button>
        </div>
      ) : null}
    </div>
  );
}

function FeedCard({
  pact,
  stats,
  c,
  member,
  byId,
  doubts,
  reactions,
  userId,
  proofUrl,
  canDoubtThisWeek,
  onChange,
}: {
  pact: Pact;
  stats: PactStats;
  c: Checkin;
  member?: Member;
  byId: Record<string, Member>;
  doubts: Doubt[];
  reactions: Reaction[];
  userId: string;
  proofUrl?: string;
  canDoubtThisWeek: boolean;
  onChange: () => void;
}) {
  const toast = useToast();
  const now = Date.now();
  const eff = effectiveStatus(c, doubts, now).status;
  const isMine = c.user_id === userId;
  const [zoom, setZoom] = useState(false);
  const [tray, setTray] = useState(false);
  const [confirmDoubt, setConfirmDoubt] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);

  const myDoubt = doubts.find((d) => d.doubter_id === userId);
  const openDoubt = doubts.find((d) => d.status === "open");
  const doubtable =
    !isMine && c.status === "kept" && !c.proof_path && !myDoubt && c.day >= addDays(stats.today, -1) && !stats.ended;

  const counts = EMOJIS.map((e) => ({
    e,
    n: reactions.filter((r) => r.emoji === e).length,
    mine: reactions.some((r) => r.emoji === e && r.user_id === userId),
  }));

  async function toggle(e: string, mine: boolean) {
    setTray(false);
    const q = mine
      ? supabase.from("reactions").delete().match({ checkin_id: c.id, user_id: userId, emoji: e })
      : supabase.from("reactions").insert({ checkin_id: c.id, pact_id: c.pact_id, user_id: userId, emoji: e });
    const { error } = await q;
    if (error) toast(errMsg(error), "err");
    onChange();
  }

  async function doubt() {
    setBusy("doubt");
    try {
      await action({ action: "doubt", checkinId: c.id });
      toast("Doubt sent. They've got 24 hours.");
      setConfirmDoubt(false);
      onChange();
    } catch (e) {
      toast(errMsg(e), "err");
    } finally {
      setBusy(null);
    }
  }

  async function ownUp(d: Doubt) {
    setBusy("own");
    const { error } = await supabase.rpc("own_up", { p_doubt: d.id, p_note: null });
    setBusy(null);
    if (error) return toast(errMsg(error), "err");
    toast("Respect for owning up.");
    onChange();
  }

  const isConfession = eff === "broke" && c.note;

  return (
    <div className="mb-2 rounded-2xl bg-surface p-3 shadow-card ring-1 ring-line">
      <div className="flex gap-3">
        <Avatar profile={member?.profile} size={36} />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="truncate font-semibold">{member?.profile.display_name ?? "Someone"}</span>
            <StatusPill status={eff} small />
            <span className="ml-auto shrink-0 text-xs text-muted">{timeAgo(c.updated_at, now)}</span>
          </div>
          {pact.goal_type === "count" && c.value !== null ? (
            <div className="mt-0.5 text-sm tabular">
              <b>{Number(c.value).toLocaleString()}</b> <span className="text-muted">/ {Number(pact.target).toLocaleString()} {pact.unit}</span>
            </div>
          ) : null}
          {c.note ? (
            <p className={cx("mt-1.5 whitespace-pre-wrap break-words text-[15px]", isConfession && "rounded-xl bg-pink-soft px-3 py-2")}>
              {isConfession ? <span className="mr-1 text-xs font-bold uppercase tracking-wide text-pink">Confession</span> : null}
              {c.note}
            </p>
          ) : null}
          {proofUrl ? (
            <button className="mt-2 block overflow-hidden rounded-xl" onClick={() => setZoom(true)} aria-label="View proof photo">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={proofUrl} alt="Proof" className="max-h-56 w-auto rounded-xl object-cover" />
            </button>
          ) : null}

          {doubts.map((d) => {
            const who = byId[d.doubter_id]?.profile.display_name ?? "Someone";
            const left = Math.max(0, Math.ceil((DOUBT_WINDOW_MS - (now - new Date(d.created_at).getTime())) / 3600000));
            const [Icon, text]: [typeof IconEye, string] =
              d.status === "proved"
                ? [IconCamera, `Proof posted after ${who}'s doubt`]
                : d.status === "confessed"
                  ? [IconFlag, `Owned up after ${who}'s doubt`]
                  : doubtExpired(d, now)
                    ? [IconClock, `${who}'s doubt went unanswered. Counts as broke.`]
                    : [IconEye, `${who} doubts this · ${left}h left to answer`];
            return (
              <p key={d.id} className="mt-2 flex items-center gap-1.5 text-xs font-semibold text-muted">
                <Icon size={14} className="shrink-0" />
                {text}
              </p>
            );
          })}

          {isMine && openDoubt && !doubtExpired(openDoubt, now) ? (
            <div className="mt-2 space-y-2 rounded-xl bg-off-soft p-3">
              <p className="text-sm font-semibold text-off">Someone doubts this. Post a photo or own up.</p>
              <div className="flex flex-wrap gap-2">
                <ProofButton pact={pact} checkin={c} userId={userId} onDone={onChange} label="Post proof" variant="primary" />
                <Button size="sm" variant="soft" loading={busy === "own"} onClick={() => ownUp(openDoubt)}>
                  Own up
                </Button>
              </div>
            </div>
          ) : null}

          <div className="mt-2 flex flex-wrap items-center gap-1.5">
            {counts
              .filter((x) => x.n > 0)
              .map((x) => (
                <button
                  key={x.e}
                  onClick={() => toggle(x.e, x.mine)}
                  className={cx("flex h-7 items-center gap-1 rounded-full px-2 text-sm tabular ring-1", x.mine ? "bg-pink-soft ring-pink/40" : "bg-surface-2 ring-transparent")}
                >
                  {x.e} <span className="text-xs font-semibold">{x.n}</span>
                </button>
              ))}
            <div className="relative">
              <button onClick={() => setTray((t) => !t)} className="flex h-7 items-center rounded-full bg-surface-2 px-2 text-sm text-muted" aria-label="React">
                <IconSmilePlus size={16} />
              </button>
              {tray ? (
                <div className="animate-pop absolute bottom-9 left-0 z-10 flex gap-1 rounded-full bg-surface p-1 shadow-card ring-1 ring-line">
                  {counts.map((x) => (
                    <button key={x.e} onClick={() => toggle(x.e, x.mine)} className={cx("h-9 w-9 rounded-full text-lg hover:bg-surface-2", x.mine && "bg-pink-soft")}>
                      {x.e}
                    </button>
                  ))}
                </div>
              ) : null}
            </div>
            {doubtable ? (
              confirmDoubt ? (
                <span className="ml-auto flex items-center gap-1.5">
                  <span className="text-xs text-muted">{canDoubtThisWeek ? "Use your 1 doubt this week?" : "Already used this week"}</span>
                  {canDoubtThisWeek ? (
                    <Button size="sm" variant="off" loading={busy === "doubt"} onClick={doubt}>
                      Doubt
                    </Button>
                  ) : null}
                  <Button size="sm" variant="ghost" onClick={() => setConfirmDoubt(false)} aria-label="Cancel">
                    <IconX size={16} />
                  </Button>
                </span>
              ) : (
                <button onClick={() => setConfirmDoubt(true)} className="ml-auto flex h-7 items-center gap-1 rounded-full px-2 text-xs font-semibold text-muted hover:bg-surface-2">
                  <IconEye size={14} />
                  Doubt
                </button>
              )
            ) : null}
          </div>
        </div>
      </div>
      {zoom && proofUrl ? (
        <button className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4" onClick={() => setZoom(false)} aria-label="Close photo">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={proofUrl} alt="Proof" className="max-h-full max-w-full rounded-2xl" />
        </button>
      ) : null}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Ledger / pot                                                          */
/* ------------------------------------------------------------------ */
export function Ledger({ pact, stats, members }: { pact: Pact; stats: PactStats; members: Member[] }) {
  const [open, setOpen] = useState<string | null>(null);
  const rows = members
    .filter((m) => m.status === "active" && stats.members[m.user_id])
    .map((m) => ({ m, s: stats.members[m.user_id] }))
    .sort((a, b) => b.s.owedCents - a.s.owedCents);

  return (
    <div>
      <div className="rounded-2xl bg-pink-soft p-4 text-center">
        <div className="text-xs font-bold uppercase tracking-wider text-pink">The pot</div>
        <div className="font-display text-5xl font-bold tabular">{money(stats.potCents)}</div>
        <div className="mt-1 text-sm text-muted">{pact.pot_destination ? <>Goes to <b className="text-ink">{pact.pot_destination}</b></> : "Decide together where it goes"}</div>
      </div>
      <div className="mt-4 divide-y divide-line">
        {rows.map(({ m, s }) => (
          <div key={m.user_id} className="py-3">
            <button className="flex w-full items-center gap-3 text-left" onClick={() => setOpen(open === m.user_id ? null : m.user_id)}>
              <Avatar profile={m.profile} size={36} />
              <div className="flex-1">
                <div className="font-semibold">{m.profile.display_name}</div>
                <div className="text-xs text-muted">
                  {s.misses.length} miss{s.misses.length === 1 ? "" : "es"}
                </div>
              </div>
              <div className="font-display text-xl font-bold tabular">{money(s.owedCents)}</div>
              <svg className={cx("text-muted transition", open === m.user_id && "rotate-180")} width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4"><path d="M6 9l6 6 6-6" /></svg>
            </button>
            {open === m.user_id ? (
              <div className="mt-2 space-y-1 pl-12">
                {s.misses.length === 0 ? <p className="text-sm text-muted">Clean so far.</p> : null}
                {s.misses
                  .slice()
                  .reverse()
                  .map((x, i) => (
                    <div key={i} className="flex justify-between text-sm">
                      <span className="text-muted">
                        {pact.goal_type === "weekly" ? x.label : `${shortDay(x.day)} · ${x.label}`}
                      </span>
                      <span className="tabular font-semibold">{money(x.cents)}</span>
                    </div>
                  ))}
              </div>
            ) : null}
          </div>
        ))}
      </div>
      <p className="mt-4 text-center text-xs text-muted">
        Pinky never touches real money. Settle up with an e-transfer when the pact ends.
      </p>
    </div>
  );
}
