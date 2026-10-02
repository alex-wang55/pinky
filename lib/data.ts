import { supabase } from "./supabase";
import type { Checkin, Doubt, Hype, Member, Pact, Reaction } from "./types";

export type Bundle = {
  pacts: Pact[];
  members: Member[];
  checkins: Checkin[];
  doubts: Doubt[];
  reactions: Reaction[];
  hypes: Hype[];
};

export const MEMBER_SELECT = "*, profile:profiles!pact_members_user_id_fkey(id,username,display_name,color)";

export async function loadBundle(pactIds: string[], withReactions = false): Promise<Bundle> {
  if (pactIds.length === 0) return { pacts: [], members: [], checkins: [], doubts: [], reactions: [], hypes: [] };
  const [p, m, c, d, r, h] = await Promise.all([
    supabase.from("pacts").select("*").in("id", pactIds),
    supabase.from("pact_members").select(MEMBER_SELECT).in("pact_id", pactIds),
    supabase.from("checkins").select("*").in("pact_id", pactIds).order("day", { ascending: true }),
    supabase.from("doubts").select("*").in("pact_id", pactIds),
    withReactions
      ? supabase.from("reactions").select("*").in("pact_id", pactIds)
      : Promise.resolve({ data: [], error: null }),
    supabase.from("hypes").select("*").in("pact_id", pactIds),
  ]);
  const err = p.error || m.error || c.error || d.error || r.error || h.error;
  if (err) throw err;
  return {
    pacts: (p.data ?? []) as Pact[],
    members: (m.data ?? []) as unknown as Member[],
    checkins: (c.data ?? []) as Checkin[],
    doubts: (d.data ?? []) as Doubt[],
    reactions: (r.data ?? []) as Reaction[],
    hypes: (h.data ?? []) as Hype[],
  };
}
