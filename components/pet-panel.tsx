"use client";

import { useState } from "react";
import { supabase, errMsg } from "@/lib/supabase";
import type { Pact } from "@/lib/types";
import type { PactStats } from "@/lib/stats";
import { Pet, petState } from "./pet";
import { Button, Card, inputCls, useToast } from "./ui";
import { IconPencil } from "./icons";

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

  return (
    <Card className="mt-3 flex items-center gap-3 p-3 pr-4">
      <div className="shrink-0">
        <Pet stage={pet.stage} mood={pet.mood} size={104} />
      </div>
      <div className="min-w-0 flex-1">
        {editing ? (
          <form
            className="flex gap-1.5"
            onSubmit={(e) => {
              e.preventDefault();
              save();
            }}
          >
            <input className={inputCls + " !py-2"} value={name} maxLength={24} onChange={(e) => setName(e.target.value)} autoFocus aria-label="Pet name" />
            <Button type="submit" size="sm" loading={busy} className="!h-auto">
              Save
            </Button>
          </form>
        ) : (
          <button className="group flex items-center gap-1.5 text-left" onClick={() => setEditing(true)} aria-label="Rename pet">
            <span className="font-display text-xl font-extrabold">{pet.name}</span>
            <IconPencil size={14} className="text-muted opacity-60 group-hover:opacity-100" />
          </button>
        )}
        <div className="text-xs font-semibold uppercase tracking-wide text-pink">{pet.stageName}</div>
        <p className="mt-1 text-sm text-muted">{pet.line}</p>
        {pet.nextAt !== null ? (
          <div className="mt-2">
            <div className="h-1.5 overflow-hidden rounded-full bg-surface-2">
              <div className="h-full rounded-full bg-pink transition-all" style={{ width: `${Math.round(pet.progress * 100)}%` }} />
            </div>
            <div className="mt-1 text-[11px] text-muted">
              {left} more {unit}
              {left === 1 ? "" : "s"} to {pet.nextName}
            </div>
          </div>
        ) : (
          <div className="mt-2 text-[11px] font-semibold text-muted">Fully grown. Legendary crew.</div>
        )}
      </div>
    </Card>
  );
}
