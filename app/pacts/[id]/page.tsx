"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Shell } from "@/components/shell";
import { useAuth } from "@/components/auth";
import { Button, Card, PageLoader, Segmented, SectionTitle, useToast } from "@/components/ui";
import { CheckIn } from "@/components/checkin";
import { Feed, Ledger, Squad } from "@/components/pact-parts";
import { PetPanel } from "@/components/pet-panel";
import { AddPeople } from "@/components/add-people";
import { supabase, errMsg } from "@/lib/supabase";
import { loadBundle, type Bundle } from "@/lib/data";
import { computePact, goalLabel, wrapWeek } from "@/lib/stats";
import { addDays, dayOfWeek, prettyDay, shortDay } from "@/lib/dates";
import { money } from "@/lib/money";
import type { Pact } from "@/lib/types";
import { PactIcon } from "@/components/pact-icon";
import { IconArrowRight, IconCalendar, IconChart, IconFlame, IconPlusUser, IconX } from "@/components/icons";

export default function PactPage() {
  return (
    <Shell title="Pacts" back="/" wide>
      <PactView />
    </Shell>
  );
}

function PactView() {
  const { id } = useParams<{ id: string }>();
  const { session } = useAuth();
  const userId = session!.user.id;
  const toast = useToast();
  const [bundle, setBundle] = useState<Bundle | null>(null);
  const [missing, setMissing] = useState(false);
  const [nudged, setNudged] = useState<Set<string>>(new Set());
  const [proofUrls, setProofUrls] = useState<Record<string, string>>({});
  const [tab, setTab] = useState<"feed" | "pot" | "info">("feed");
  const [adding, setAdding] = useState(false);

  const load = useCallback(async () => {
    try {
      const b = await loadBundle([id], true);
      if (b.pacts.length === 0) {
        setMissing(true);
        return;
      }
      setBundle(b);
      const { data: n } = await supabase.from("nudges").select("to_user, day").eq("pact_id", id).eq("from_user", userId);
      const paths = b.checkins.map((c) => c.proof_path).filter(Boolean) as string[];
      const known = new Set(Object.keys(proofUrls));
      const fresh = paths.filter((p) => !known.has(p));
      if (fresh.length) {
        const { data: signed } = await supabase.storage.from("proofs").createSignedUrls(fresh, 60 * 60 * 6);
        if (signed) {
          setProofUrls((prev) => {
            const next = { ...prev };
            for (const s of signed) if (s.path && s.signedUrl) next[s.path] = s.signedUrl;
            return next;
          });
        }
      }
      const pact = b.pacts[0];
      const t = new Intl.DateTimeFormat("en-CA", { timeZone: pact.timezone, year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
      setNudged(new Set((n ?? []).filter((x) => x.day === t).map((x) => x.to_user as string)));
    } catch (e) {
      toast(errMsg(e), "err");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, userId, toast]);

  useEffect(() => {
    load();
    const onFocus = () => load();
    window.addEventListener("focus", onFocus);
    return () => window.removeEventListener("focus", onFocus);
  }, [load]);

  const stats = useMemo(() => (bundle ? computePact(bundle.pacts[0], bundle.members, bundle.checkins, bundle.doubts) : null), [bundle]);

  if (missing)
    return (
      <Card className="p-6 text-center">
        <p className="font-semibold">This pact doesn&apos;t exist or you&apos;re not in it.</p>
        <Button href="/" className="mt-4" variant="soft">
          Back home
        </Button>
      </Card>
    );
  if (!bundle || !stats) return <PageLoader />;

  const pact = bundle.pacts[0];
  const me = bundle.members.find((m) => m.user_id === userId);
  const isInvited = me?.status === "invited";

  return (
    <div className="lg:grid lg:grid-cols-2 lg:items-start lg:gap-8">
      <div>
      <Card className="overflow-hidden">
        <div className="bg-gradient-to-br from-pink-soft to-surface p-5">
          <div className="flex items-start gap-3">
            <PactIcon emoji={pact.emoji} size={56} className="shadow-card ring-4 ring-surface" />
            <div className="min-w-0 flex-1">
              <h1 className="font-display text-2xl font-bold leading-tight">{pact.name}</h1>
              <p className="text-sm text-muted">
                {stats.ended
                  ? `Ended ${shortDay(pact.end_date)}`
                  : stats.started
                    ? `Day ${stats.dayNumber} of ${stats.totalDays} · ${stats.daysLeft} left`
                    : `Starts ${prettyDay(pact.start_date, stats.today)}`}
              </p>
            </div>
          </div>
          <div className="mt-4 flex flex-wrap gap-1.5 text-xs font-semibold">
            <Chip>{goalLabel(pact)}</Chip>
            <Chip>
              {money(pact.stake_cents)}/miss{pact.escalating ? ", escalating" : ""}
            </Chip>
            {pact.off_days_per_week > 0 && pact.goal_type !== "weekly" ? <Chip>{pact.off_days_per_week} off-day{pact.off_days_per_week === 1 ? "" : "s"}/wk</Chip> : null}
            <Chip>
              {shortDay(pact.start_date)} to {shortDay(pact.end_date)}
            </Chip>
          </div>
          {pact.rules ? (
            <p className="mt-3 rounded-xl bg-surface/70 px-3 py-2 text-sm">
              <span className="font-semibold">Breaking it means: </span>
              {pact.rules}
            </p>
          ) : null}
        </div>
        <div className="grid grid-cols-3 divide-x divide-line border-t border-line">
          <Stat
            label={`Group ${stats.unit}s`}
            value={
              <span className="inline-flex items-center gap-1">
                <IconFlame size={18} className={stats.groupStreak > 0 ? "text-pink" : "text-muted"} />
                {stats.groupStreak}
              </span>
            }
          />
          <Stat label="Best streak" value={String(stats.bestGroupStreak)} />
          <Stat label="Pot" value={money(stats.potCents)} />
        </div>
      </Card>

      {!isInvited ? <PetPanel pact={pact} stats={stats} onChange={load} /> : null}

      {isInvited ? (
        <Card className="mt-3 p-4">
          <p className="font-semibold">You&apos;re invited to this pact.</p>
          <div className="mt-3 grid grid-cols-2 gap-2">
            <Button
              onClick={async () => {
                const { error } = await supabase.rpc("respond_pact_invite", { p_pact: pact.id, p_accept: true });
                if (error) return toast(errMsg(error), "err");
                toast("You're in.");
                load();
              }}
            >
              I&apos;m in
            </Button>
            <Button
              variant="soft"
              onClick={async () => {
                const { error } = await supabase.rpc("respond_pact_invite", { p_pact: pact.id, p_accept: false });
                if (error) return toast(errMsg(error), "err");
                window.location.href = "/";
              }}
            >
              Decline
            </Button>
          </div>
        </Card>
      ) : (
        <>
          {!stats.ended ? (
            <>
              <SectionTitle>{pact.goal_type === "weekly" ? "Your week" : "Your check-in"}</SectionTitle>
              <Card className="p-4">
                <CheckIn pact={pact} stats={stats} userId={userId} doubts={bundle.doubts} onChange={load} full />
              </Card>
            </>
          ) : (
            <Link href={`/pacts/${pact.id}/recap`} className="mt-3 block">
              <Card className="flex items-center justify-between bg-ink p-4 text-bg">
                <span className="font-display text-lg font-bold">See the final recap</span>
                <IconArrowRight size={20} />
              </Card>
            </Link>
          )}

          <SectionTitle
            right={
              !stats.ended ? (
                <button
                  className="flex items-center gap-1 rounded-full px-2 py-1 text-xs font-semibold text-pink hover:bg-pink-soft"
                  onClick={() => setAdding((a) => !a)}
                  aria-expanded={adding}
                >
                  {adding ? <IconX size={14} /> : <IconPlusUser size={14} />}
                  {adding ? "Close" : "Add people"}
                </button>
              ) : null
            }
          >
            Squad
          </SectionTitle>
          {adding && !stats.ended ? (
            <Card className="animate-pop mb-3 p-4">
              <AddPeople pact={pact} memberIds={bundle.members.map((m) => m.user_id)} onChange={load} />
            </Card>
          ) : null}
          <Card className="p-4">
            <Squad pact={pact} stats={stats} members={bundle.members} userId={userId} nudgedToday={nudged} hypes={bundle.hypes} onNudged={load} />
          </Card>

          {stats.started && addDays(wrapWeek(stats.today), 6) >= pact.start_date && [0, 1].includes(dayOfWeek(stats.today)) ? (
            <Link href={`/pacts/${pact.id}/week`} className="mt-3 block">
              <Card className="flex items-center gap-3 border-pink/30 bg-pink-soft p-4">
                <IconCalendar size={22} className="shrink-0 text-pink" />
                <span className="flex-1">
                  <span className="block font-semibold">Weekly wrap is in</span>
                  <span className="block text-sm text-muted">See how the week went and who carried the group.</span>
                </span>
                <IconArrowRight size={18} className="text-pink" />
              </Card>
            </Link>
          ) : null}
        </>
      )}
      </div>

      {!isInvited ? (
        <div className="mt-6 lg:mt-0">
          <div>
            <Segmented
              value={tab}
              onChange={setTab}
              options={[
                { value: "feed", label: "Feed" },
                { value: "pot", label: "Pot" },
                { value: "info", label: "More" },
              ]}
            />
          </div>
          <div className="mt-4">
            {tab === "feed" ? (
              <Feed
                pact={pact}
                stats={stats}
                members={bundle.members}
                checkins={bundle.checkins}
                doubts={bundle.doubts}
                reactions={bundle.reactions}
                userId={userId}
                proofUrls={proofUrls}
                onChange={load}
              />
            ) : tab === "pot" ? (
              <Card className="p-4">
                <Ledger pact={pact} stats={stats} members={bundle.members} />
              </Card>
            ) : (
              <InfoTab pact={pact} ended={stats.ended} memberIds={bundle.members.map((m) => m.user_id)} onChange={load} />
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
}

function Chip({ children }: { children: React.ReactNode }) {
  return <span className="rounded-full bg-surface/80 px-2.5 py-1 ring-1 ring-line">{children}</span>;
}

function Stat({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="px-2 py-3 text-center">
      <div className="font-display text-xl font-bold tabular">{value}</div>
      <div className="text-[10px] font-semibold uppercase tracking-wide text-muted">{label}</div>
    </div>
  );
}

function InfoTab({ pact, ended, memberIds, onChange }: { pact: Pact; ended: boolean; memberIds: string[]; onChange: () => void }) {
  const { session } = useAuth();
  const me = session!.user.id;
  const pactId = pact.id;
  const isCreator = pact.created_by === me;
  const router = useRouter();
  const toast = useToast();
  const [busy, setBusy] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);

  return (
    <div className="space-y-3">
      <Link href={`/pacts/${pactId}/week`}>
        <Card className="flex items-center justify-between p-4">
          <span className="flex items-center gap-2 font-semibold">
            <IconCalendar size={18} className="text-pink" />
            Weekly wrap
          </span>
          <IconArrowRight size={18} className="text-pink" />
        </Card>
      </Link>
      <Link href={`/pacts/${pactId}/recap`}>
        <Card className="flex items-center justify-between p-4">
          <span className="flex items-center gap-2 font-semibold">
            <IconChart size={18} className="text-pink" />
            {ended ? "Final recap" : "Recap so far"}
          </span>
          <IconArrowRight size={18} className="text-pink" />
        </Card>
      </Link>

      {!ended ? (
        <Card className="p-4">
          <p className="mb-3 font-semibold">Add people</p>
          <AddPeople pact={pact} memberIds={memberIds} onChange={onChange} />
        </Card>
      ) : null}

      <Card className="space-y-2 p-4 text-sm text-muted">
        <p className="font-semibold text-ink">House rules</p>
        <p>• Check in before midnight. No check-in counts as broke.</p>
        <p>• You get one doubt per week in each pact. The other person has 24h to post a photo or own up.</p>
        <p>• Off-days don&apos;t break the streak but they&apos;re limited per week.</p>
        <p>• The group streak resets if anyone breaks.</p>
      </Card>

      {ended ? (
        <Card className="flex items-center justify-between gap-3 p-4">
          <span className="text-sm text-muted">Done with this one? Take it off your home screen. You can bring it back later.</span>
          <Button
            size="sm"
            variant="soft"
            loading={busy === "hide"}
            onClick={async () => {
              setBusy("hide");
              const { error } = await supabase.rpc("hide_pact", { p_pact: pactId, p_hidden: true });
              setBusy(null);
              if (error) return toast(errMsg(error), "err");
              toast("Hidden from your list");
              router.replace("/");
            }}
          >
            Hide
          </Button>
        </Card>
      ) : null}

      {isCreator ? (
        <Card className="p-4">
          {confirmDelete ? (
            <div className="flex items-center gap-2">
              <span className="flex-1 text-sm font-semibold">Delete for everyone? Check-ins, confessions and the recap go too. This can&apos;t be undone.</span>
              <Button size="sm" variant="ghost" onClick={() => setConfirmDelete(false)}>
                Cancel
              </Button>
              <Button
                size="sm"
                variant="danger"
                loading={busy === "del"}
                onClick={async () => {
                  setBusy("del");
                  const { error } = await supabase.rpc("delete_pact", { p_pact: pactId });
                  setBusy(null);
                  if (error) return toast(errMsg(error), "err");
                  toast("Pact deleted");
                  router.replace("/");
                }}
              >
                Delete
              </Button>
            </div>
          ) : (
            <button className="text-sm font-semibold text-broke" onClick={() => setConfirmDelete(true)}>
              Delete this pact
            </button>
          )}
        </Card>
      ) : null}
    </div>
  );
}
