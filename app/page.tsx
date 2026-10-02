"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useAuth } from "@/components/auth";
import { Shell } from "@/components/shell";
import { Avatar, Button, Card, PageLoader, SectionTitle, StatusPill, useToast } from "@/components/ui";
import { CheckIn } from "@/components/checkin";
import { LogoMark } from "@/components/logo";
import { supabase, errMsg } from "@/lib/supabase";
import { loadBundle, type Bundle } from "@/lib/data";
import { computePact, doubtExpired, goalLabel, type PactStats } from "@/lib/stats";
import { prettyDay, shortDay } from "@/lib/dates";
import { money } from "@/lib/money";
import { enablePush, isIos, isStandalone, pushSupported } from "@/lib/push-client";
import type { Pact } from "@/lib/types";
import { IconArrowRight, IconBell, IconEye, IconFlame, IconJar, IconMoon, IconNudge, IconPact } from "@/components/icons";

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

function Dashboard({ userId }: { userId: string }) {
  const { profile } = useAuth();
  const toast = useToast();
  const [bundle, setBundle] = useState<Bundle | null>(null);
  const [nudges, setNudges] = useState<Nudge[]>([]);
  const [friendReqs, setFriendReqs] = useState(0);
  const [hasFriends, setHasFriends] = useState(true);

  const load = useCallback(async () => {
    try {
      const { data: mine, error } = await supabase.from("pact_members").select("pact_id").eq("user_id", userId);
      if (error) throw error;
      const ids = (mine ?? []).map((m) => m.pact_id as string);
      const [b, n, fr, fa] = await Promise.all([
        loadBundle(ids),
        supabase
          .from("nudges")
          .select("id, pact_id, from:profiles!nudges_from_user_fkey(display_name,color), pact:pacts(name,emoji)")
          .eq("to_user", userId)
          .eq("seen", false)
          .order("created_at", { ascending: false }),
        supabase.from("friendships").select("id", { count: "exact", head: true }).eq("addressee", userId).eq("status", "pending"),
        supabase.from("friendships").select("id", { count: "exact", head: true }).eq("status", "accepted"),
      ]);
      setBundle(b);
      setNudges((n.data ?? []) as unknown as Nudge[]);
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
    const done = rows.filter((r) => r.me?.status === "active" && r.stats.ended);
    // Sort: things I still need to do today first
    active.sort((a, b) => {
      const ap = a.stats.members[userId]?.today === "pending" ? 0 : 1;
      const bp = b.stats.members[userId]?.today === "pending" ? 0 : 1;
      return ap - bp || a.p.name.localeCompare(b.p.name);
    });
    const myCheckins = new Set(bundle.checkins.filter((c) => c.user_id === userId).map((c) => c.id));
    const doubtsOnMe = bundle.doubts.filter((d) => myCheckins.has(d.checkin_id) && d.status === "open" && !doubtExpired(d, now));
    return { invites, active, done, doubtsOnMe };
  }, [bundle, userId]);

  async function dismissNudges() {
    setNudges([]);
    await supabase.rpc("mark_nudges_seen");
  }

  if (!computed || !bundle) return <PageLoader />;
  const pending = computed.active.filter((r) => r.stats.members[userId]?.today === "pending").length;

  return (
    <div>
      <div className="mb-5 px-1">
        <h1 className="font-display text-[28px] font-extrabold leading-tight">Hey {profile?.display_name?.split(" ")[0] ?? "there"}</h1>
        <p className="text-muted">
          {computed.active.length === 0
            ? "No active pacts yet."
            : pending === 0
              ? "You're all checked in today. Nice."
              : `${pending} pact${pending === 1 ? "" : "s"} waiting on you today.`}
        </p>
      </div>

      {nudges.length ? (
        <Card className="mb-3 border-pink/30 bg-pink-soft p-4">
          <div className="flex items-start gap-3">
            <span className="mt-0.5 text-pink">
              <IconNudge size={22} />
            </span>
            <div className="flex-1 text-sm">
              {nudges.slice(0, 3).map((n) => (
                <p key={n.id}>
                  <b>{n.from?.display_name}</b> nudged you about{" "}
                  <Link className="font-semibold underline" href={`/pacts/${n.pact_id}`}>
                    {n.pact?.emoji} {n.pact?.name}
                  </Link>
                </p>
              ))}
            </div>
            <button className="text-sm font-semibold text-pink" onClick={dismissNudges}>
              Got it
            </button>
          </div>
        </Card>
      ) : null}

      {computed.doubtsOnMe.length ? (
        <Card className="mb-3 border-off/30 bg-off-soft p-4">
          <p className="flex items-start gap-2 text-sm font-semibold text-off">
            <IconEye size={18} className="mt-0.5 shrink-0" />
            <span>
              Someone doubts your check-in.{" "}
              <Link className="underline" href={`/pacts/${computed.doubtsOnMe[0].pact_id}`}>
                Post proof or own up
              </Link>{" "}
              within 24h or it counts as broke.
            </span>
          </p>
        </Card>
      ) : null}

      {friendReqs > 0 ? (
        <Link href="/friends" className="mb-3 block">
          <Card className="flex items-center justify-between p-4">
            <span className="text-sm font-semibold">
              {friendReqs} friend request{friendReqs === 1 ? "" : "s"}
            </span>
            <span className="flex items-center gap-1 text-sm font-semibold text-pink">
              See <IconArrowRight size={16} />
            </span>
          </Card>
        </Link>
      ) : null}

      <PushPrompt />

      {computed.invites.map(({ p, members }) => (
        <Invite key={p.id} pact={p} inviter={members.find((m) => m.user_id === members.find((x) => x.user_id === userId)?.invited_by)?.profile.display_name} onDone={load} />
      ))}

      {computed.active.length === 0 && computed.invites.length === 0 ? (
        <Card className="p-6 text-center">
          <div className="mx-auto mb-3 w-fit">
            <LogoMark size={56} />
          </div>
          <h2 className="font-display text-xl font-bold">Make your first pact</h2>
          <p className="mx-auto mt-1 max-w-xs text-sm text-muted">
            {hasFriends ? "Pick a goal, set the stakes, and invite your friends." : "Start by adding a friend. Then make a pact together."}
          </p>
          <div className="mt-4 flex justify-center gap-2">
            {hasFriends ? <Button href="/pacts/new">New pact</Button> : <Button href="/friends">Add a friend</Button>}
            {hasFriends ? null : (
              <Button href="/pacts/new" variant="soft">
                Solo pact
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

      {computed.done.length ? (
        <>
          <SectionTitle>Finished</SectionTitle>
          <div className="space-y-2">
            {computed.done.map(({ p, stats }) => (
              <Link key={p.id} href={`/pacts/${p.id}/recap`}>
                <Card className="flex items-center gap-3 p-4">
                  <span className="text-2xl">{p.emoji}</span>
                  <div className="flex-1">
                    <div className="font-semibold">{p.name}</div>
                    <div className="text-xs text-muted">
                      {shortDay(p.start_date)} to {shortDay(p.end_date)} · pot {money(stats.potCents)}
                    </div>
                  </div>
                  <span className="flex items-center gap-1 text-sm font-semibold text-pink">
                    Recap <IconArrowRight size={16} />
                  </span>
                </Card>
              </Link>
            ))}
          </div>
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
  return (
    <Card className="p-4">
      <Link href={`/pacts/${pact.id}`} className="block">
        <div className="flex items-start gap-3">
          <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-surface-2 text-2xl">{pact.emoji}</span>
          <div className="min-w-0 flex-1">
            <h3 className="truncate font-display text-lg font-bold leading-tight">{pact.name}</h3>
            <p className="text-xs text-muted">
              {stats.started ? `Day ${stats.dayNumber} of ${stats.totalDays}` : `Starts ${prettyDay(pact.start_date, stats.today)}`} · {goalLabel(pact)} · {money(pact.stake_cents)}/miss
            </p>
          </div>
          <div className="text-right">
            <div className="flex items-center justify-end gap-1 font-display text-2xl font-extrabold leading-none tabular">
              <IconFlame size={20} className={stats.groupStreak > 0 ? "text-pink" : "text-muted"} />
              {stats.groupStreak}
            </div>
            <div className="text-[10px] font-semibold uppercase tracking-wide text-muted">group {stats.unit}s</div>
          </div>
        </div>
        <div className="mt-3 flex items-center gap-1.5">
          {active.map((m) => {
            const st = stats.members[m.user_id]?.today;
            const ring = st === "kept" ? "ring-2 ring-kept ring-offset-2 ring-offset-surface" : st === "broke" ? "ring-2 ring-broke ring-offset-2 ring-offset-surface" : st === "off" ? "ring-2 ring-off ring-offset-2 ring-offset-surface" : "opacity-60";
            return <Avatar key={m.user_id} profile={m.profile} size={28} ring={ring} />;
          })}
          <span className="ml-auto text-xs text-muted">pot {money(stats.potCents)}</span>
        </div>
      </Link>
      <div className="mt-4 border-t border-line pt-4">
        <CheckIn pact={pact} stats={stats} userId={userId} doubts={doubts} onChange={onChange} />
      </div>
    </Card>
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
    <Card className="mb-3 border-pink/30 p-4">
      <p className="text-xs font-bold uppercase tracking-wider text-pink">{inviter ? `${inviter} invited you` : "Pact invite"}</p>
      <div className="mt-2 flex items-center gap-3">
        <span className="text-3xl">{pact.emoji}</span>
        <div className="flex-1">
          <div className="font-display text-lg font-bold">{pact.name}</div>
          <div className="text-xs text-muted">
            {goalLabel(pact)} · {money(pact.stake_cents)}/miss{pact.escalating ? " (escalating)" : ""} · {shortDay(pact.start_date)} to {shortDay(pact.end_date)}
          </div>
        </div>
      </div>
      {pact.rules ? <p className="mt-2 rounded-xl bg-surface-2 px-3 py-2 text-sm">“{pact.rules}”</p> : null}
      <div className="mt-3 grid grid-cols-2 gap-2">
        <Button loading={busy === "y"} onClick={() => respond(true)}>
          I&apos;m in
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
    <Card className="mb-3 p-4">
      <div className="flex items-start gap-3">
        <span className="mt-0.5 text-pink">
          <IconBell size={22} />
        </span>
        <div className="flex-1">
          <p className="font-semibold">Get nudges and reminders</p>
          <p className="text-sm text-muted">
            {state === "ios"
              ? "On iPhone, tap Share then Add to Home Screen. Open Pinky from there to turn on notifications."
              : "Friends can nudge you, and we'll remind you before midnight if you haven't checked in."}
          </p>
          <div className="mt-3 flex gap-2">
            {state === "ask" ? (
              <Button
                size="sm"
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
            <Button size="sm" variant="ghost" onClick={dismiss}>
              Not now
            </Button>
          </div>
        </div>
      </div>
    </Card>
  );
}

/* ------------------------------------------------------------------ */
const FEATURES = [
  { Icon: IconPact, t: "Make a pact", d: "No junk food, 10k steps, gym 4x a week. Set the stakes and what counts as breaking it." },
  { Icon: IconMoon, t: "Check in by midnight", d: "Kept it or broke it. Skip the check-in and it counts as broke, so no quietly ghosting." },
  { Icon: IconFlame, t: "Keep the group streak", d: "One shared streak. If anyone breaks, it resets for everyone. That's the peer pressure." },
  { Icon: IconJar, t: "Slip? Pay the pot", d: "Each miss adds to a pot that goes wherever you agreed. Settle up when the pact ends." },
  { Icon: IconEye, t: "Doubt and confess", d: "One doubt a week: they post a photo or own up. Confessions get reactions, not shame." },
];

function Landing() {
  return (
    <div className="mx-auto max-w-lg px-5 pb-16">
      <header className="flex h-16 items-center justify-between">
        <span className="flex items-center gap-2">
          <LogoMark size={30} />
          <span className="font-display text-2xl font-extrabold">pinky</span>
        </span>
        <Link href="/login" className="text-sm font-semibold text-muted hover:text-ink">
          Log in
        </Link>
      </header>

      <section className="pt-10 text-center">
        <div className="mx-auto mb-6 w-fit">
          <LogoMark size={88} />
        </div>
        <h1 className="font-display text-[44px] font-extrabold leading-[1.02]">
          Pinky promise.
          <br />
          <span className="text-pink">Actually keep it.</span>
        </h1>
        <p className="mx-auto mt-4 max-w-sm text-lg text-muted">
          Make a pact with your friends, check in every night, and be honest. Slip up and you pay the pot.
        </p>
        <div className="mx-auto mt-8 flex max-w-xs flex-col gap-2">
          <Button href="/signup" size="lg">
            Make an account
          </Button>
          <Button href="/login" size="lg" variant="soft">
            I already have one
          </Button>
        </div>
      </section>

      <section className="mt-16">
        <h2 className="mb-3 px-1 text-[13px] font-bold uppercase tracking-wider text-muted">How it works</h2>
        <Card className="divide-y divide-line px-4">
          {FEATURES.map(({ Icon, t, d }) => (
            <div key={t} className="flex gap-4 py-4">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-pink-soft text-pink">
                <Icon size={20} />
              </span>
              <div>
                <h3 className="font-display text-lg font-bold leading-tight">{t}</h3>
                <p className="mt-0.5 text-sm text-muted">{d}</p>
              </div>
            </div>
          ))}
        </Card>
      </section>

      <div className="mt-10 text-center">
        <StatusPill status="kept" /> <StatusPill status="broke" /> <StatusPill status="off" />
        <p className="mt-3 text-xs text-muted">Built on the honor system. Be honest.</p>
      </div>
    </div>
  );
}
