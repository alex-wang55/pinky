"use client";

import { useParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { useAuth } from "@/components/auth";
import { Button, Card, PageLoader } from "@/components/ui";
import { LogoMark } from "@/components/logo";
import { action } from "@/lib/api";
import { errMsg } from "@/lib/supabase";

export default function AddFriend() {
  const { username } = useParams<{ username: string }>();
  const { session, profile, loading } = useAuth();
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const ran = useRef(false);
  const uname = decodeURIComponent(username).toLowerCase();

  useEffect(() => {
    if (!session || !profile || ran.current) return;
    ran.current = true;
    if (profile.username === uname) {
      setMsg("That's your own link. Send it to a friend.");
      return;
    }
    action<{ result: string }>({ action: "friend_request", username: uname })
      .then(({ result }) =>
        setMsg(
          result === "sent"
            ? `Request sent to @${uname}. Once they accept, you can make a pact.`
            : result === "accepted"
              ? `You and @${uname} are friends now.`
              : result === "already_friends"
                ? `You're already friends with @${uname}.`
                : `Request to @${uname} is already waiting.`,
        ),
      )
      .catch((e) => setErr(errMsg(e)));
  }, [session, profile, uname]);

  if (loading) return <PageLoader />;
  const next = encodeURIComponent(`/add/${uname}`);

  return (
    <div className="mx-auto flex min-h-dvh max-w-sm flex-col items-center justify-center px-5 text-center">
      <LogoMark size={64} />
      <Card className="mt-6 w-full p-6">
        {!session ? (
          <>
            <h1 className="font-display text-2xl font-bold">@{uname} wants you on Pinky</h1>
            <p className="mt-2 text-muted">Pinky promise each other you&apos;ll stick to it. Make an account to connect.</p>
            <div className="mt-5 flex flex-col gap-2">
              <Button href={`/signup?next=${next}`} size="lg">
                Make an account
              </Button>
              <Button href={`/login?next=${next}`} size="lg" variant="soft">
                Log in
              </Button>
            </div>
          </>
        ) : err ? (
          <>
            <p className="font-semibold text-broke">{err}</p>
            <Button href="/friends" className="mt-4" variant="soft">
              Go to friends
            </Button>
          </>
        ) : msg ? (
          <>
            <p className="font-semibold">{msg}</p>
            <div className="mt-4 flex justify-center gap-2">
              <Button href="/pacts/new">Make a pact</Button>
              <Button href="/" variant="soft">
                Home
              </Button>
            </div>
          </>
        ) : (
          <PageLoader />
        )}
      </Card>
    </div>
  );
}
