"use client";

import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { useAuth } from "@/components/auth";
import { Button, Card, PageLoader, useToast } from "@/components/ui";
import { LogoMark } from "@/components/logo";
import { Pet } from "@/components/pet";
import { supabase, errMsg } from "@/lib/supabase";
import { shortDay } from "@/lib/dates";
import { money } from "@/lib/money";

type Preview = {
  id: string;
  name: string;
  emoji: string;
  rules: string | null;
  goal_type: "daily" | "count" | "weekly";
  target: number | null;
  unit: string | null;
  stake_cents: number;
  escalating: boolean;
  off_days_per_week: number;
  start_date: string;
  end_date: string;
  ended: boolean;
  creator: string | null;
  member_count: number;
  my_status: "invited" | "active" | null;
};

export default function JoinPage() {
  const { code } = useParams<{ code: string }>();
  const { session, loading } = useAuth();
  const router = useRouter();
  const toast = useToast();
  const [p, setP] = useState<Preview | null | undefined>(undefined);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (loading) return;
    supabase.rpc("pact_preview", { p_code: code }).then(({ data, error }) => {
      if (error) {
        toast(errMsg(error), "err");
        setP(null);
      } else setP((data as Preview) ?? null);
    });
  }, [code, loading, session?.user.id, toast]);

  async function join() {
    setBusy(true);
    const { data, error } = await supabase.rpc("join_pact", { p_code: code });
    setBusy(false);
    if (error) return toast(errMsg(error), "err");
    toast("You're in. Pinky promise.");
    router.replace(`/pacts/${data}`);
  }

  if (loading || p === undefined) return <PageLoader />;
  const next = encodeURIComponent(`/join/${code}`);
  const goal =
    p?.goal_type === "count"
      ? `${Number(p.target).toLocaleString()} ${p.unit ?? ""} a day`
      : p?.goal_type === "weekly"
        ? `${p.target}x a week`
        : "Every day";

  return (
    <div className="mx-auto flex min-h-dvh max-w-sm flex-col items-center justify-center px-5 py-10">
      <LogoMark size={48} />
      {p === null ? (
        <Card className="mt-6 w-full p-6 text-center">
          <h1 className="font-display text-2xl font-extrabold">This link doesn&apos;t work anymore</h1>
          <p className="mt-2 text-muted">Ask whoever sent it for a fresh one.</p>
          <Button href="/" className="mt-5" variant="soft">
            Go to Pinky
          </Button>
        </Card>
      ) : (
        <Card className="mt-6 w-full overflow-hidden">
          <div className="flex flex-col items-center bg-pink-soft px-6 pb-5 pt-6 text-center">
            <Pet stage={0} mood={p.ended ? "sleeping" : "waiting"} size={88} />
            <p className="mt-1 text-xs font-bold uppercase tracking-wider text-pink">{p.creator ? `${p.creator} invited you` : "You're invited"}</p>
            <h1 className="mt-1 font-display text-2xl font-extrabold leading-tight">
              {p.emoji} {p.name}
            </h1>
            <p className="mt-1 text-sm text-muted">
              {p.member_count} {p.member_count === 1 ? "person" : "people"} in · {shortDay(p.start_date)} to {shortDay(p.end_date)}
            </p>
          </div>
          <div className="space-y-3 p-6">
            <div className="flex flex-wrap justify-center gap-1.5 text-xs font-semibold">
              <span className="rounded-full bg-surface-2 px-2.5 py-1">{goal}</span>
              <span className="rounded-full bg-surface-2 px-2.5 py-1">
                {money(p.stake_cents)}/miss{p.escalating ? ", escalating" : ""}
              </span>
              {p.off_days_per_week > 0 ? (
                <span className="rounded-full bg-surface-2 px-2.5 py-1">
                  {p.off_days_per_week} off-day{p.off_days_per_week === 1 ? "" : "s"}/wk
                </span>
              ) : null}
            </div>
            {p.rules ? (
              <p className="rounded-xl bg-surface-2 px-3 py-2 text-sm">
                <span className="font-semibold">Breaking it means: </span>
                {p.rules}
              </p>
            ) : null}

            {p.ended ? (
              <p className="text-center text-sm font-semibold text-muted">This pact is already over.</p>
            ) : p.my_status === "active" ? (
              <Button href={`/pacts/${p.id}`} size="lg" className="w-full">
                You&apos;re already in. Open it
              </Button>
            ) : !session ? (
              <div className="flex flex-col gap-2">
                <Button href={`/signup?next=${next}`} size="lg">
                  Make an account to join
                </Button>
                <Button href={`/login?next=${next}`} size="lg" variant="soft">
                  I have an account
                </Button>
              </div>
            ) : (
              <Button size="lg" className="w-full" loading={busy} onClick={join}>
                Join the pact
              </Button>
            )}
            {!p.ended && p.my_status !== "active" ? (
              <p className="text-center text-xs text-muted">You start counting from the day you join.</p>
            ) : null}
          </div>
        </Card>
      )}
    </div>
  );
}
