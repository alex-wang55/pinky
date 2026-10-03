"use client";

import { useCallback, useEffect, useState } from "react";
import { Shell } from "@/components/shell";
import { useAuth } from "@/components/auth";
import { Avatar, Button, Card, IconButton, LargeTitle, List, Row, SectionTitle, Sheet, Tile, inputCls, useToast } from "@/components/ui";
import { supabase, errMsg } from "@/lib/supabase";
import { action } from "@/lib/api";
import type { Profile } from "@/lib/types";
import { IconMore, IconShare, IconX } from "@/components/icons";

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
  const confirmed = friends.find((r) => r.other.id === confirm);

  return (
    <div>
      <LargeTitle title="Friends" sub={friends.length ? `${friends.length} ${friends.length === 1 ? "person" : "people"} holding you to it` : "The people who hold you to it"} />

      <form onSubmit={add} className="flex gap-2">
        <div className="relative flex-1">
          <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-[16px] text-faint">@</span>
          <input
            className={inputCls + " h-11 rounded-full !bg-surface py-0 pl-8 shadow-card"}
            placeholder="username to add"
            autoCapitalize="none"
            autoCorrect="off"
            spellCheck={false}
            value={username}
            onChange={(e) => setUsername(e.target.value.replace(/\s/g, ""))}
            aria-label="Friend's username"
          />
        </div>
        <Button type="submit" loading={busy === "add"} disabled={!username.trim()}>
          Add
        </Button>
      </form>

      <List className="mt-3" inset={60}>
        <Row
          onClick={share}
          leading={
            <Tile>
              <IconShare size={17} />
            </Tile>
          }
          title="Share your link"
          subtitle={link.replace(/^https?:\/\//, "")}
          chevron
        />
      </List>

      {incoming.length ? (
        <>
          <SectionTitle>Requests</SectionTitle>
          <List inset={68}>
            {incoming.map((r) => (
              <Row
                key={r.id}
                leading={<Avatar profile={r.other} size={40} />}
                title={r.other.display_name}
                subtitle={`@${r.other.username}`}
                trailing={
                  <>
                    <Button size="sm" loading={busy === r.id} onClick={() => respond(r.id, true)}>
                      Accept
                    </Button>
                    <IconButton tone="ghost" label={`Decline ${r.other.display_name}`} onClick={() => respond(r.id, false)} className="-mr-2">
                      <IconX size={16} />
                    </IconButton>
                  </>
                }
              />
            ))}
          </List>
        </>
      ) : null}

      <SectionTitle>Your friends</SectionTitle>
      {rows === null ? (
        <p className="px-1 text-[15px] text-muted">Loading...</p>
      ) : friends.length === 0 ? (
        <Card className="px-6 py-8 text-center">
          <p className="text-[15px] text-muted">No friends yet. Add someone by username, or share your link and they can add you.</p>
        </Card>
      ) : (
        <List inset={68}>
          {friends.map((r) => (
            <Row
              key={r.id}
              leading={<Avatar profile={r.other} size={40} />}
              title={r.other.display_name}
              subtitle={`@${r.other.username}`}
              trailing={
                <IconButton tone="ghost" label={`Options for ${r.other.display_name}`} onClick={() => setConfirm(r.other.id)} className="-mr-2">
                  <IconMore size={20} />
                </IconButton>
              }
            />
          ))}
        </List>
      )}

      {outgoing.length ? (
        <>
          <SectionTitle>Waiting on them</SectionTitle>
          <List inset={68}>
            {outgoing.map((r) => (
              <Row
                key={r.id}
                leading={<Avatar profile={r.other} size={40} />}
                title={r.other.display_name}
                subtitle={`@${r.other.username}`}
                trailing={
                  <Button size="sm" variant="ghost" onClick={() => remove(r.other.id)}>
                    Cancel
                  </Button>
                }
              />
            ))}
          </List>
        </>
      ) : null}

      <Sheet open={confirm !== null} onClose={() => setConfirm(null)} title={confirmed ? confirmed.other.display_name : ""}>
        <p className="mb-3 px-1 text-[15px] text-muted">Removing a friend doesn&apos;t take them out of pacts you&apos;re already in together.</p>
        <Button variant="danger" size="lg" className="w-full" loading={busy === confirm} onClick={() => confirm && remove(confirm)}>
          Remove friend
        </Button>
        <Button variant="soft" size="lg" className="mt-2 w-full" onClick={() => setConfirm(null)}>
          Cancel
        </Button>
      </Sheet>
    </div>
  );
}
