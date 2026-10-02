"use client";

import { useCallback, useEffect, useState } from "react";
import { Shell } from "@/components/shell";
import { useAuth } from "@/components/auth";
import { Avatar, Button, Card, SectionTitle, inputCls, useToast } from "@/components/ui";
import { supabase, errMsg } from "@/lib/supabase";
import { action } from "@/lib/api";
import type { Profile } from "@/lib/types";
import { IconX } from "@/components/icons";

type Row = { id: string; status: "pending" | "accepted"; requester: string; addressee: string; other: Profile; incoming: boolean };

export default function FriendsPage() {
  return (
    <Shell>
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

  useEffect(() => {
    load();
  }, [load]);

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

  return (
    <div>
      <h1 className="px-1 font-display text-[28px] font-extrabold">Friends</h1>
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

      <SectionTitle>Your people {friends.length ? `· ${friends.length}` : ""}</SectionTitle>
      <Card className="divide-y divide-line px-4">
        {rows === null ? (
          <p className="py-4 text-sm text-muted">Loading...</p>
        ) : friends.length === 0 ? (
          <p className="py-4 text-sm text-muted">No friends yet. Add someone by username or send them your link.</p>
        ) : (
          friends.map((r) => (
            <div key={r.id} className="flex items-center gap-3 py-3">
              <Avatar profile={r.other} size={40} />
              <div className="flex-1">
                <div className="font-semibold">{r.other.display_name}</div>
                <div className="text-xs text-muted">@{r.other.username}</div>
              </div>
              {confirm === r.other.id ? (
                <>
                  <Button size="sm" variant="danger" loading={busy === r.other.id} onClick={() => remove(r.other.id)}>
                    Remove
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => setConfirm(null)}>
                    Keep
                  </Button>
                </>
              ) : (
                <button className="text-xs font-semibold text-muted hover:text-broke" onClick={() => setConfirm(r.other.id)}>
                  Remove
                </button>
              )}
            </div>
          ))
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
  );
}
