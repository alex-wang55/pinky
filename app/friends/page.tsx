"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Shell } from "@/components/shell";
import { useAuth } from "@/components/auth";
import { Avatar, Button, Card, SectionTitle, cx, inputCls, useToast } from "@/components/ui";
import { PactIcon } from "@/components/pact-icon";
import { loadBundle, type Bundle } from "@/lib/data";
import { friendInfo, monthBoard, statsFor, type FriendInfo } from "@/lib/friends";
import { localTz, todayIn } from "@/lib/dates";
import { supabase, errMsg } from "@/lib/supabase";
import { action } from "@/lib/api";
import type { Profile } from "@/lib/types";
import { IconFlame, IconNudge, IconTrophy, IconX } from "@/components/icons";

type Row = { id: string; status: "pending" | "accepted"; requester: string; addressee: string; other: Profile; incoming: boolean };

export default function FriendsPage() {
  return (
    <Shell wide>
      <Friends />
    </Shell>
  );
}

function Friends() {
  const { session, profile } = useAuth();
  const me = session!.user.id;
  const toast = useToast();
  const [rows, setRows] = useState<Row[] | null>(null);
  const [username, setUsername] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [confirm, setConfirm] = useState<string | null>(null);
  const [origin, setOrigin] = useState("");
  const [bundle, setBundle] = useState<Bundle | null>(null);
  const [nudged, setNudged] = useState<Set<string>>(new Set());

  useEffect(() => setOrigin(window.location.origin), []);

  const load = useCallback(async () => {
    const { data, error } = await supabase
      .from("friendships")
      .select("id, status, requester, addressee, r:profiles!friendships_requester_fkey(id,username,display_name,color), a:profiles!friendships_addressee_fkey(id,username,display_name,color)")
      .order("created_at", { ascending: false });
    if (error) return toast(errMsg(error), "err");
    setRows(
      (data ?? []).map((f) => ({
        id: f.id,
        status: f.status,
        requester: f.requester,
        addressee: f.addressee,
        incoming: f.addressee === me,
        other: (f.requester === me ? f.a : f.r) as unknown as Profile,
      })),
    );
  }, [me, toast]);

  // Pacts you're in, so each friend can show what you share.
  const loadPacts = useCallback(async () => {
    const { data: mem } = await supabase.from("pact_members").select("pact_id").eq("user_id", me).eq("status", "active");
    const b = await loadBundle((mem ?? []).map((m) => m.pact_id as string));
    setBundle(b);
    const { data: n } = await supabase.from("nudges").select("pact_id, to_user, day").eq("from_user", me);
    const todayOf = Object.fromEntries(b.pacts.map((p) => [p.id, todayIn(p.timezone)]));
    setNudged(new Set((n ?? []).filter((x) => x.day === todayOf[x.pact_id as string]).map((x) => `${x.pact_id}|${x.to_user}`)));
  }, [me]);

  useEffect(() => {
    load();
    loadPacts().catch(() => setBundle({ pacts: [], members: [], checkins: [], doubts: [], reactions: [], hypes: [] }));
  }, [load, loadPacts]);

  async function add(e: React.FormEvent) {
    e.preventDefault();
    const u = username.trim().replace(/^@/, "");
    if (!u) return;
    setBusy("add");
    try {
      const { result } = await action<{ result: string }>({ action: "friend_request", username: u });
      toast(
        result === "sent" ? `Request sent to @${u}` : result === "accepted" ? `You and @${u} are friends now` : result === "already_friends" ? "Already friends" : "Request already sent",
      );
      setUsername("");
      load();
    } catch (err) {
      toast(errMsg(err), "err");
    } finally {
      setBusy(null);
    }
  }

  async function respond(id: string, accept: boolean) {
    setBusy(id);
    const { error } = await supabase.rpc("respond_friend_request", { p_id: id, p_accept: accept });
    setBusy(null);
    if (error) return toast(errMsg(error), "err");
    load();
  }

  async function nudge(pactId: string, to: string, name: string) {
    setBusy(`n-${to}`);
    try {
      await action({ action: "nudge", pactId, toUser: to });
      toast(`Nudged ${name.split(" ")[0]}`);
      setNudged((s) => new Set(s).add(`${pactId}|${to}`));
    } catch (err) {
      toast(errMsg(err), "err");
    } finally {
      setBusy(null);
    }
  }

  async function remove(userId: string) {
    setBusy(userId);
    const { error } = await supabase.rpc("remove_friend", { p_user: userId });
    setBusy(null);
    setConfirm(null);
    if (error) return toast(errMsg(error), "err");
    load();
  }

  const link = profile ? `${origin}/add/${profile.username}` : "";
  async function share() {
    if (!link) return;
    const nav = navigator as Navigator & { share?: (d: ShareData) => Promise<void> };
    if (nav.share) {
      try {
        await nav.share({ title: "Pinky", text: "Be my accountability buddy on Pinky", url: link });
        return;
      } catch {
        /* cancelled */
      }
    }
    try {
      await navigator.clipboard.writeText(link);
      toast("Link copied");
    } catch {
      toast(link);
    }
  }

  const incoming = (rows ?? []).filter((r) => r.status === "pending" && r.incoming);
  const outgoing = (rows ?? []).filter((r) => r.status === "pending" && !r.incoming);
  const friends = (rows ?? []).filter((r) => r.status === "accepted");

  const stats = useMemo(() => (bundle ? statsFor(bundle) : null), [bundle]);
  const info = useMemo(() => {
    const out: Record<string, FriendInfo> = {};
    if (bundle && stats) for (const f of friends) out[f.other.id] = friendInfo(bundle, stats, me, f.other.id, nudged);
    return out;
  }, [bundle, stats, friends, me, nudged]);
  const board = useMemo(
    () => (bundle && stats ? monthBoard(bundle, stats, me, friends.map((f) => f.other.id), todayIn(localTz())) : []),
    [bundle, stats, friends, me],
  );
  const nameOf = (id: string) => (id === me ? "You" : friends.find((f) => f.other.id === id)?.other.display_name ?? "Someone");
  const profileOf = (id: string) => (id === me ? profile : friends.find((f) => f.other.id === id)?.other);
  // Friends with pacts going (and anyone you can nudge) float to the top.
  const sortedFriends = [...friends].sort((x, y) => {
    const a = info[x.other.id];
    const b = info[y.other.id];
    const score = (i?: FriendInfo) => (i ? (i.shared.some((s) => s.nudgeable) ? 2 : 0) + (i.shared.length ? 1 : 0) : 0);
    return score(b) - score(a) || x.other.display_name.localeCompare(y.other.display_name);
  });
  const month = new Intl.DateTimeFormat("en-US", { month: "long" }).format(new Date());

  return (
    <div className="lg:grid lg:grid-cols-2 lg:items-start lg:gap-8">
      <div>
      <h1 className="px-1 font-display text-[28px] font-bold">Friends</h1>
      <p className="mb-4 px-1 text-muted">The people who&apos;ll hold you to it.</p>

      <Card className="p-4">
        <form onSubmit={add} className="flex gap-2">
          <div className="relative flex-1">
            <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-muted">@</span>
            <input
              className={inputCls + " pl-8"}
              placeholder="username"
              autoCapitalize="none"
              autoCorrect="off"
              spellCheck={false}
              value={username}
              onChange={(e) => setUsername(e.target.value.replace(/\s/g, ""))}
              aria-label="Friend's username"
            />
          </div>
          <Button type="submit" loading={busy === "add"} size="lg">
            Add
          </Button>
        </form>
        <div className="mt-3 flex items-center gap-2 rounded-2xl bg-surface-2 p-3">
          <div className="min-w-0 flex-1">
            <div className="text-xs font-semibold text-muted">Or send your link</div>
            <div className="truncate text-sm font-semibold">{link.replace(/^https?:\/\//, "")}</div>
          </div>
          <Button size="sm" variant="primary" onClick={share}>
            Share
          </Button>
        </div>
      </Card>

      {incoming.length ? (
        <>
          <SectionTitle>Requests</SectionTitle>
          <Card className="divide-y divide-line px-4">
            {incoming.map((r) => (
              <div key={r.id} className="flex items-center gap-3 py-3">
                <Avatar profile={r.other} size={40} />
                <div className="flex-1">
                  <div className="font-semibold">{r.other.display_name}</div>
                  <div className="text-xs text-muted">@{r.other.username}</div>
                </div>
                <Button size="sm" loading={busy === r.id} onClick={() => respond(r.id, true)}>
                  Accept
                </Button>
                <Button size="sm" variant="ghost" onClick={() => respond(r.id, false)} aria-label="Decline">
                  <IconX size={16} />
                </Button>
              </div>
            ))}
          </Card>
        </>
      ) : null}

      <SectionTitle>{month} so far</SectionTitle>
      <Card className="p-4">
        {board.length >= 2 ? (
          <>
            <div className="space-y-3">
              {board.map((r) => {
                const pct = Math.round((r.kept / r.decided) * 100);
                // Ties share a place, so three people on 100% are all first.
                const rank = 1 + board.filter((o) => o.kept / o.decided > r.kept / r.decided || (o.kept / o.decided === r.kept / r.decided && o.kept > r.kept)).length;
                const i = rank - 1;
                return (
                  <div key={r.userId} className="flex items-center gap-3">
                    <span className={cx("flex w-6 shrink-0 justify-center font-display font-bold tabular", i === 0 ? "text-pink" : "text-muted")}>
                      {i === 0 ? <IconTrophy size={18} /> : i + 1}
                    </span>
                    <Avatar profile={profileOf(r.userId)} size={32} />
                    <div className="min-w-0 flex-1">
                      <div className={cx("truncate font-semibold", r.userId === me && "text-pink")}>{nameOf(r.userId)}</div>
                      <div className="text-xs text-muted">
                        kept {r.kept} of {r.decided} days
                      </div>
                    </div>
                    <span className="font-display text-lg font-bold tabular">{pct}%</span>
                  </div>
                );
              })}
            </div>
            <p className="mt-4 text-xs text-muted">Counts days in the daily pacts you share. Weekly pacts aren&apos;t in here.</p>
          </>
        ) : (
          <p className="text-sm text-muted">
            {bundle === null ? "Loading..." : "Make a pact with a friend and you'll see who's keeping it best this month."}
          </p>
        )}
      </Card>
      </div>

      <div className="lg:pt-[47px] lg:[&>*:first-child]:mt-0">
      <SectionTitle>Your people {friends.length ? `· ${friends.length}` : ""}</SectionTitle>
      <Card className="divide-y divide-line px-4">
        {rows === null ? (
          <p className="py-4 text-sm text-muted">Loading...</p>
        ) : friends.length === 0 ? (
          <p className="py-4 text-sm text-muted">No friends yet. Add someone by username or send them your link.</p>
        ) : (
          sortedFriends.map((r) => {
            const f = r.other;
            const i = info[f.id];
            const live = i?.shared.filter((x) => !x.stats.ended) ?? [];
            const nudgeIn = i?.shared.find((x) => x.nudgeable);
            const status =
              !i || i.today === "none"
                ? null
                : i.today === "pending"
                  ? { text: "not in yet today", cls: "text-muted", dot: "bg-line" }
                  : i.today === "slipped"
                    ? { text: "slipped today", cls: "text-broke", dot: "bg-broke" }
                    : { text: "checked in today", cls: "text-kept", dot: "bg-kept" };
            return (
              <div key={r.id} className="py-3">
                <div className="flex items-center gap-3">
                  <span className="relative shrink-0">
                    <Avatar profile={f} size={40} />
                    {status ? <span className={cx("absolute -bottom-0.5 -right-0.5 h-3.5 w-3.5 rounded-full ring-2 ring-surface", status.dot)} aria-hidden="true" /> : null}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="truncate font-semibold">{f.display_name}</div>
                    <div className="truncate text-xs text-muted">
                      @{f.username}
                      {status ? (
                        <>
                          {" · "}
                          <span className={status.cls}>{status.text}</span>
                        </>
                      ) : null}
                    </div>
                  </div>
                  {nudgeIn ? (
                    <Button size="sm" variant="soft" loading={busy === `n-${f.id}`} onClick={() => nudge(nudgeIn.pact.id, f.id, f.display_name)} title={`Nudge about ${nudgeIn.pact.name}`}>
                      <IconNudge size={16} />
                      Nudge
                    </Button>
                  ) : null}
                </div>
                <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-2 pl-[52px]">
                  {live.length ? (
                    <span className="flex items-center gap-1">
                      {live.slice(0, 4).map((x) => (
                        <Link key={x.pact.id} href={`/pacts/${x.pact.id}`} title={x.pact.name} aria-label={x.pact.name}>
                          <PactIcon emoji={x.pact.emoji} size={24} />
                        </Link>
                      ))}
                      {live.length > 4 ? <span className="text-xs text-muted">+{live.length - 4}</span> : null}
                    </span>
                  ) : (
                    <span className="text-xs text-muted">{i ? "No pacts together right now" : ""}</span>
                  )}
                  {i && i.streak > 0 ? (
                    <span className="flex items-center gap-0.5 text-xs font-semibold text-pink">
                      <IconFlame size={13} />
                      {i.streak}-{live.some((x) => x.pact.goal_type !== "weekly") ? "day" : "week"} streak
                    </span>
                  ) : null}
                  <span className="ml-auto flex items-center gap-3">
                    <Link href={`/pacts/new?with=${f.id}`} className="text-xs font-semibold text-pink hover:underline">
                      Start a pact
                    </Link>
                    {confirm === f.id ? (
                      <span className="flex items-center gap-1">
                        <Button size="sm" variant="danger" loading={busy === f.id} onClick={() => remove(f.id)}>
                          Remove
                        </Button>
                        <Button size="sm" variant="ghost" onClick={() => setConfirm(null)}>
                          Keep
                        </Button>
                      </span>
                    ) : (
                      <button className="text-xs font-semibold text-muted hover:text-broke" onClick={() => setConfirm(f.id)}>
                        Remove
                      </button>
                    )}
                  </span>
                </div>
              </div>
            );
          })
        )}
      </Card>

      {outgoing.length ? (
        <>
          <SectionTitle>Waiting on them</SectionTitle>
          <Card className="divide-y divide-line px-4">
            {outgoing.map((r) => (
              <div key={r.id} className="flex items-center gap-3 py-3">
                <Avatar profile={r.other} size={36} />
                <div className="flex-1">
                  <div className="font-semibold">{r.other.display_name}</div>
                  <div className="text-xs text-muted">@{r.other.username}</div>
                </div>
                <button className="text-xs font-semibold text-muted hover:text-broke" onClick={() => remove(r.other.id)}>
                  Cancel
                </button>
              </div>
            ))}
          </Card>
        </>
      ) : null}
      </div>
    </div>
  );
}
