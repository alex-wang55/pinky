"use client";

import { useState } from "react";
import { supabase, errMsg } from "@/lib/supabase";
import type { Pact } from "@/lib/types";
import type { PactStats } from "@/lib/stats";
import { Pet, petState } from "./pet";
import { Button, Card, Sheet, inputCls, useToast } from "./ui";
import { IconFlame, IconPencil } from "./icons";

/** The pet plus the group streak: the "how are we doing" card at the top of a pact. */
export function PetPanel({ pact, stats, onChange }: { pact: Pact; stats: PactStats; onChange: () => void }) {
  const pet = petState(pact, stats);
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(pet.name);
  const [busy, setBusy] = useState(false);
  const toast = useToast();
  const unit = pact.goal_type === "weekly" ? "perfect week" : "perfect day";
  const left = pet.nextAt !== null ? Math.max(0, Math.ceil((pet.nextAt - pet.xp) / (pact.goal_type === "weekly" ? 5 : 1))) : 0;

  async function save() {
    setBusy(true);
    const { error } = await supabase.rpc("set_pet_name", { p_pact: pact.id, p_name: name });
    setBusy(false);
    if (error) return toast(errMsg(error), "err");
    setEditing(false);
    onChange();
  }

  const streakLine =
    stats.groupStreak > 0
      ? `${stats.groupStreak}-${stats.unit} group streak`
      : stats.started && stats.bestGroupStreak > 0
        ? "Streak's at zero"
        : "No streak yet";

  return (
    <Card className="mt-4 p-4">
      <div className="flex items-center gap-3">
        <div className="-my-2 -ml-2 shrink-0">
          <Pet stage={pet.stage} mood={pet.mood} size={92} />
        </div>
        <div className="min-w-0 flex-1">
          <p className="flex items-center gap-1 text-[17px] font-semibold">
            <IconFlame size={18} className={stats.groupStreak > 0 ? "text-pink" : "text-faint"} />
            {streakLine}
          </p>
          <p className="mt-0.5 text-[14px] leading-snug text-muted">
            {pet.line}
            {stats.bestGroupStreak > stats.groupStreak ? ` Best run so far: ${stats.bestGroupStreak}.` : ""}
          </p>
        </div>
      </div>
      <div className="mt-3 border-t border-line pt-3">
        <div className="flex items-center justify-between gap-2 text-[13px]">
          <button className="group flex min-w-0 items-center gap-1 font-semibold active:opacity-60" onClick={() => setEditing(true)} aria-label={`Rename ${pet.name}`}>
            <span className="truncate">{pet.name}</span>
            <IconPencil size={12} className="shrink-0 text-faint group-hover:text-muted" />
            <span className="font-normal text-muted">· {pet.stageName}</span>
          </button>
          <span className="shrink-0 text-muted">
            {pet.nextAt !== null ? `${left} more ${unit}${left === 1 ? "" : "s"} to ${pet.nextName}` : "Fully grown"}
          </span>
        </div>
        <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-surface-2">
          <div className="h-full rounded-full bg-pink transition-all" style={{ width: `${Math.round(pet.progress * 100)}%` }} />
        </div>
      </div>

      <Sheet open={editing} onClose={() => setEditing(false)} title="Rename your pet">
        <form
          className="space-y-3"
          onSubmit={(e) => {
            e.preventDefault();
            save();
          }}
        >
          <input className={inputCls + " !bg-surface"} value={name} maxLength={24} onChange={(e) => setName(e.target.value)} autoFocus aria-label="Pet name" />
          <Button type="submit" size="lg" className="w-full" loading={busy}>
            Save
          </Button>
        </form>
      </Sheet>
    </Card>
  );
}
