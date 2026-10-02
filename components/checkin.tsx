"use client";

import { useRef, useState } from "react";
import { supabase, errMsg } from "@/lib/supabase";
import { compressImage } from "@/lib/image";
import type { Checkin, Doubt, Pact } from "@/lib/types";
import type { PactStats } from "@/lib/stats";
import { effectiveStatus } from "@/lib/stats";
import { prettyDay } from "@/lib/dates";
import { money } from "@/lib/money";
import { Button, StatusPill, inputCls, useToast, cx } from "./ui";
import { IconCamera, IconPencil } from "./icons";

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
  label = "Add proof photo",
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
        <IconCamera size={16} />
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
    return <p className="text-sm text-muted">This pact is over. Check the recap.</p>;
  }
  if (!me.active) {
    return <p className="text-sm text-muted">Starts {prettyDay(me.startsOn, stats.today)}. Get ready.</p>;
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
    const pct = me.weekTarget ? Math.min(1, me.weekCount / me.weekTarget) : 0;
    return (
      <div className="space-y-3">
        <div>
          <div className="mb-1.5 flex items-baseline justify-between text-sm">
            <span className="font-semibold">This week</span>
            <span className="tabular font-bold">
              {me.weekCount} / {me.weekTarget}
            </span>
          </div>
          <div className="h-2.5 overflow-hidden rounded-full bg-surface-2">
            <div className="h-full rounded-full bg-kept transition-all" style={{ width: `${pct * 100}%` }} />
          </div>
        </div>
        {c && eff === "kept" ? (
          <div className="flex flex-wrap items-center gap-2">
            <StatusPill status="kept" />
            <span className="text-sm text-muted">Logged today</span>
            {!myOpenDoubt ? (
              <button className="ml-auto text-sm font-semibold text-muted underline-offset-2 hover:underline" onClick={undo} disabled={busy === "undo"}>
                Undo
              </button>
            ) : null}
          </div>
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
  return (
    <div className="space-y-3">
      {c && !editing ? (
        <div className="flex flex-wrap items-center gap-2">
          <StatusPill status={eff ?? "pending"} />
          {pact.goal_type === "count" && c.value !== null ? (
            <span className="tabular text-sm font-semibold">
              {Number(c.value).toLocaleString()} / {Number(pact.target).toLocaleString()} {pact.unit}
            </span>
          ) : null}
          {eff === "broke" ? <span className="text-sm text-muted">+{money(me.misses.find((m) => m.day === stats.today)?.cents ?? pact.stake_cents)} to the pot</span> : null}
          {!myOpenDoubt ? (
            <button className="ml-auto text-sm font-semibold text-muted underline-offset-2 hover:underline" onClick={() => setEditing(true)}>
              Change
            </button>
          ) : null}
        </div>
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
                className={inputCls + " pr-16"}
                inputMode="decimal"
                placeholder={`Goal: ${Number(pact.target).toLocaleString()}`}
                value={value}
                onChange={(e) => setValue(e.target.value)}
                aria-label={`How many ${pact.unit ?? ""} today`}
              />
              <span className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-sm text-muted">{pact.unit}</span>
            </div>
            <Button type="submit" size="lg" loading={busy === "kept" || busy === "broke"}>
              Log
            </Button>
          </form>
        ) : (
          <div className="grid grid-cols-2 gap-2">
            <Button variant="kept" size="lg" loading={busy === "kept"} onClick={() => submit("kept")}>
              Kept it
            </Button>
            <Button variant="broke" size="lg" loading={busy === "broke"} onClick={() => submit("broke")}>
              Broke it
            </Button>
          </div>
        )
      ) : null}

      {showButtons && pact.off_days_per_week > 0 ? (
        <button
          className={cx("w-full rounded-2xl border border-dashed py-2.5 text-sm font-semibold transition", me.offLeftThisWeek > 0 ? "border-off/50 text-off hover:bg-off-soft" : "border-line text-muted opacity-60")}
          disabled={me.offLeftThisWeek === 0 || busy === "off"}
          onClick={() => submit("off")}
        >
          {me.offLeftThisWeek > 0
            ? `Use an off-day (${me.offLeftThisWeek} left this week)`
            : "No off-days left this week"}
        </button>
      ) : null}

      {editing ? (
        <button className="text-sm font-semibold text-muted" onClick={() => setEditing(false)}>
          Cancel
        </button>
      ) : null}

      {noteOpen && c ? (
        <div className="animate-pop space-y-2 rounded-2xl bg-surface-2 p-3">
          <p className="text-sm font-semibold">Confess. What happened?</p>
          <textarea
            className={inputCls + " min-h-20 resize-none"}
            maxLength={280}
            placeholder="birthday cake, no regrets"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            autoFocus
          />
          <div className="flex justify-end gap-2">
            <Button size="sm" variant="ghost" onClick={() => setNoteOpen(false)}>
              Skip
            </Button>
            <Button size="sm" loading={busy === "note"} onClick={saveNote}>
              Post confession
            </Button>
          </div>
        </div>
      ) : null}

      {full && c && !editing && !noteOpen ? <NoteAndProof pact={pact} c={c} userId={userId} onChange={onChange} /> : null}
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
      {open ? (
        <div className="space-y-2">
          <textarea className={inputCls + " min-h-20 resize-none"} maxLength={280} value={note} onChange={(e) => setNote(e.target.value)} placeholder={c.status === "broke" ? "What happened?" : "Anything to add?"} autoFocus />
          <div className="flex justify-end gap-2">
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
            <IconPencil size={16} />
            {c.note ? "Edit note" : c.status === "broke" ? "Confess" : "Add a note"}
          </Button>
          {!c.proof_path ? <ProofButton pact={pact} checkin={c} userId={userId} onDone={onChange} /> : null}
        </div>
      )}
    </div>
  );
}
