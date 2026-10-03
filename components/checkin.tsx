"use client";

import { useRef, useState } from "react";
import { supabase, errMsg } from "@/lib/supabase";
import { compressImage } from "@/lib/image";
import type { Checkin, Doubt, Pact } from "@/lib/types";
import type { PactStats } from "@/lib/stats";
import { effectiveStatus } from "@/lib/stats";
import { addDays, prettyDay } from "@/lib/dates";
import { money } from "@/lib/money";
import { Button, inputCls, useToast, cx } from "./ui";
import { IconCamera, IconCheck, IconPencil, IconRebound, IconX } from "./icons";

export async function uploadProof(pact: Pact, checkin: Checkin, userId: string, file: File) {
  const blob = await compressImage(file);
  const path = `${pact.id}/${userId}/${crypto.randomUUID()}.jpg`;
  const up = await supabase.storage.from("proofs").upload(path, blob, { contentType: "image/jpeg", upsert: false });
  if (up.error) throw up.error;
  const { error } = await supabase.rpc("attach_proof", { p_checkin: checkin.id, p_path: path });
  if (error) throw error;
}

export function ProofButton({
  pact,
  checkin,
  userId,
  onDone,
  label = "Add a photo",
  variant = "soft",
}: {
  pact: Pact;
  checkin: Checkin;
  userId: string;
  onDone: () => void;
  label?: string;
  variant?: "soft" | "primary" | "ghost";
}) {
  const ref = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const toast = useToast();
  return (
    <>
      <input
        ref={ref}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={async (e) => {
          const f = e.target.files?.[0];
          e.target.value = "";
          if (!f) return;
          setBusy(true);
          try {
            await uploadProof(pact, checkin, userId, f);
            toast("Proof posted");
            onDone();
          } catch (err) {
            toast(errMsg(err), "err");
          } finally {
            setBusy(false);
          }
        }}
      />
      <Button size="sm" variant={variant} loading={busy} onClick={() => ref.current?.click()}>
        <IconCamera size={15} />
        {label}
      </Button>
    </>
  );
}

export function CheckIn({
  pact,
  stats,
  userId,
  doubts,
  onChange,
  full,
}: {
  pact: Pact;
  stats: PactStats;
  userId: string;
  doubts: Doubt[];
  onChange: () => void;
  full?: boolean;
}) {
  const me = stats.members[userId];
  const toast = useToast();
  const [busy, setBusy] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState("");
  const [noteOpen, setNoteOpen] = useState(false);
  const [note, setNote] = useState("");

  if (!me) return null;
  if (stats.ended) {
    return <p className="text-[15px] text-muted">This pact is over. Check the recap.</p>;
  }
  if (!me.active) {
    return <p className="text-[15px] text-muted">Starts {prettyDay(me.startsOn, stats.today)}. Get ready.</p>;
  }

  const c = me.todayCheckin;
  const eff = c ? effectiveStatus(c, doubts, Date.now()).status : null;
  const showButtons = !c || editing;

  async function submit(status: "kept" | "broke" | "off", v?: number) {
    setBusy(status);
    const { error } = await supabase.rpc("check_in", {
      p_pact: pact.id,
      p_status: status,
      p_value: v ?? null,
      p_note: null,
    });
    setBusy(null);
    if (error) return toast(errMsg(error), "err");
    setEditing(false);
    if (status === "kept") {
      toast(pact.goal_type === "weekly" ? "Logged. Keep stacking." : "Kept it. Nice.");
    } else if (status === "off") {
      toast("Off-day used. Back at it tomorrow");
    } else {
      setNoteOpen(true);
    }
    onChange();
  }

  async function saveNote() {
    if (!c) return;
    setBusy("note");
    const { error } = await supabase.rpc("set_note", { p_checkin: c.id, p_note: note });
    setBusy(null);
    if (error) return toast(errMsg(error), "err");
    setNoteOpen(false);
    toast("Confession saved");
    onChange();
  }

  async function undo() {
    setBusy("undo");
    const { error } = await supabase.rpc("undo_check_in", { p_pact: pact.id });
    setBusy(null);
    if (error) return toast(errMsg(error), "err");
    onChange();
  }

  const myOpenDoubt = c ? doubts.find((d) => d.checkin_id === c.id && d.status === "open") : undefined;

  /* ---------- weekly ---------- */
  if (pact.goal_type === "weekly") {
    const pips = Math.max(me.weekTarget, me.weekCount);
    return (
      <div className="space-y-3">
        <div className="flex items-center justify-between gap-3">
          <div>
            <div className="text-[15px] font-semibold">
              {me.weekCount >= me.weekTarget ? "Done for the week" : `${me.weekTarget - me.weekCount} to go this week`}
            </div>
            <div className="text-[13px] text-muted tabular">
              {me.weekCount} of {me.weekTarget} sessions
            </div>
          </div>
          <div className="flex gap-1" aria-hidden="true">
            {Array.from({ length: pips }, (_, i) => (
              <span key={i} className={cx("h-2.5 w-6 rounded-full", i < me.weekCount ? "bg-kept" : "bg-surface-2")} />
            ))}
          </div>
        </div>
        {c && eff === "kept" ? (
          <Done tone="kept" text="Logged today" action={!myOpenDoubt ? { label: "Undo", onClick: undo, busy: busy === "undo" } : undefined} />
        ) : (
          <Button variant="kept" size="lg" className="w-full" loading={busy === "kept"} onClick={() => submit("kept")}>
            I did it today
          </Button>
        )}
        {full && c ? <NoteAndProof pact={pact} c={c} userId={userId} onChange={onChange} /> : null}
      </div>
    );
  }

  /* ---------- daily / count ---------- */
  const todayMiss = me.misses.find((m) => m.day === stats.today);
  const offer = me.comebackOffer;
  const countBit = pact.goal_type === "count" && c?.value !== null && c?.value !== undefined ? ` ${Number(c.value).toLocaleString()} of ${Number(pact.target).toLocaleString()} ${pact.unit ?? ""}.` : "";
  return (
    <div className="space-y-3">
      {offer && (!c || editing) ? (
        <p className="flex items-start gap-2 text-[14px] text-kept">
          <IconRebound size={17} className="mt-0.5 shrink-0" />
          <span>
            <b className="font-semibold">Comeback day.</b> Keep it today and yesterday&apos;s {money(offer.cents)} miss drops to {money(Math.round(offer.cents / 2))}.
          </span>
        </p>
      ) : null}

      {c && !editing ? (
        <Done
          tone={eff ?? "kept"}
          text={
            eff === "kept"
              ? `You kept it today.${countBit}`
              : eff === "off"
                ? "Off-day today. Back at it tomorrow."
                : `You broke it.${countBit} ${money(todayMiss?.cents ?? pact.stake_cents)} to the pot.`
          }
          sub={
            eff === "kept" && offer === null && me.misses.some((m) => m.comeback && m.day === addDays(stats.today, -1))
              ? "Comeback. Yesterday's miss is half off."
              : eff === "broke" && todayMiss && todayMiss.kind !== "doubt"
                ? "Keep it tomorrow and this one's half off."
                : undefined
          }
          action={!myOpenDoubt ? { label: "Change", onClick: () => setEditing(true) } : undefined}
        />
      ) : null}

      {showButtons ? (
        pact.goal_type === "count" ? (
          <form
            className="flex gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              const n = Number(value.replace(/,/g, ""));
              if (!value || Number.isNaN(n) || n < 0) return toast("Enter a number", "err");
              submit(n >= Number(pact.target) ? "kept" : "broke", n);
            }}
          >
            <div className="relative flex-1">
              <input
                className={inputCls + " h-11 rounded-full py-0 pr-16"}
                inputMode="decimal"
                placeholder={`Goal is ${Number(pact.target).toLocaleString()}`}
                value={value}
                onChange={(e) => setValue(e.target.value)}
                aria-label={`How many ${pact.unit ?? ""} today`}
              />
              <span className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-[15px] text-muted">{pact.unit}</span>
            </div>
            <Button type="submit" loading={busy === "kept" || busy === "broke"}>
              Log it
            </Button>
          </form>
        ) : (
          <div className="grid grid-cols-2 gap-2">
            <Button variant="kept" loading={busy === "kept"} onClick={() => submit("kept")}>
              Kept it
            </Button>
            <Button variant="broke" loading={busy === "broke"} onClick={() => submit("broke")}>
              Broke it
            </Button>
          </div>
        )
      ) : null}

      {showButtons && (pact.off_days_per_week > 0 || editing) ? (
        <div className="flex items-center justify-center gap-4 text-[14px]">
          {pact.off_days_per_week > 0 ? (
            <button
              className={cx("font-medium transition active:opacity-60", me.offLeftThisWeek > 0 ? "text-off" : "text-faint")}
              disabled={me.offLeftThisWeek === 0 || busy === "off"}
              onClick={() => submit("off")}
            >
              {me.offLeftThisWeek > 0 ? `Use an off-day (${me.offLeftThisWeek} left)` : "No off-days left this week"}
            </button>
          ) : null}
          {editing ? (
            <button className="font-medium text-muted active:opacity-60" onClick={() => setEditing(false)}>
              Cancel
            </button>
          ) : null}
        </div>
      ) : null}

      {noteOpen && c ? (
        <div className="animate-pop space-y-2">
          <p className="text-[15px] font-semibold">What happened?</p>
          <textarea
            className={inputCls + " min-h-20 resize-none"}
            maxLength={280}
            placeholder="birthday cake, no regrets"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            autoFocus
          />
          <div className="flex items-center justify-between gap-2">
            <span className="text-[13px] text-muted">Your crew sees this in the feed.</span>
            <div className="flex gap-1">
              <Button size="sm" variant="ghost" onClick={() => setNoteOpen(false)}>
                Skip
              </Button>
              <Button size="sm" loading={busy === "note"} onClick={saveNote}>
                Post
              </Button>
            </div>
          </div>
        </div>
      ) : null}

      {full && c && !editing && !noteOpen ? <NoteAndProof pact={pact} c={c} userId={userId} onChange={onChange} /> : null}
    </div>
  );
}

/** "You kept it today" line with a status circle and an optional action on the right. */
function Done({
  tone,
  text,
  sub,
  action,
}: {
  tone: "kept" | "broke" | "off";
  text: string;
  sub?: string;
  action?: { label: string; onClick: () => void; busy?: boolean };
}) {
  const circle = {
    kept: "bg-kept text-kept-ink",
    broke: "bg-broke text-white",
    off: "bg-off text-white",
  }[tone];
  return (
    <div className="flex items-center gap-3">
      <span className={cx("flex h-8 w-8 shrink-0 items-center justify-center rounded-full", circle)}>
        {tone === "kept" ? <IconCheck size={18} strokeWidth={2.8} /> : tone === "broke" ? <IconX size={16} strokeWidth={2.8} /> : <span className="h-[3px] w-3 rounded bg-current" />}
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-[15px] font-medium leading-snug">{text}</p>
        {sub ? (
          <p className="mt-0.5 flex items-center gap-1 text-[13px] text-muted">
            <IconRebound size={13} className="shrink-0" />
            {sub}
          </p>
        ) : null}
      </div>
      {action ? (
        <Button size="sm" variant="plain" onClick={action.onClick} disabled={action.busy}>
          {action.label}
        </Button>
      ) : null}
    </div>
  );
}

function NoteAndProof({ pact, c, userId, onChange }: { pact: Pact; c: Checkin; userId: string; onChange: () => void }) {
  const [open, setOpen] = useState(false);
  const [note, setNote] = useState(c.note ?? "");
  const [busy, setBusy] = useState(false);
  const toast = useToast();
  return (
    <div className="space-y-2">
      {c.note && !open ? <p className="rounded-xl bg-surface-2 px-3 py-2 text-[15px]">{c.note}</p> : null}
      {open ? (
        <div className="space-y-2">
          <textarea className={inputCls + " min-h-20 resize-none"} maxLength={280} value={note} onChange={(e) => setNote(e.target.value)} placeholder={c.status === "broke" ? "What happened?" : "Anything to add?"} autoFocus />
          <div className="flex justify-end gap-1">
            <Button size="sm" variant="ghost" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button
              size="sm"
              loading={busy}
              onClick={async () => {
                setBusy(true);
                const { error } = await supabase.rpc("set_note", { p_checkin: c.id, p_note: note });
                setBusy(false);
                if (error) return toast(errMsg(error), "err");
                setOpen(false);
                onChange();
              }}
            >
              Save
            </Button>
          </div>
        </div>
      ) : (
        <div className="flex flex-wrap gap-2">
          <Button size="sm" variant="soft" onClick={() => setOpen(true)}>
            <IconPencil size={15} />
            {c.note ? "Edit note" : c.status === "broke" ? "Say what happened" : "Add a note"}
          </Button>
          {!c.proof_path ? <ProofButton pact={pact} checkin={c} userId={userId} onDone={onChange} /> : null}
        </div>
      )}
    </div>
  );
}
