"use client";

import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { useAuth } from "@/components/auth";
import { Button, Card, GroupLabel, List, PageLoader, Row, useToast } from "@/components/ui";
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
    <div className="mx-auto flex min-h-dvh max-w-sm flex-col justify-center px-5 py-10">
      {p === null ? (
        <div className="flex flex-col items-center text-center">
          <LogoMark size={56} />
          <h1 className="mt-5 text-[24px] font-bold tracking-[-0.02em]">This link doesn&apos;t work anymore</h1>
          <p className="mt-1 text-[15px] text-muted">Ask whoever sent it for a fresh one.</p>
          <Button href="/" className="mt-6" variant="soft">
            Go to Pinky
          </Button>
        </div>
      ) : (
        <>
          <div className="flex flex-col items-center text-center">
            <Pet stage={0} mood={p.ended ? "sleeping" : "waiting"} size={104} />
            <p className="mt-1 text-[15px] font-medium text-pink">{p.creator ? `${p.creator.split(" ")[0]} invited you` : "You're invited"}</p>
            <h1 className="mt-1 text-[28px] font-bold leading-tight tracking-[-0.02em]">
              {p.emoji} {p.name}
            </h1>
            <p className="mt-1 text-[15px] text-muted">
              {p.member_count} {p.member_count === 1 ? "person" : "people"} in · {shortDay(p.start_date)} to {shortDay(p.end_date)}
            </p>
          </div>

          <List className="mt-6">
            <Row title="Goal" trailing={<span className="text-[16px] text-muted">{goal}</span>} />
            <Row title="Per miss" trailing={<span className="text-[16px] text-muted">{money(p.stake_cents)}{p.escalating ? ", doubling" : ""}</span>} />
            {p.off_days_per_week > 0 ? <Row title="Off-days" trailing={<span className="text-[16px] text-muted">{p.off_days_per_week} a week</span>} /> : null}
          </List>
          {p.rules ? (
            <>
              <GroupLabel>Breaking it means</GroupLabel>
              <Card className="p-4 text-[15px] leading-snug">{p.rules}</Card>
            </>
          ) : null}

          <div className="mt-6">
            {p.ended ? (
              <p className="text-center text-[15px] text-muted">This pact is already over.</p>
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
            {!p.ended && p.my_status !== "active" ? <p className="mt-3 text-center text-[13px] text-muted">You start counting from the day you join.</p> : null}
          </div>
        </>
      )}
    </div>
  );
}
