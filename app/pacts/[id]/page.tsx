"use client";

import { useParams, useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Shell } from "@/components/shell";
import { useAuth } from "@/components/auth";
import { Button, Card, GroupLabel, List, PageLoader, Row, Segmented, SectionTitle, Sheet, Tile, useToast } from "@/components/ui";
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
import { IconCalendar, IconChart, IconPlusUser } from "@/components/icons";

export default function PactPage() {
  return (
    <Shell title="Pacts" back="/">
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
      <Card className="mt-6 px-6 py-8 text-center">
        <p className="text-[17px] font-semibold">This pact doesn&apos;t exist, or you&apos;re not in it.</p>
        <Button href="/" className="mt-4" variant="soft">
          Back to pacts
        </Button>
      </Card>
    );
  if (!bundle || !stats) return <PageLoader />;

  const pact = bundle.pacts[0];
  const me = bundle.members.find((m) => m.user_id === userId);
  const isInvited = me?.status === "invited";
  const offs = pact.off_days_per_week;
  const terms = [
    pact.goal_type === "count" ? `${goalLabel(pact)}` : pact.goal_type === "weekly" ? `${pact.target}x a week` : "Every day",
    `${money(pact.stake_cents)} a miss${pact.escalating ? ", doubling" : ""}`,
    offs > 0 && pact.goal_type !== "weekly" ? `${offs} off-day${offs === 1 ? "" : "s"} a week` : null,
  ].filter(Boolean);
  const showWrap = stats.started && addDays(wrapWeek(stats.today), 6) >= pact.start_date && [0, 1].includes(dayOfWeek(stats.today));

  return (
    <div>
      <div className="flex items-center gap-3 px-1 pt-1">
        <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-surface text-[30px] shadow-card">{pact.emoji}</span>
        <div className="min-w-0">
          <h1 className="text-[26px] font-bold leading-tight tracking-[-0.02em]">{pact.name}</h1>
          <p className="text-[15px] text-muted">
            {stats.ended
              ? `Ended ${shortDay(pact.end_date)}`
              : stats.started
                ? `Day ${stats.dayNumber} of ${stats.totalDays}, ${stats.daysLeft} to go`
                : `Starts ${prettyDay(pact.start_date, stats.today)}`}
          </p>
        </div>
      </div>
      <p className="mt-3 px-1 text-[15px] text-muted">
        {terms.join(" · ")}
        {pact.rules ? (
          <>
            <br />
            <span className="text-ink">Breaking it means:</span> {pact.rules}
          </>
        ) : null}
      </p>

      {!isInvited ? <PetPanel pact={pact} stats={stats} onChange={load} /> : null}

      {isInvited ? (
        <Card className="mt-4 p-4">
          <p className="text-[17px] font-semibold">You&apos;re invited to this pact</p>
          <p className="mt-0.5 text-[15px] text-muted">You start counting from the day you join.</p>
          <div className="mt-3 grid grid-cols-2 gap-2">
            <Button
              onClick={async () => {
                const { error } = await supabase.rpc("respond_pact_invite", { p_pact: pact.id, p_accept: true });
                if (error) return toast(errMsg(error), "err");
                toast("You're in.");
                load();
              }}
            >
              Join
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
              <SectionTitle>{pact.goal_type === "weekly" ? "This week" : "Today"}</SectionTitle>
              <Card className="p-4">
                <CheckIn pact={pact} stats={stats} userId={userId} doubts={bundle.doubts} onChange={load} full />
              </Card>
            </>
          ) : (
            <List className="mt-4" inset={60}>
              <Row
                href={`/pacts/${pact.id}/recap`}
                leading={
                  <Tile>
                    <IconChart size={18} />
                  </Tile>
                }
                title="See the final recap"
                subtitle="Who kept it, who paid up, and the best confessions"
                chevron
              />
            </List>
          )}

          {showWrap ? (
            <List className="mt-3" inset={60}>
              <Row
                href={`/pacts/${pact.id}/week`}
                leading={
                  <Tile>
                    <IconCalendar size={18} />
                  </Tile>
                }
                title="Weekly wrap is in"
                subtitle="How last week went and who carried the group"
                chevron
              />
            </List>
          ) : null}

          <SectionTitle
            right={
              !stats.ended ? (
                <Button size="sm" variant="plain" onClick={() => setAdding(true)}>
                  <IconPlusUser size={16} />
                  Add
                </Button>
              ) : null
            }
          >
            Squad
          </SectionTitle>
          <Squad pact={pact} stats={stats} members={bundle.members} userId={userId} nudgedToday={nudged} hypes={bundle.hypes} onNudged={load} />

          <div className="mb-4 mt-8">
            <Segmented
              value={tab}
              onChange={setTab}
              options={[
                { value: "feed", label: "Activity" },
                { value: "pot", label: `Pot ${money(stats.potCents)}` },
                { value: "info", label: "Details" },
              ]}
            />
          </div>
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
            <Ledger pact={pact} stats={stats} members={bundle.members} />
          ) : (
            <InfoTab pact={pact} ended={stats.ended} onAdd={() => setAdding(true)} />
          )}

          <Sheet open={adding && !stats.ended} onClose={() => setAdding(false)} title="Add people">
            <AddPeople pact={pact} memberIds={bundle.members.map((m) => m.user_id)} onChange={load} />
          </Sheet>
        </>
      )}
    </div>
  );
}

function InfoTab({ pact, ended, onAdd }: { pact: Pact; ended: boolean; onAdd: () => void }) {
  const { session } = useAuth();
  const me = session!.user.id;
  const pactId = pact.id;
  const isCreator = pact.created_by === me;
  const router = useRouter();
  const toast = useToast();
  const [busy, setBusy] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);

  async function hide() {
    setBusy("hide");
    const { error } = await supabase.rpc("hide_pact", { p_pact: pactId, p_hidden: true });
    setBusy(null);
    if (error) return toast(errMsg(error), "err");
    toast("Hidden from your list");
    router.replace("/");
  }

  async function remove() {
    setBusy("del");
    const { error } = await supabase.rpc("delete_pact", { p_pact: pactId });
    setBusy(null);
    if (error) return toast(errMsg(error), "err");
    toast("Pact deleted");
    router.replace("/");
  }

  return (
    <div>
      <List inset={60}>
        <Row
          href={`/pacts/${pactId}/week`}
          leading={
            <Tile>
              <IconCalendar size={18} />
            </Tile>
          }
          title="Weekly wrap"
          chevron
        />
        <Row
          href={`/pacts/${pactId}/recap`}
          leading={
            <Tile>
              <IconChart size={18} />
            </Tile>
          }
          title={ended ? "Final recap" : "Recap so far"}
          chevron
        />
        {!ended ? (
          <Row
            onClick={onAdd}
            leading={
              <Tile tone="grey">
                <IconPlusUser size={18} />
              </Tile>
            }
            title="Add people"
            chevron
          />
        ) : null}
      </List>

      <GroupLabel>House rules</GroupLabel>
      <Card className="space-y-2.5 p-4 text-[15px] leading-snug">
        <p>Check in before midnight. No check-in counts as broke.</p>
        <p>Everyone gets one doubt a week per pact. Whoever gets doubted has 24 hours to post a photo or own up.</p>
        <p>Off-days don&apos;t break the streak, but you only get so many a week.</p>
        <p>The group streak resets if anyone breaks it.</p>
      </Card>

      {ended || isCreator ? (
      <List className="mt-6">
        {ended ? <Row title="Hide from my list" subtitle="You can bring it back later from the home screen." onClick={hide} trailing={busy === "hide" ? <span className="text-[13px] text-muted">...</span> : null} /> : null}
        {isCreator ? <Row title="Delete this pact" tone="danger" onClick={() => setConfirmDelete(true)} /> : null}
      </List>
      ) : null}

      <Sheet open={confirmDelete} onClose={() => setConfirmDelete(false)} title="Delete for everyone?">
        <p className="px-1 text-[15px] text-muted">Check-ins, confessions and the recap go too. This can&apos;t be undone.</p>
        <div className="mt-4 space-y-2">
          <Button variant="danger" size="lg" className="w-full" loading={busy === "del"} onClick={remove}>
            Delete pact
          </Button>
          <Button variant="soft" size="lg" className="w-full" onClick={() => setConfirmDelete(false)}>
            Cancel
          </Button>
        </div>
      </Sheet>
    </div>
  );
}
