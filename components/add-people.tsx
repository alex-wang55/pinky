"use client";

import { useEffect, useState } from "react";
import { useAuth } from "./auth";
import { Avatar, Button, List, Row, useToast } from "./ui";
import { IconShare } from "./icons";
import { supabase, errMsg } from "@/lib/supabase";
import { action } from "@/lib/api";
import type { Pact, Profile } from "@/lib/types";

/** Invite link + friends who aren't in the pact yet. Used on the pact page. */
export function AddPeople({ pact, memberIds, onChange }: { pact: Pact; memberIds: string[]; onChange: () => void }) {
  const { session } = useAuth();
  const me = session!.user.id;
  const toast = useToast();
  const [friends, setFriends] = useState<Profile[] | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [origin, setOrigin] = useState("");
  const [confirmReset, setConfirmReset] = useState(false);
  const isCreator = pact.created_by === me;

  useEffect(() => setOrigin(window.location.origin), []);

  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from("friendships")
        .select("requester, addressee, r:profiles!friendships_requester_fkey(id,username,display_name,color), a:profiles!friendships_addressee_fkey(id,username,display_name,color)")
        .eq("status", "accepted");
      setFriends((data ?? []).map((f) => (f.requester === me ? f.a : f.r) as unknown as Profile));
    })();
  }, [me]);

  const link = `${origin}/join/${pact.invite_code}`;
  const invitable = (friends ?? []).filter((f) => !memberIds.includes(f.id));

  async function share() {
    const nav = navigator as Navigator & { share?: (d: ShareData) => Promise<void> };
    const text = `Join my pact on Pinky: ${pact.emoji} ${pact.name}`;
    if (nav.share) {
      try {
        await nav.share({ title: "Pinky", text, url: link });
        return;
      } catch {
        /* cancelled, fall through to copy */
      }
    }
    try {
      await navigator.clipboard.writeText(link);
      toast("Link copied");
    } catch {
      toast(link);
    }
  }

  async function invite(f: Profile) {
    setBusy(f.id);
    try {
      await action({ action: "invite", pactId: pact.id, users: [f.id] });
      toast(`Invited ${f.display_name}`);
      onChange();
    } catch (e) {
      toast(errMsg(e), "err");
    } finally {
      setBusy(null);
    }
  }

  async function resetLink() {
    setBusy("reset");
    const { error } = await supabase.rpc("reset_invite_code", { p_pact: pact.id });
    setBusy(null);
    setConfirmReset(false);
    if (error) return toast(errMsg(error), "err");
    toast("New link made. The old one stops working.");
    onChange();
  }

  return (
    <div>
      <p className="mb-1.5 px-1 text-[13px] font-medium text-muted">Invite link</p>
      <List>
        <div className="flex items-center gap-3 px-4 py-3">
          <span className="min-w-0 flex-1 truncate text-[15px]">{link.replace(/^https?:\/\//, "")}</span>
          <Button size="sm" onClick={share}>
            <IconShare size={15} />
            Share
          </Button>
        </div>
      </List>
      <div className="mt-1.5 flex items-start justify-between gap-3 px-1 text-[13px] text-muted">
        <span>Anyone with the link can join, even if they&apos;re not on Pinky yet.</span>
        {isCreator && !confirmReset ? (
          <button className="shrink-0 font-medium text-pink active:opacity-60" onClick={() => setConfirmReset(true)}>
            Reset link
          </button>
        ) : null}
      </div>
      {isCreator && confirmReset ? (
        <div className="animate-pop mt-2 flex items-center gap-2 rounded-xl bg-surface p-3 text-[14px]">
          <span className="flex-1 text-muted">Make a new link? The current one stops working.</span>
          <Button size="sm" variant="ghost" onClick={() => setConfirmReset(false)}>
            Cancel
          </Button>
          <Button size="sm" variant="tinted" loading={busy === "reset"} onClick={resetLink}>
            Reset
          </Button>
        </div>
      ) : null}

      <p className="mb-1.5 mt-6 px-1 text-[13px] font-medium text-muted">Your friends</p>
      {friends === null ? (
        <p className="px-1 text-[15px] text-muted">Loading...</p>
      ) : invitable.length === 0 ? (
        <List>
          <Row
            href="/friends"
            title={friends.length ? "All your friends are already in" : "No friends added yet"}
            subtitle="Add friends on Pinky to invite them here"
            chevron
          />
        </List>
      ) : (
        <List inset={64}>
          {invitable.map((f) => (
            <Row
              key={f.id}
              leading={<Avatar profile={f} size={36} />}
              title={f.display_name}
              subtitle={`@${f.username}`}
              trailing={
                <Button size="sm" variant="tinted" loading={busy === f.id} onClick={() => invite(f)}>
                  Invite
                </Button>
              }
            />
          ))}
        </List>
      )}

      <p className="mt-4 px-1 text-[13px] text-muted">People who join late start counting from the day they join. Nothing before that counts against them.</p>
    </div>
  );
}
