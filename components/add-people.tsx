"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useAuth } from "./auth";
import { Avatar, Button, useToast } from "./ui";
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
    const text = `Join my pact on Pinky: ${pact.name}`;
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
    <div className="space-y-4">
      <div>
        <p className="text-sm font-semibold">Send an invite link</p>
        <p className="mt-0.5 text-xs text-muted">Anyone with it can join, even if they&apos;re not on Pinky yet.</p>
        <div className="mt-2 flex items-center gap-2 rounded-2xl bg-surface-2 p-3">
          <span className="min-w-0 flex-1 truncate text-sm font-semibold">{link.replace(/^https?:\/\//, "")}</span>
          <Button size="sm" onClick={share}>
            Share
          </Button>
        </div>
        {isCreator ? (
          confirmReset ? (
            <div className="mt-2 flex items-center gap-2 text-xs">
              <span className="flex-1 text-muted">Make a new link? The current one stops working.</span>
              <Button size="sm" variant="ghost" onClick={() => setConfirmReset(false)}>
                Cancel
              </Button>
              <Button size="sm" variant="soft" loading={busy === "reset"} onClick={resetLink}>
                Reset
              </Button>
            </div>
          ) : (
            <button className="mt-2 text-xs font-semibold text-muted hover:text-ink" onClick={() => setConfirmReset(true)}>
              Reset link
            </button>
          )
        ) : null}
      </div>

      <div>
        <p className="text-sm font-semibold">Or invite a friend</p>
        {friends === null ? (
          <p className="mt-1 text-sm text-muted">Loading...</p>
        ) : invitable.length === 0 ? (
          <p className="mt-1 text-sm text-muted">
            {friends.length ? "All your friends are already in." : "No friends added yet."}{" "}
            <Link className="font-semibold text-pink" href="/friends">
              Add friends
            </Link>
          </p>
        ) : (
          <div className="mt-1 divide-y divide-line">
            {invitable.map((f) => (
              <div key={f.id} className="flex items-center gap-3 py-2.5">
                <Avatar profile={f} size={34} />
                <span className="flex-1 font-semibold">{f.display_name}</span>
                <Button size="sm" variant="soft" loading={busy === f.id} onClick={() => invite(f)}>
                  Invite
                </Button>
              </div>
            ))}
          </div>
        )}
      </div>

      <p className="text-xs text-muted">People who join late start counting from the day they join. Nothing before that counts against them.</p>
    </div>
  );
}
