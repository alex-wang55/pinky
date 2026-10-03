"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import { Shell } from "@/components/shell";
import { useAuth } from "@/components/auth";
import { Avatar, Button, Card, Field, PageLoader, Segmented, Stepper, Toggle, inputCls, cx, useToast } from "@/components/ui";
import { supabase, errMsg } from "@/lib/supabase";
import { action } from "@/lib/api";
import { addDays, diffDays, localTz, todayIn } from "@/lib/dates";
import type { GoalType, Profile } from "@/lib/types";
import { IconCheck } from "@/components/icons";
import { PACT_ICONS, PactIcon, pactIconDef } from "@/components/pact-icon";

const LENGTHS = [
  { label: "2 wks", days: 14 },
  { label: "4 wks", days: 28 },
  { label: "8 wks", days: 56 },
  { label: "12 wks", days: 84 },
];

export default function NewPact() {
  return (
    <Shell title="New pact" back="/" wide>
      <Suspense fallback={<PageLoader />}>
        <Form />
      </Suspense>
    </Shell>
  );
}

function Form() {
  const { session } = useAuth();
  const router = useRouter();
  const sp = useSearchParams();
  const withId = sp.get("with");
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
  // "Start a pact" on the Friends tab lands here with ?with=<their id> already ticked.
  const [invite, setInvite] = useState<Set<string>>(() => new Set(withId ? [withId] : []));
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
      // Drop the pre-selected person if they turn out not to be a friend.
      setInvite((cur) => new Set([...cur].filter((id) => list.some((f) => f.id === id))));
    })();
  }, [session?.user.id]);

  const lengthDays = diffDays(end, start) + 1;
  const withFriend = withId && invite.has(withId) ? friends.find((f) => f.id === withId) : undefined;

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

  return (
    <form onSubmit={submit} className="space-y-4">
      <h1 className="px-1 font-display text-[28px] font-bold">Make a pact</h1>
      {withFriend ? <p className="-mt-2 px-1 text-muted">With {withFriend.display_name.split(" ")[0]}{invite.size > 1 ? ` and ${invite.size - 1} more` : ""}. Pick the goal and the stakes.</p> : null}

      <div className="space-y-4 lg:grid lg:grid-cols-2 lg:items-start lg:gap-4 lg:space-y-0">
      <div className="space-y-4">
      <Card className="space-y-4 p-4">
        <div>
          <span className="mb-1.5 block text-sm font-semibold">
            Pick an icon <span className="font-normal text-muted">· {pactIconDef(emoji).label}</span>
          </span>
          <div className="grid grid-cols-7 gap-1.5" role="radiogroup" aria-label="Pact icon">
            {PACT_ICONS.map((d) => (
              <button
                key={d.key}
                type="button"
                role="radio"
                aria-checked={emoji === d.key}
                onClick={() => setEmoji(d.key)}
                className={cx("flex aspect-square items-center justify-center rounded-2xl transition", emoji === d.key ? "ring-2 ring-pink ring-offset-2 ring-offset-surface" : "opacity-80 hover:opacity-100")}
                aria-label={d.label}
                title={d.label}
              >
                <PactIcon emoji={d.key} size={34} />
              </button>
            ))}
          </div>
        </div>
        <Field label="Name">
          <input className={inputCls} maxLength={60} value={name} onChange={(e) => setName(e.target.value)} placeholder="The Cut" required />
        </Field>
      </Card>

      <Card className="space-y-4 p-4">
        <span className="block text-sm font-semibold">What kind of goal?</span>
        <Segmented<GoalType>
          value={goal}
          onChange={setGoal}
          options={[
            { value: "daily", label: "Yes / no" },
            { value: "count", label: "A number" },
            { value: "weekly", label: "X per week" },
          ]}
        />
        <p className="text-sm text-muted">
          {goal === "daily" && "Every day you say if you kept it or broke it. Good for diets, no-spend, no-phone."}
          {goal === "count" && "Every day you log a number. Hit the target and you kept it."}
          {goal === "weekly" && "Log the days you did it. Come up short by Sunday and each missing session is a miss."}
        </p>
        {goal === "count" ? (
          <div className="grid grid-cols-2 gap-3">
            <Field label="Daily target">
              <input className={inputCls} inputMode="numeric" value={target} onChange={(e) => setTarget(e.target.value)} />
            </Field>
            <Field label="Unit">
              <input className={inputCls} maxLength={20} value={unit} onChange={(e) => setUnit(e.target.value)} placeholder="steps" />
            </Field>
          </div>
        ) : null}
        {goal === "weekly" ? (
          <div className="flex items-center justify-between">
            <span className="text-sm font-semibold">Times per week</span>
            <Stepper value={perWeek} onChange={setPerWeek} min={1} max={7} />
          </div>
        ) : null}
        <Field label="What counts as breaking it?" hint="Agree on this now so nobody argues about the cookie later.">
          <textarea
            className={inputCls + " min-h-24 resize-none"}
            maxLength={500}
            value={rules}
            onChange={(e) => setRules(e.target.value)}
            placeholder={goal === "weekly" ? "At least 45 min at the gym. Walks don't count." : "Going over 2,000 calories, or any fast food. Protein bars are fine."}
          />
        </Field>
      </Card>
      </div>

      <div className="space-y-4">
      <Card className="space-y-4 p-4">
        <span className="block text-sm font-semibold">Stakes</span>
        <div className="flex items-center gap-3">
          <div className="relative w-32">
            <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 font-semibold text-muted">$</span>
            <input className={inputCls + " pl-8"} inputMode="decimal" value={stake} onChange={(e) => setStake(e.target.value)} aria-label="Dollars per miss" />
          </div>
          <span className="text-sm text-muted">into the pot per miss</span>
        </div>
        <div className="flex items-center justify-between gap-4">
          <div>
            <div className="text-sm font-semibold">Escalating</div>
            <div className="text-xs text-muted">Misses in the same week double: ${stake || 0}, then ${Number(stake || 0) * 2}, then ${Number(stake || 0) * 4}</div>
          </div>
          <Toggle checked={escalating} onChange={setEscalating} label="Escalating stakes" />
        </div>
        {goal !== "weekly" ? (
          <div className="flex items-center justify-between gap-4">
            <div>
              <div className="text-sm font-semibold">Off-days per week</div>
              <div className="text-xs text-muted">Planned free passes so one slip doesn&apos;t wreck everything</div>
            </div>
            <Stepper value={offDays} onChange={setOffDays} min={0} max={3} />
          </div>
        ) : null}
        <Field label="Where does the pot go?" hint="A charity, a cause you'd hate to fund, or dinner for whoever slipped least.">
          <input className={inputCls} maxLength={120} value={pot} onChange={(e) => setPot(e.target.value)} placeholder="Ottawa Food Bank" />
        </Field>
      </Card>

      <Card className="space-y-4 p-4">
        <span className="block text-sm font-semibold">How long?</span>
        <div className="flex flex-wrap gap-1.5">
          {LENGTHS.map((l) => (
            <button
              key={l.days}
              type="button"
              onClick={() => setEnd(addDays(start, l.days - 1))}
              className={cx("rounded-full px-3 py-1.5 text-sm font-semibold", lengthDays === l.days ? "bg-pink text-pink-ink" : "bg-surface-2")}
            >
              {l.label}
            </button>
          ))}
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Starts">
            <input
              className={inputCls}
              type="date"
              min={today}
              value={start}
              onChange={(e) => {
                const s = e.target.value;
                if (!s) return;
                setEnd(addDays(s, Math.max(0, lengthDays - 1)));
                setStart(s);
              }}
            />
          </Field>
          <Field label="Ends">
            <input className={inputCls} type="date" min={start} max={addDays(start, 365)} value={end} onChange={(e) => e.target.value && setEnd(e.target.value)} />
          </Field>
        </div>
        <p className="text-xs text-muted">
          {lengthDays} days. Check-ins close at midnight ({tz.replace(/_/g, " ")}).
        </p>
      </Card>

      <Card className="space-y-3 p-4">
        <span className="block text-sm font-semibold">Who&apos;s in?</span>
        {friends.length === 0 ? (
          <p className="text-sm text-muted">No friends added yet. You can make it solo now and invite people later from the pact page.</p>
        ) : (
          <div className="divide-y divide-line">
            {friends.map((f) => {
              const on = invite.has(f.id);
              return (
                <button
                  key={f.id}
                  type="button"
                  className="flex w-full items-center gap-3 py-2.5 text-left"
                  onClick={() =>
                    setInvite((s) => {
                      const n = new Set(s);
                      if (on) n.delete(f.id);
                      else n.add(f.id);
                      return n;
                    })
                  }
                >
                  <Avatar profile={f} size={36} />
                  <span className="flex-1">
                    <span className="block font-semibold">{f.display_name}</span>
                    <span className="block text-xs text-muted">@{f.username}</span>
                  </span>
                  <span className={cx("flex h-6 w-6 items-center justify-center rounded-full border-2 text-xs font-bold", on ? "border-pink bg-pink text-pink-ink" : "border-line")}>{on ? <IconCheck size={14} strokeWidth={2.6} /> : null}</span>
                </button>
              );
            })}
          </div>
        )}
      </Card>
      </div>
      </div>

      <Button type="submit" size="lg" className="w-full lg:ml-auto lg:flex lg:w-80" loading={busy}>
        Make the pact
      </Button>
    </form>
  );
}
