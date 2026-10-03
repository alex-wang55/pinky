"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useAuth } from "@/components/auth";
import { Shell } from "@/components/shell";
import { Avatar, Button, Card, IconButton, LargeTitle, List, PageLoader, Row, SectionTitle, Sheet, Tile, cx, useToast } from "@/components/ui";
import { CheckIn } from "@/components/checkin";
import { Wordmark } from "@/components/logo";
import { supabase, errMsg } from "@/lib/supabase";
import { loadBundle, type Bundle } from "@/lib/data";
import { computePact, doubtExpired, goalLabel, wrapWeek, type PactStats } from "@/lib/stats";
import { addDays, dayOfWeek, prettyDay, shortDay } from "@/lib/dates";
import { joinAnd } from "@/lib/wrap-story";
import { money } from "@/lib/money";
import { enablePush, isIos, isStandalone, pushSupported } from "@/lib/push-client";
import type { Pact } from "@/lib/types";
import { IconBell, IconCalendar, IconChevronRight, IconEye, IconFlame, IconMore, IconNudge, IconPlus, IconPlusUser, IconSpark, IconX } from "@/components/icons";
import { Pet, petState } from "@/components/pet";

export default function Home() {
  const { session, loading } = useAuth();
  if (loading) return <PageLoader />;
  if (!session) return <Landing />;
  return (
    <Shell>
      <Dashboard userId={session.user.id} />
    </Shell>
  );
}

type Nudge = { id: string; pact_id: string; from: { display_name: string; color: string }; pact: { name: string; emoji: string } };
type HypeIn = { id: string; pact_id: string; streak: number; from: { display_name: string }; pact: { name: string; emoji: string; goal_type: string } };

function Dashboard({ userId }: { userId: string }) {
  const { profile } = useAuth();
  const toast = useToast();
  const [bundle, setBundle] = useState<Bundle | null>(null);
  const [nudges, setNudges] = useState<Nudge[]>([]);
  const [hypesIn, setHypesIn] = useState<HypeIn[]>([]);
  const [friendReqs, setFriendReqs] = useState(0);
  const [hasFriends, setHasFriends] = useState(true);
  const [showHidden, setShowHidden] = useState(false);

  const load = useCallback(async () => {
    try {
      const { data: mine, error } = await supabase.from("pact_members").select("pact_id").eq("user_id", userId);
      if (error) throw error;
      const ids = (mine ?? []).map((m) => m.pact_id as string);
      const [b, n, fr, fa, hy] = await Promise.all([
        loadBundle(ids),
        supabase
          .from("nudges")
          .select("id, pact_id, from:profiles!nudges_from_user_fkey(display_name,color), pact:pacts(name,emoji)")
          .eq("to_user", userId)
          .eq("seen", false)
          .order("created_at", { ascending: false }),
        supabase.from("friendships").select("id", { count: "exact", head: true }).eq("addressee", userId).eq("status", "pending"),
        supabase.from("friendships").select("id", { count: "exact", head: true }).eq("status", "accepted"),
        supabase
          .from("hypes")
          .select("id, pact_id, streak, from:profiles!hypes_from_user_fkey(display_name), pact:pacts(name,emoji,goal_type)")
          .eq("to_user", userId)
          .eq("seen", false)
          .order("created_at", { ascending: false }),
      ]);
      setBundle(b);
      setNudges((n.data ?? []) as unknown as Nudge[]);
      setHypesIn((hy.data ?? []) as unknown as HypeIn[]);
      setFriendReqs(fr.count ?? 0);
      setHasFriends((fa.count ?? 0) > 0);
    } catch (e) {
      toast(errMsg(e), "err");
    }
  }, [userId, toast]);

  useEffect(() => {
    load();
    const onFocus = () => load();
    window.addEventListener("focus", onFocus);
    return () => window.removeEventListener("focus", onFocus);
  }, [load]);

  const computed = useMemo(() => {
    if (!bundle) return null;
    const now = Date.now();
    const rows = bundle.pacts.map((p) => {
      const members = bundle.members.filter((m) => m.pact_id === p.id);
      const me = members.find((m) => m.user_id === userId);
      const stats = computePact(
        p,
        members,
        bundle.checkins.filter((c) => c.pact_id === p.id),
        bundle.doubts.filter((d) => d.pact_id === p.id),
        now,
      );
      return { p, members, me, stats };
    });
    const invites = rows.filter((r) => r.me?.status === "invited");
    const active = rows.filter((r) => r.me?.status === "active" && !r.stats.ended);
    const done = rows.filter((r) => r.me?.status === "active" && r.stats.ended && !r.me.hidden);
    const hiddenDone = rows.filter((r) => r.me?.status === "active" && r.stats.ended && r.me.hidden);
    // Sort: things I still need to do today first
    active.sort((a, b) => {
      const ap = a.stats.members[userId]?.today === "pending" ? 0 : 1;
      const bp = b.stats.members[userId]?.today === "pending" ? 0 : 1;
      return ap - bp || a.p.name.localeCompare(b.p.name);
    });
    const myCheckins = new Set(bundle.checkins.filter((c) => c.user_id === userId).map((c) => c.id));
    const doubtsOnMe = bundle.doubts.filter((d) => myCheckins.has(d.checkin_id) && d.status === "open" && !doubtExpired(d, now));
    // Weekly wrap card shows Sunday and Monday for pacts that ran that week.
    const wraps = [...active, ...done].filter(
      (r) => r.stats.started && [0, 1].includes(dayOfWeek(r.stats.today)) && addDays(wrapWeek(r.stats.today), 6) >= r.p.start_date && wrapWeek(r.stats.today) <= r.p.end_date,
    );
    return { invites, active, done, hiddenDone, doubtsOnMe, wraps };
  }, [bundle, userId]);

  async function dismissHypes() {
    setHypesIn([]);
    await supabase.rpc("mark_hypes_seen");
  }

  async function dismissNudges() {
    setNudges([]);
    await supabase.rpc("mark_nudges_seen");
  }


  if (!computed || !bundle) return <PageLoader />;
  const pending = computed.active.filter((r) => r.stats.members[userId]?.today === "pending").length;
  const todayLabel = new Intl.DateTimeFormat("en-US", { weekday: "long", month: "long", day: "numeric" }).format(new Date());
  const firstName = profile?.display_name?.split(" ")[0];

  // Group hypes by pact + streak so three friends hyping the same streak read as one line.
  const hypeGroups = Object.values(
    hypesIn.reduce<Record<string, HypeIn[]>>((acc, h) => {
      (acc[`${h.pact_id}|${h.streak}`] ||= []).push(h);
      return acc;
    }, {}),
  );
  const hasUpdates = hypeGroups.length || nudges.length || computed.doubtsOnMe.length || friendReqs > 0 || computed.wraps.length;

  return (
    <div>
      <LargeTitle
        eyebrow={todayLabel}
        title="Pacts"
        sub={
          computed.active.length === 0
            ? firstName
              ? `Hey ${firstName}. Nothing on the go yet.`
              : "Nothing on the go yet."
            : pending === 0
              ? "You're checked in everywhere today."
              : `${pending === 1 ? "One pact is" : `${pending} pacts are`} waiting on you today.`
        }
        action={
          <IconButton tone="primary" href="/pacts/new" label="New pact" className="h-10 w-10">
            <IconPlus size={20} strokeWidth={2.4} />
          </IconButton>
        }
      />

      {hasUpdates ? (
        <List inset={60} className="mb-4">
          {computed.doubtsOnMe.length ? (
            <Row
              href={`/pacts/${computed.doubtsOnMe[0].pact_id}`}
              leading={
                <Tile tone="off">
                  <IconEye size={18} />
                </Tile>
              }
              title="Someone doubts your check-in"
              subtitle="Post a photo or own up within 24 hours, or it counts as broke."
              chevron
            />
          ) : null}
          {hypeGroups.slice(0, 3).map((group) => {
            const h = group[0];
            const names = group.map((g) => g.from?.display_name.split(" ")[0]).filter(Boolean) as string[];
            const who = names.length > 2 ? `${names.slice(0, 2).join(", ")} and ${names.length - 2} more` : joinAnd(names);
            return (
              <Row
                key={h.id}
                leading={
                  <Tile>
                    <IconSpark size={18} />
                  </Tile>
                }
                title={`${who} hyped your ${h.streak}-${h.pact?.goal_type === "weekly" ? "week" : "day"} streak`}
                subtitle={`${h.pact?.emoji ?? ""} ${h.pact?.name ?? ""}`}
                trailing={
                  <Button size="sm" variant="plain" onClick={dismissHypes}>
                    Thanks
                  </Button>
                }
              />
            );
          })}
          {nudges.length ? (
            <Row
              leading={
                <Tile>
                  <IconNudge size={18} />
                </Tile>
              }
              title={
                <Link href={`/pacts/${nudges[0].pact_id}`}>
                  {joinAnd([...new Set(nudges.map((n) => n.from?.display_name.split(" ")[0]).filter(Boolean) as string[])].slice(0, 3))} nudged you
                </Link>
              }
              subtitle={`${nudges[0].pact?.emoji ?? ""} ${nudges[0].pact?.name ?? ""}${nudges.length > 1 ? ` and ${nudges.length - 1} more` : ""}`}
              trailing={
                <Button size="sm" variant="plain" onClick={dismissNudges}>
                  Got it
                </Button>
              }
            />
          ) : null}
          {computed.wraps.map(({ p }) => (
            <Row
              key={`wrap-${p.id}`}
              href={`/pacts/${p.id}/week`}
              leading={
                <Tile>
                  <IconCalendar size={18} />
                </Tile>
              }
              title="Your weekly wrap is in"
              subtitle={`${p.emoji} ${p.name}`}
              chevron
            />
          ))}
          {friendReqs > 0 ? (
            <Row
              href="/friends"
              leading={
                <Tile tone="grey">
                  <IconPlusUser size={18} />
                </Tile>
              }
              title={`${friendReqs} friend request${friendReqs === 1 ? "" : "s"}`}
              chevron
            />
          ) : null}
        </List>
      ) : null}

      <PushPrompt />

      {computed.invites.map(({ p, members }) => (
        <Invite key={p.id} pact={p} inviter={members.find((m) => m.user_id === members.find((x) => x.user_id === userId)?.invited_by)?.profile.display_name} onDone={load} />
      ))}

      {computed.active.length === 0 && computed.invites.length === 0 ? (
        <Card className="flex flex-col items-center px-6 pb-6 pt-4 text-center">
          <Pet stage={0} mood="waiting" size={96} />
          <h2 className="mt-1 text-[20px] font-bold">Start your first pact</h2>
          <p className="mx-auto mt-1 max-w-xs text-[15px] text-muted">
            {hasFriends ? "Pick a goal, put a price on slipping, and bring your friends in." : "Add a friend first, or start one solo and invite people later."}
          </p>
          <div className="mt-5 flex w-full max-w-xs flex-col gap-2">
            <Button href="/pacts/new" size="lg">
              New pact
            </Button>
            {hasFriends ? null : (
              <Button href="/friends" size="lg" variant="soft">
                Add a friend
              </Button>
            )}
          </div>
        </Card>
      ) : null}

      <div className="space-y-3">
        {computed.active.map(({ p, members, stats }) => (
          <PactCard key={p.id} pact={p} stats={stats} members={members} userId={userId} doubts={bundle.doubts.filter((d) => d.pact_id === p.id)} onChange={load} />
        ))}
      </div>

      {computed.done.length || computed.hiddenDone.length ? (
        <>
          <SectionTitle
            right={
              computed.hiddenDone.length ? (
                <Button size="sm" variant="plain" onClick={() => setShowHidden((v) => !v)}>
                  {showHidden ? "Hide hidden" : `Show hidden (${computed.hiddenDone.length})`}
                </Button>
              ) : null
            }
          >
            Finished
          </SectionTitle>
          {computed.done.length || showHidden ? (
            <List inset={68}>
              {computed.done.map(({ p, stats, members }) => (
                <FinishedRow key={p.id} pact={p} stats={stats} members={members} userId={userId} onChange={load} />
              ))}
              {showHidden
                ? computed.hiddenDone.map(({ p, stats, members }) => (
                    <FinishedRow key={p.id} pact={p} stats={stats} members={members} userId={userId} onChange={load} hidden />
                  ))
                : null}
            </List>
          ) : (
            <p className="px-1 text-[15px] text-muted">Everything finished is hidden.</p>
          )}
        </>
      ) : null}
    </div>
  );
}

function PactCard({
  pact,
  stats,
  members,
  userId,
  doubts,
  onChange,
}: {
  pact: Pact;
  stats: PactStats;
  members: Bundle["members"];
  userId: string;
  doubts: Bundle["doubts"];
  onChange: () => void;
}) {
  const active = members.filter((m) => m.status === "active");
  const pet = petState(pact, stats);
  const counted = active.filter((m) => stats.members[m.user_id]?.active);
  const inToday = counted.filter((m) => {
    const t = stats.members[m.user_id]?.today;
    return t && t !== "pending";
  }).length;
  const weekly = pact.goal_type === "weekly";
  return (
    <Card className="overflow-hidden">
      <Link href={`/pacts/${pact.id}`} className="tap block px-4 pb-3 pt-3.5">
        <div className="flex items-center gap-3">
          <span className="-my-2 -ml-1.5 shrink-0">
            <Pet stage={pet.stage} mood={pet.mood} size={56} />
          </span>
          <div className="min-w-0 flex-1">
            <h3 className="truncate text-[17px] font-semibold leading-snug">
              {pact.emoji} {pact.name}
            </h3>
            <p className="text-[13px] text-muted">
              {stats.started ? `Day ${stats.dayNumber} of ${stats.totalDays}` : `Starts ${prettyDay(pact.start_date, stats.today)}`} · {money(pact.stake_cents)} a miss
            </p>
          </div>
          <div className="text-right">
            <div className="flex items-center justify-end gap-0.5 text-[20px] font-bold leading-none tabular">
              <IconFlame size={18} className={stats.groupStreak > 0 ? "text-pink" : "text-faint"} />
              {stats.groupStreak}
            </div>
            <div className="mt-0.5 text-[11px] text-muted">{stats.unit} streak</div>
          </div>
          <IconChevronRight size={18} className="-mr-1 shrink-0 text-faint" />
        </div>
        <div className="mt-3 flex items-center gap-2">
          <div className="flex gap-1.5">
            {active.slice(0, 6).map((m) => {
              const st = stats.members[m.user_id]?.today;
              return <Avatar key={m.user_id} profile={m.profile} size={26} badge={weekly || !st || st === "pending" ? null : st} />;
            })}
          </div>
          <span className="text-[13px] text-muted">
            {!stats.started
              ? `${active.length} ${active.length === 1 ? "person" : "people"} in`
              : weekly
                ? `${active.length} ${active.length === 1 ? "person" : "people"} in`
                : inToday === counted.length
                  ? "Everyone's in today"
                  : `${inToday} of ${counted.length} in today`}
          </span>
          <span className="ml-auto text-[13px] tabular text-muted">{money(stats.potCents)} pot</span>
        </div>
      </Link>
      <div className="border-t border-line px-4 py-3">
        <CheckIn pact={pact} stats={stats} userId={userId} doubts={doubts} onChange={onChange} />
      </div>
    </Card>
  );
}

function FinishedRow({
  pact,
  stats,
  members,
  userId,
  onChange,
  hidden,
}: {
  pact: Pact;
  stats: PactStats;
  members: Bundle["members"];
  userId: string;
  onChange: () => void;
  hidden?: boolean;
}) {
  const toast = useToast();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const isCreator = pact.created_by === userId;
  const creator = members.find((m) => m.user_id === pact.created_by)?.profile.display_name ?? "whoever made it";

  async function setHidden(h: boolean) {
    setBusy(h ? "hide" : "unhide");
    const { error } = await supabase.rpc("hide_pact", { p_pact: pact.id, p_hidden: h });
    setBusy(null);
    if (error) return toast(errMsg(error), "err");
    toast(h ? "Hidden from your list" : "Back on your list");
    setOpen(false);
    onChange();
  }

  async function remove() {
    setBusy("delete");
    const { error } = await supabase.rpc("delete_pact", { p_pact: pact.id });
    setBusy(null);
    if (error) return toast(errMsg(error), "err");
    toast("Pact deleted");
    setOpen(false);
    onChange();
  }

  return (
    <div className="flex items-center pr-2">
      <Link href={`/pacts/${pact.id}/recap`} className={cx("tap flex min-w-0 flex-1 items-center gap-3 py-2.5 pl-4", hidden && "opacity-60")}>
        <Tile tone="grey" size={40}>
          <span className="text-[22px]">{pact.emoji}</span>
        </Tile>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-[16px] font-medium">{pact.name}</span>
          <span className="block text-[13px] text-muted">
            {shortDay(pact.start_date)} to {shortDay(pact.end_date)} · {money(stats.potCents)} pot
          </span>
        </span>
      </Link>
      {hidden ? (
        <Button size="sm" variant="plain" loading={busy === "unhide"} onClick={() => setHidden(false)} className="!px-3">
          Unhide
        </Button>
      ) : (
        <IconButton tone="ghost" label={`Remove ${pact.name}`} onClick={() => setOpen(true)}>
          <IconMore size={20} />
        </IconButton>
      )}
      <Sheet open={open} onClose={() => setOpen(false)} title={`${pact.emoji} ${pact.name}`}>
        <p className="mb-3 px-1 text-[15px] text-muted">
          {isCreator
            ? "Take it off your list, or delete it for everyone. Deleting wipes the check-ins, confessions and recap for the whole group."
            : `Only ${creator} can delete it for everyone. You can take it off your list.`}
        </p>
        <List>
          <Row title="Hide from my list" subtitle="You can bring it back any time." onClick={() => setHidden(true)} trailing={busy === "hide" ? <span className="text-[13px] text-muted">...</span> : null} />
          {isCreator ? <Row title="Delete for everyone" tone="danger" subtitle="Can't be undone." onClick={remove} trailing={busy === "delete" ? <span className="text-[13px] text-muted">...</span> : null} /> : null}
        </List>
        <Button variant="soft" size="lg" className="mt-3 w-full" onClick={() => setOpen(false)}>
          Cancel
        </Button>
      </Sheet>
    </div>
  );
}

function Invite({ pact, inviter, onDone }: { pact: Pact; inviter?: string; onDone: () => void }) {
  const [busy, setBusy] = useState<string | null>(null);
  const toast = useToast();
  async function respond(accept: boolean) {
    setBusy(accept ? "y" : "n");
    const { error } = await supabase.rpc("respond_pact_invite", { p_pact: pact.id, p_accept: accept });
    setBusy(null);
    if (error) return toast(errMsg(error), "err");
    toast(accept ? "You're in. Pinky promise." : "Declined");
    onDone();
  }
  return (
    <Card className="mb-3 p-4">
      <div className="flex items-center gap-3">
        <Tile tone="grey" size={44}>
          <span className="text-[24px]">{pact.emoji}</span>
        </Tile>
        <div className="min-w-0 flex-1">
          <p className="text-[13px] font-medium text-pink">{inviter ? `${inviter.split(" ")[0]} invited you` : "You're invited"}</p>
          <div className="truncate text-[17px] font-semibold">{pact.name}</div>
        </div>
      </div>
      <p className="mt-2 text-[14px] text-muted">
        {goalLabel(pact)}, {money(pact.stake_cents)} a miss{pact.escalating ? " and it doubles" : ""}. {shortDay(pact.start_date)} to {shortDay(pact.end_date)}.
      </p>
      {pact.rules ? <p className="mt-2 rounded-xl bg-surface-2 px-3 py-2 text-[14px]">Breaking it means: {pact.rules}</p> : null}
      <div className="mt-3 grid grid-cols-2 gap-2">
        <Button loading={busy === "y"} onClick={() => respond(true)}>
          Join
        </Button>
        <Button variant="soft" loading={busy === "n"} onClick={() => respond(false)}>
          Not this time
        </Button>
      </div>
    </Card>
  );
}

function PushPrompt() {
  const [state, setState] = useState<"hidden" | "ask" | "ios">("hidden");
  const [busy, setBusy] = useState(false);
  const toast = useToast();
  useEffect(() => {
    let dismissed = false;
    try {
      dismissed = localStorage.getItem("pinky-push-dismissed") === "1";
    } catch {}
    if (dismissed) return;
    if (isIos() && !isStandalone()) setState("ios");
    else if (pushSupported() && Notification.permission === "default") setState("ask");
  }, []);
  if (state === "hidden") return null;
  const dismiss = () => {
    try {
      localStorage.setItem("pinky-push-dismissed", "1");
    } catch {}
    setState("hidden");
  };
  return (
    <Card className="mb-4 flex items-start gap-3 p-4">
      <Tile>
        <IconBell size={18} />
      </Tile>
      <div className="min-w-0 flex-1">
        <p className="text-[16px] font-semibold">Get a reminder before midnight</p>
        <p className="mt-0.5 text-[14px] text-muted">
          {state === "ios"
            ? "On iPhone, tap Share, then Add to Home Screen. Open Pinky from there to turn on notifications."
            : "Plus a ping when a friend nudges you or doubts a check-in."}
        </p>
        {state === "ask" ? (
          <Button
            size="sm"
            variant="tinted"
            className="mt-3"
            loading={busy}
            onClick={async () => {
              setBusy(true);
              try {
                await enablePush();
                toast("Notifications on");
                setState("hidden");
              } catch (e) {
                toast(errMsg(e), "err");
              } finally {
                setBusy(false);
              }
            }}
          >
            Turn on
          </Button>
        ) : null}
      </div>
      <IconButton tone="ghost" label="Dismiss" onClick={dismiss} className="-mr-2 -mt-1.5">
        <IconX size={16} />
      </IconButton>
    </Card>
  );
}

/* ------------------------------------------------------------------ */
/* Signed-out landing                                                   */
/* ------------------------------------------------------------------ */
const STEPS = [
  ["Make a pact", "Pick a goal with your friends and put a price on slipping. $5 a miss is plenty."],
  ["Check in every night", "Kept it or broke it, before midnight. Skipping the check-in counts as broke."],
  ["Slip up, pay the pot", "Misses go in a shared pot. When the pact ends it goes wherever you agreed."],
];

function Landing() {
  return (
    <div className="mx-auto max-w-lg px-5 pb-16 pt-[env(safe-area-inset-top)]">
      <header className="flex h-16 items-center justify-between">
        <Wordmark />
        <Button href="/login" size="sm" variant="plain">
          Log in
        </Button>
      </header>

      <section className="pt-8">
        <h1 className="text-[40px] font-bold leading-[1.05] tracking-[-0.03em]">
          Pinky promise.
          <br />
          <span className="text-pink">Actually keep it.</span>
        </h1>
        <p className="mt-4 max-w-sm text-[17px] leading-relaxed text-muted">
          A tiny app for you and your friends to stay honest about a goal. Check in every night. Slip up and you pay the pot.
        </p>
        <div className="mt-7 flex flex-col gap-2 sm:flex-row">
          <Button href="/signup" size="lg">
            Get started
          </Button>
          <Button href="/login" size="lg" variant="soft">
            I have an account
          </Button>
        </div>
      </section>

      <section className="mt-12" aria-hidden="true">
        <DemoCard />
      </section>

      <section className="mt-12">
        <h2 className="px-1 text-[20px] font-bold tracking-[-0.015em]">How it works</h2>
        <ol className="mt-3 space-y-5 px-1">
          {STEPS.map(([t, d], i) => (
            <li key={t} className="flex gap-4">
              <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-ink text-[14px] font-semibold text-bg">{i + 1}</span>
              <div>
                <h3 className="text-[17px] font-semibold">{t}</h3>
                <p className="mt-0.5 text-[15px] leading-snug text-muted">{d}</p>
              </div>
            </li>
          ))}
        </ol>
      </section>

      <p className="mt-14 text-center text-[13px] text-muted">Runs on the honor system. Your friends are the referees.</p>
    </div>
  );
}

/** A static pact card so people can see what they're signing up for. */
function DemoCard() {
  const people = [
    { display_name: "Maya", color: "#7c5cff", s: "kept" as const },
    { display_name: "Theo", color: "#0ea5a4", s: "kept" as const },
    { display_name: "You", color: "#f59e0b", s: "pending" as const },
  ];
  return (
    <div className="pointer-events-none select-none">
      <Card className="overflow-hidden">
        <div className="px-4 pb-3 pt-3.5">
          <div className="flex items-center gap-3">
            <span className="-my-2 -ml-1.5 shrink-0">
              <Pet stage={3} mood="waiting" size={56} still />
            </span>
            <div className="min-w-0 flex-1">
              <div className="truncate text-[17px] font-semibold">🥗 No takeout till June</div>
              <div className="text-[13px] text-muted">Day 12 of 56 · $5 a miss</div>
            </div>
            <div className="text-right">
              <div className="flex items-center justify-end gap-0.5 text-[20px] font-bold leading-none tabular">
                <IconFlame size={18} className="text-pink" />
                11
              </div>
              <div className="mt-0.5 text-[11px] text-muted">day streak</div>
            </div>
          </div>
          <div className="mt-3 flex items-center gap-2">
            <div className="flex gap-1.5">
              {people.map((p) => (
                <Avatar key={p.display_name} profile={p} size={26} badge={p.s === "pending" ? null : p.s} />
              ))}
            </div>
            <span className="text-[13px] text-muted">2 of 3 in today</span>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-2 border-t border-line px-4 py-3">
          <span className="flex h-11 items-center justify-center rounded-full bg-kept text-[15px] font-semibold text-kept-ink">Kept it</span>
          <span className="flex h-11 items-center justify-center rounded-full bg-broke-soft text-[15px] font-semibold text-broke">Broke it</span>
        </div>
      </Card>
    </div>
  );
}
