"use client";

import { useMemo, useState } from "react";
import { supabase, errMsg } from "@/lib/supabase";
import { action } from "@/lib/api";
import type { Checkin, Doubt, Hype, Member, Pact, Reaction } from "@/lib/types";
import { DOUBT_WINDOW_MS, doubtExpired, effectiveStatus, streakMilestone, type PactStats } from "@/lib/stats";
import { addDays, prettyDay, shortDay, timeAgo, weekStart, todayIn } from "@/lib/dates";
import { money } from "@/lib/money";
import { Avatar, Button, Card, GroupNote, List, StatusPill, cx, useToast } from "./ui";
import { ProofButton } from "./checkin";
import { IconCamera, IconChevronDown, IconClock, IconEye, IconFlag, IconNudge, IconSmilePlus, IconSpark, IconX } from "./icons";
import { joinAnd } from "@/lib/wrap-story";

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
    <List inset={68}>
      {active.map((m) => {
        const s = stats.members[m.user_id];
        if (!s) return null;
        const isMe = m.user_id === userId;
        const canNudge = !isMe && !stats.ended && s.active && s.today === "pending" && !nudgedToday.has(m.user_id);
        const milestone = streakMilestone(s.streak, stats.unit);
        const hypesHere = milestone ? hypes.filter((h) => h.to_user === m.user_id && h.streak === milestone) : [];
        const canHype = !isMe && !canNudge && milestone !== null && !hypesHere.some((h) => h.from_user === userId);
        const bits = [
          s.streak > 0 ? `${s.streak}-${stats.unit} streak` : "No streak",
          pact.goal_type === "weekly" && s.active && !stats.ended ? `${s.weekCount} of ${s.weekTarget} this week` : null,
          s.owedCents ? `owes ${money(s.owedCents)}` : null,
          hypesHere.length ? `${hypesHere.length} hype${hypesHere.length === 1 ? "" : "s"}` : null,
        ].filter(Boolean);
        return (
          <div key={m.user_id} className="flex min-h-[60px] items-center gap-3 px-4 py-2.5">
            <Avatar profile={m.profile} size={40} />
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-1.5">
                <span className="truncate text-[16px] font-medium">{m.profile.display_name}</span>
                {isMe ? <span className="text-[13px] text-faint">You</span> : null}
              </div>
              <div className="text-[13px] text-muted">
                {bits.map((b, i) => (
                  <span key={i}>
                    {i ? " · " : ""}
                    {b}
                  </span>
                ))}
              </div>
            </div>
            {canNudge ? (
              <Button size="sm" variant="tinted" loading={busy === m.user_id} onClick={() => nudge(m.user_id, m.profile.display_name)}>
                <IconNudge size={15} />
                Nudge
              </Button>
            ) : canHype && milestone ? (
              <Button size="sm" variant="primary" loading={busy === `h-${m.user_id}`} onClick={() => hype(m.user_id, m.profile.display_name, milestone)}>
                <IconSpark size={15} />
                Hype
              </Button>
            ) : !s.active ? (
              <span className="text-[13px] text-muted">Starts {shortDay(s.startsOn)}</span>
            ) : s.today ? (
              <StatusPill status={s.today} small />
            ) : null}
          </div>
        );
      })}
      {invited.length ? (
        <div className="px-4 py-3 text-[13px] text-muted">
          Invited, not in yet: {joinAnd(invited.map((m) => m.profile.display_name.split(" ")[0]))}
        </div>
      ) : null}
    </List>
  );
}

/* ------------------------------------------------------------------ */
/* Feed                                                                 */
/* ------------------------------------------------------------------ */
const DAYS_PER_PAGE = 7;

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
  const [pages, setPages] = useState(1);
  const byId = useMemo(() => Object.fromEntries(members.map((m) => [m.user_id, m])), [members]);
  const now = Date.now();

  // Check-ins and no-shows, grouped by day, newest first.
  const days = useMemo(() => {
    const map = new Map<string, { checkins: Checkin[]; ghosts: string[] }>();
    const get = (d: string) => {
      if (!map.has(d)) map.set(d, { checkins: [], ghosts: [] });
      return map.get(d)!;
    };
    for (const c of checkins) get(c.day).checkins.push(c);
    if (pact.goal_type !== "weekly") {
      const cutoff = addDays(stats.today, -14);
      for (const s of Object.values(stats.members)) for (const m of s.misses) if (m.kind === "auto" && m.day >= cutoff) get(m.day).ghosts.push(s.userId);
    }
    return [...map.entries()]
      .sort((a, b) => (a[0] < b[0] ? 1 : -1))
      .map(([day, v]) => ({ day, ...v, checkins: v.checkins.sort((a, b) => (a.updated_at < b.updated_at ? 1 : -1)) }));
  }, [checkins, stats, pact.goal_type]);

  const myWeek = weekStart(stats.today);
  const usedDoubt = doubts.some((d) => d.doubter_id === userId && todayIn(pact.timezone, new Date(d.created_at)) >= myWeek);
  const doubtable = (c: Checkin) =>
    c.user_id !== userId && c.status === "kept" && !c.proof_path && !doubts.some((d) => d.checkin_id === c.id && d.doubter_id === userId) && c.day >= addDays(stats.today, -1) && !stats.ended;

  if (days.length === 0) {
    return (
      <Card className="px-6 py-8 text-center">
        <p className="text-[15px] text-muted">Nothing yet. Check-ins, confessions and photos show up here.</p>
      </Card>
    );
  }

  const shown = days.slice(0, pages * DAYS_PER_PAGE);
  return (
    <div className="space-y-5">
      {shown.map(({ day, checkins: cs, ghosts }) => {
        // Plain check-ins (no note, photo, doubt or reactions) fold into one line so the feed isn't a wall of "kept it".
        const plain = cs.filter(
          (c) =>
            c.status !== "broke" &&
            !c.note &&
            !c.proof_path &&
            !doubts.some((d) => d.checkin_id === c.id) &&
            !reactions.some((r) => r.checkin_id === c.id) &&
            !doubtable(c) &&
            effectiveStatus(c, doubts, now).status !== "broke",
        );
        const rich = cs.filter((c) => !plain.includes(c));
        const keptPlain = plain.filter((c) => c.status === "kept");
        const offPlain = plain.filter((c) => c.status === "off");
        return (
          <section key={day}>
            <h3 className="mb-1.5 px-1 text-[13px] font-medium text-muted">{prettyDay(day, stats.today)}</h3>
            <List inset={64}>
              {rich.map((c) => (
                <FeedRow
                  key={c.id}
                  pact={pact}
                  stats={stats}
                  c={c}
                  member={byId[c.user_id]}
                  byId={byId}
                  doubts={doubts.filter((d) => d.checkin_id === c.id)}
                  reactions={reactions.filter((r) => r.checkin_id === c.id)}
                  userId={userId}
                  proofUrl={c.proof_path ? proofUrls[c.proof_path] : undefined}
                  doubtable={doubtable(c)}
                  canDoubtThisWeek={!usedDoubt}
                  onChange={onChange}
                />
              ))}
              {keptPlain.length ? <Summary people={keptPlain.map((c) => byId[c.user_id])} verb={pact.goal_type === "weekly" ? "got a session in" : "kept it"} /> : null}
              {offPlain.length ? <Summary people={offPlain.map((c) => byId[c.user_id])} verb={offPlain.length === 1 ? "took an off-day" : "took off-days"} /> : null}
              {ghosts.map((uid) => (
                <div key={`g-${uid}`} className="flex items-center gap-3 px-4 py-3">
                  <span className="h-9 w-9 shrink-0 rounded-full border-[1.5px] border-dashed border-faint" aria-hidden="true" />
                  <p className="text-[15px] text-muted">
                    <span className="font-medium text-ink">{byId[uid]?.profile.display_name.split(" ")[0] ?? "Someone"}</span> didn&apos;t check in, so it counts as broke.
                  </p>
                </div>
              ))}
            </List>
          </section>
        );
      })}
      {days.length > shown.length ? (
        <div className="text-center">
          <Button variant="soft" size="sm" onClick={() => setPages((n) => n + 1)}>
            Show earlier days
          </Button>
        </div>
      ) : null}
    </div>
  );
}

function Summary({ people, verb }: { people: (Member | undefined)[]; verb: string }) {
  const ps = people.filter(Boolean) as Member[];
  const names = ps.map((m) => m.profile.display_name.split(" ")[0]);
  return (
    <div className="flex items-center gap-3 px-4 py-3">
      <Cluster people={ps} />
      <p className="min-w-0 flex-1 text-[15px]">
        <span className="font-medium">{names.length > 4 ? `${names.slice(0, 3).join(", ")} and ${names.length - 3} others` : joinAnd(names)}</span>{" "}
        <span className="text-muted">{verb}</span>
      </p>
    </div>
  );
}

/** Two faces packed into one 36px slot, like a group chat icon. More than two shows a count. */
function Cluster({ people }: { people: Member[] }) {
  if (people.length <= 1) return <Avatar profile={people[0]?.profile} size={36} />;
  return (
    <span className="relative h-9 w-9 shrink-0" aria-hidden="true">
      <span className="absolute left-0 top-0">
        <Avatar profile={people[0].profile} size={24} />
      </span>
      <span className="absolute left-3 top-3">
        {people.length === 2 ? (
          <Avatar profile={people[1].profile} size={24} ring="ring-2 ring-surface" />
        ) : (
          <span className="flex h-6 w-6 items-center justify-center rounded-full bg-surface-2 text-[11px] font-semibold text-muted ring-2 ring-surface">+{people.length - 1}</span>
        )}
      </span>
    </span>
  );
}

function FeedRow({
  pact,
  stats,
  c,
  member,
  byId,
  doubts,
  reactions,
  userId,
  proofUrl,
  doubtable,
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
  doubtable: boolean;
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
  const openDoubt = doubts.find((d) => d.status === "open");

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

  const simple = !c.note && !proofUrl && !doubts.length && !reactions.length && !(isMine && openDoubt) && !confirmDoubt;
  const actions = (
    <>
          {counts
            .filter((x) => x.n > 0)
            .map((x) => (
              <button
                key={x.e}
                onClick={() => toggle(x.e, x.mine)}
                className={cx("flex h-7 items-center gap-1 rounded-full px-2 text-[14px] tabular", x.mine ? "bg-pink-soft text-pink" : "bg-surface-2")}
                aria-label={`${x.e} ${x.n}${x.mine ? ", you reacted" : ""}`}
              >
                {x.e} <span className="text-[12px] font-semibold">{x.n}</span>
              </button>
            ))}
          <button
            onClick={() => setTray((t) => !t)}
            className={cx("flex h-7 w-7 items-center justify-center rounded-full hover:bg-surface-2", tray ? "bg-surface-2 text-ink" : "text-faint hover:text-muted")}
            aria-label="React"
            aria-expanded={tray}
          >
            <IconSmilePlus size={17} />
          </button>
          {doubtable ? (
            confirmDoubt ? (
              <span className="ml-auto flex items-center gap-1">
                <span className="text-[13px] text-muted">{canDoubtThisWeek ? "Use your doubt for this week?" : "You've used this week's doubt"}</span>
                {canDoubtThisWeek ? (
                  <Button size="sm" variant="off" loading={busy === "doubt"} onClick={doubt}>
                    Doubt
                  </Button>
                ) : null}
                <button className="flex h-7 w-7 items-center justify-center rounded-full text-faint hover:bg-surface-2" onClick={() => setConfirmDoubt(false)} aria-label="Cancel">
                  <IconX size={14} />
                </button>
              </span>
            ) : (
              <button onClick={() => setConfirmDoubt(true)} className="ml-auto flex h-7 items-center gap-1 rounded-full px-2 text-[13px] font-medium text-faint hover:bg-surface-2 hover:text-muted">
                <IconEye size={14} />
                Doubt
              </button>
            )
          ) : null}
    </>
  );

  const verb =
    eff === "kept"
      ? pact.goal_type === "weekly"
        ? ["got a session in", "text-kept"]
        : ["kept it", "text-kept"]
      : eff === "off"
        ? ["took an off-day", "text-off"]
        : ["broke it", "text-broke"];

  return (
    <div className="flex gap-3 px-4 py-3">
      <Avatar profile={member?.profile} size={36} />
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5">
          <p className="min-w-0 flex-1 text-[15px]">
            <span className="font-semibold">{member?.profile.display_name.split(" ")[0] ?? "Someone"}</span> <span className={cx("font-medium", verb[1])}>{verb[0]}</span>
            {pact.goal_type === "count" && c.value !== null ? (
              <span className="text-muted tabular">
                {" "}
                with {Number(c.value).toLocaleString()} {pact.unit}
              </span>
            ) : null}
          </p>
          <span className="shrink-0 text-[13px] text-faint">{timeAgo(c.updated_at, now)}</span>
          {simple ? actions : null}
        </div>

        {c.note ? <p className="mt-1 whitespace-pre-wrap break-words text-[15px] leading-snug">{c.note}</p> : null}
        {proofUrl ? (
          <button className="mt-2 block overflow-hidden rounded-xl" onClick={() => setZoom(true)} aria-label="View proof photo">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={proofUrl} alt="Proof" className="max-h-56 w-auto rounded-xl object-cover" />
          </button>
        ) : null}

        {doubts.map((d) => {
          const who = byId[d.doubter_id]?.profile.display_name.split(" ")[0] ?? "Someone";
          const left = Math.max(0, Math.ceil((DOUBT_WINDOW_MS - (now - new Date(d.created_at).getTime())) / 3600000));
          const [Icon, text]: [typeof IconEye, string] =
            d.status === "proved"
              ? [IconCamera, `Posted proof after ${who} doubted it`]
              : d.status === "confessed"
                ? [IconFlag, `Owned up after ${who} doubted it`]
                : doubtExpired(d, now)
                  ? [IconClock, `Didn't answer ${who}'s doubt, so it counts as broke`]
                  : [IconEye, `${who} doubts this. ${left}h left to answer.`];
          return (
            <p key={d.id} className="mt-1.5 flex items-center gap-1.5 text-[13px] text-muted">
              <Icon size={14} className="shrink-0" />
              {text}
            </p>
          );
        })}

        {isMine && openDoubt && !doubtExpired(openDoubt, now) ? (
          <div className="mt-2 rounded-xl bg-off-soft p-3">
            <p className="text-[14px] font-medium text-off">Someone doubts this. Post a photo or own up.</p>
            <div className="mt-2 flex flex-wrap gap-2">
              <ProofButton pact={pact} checkin={c} userId={userId} onDone={onChange} label="Post a photo" variant="primary" />
              <Button size="sm" variant="soft" loading={busy === "own"} onClick={() => ownUp(openDoubt)}>
                Own up
              </Button>
            </div>
          </div>
        ) : null}

        {!simple ? <div className="mt-2 flex flex-wrap items-center gap-1.5">{actions}</div> : null}
        {tray ? (
          <div className="animate-pop mt-2 flex w-fit gap-0.5 rounded-full bg-surface-2 p-1">
            {counts.map((x) => (
              <button key={x.e} onClick={() => toggle(x.e, x.mine)} className={cx("h-9 w-9 rounded-full text-[20px] active:scale-90", x.mine ? "bg-pink-soft" : "hover:bg-surface")} aria-label={`React ${x.e}`}>
                {x.e}
              </button>
            ))}
          </div>
        ) : null}
      </div>
      {zoom && proofUrl ? (
        <button className="animate-fade fixed inset-0 z-50 flex items-center justify-center bg-black/85 p-4" onClick={() => setZoom(false)} aria-label="Close photo">
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
      <Card className="px-5 py-6 text-center">
        <p className="text-[13px] font-medium text-muted">{stats.ended ? "Final pot" : "In the pot so far"}</p>
        <p className="mt-1 text-[44px] font-bold leading-none tracking-[-0.03em] tabular">{money(stats.potCents)}</p>
        <p className="mt-2 text-[15px] text-muted">
          {pact.pot_destination ? (
            <>
              Goes to <span className="font-medium text-ink">{pact.pot_destination}</span>
            </>
          ) : (
            "Decide together where it goes."
          )}
        </p>
      </Card>
      <List inset={64} className="mt-3">
        {rows.map(({ m, s }) => (
          <div key={m.user_id}>
            <button className="tap flex min-h-[56px] w-full items-center gap-3 px-4 py-2.5 text-left" onClick={() => setOpen(open === m.user_id ? null : m.user_id)} aria-expanded={open === m.user_id}>
              <Avatar profile={m.profile} size={36} />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[16px] font-medium">{m.profile.display_name}</span>
                <span className="block text-[13px] text-muted">{s.misses.length ? `${s.misses.length} miss${s.misses.length === 1 ? "" : "es"}` : "Clean so far"}</span>
              </span>
              <span className="text-[17px] font-semibold tabular">{money(s.owedCents)}</span>
              <IconChevronDown size={16} className={cx("text-faint transition", open === m.user_id && "rotate-180")} />
            </button>
            {open === m.user_id && s.misses.length ? (
              <div className="space-y-1.5 pb-3 pl-16 pr-4">
                {s.misses
                  .slice()
                  .reverse()
                  .map((x, i) => (
                    <div key={i} className="flex justify-between gap-3 text-[14px]">
                      <span className="text-muted">{pact.goal_type === "weekly" ? x.label : `${shortDay(x.day)}, ${x.label.charAt(0).toLowerCase()}${x.label.slice(1).replace(" · ", ", ")}`}</span>
                      <span className="shrink-0 font-medium tabular">{money(x.cents)}</span>
                    </div>
                  ))}
              </div>
            ) : null}
          </div>
        ))}
      </List>
      <GroupNote>Pinky never touches real money. Settle up with an e-transfer when the pact ends.</GroupNote>
    </div>
  );
}
