"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Shell } from "@/components/shell";
import { useAuth } from "@/components/auth";
import { Avatar, Button, Card, Field, GroupLabel, GroupNote, List, Row, Segmented, Stepper, Toggle, inputCls, cx, rowInputCls, useToast } from "@/components/ui";
import { supabase, errMsg } from "@/lib/supabase";
import { action } from "@/lib/api";
import { addDays, diffDays, localTz, todayIn } from "@/lib/dates";
import type { GoalType, Profile } from "@/lib/types";
import { IconCheck } from "@/components/icons";

const EMOJI_OPTIONS = ["🥗", "🍔", "🏋️", "🏃", "💧", "📚", "😴", "🧘", "🚭", "📵", "🍺", "✍️", "💸", "🤙"];
const LENGTHS = [
  { label: "2 wks", days: 14 },
  { label: "4 wks", days: 28 },
  { label: "8 wks", days: 56 },
  { label: "12 wks", days: 84 },
];

export default function NewPact() {
  return (
    <Shell title="Pacts" back="/" navTitle="New pact">
      <Form />
    </Shell>
  );
}

function Form() {
  const { session } = useAuth();
  const router = useRouter();
  const toast = useToast();
  const tz = localTz();
  const today = todayIn(tz);

  const [emoji, setEmoji] = useState("🥗");
  const [name, setName] = useState("");
  const [goal, setGoal] = useState<GoalType>("daily");
  const [target, setTarget] = useState("10000");
  const [unit, setUnit] = useState("steps");
  const [perWeek, setPerWeek] = useState(4);
  const [rules, setRules] = useState("");
  const [stake, setStake] = useState("5");
  const [escalating, setEscalating] = useState(false);
  const [offDays, setOffDays] = useState(1);
  const [pot, setPot] = useState("");
  const [start, setStart] = useState(today);
  const [end, setEnd] = useState(addDays(today, 55));
  const [friends, setFriends] = useState<Profile[]>([]);
  const [invite, setInvite] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const me = session?.user.id;
    if (!me) return;
    (async () => {
      const { data } = await supabase
        .from("friendships")
        .select("requester, addressee, r:profiles!friendships_requester_fkey(id,username,display_name,color), a:profiles!friendships_addressee_fkey(id,username,display_name,color)")
        .eq("status", "accepted");
      const list = (data ?? []).map((f) => ((f.requester === me ? f.a : f.r) as unknown as Profile));
      setFriends(list.sort((x, y) => x.display_name.localeCompare(y.display_name)));
    })();
  }, [session?.user.id]);

  const lengthDays = diffDays(end, start) + 1;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return toast("Give your pact a name", "err");
    const stakeCents = Math.round(Number(stake || 0) * 100);
    if (Number.isNaN(stakeCents) || stakeCents < 0) return toast("Stake has to be a number", "err");
    const t = goal === "count" ? Number(target.replace(/,/g, "")) : goal === "weekly" ? perWeek : null;
    if (goal === "count" && (!t || t <= 0)) return toast("Set a daily target", "err");
    setBusy(true);
    const { data, error } = await supabase.rpc("create_pact", {
      p_name: name,
      p_emoji: emoji,
      p_rules: rules,
      p_goal_type: goal,
      p_target: t,
      p_unit: goal === "count" ? unit : null,
      p_stake_cents: stakeCents,
      p_escalating: escalating,
      p_off_days: goal === "weekly" ? 0 : offDays,
      p_pot: pot,
      p_start: start,
      p_end: end,
      p_timezone: tz,
      p_invitees: [...invite],
    });
    if (error) {
      setBusy(false);
      return toast(errMsg(error), "err");
    }
    if (invite.size) action({ action: "notify_invites", pactId: data }).catch(() => {});
    toast("Pact made. Pinky promise.");
    router.replace(`/pacts/${data}`);
  }

  const stakeN = Number(stake || 0);
  return (
    <form onSubmit={submit}>
      <Card className="p-4">
        <div className="flex items-center gap-3">
          <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-surface-2 text-[30px]" aria-hidden="true">
            {emoji}
          </span>
          <input
            className="min-w-0 flex-1 bg-transparent text-[20px] font-semibold tracking-[-0.01em] outline-none placeholder:font-normal placeholder:text-faint"
            maxLength={60}
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Name it, like The Cut"
            aria-label="Pact name"
            required
          />
        </div>
        <div className="no-scrollbar -mx-4 mt-3 flex gap-1.5 overflow-x-auto px-4" role="radiogroup" aria-label="Emoji">
          {EMOJI_OPTIONS.map((e) => (
            <button
              key={e}
              type="button"
              role="radio"
              aria-checked={emoji === e}
              onClick={() => setEmoji(e)}
              className={cx("h-10 w-10 shrink-0 rounded-xl text-[20px] transition active:scale-90", emoji === e ? "bg-pink-soft ring-2 ring-pink" : "bg-surface-2")}
              aria-label={`Emoji ${e}`}
            >
              {e}
            </button>
          ))}
        </div>
      </Card>

      <GroupLabel>Goal</GroupLabel>
      <Card className="space-y-3 p-4">
        <Segmented<GoalType>
          value={goal}
          onChange={setGoal}
          options={[
            { value: "daily", label: "Yes or no" },
            { value: "count", label: "A number" },
            { value: "weekly", label: "Per week" },
          ]}
        />
        <p className="text-[14px] leading-snug text-muted">
          {goal === "daily" && "Every night you say whether you kept it or broke it. Good for diets, no-spend, no-phone."}
          {goal === "count" && "Every night you log a number. Hit the target and you kept it."}
          {goal === "weekly" && "Log the days you did it. Come up short by Sunday and each missing session is a miss."}
        </p>
        {goal === "count" ? (
          <div className="grid grid-cols-2 gap-2">
            <Field label="Daily target">
              <input className={inputCls} inputMode="numeric" value={target} onChange={(e) => setTarget(e.target.value)} />
            </Field>
            <Field label="Unit">
              <input className={inputCls} maxLength={20} value={unit} onChange={(e) => setUnit(e.target.value)} placeholder="steps" />
            </Field>
          </div>
        ) : null}
        {goal === "weekly" ? (
          <div className="flex items-center justify-between border-t border-line pt-3">
            <span className="text-[16px]">Times per week</span>
            <Stepper value={perWeek} onChange={setPerWeek} min={1} max={7} label="times per week" />
          </div>
        ) : null}
      </Card>

      <GroupLabel>What counts as breaking it?</GroupLabel>
      <Card>
        <textarea
          className="block min-h-24 w-full resize-none rounded-2xl bg-transparent px-4 py-3 text-[16px] outline-none placeholder:text-faint"
          maxLength={500}
          value={rules}
          onChange={(e) => setRules(e.target.value)}
          placeholder={goal === "weekly" ? "At least 45 min at the gym. Walks don't count." : "Going over 2,000 calories, or any fast food. Protein bars are fine."}
          aria-label="What counts as breaking it"
        />
      </Card>
      <GroupNote>Agree on this now so nobody argues about the cookie later.</GroupNote>

      <GroupLabel>Stakes</GroupLabel>
      <List>
        <label className="flex min-h-[52px] items-center gap-3 px-4">
          <span className="flex-1 text-[16px]">Per miss</span>
          <span className="flex items-center text-[16px]">
            <span className="text-muted">$</span>
            <input className={rowInputCls + " w-14 flex-none"} inputMode="decimal" value={stake} onChange={(e) => setStake(e.target.value)} aria-label="Dollars per miss" />
          </span>
        </label>
        <Row
          title="Doubles each miss"
          subtitle={`$${stakeN}, then $${stakeN * 2}, then $${stakeN * 4} in the same week`}
          trailing={<Toggle checked={escalating} onChange={setEscalating} label="Escalating stakes" />}
        />
        {goal !== "weekly" ? (
          <Row title="Off-days a week" subtitle="Free passes so one slip doesn't wreck it" trailing={<Stepper value={offDays} onChange={setOffDays} min={0} max={3} label="off-days" />} />
        ) : null}
        <label className="flex min-h-[52px] items-center gap-3 px-4">
          <span className="shrink-0 text-[16px]">Pot goes to</span>
          <input className={rowInputCls} maxLength={120} value={pot} onChange={(e) => setPot(e.target.value)} placeholder="Ottawa Food Bank" />
        </label>
      </List>
      <GroupNote>A charity, a cause you&apos;d hate to fund, or dinner for whoever slipped least.</GroupNote>

      <GroupLabel>How long</GroupLabel>
      <Card className="p-3">
        <Segmented
          value={String(lengthDays)}
          onChange={(v) => setEnd(addDays(start, Number(v) - 1))}
          options={LENGTHS.map((l) => ({ value: String(l.days), label: l.label }))}
        />
      </Card>
      <List className="mt-2">
        <label className="flex min-h-[52px] items-center gap-3 px-4">
          <span className="flex-1 text-[16px]">Starts</span>
          <input
            className={rowInputCls + " flex-none"}
            type="date"
            min={today}
            value={start}
            onChange={(e) => {
              const v = e.target.value;
              if (!v) return;
              setEnd(addDays(v, Math.max(0, lengthDays - 1)));
              setStart(v);
            }}
          />
        </label>
        <label className="flex min-h-[52px] items-center gap-3 px-4">
          <span className="flex-1 text-[16px]">Ends</span>
          <input className={rowInputCls + " flex-none"} type="date" min={start} max={addDays(start, 365)} value={end} onChange={(e) => e.target.value && setEnd(e.target.value)} />
        </label>
      </List>
      <GroupNote>
        {lengthDays} days. Check-ins close at midnight, {tz.split("/").pop()?.replace(/_/g, " ")} time.
      </GroupNote>

      <GroupLabel>Who&apos;s in</GroupLabel>
      {friends.length === 0 ? (
        <List>
          <Row title="No friends added yet" subtitle="Make it solo now and invite people from the pact later." />
        </List>
      ) : (
        <List inset={64}>
          {friends.map((f) => {
            const on = invite.has(f.id);
            return (
              <Row
                key={f.id}
                onClick={() =>
                  setInvite((s) => {
                    const n = new Set(s);
                    if (on) n.delete(f.id);
                    else n.add(f.id);
                    return n;
                  })
                }
                leading={<Avatar profile={f} size={36} />}
                title={f.display_name}
                subtitle={`@${f.username}`}
                trailing={
                  <span className={cx("flex h-6 w-6 items-center justify-center rounded-full border-2 transition", on ? "border-pink bg-pink text-pink-ink" : "border-line")} aria-label={on ? "Invited" : "Not invited"}>
                    {on ? <IconCheck size={14} strokeWidth={3} /> : null}
                  </span>
                }
              />
            );
          })}
        </List>
      )}
      <GroupNote>You can always add people later with an invite link.</GroupNote>

      <Button type="submit" size="lg" className="mt-6 w-full" loading={busy}>
        {invite.size ? `Make it and invite ${invite.size}` : "Make the pact"}
      </Button>
    </form>
  );
}
