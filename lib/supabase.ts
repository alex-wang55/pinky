import { createClient } from "@supabase/supabase-js";

export const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
export const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: { persistSession: true, autoRefreshToken: true, storageKey: "pinky-auth" },
});

/** Public URL for a profile picture in the avatars bucket. */
export function avatarUrl(path: string | null | undefined): string | null {
  return path ? supabase.storage.from("avatars").getPublicUrl(path).data.publicUrl : null;
}

/** Turn a Postgres/PostgREST error into something a person can read. */
export function errMsg(e: unknown): string {
  if (!e) return "Something went wrong";
  const m = (e as { message?: string }).message ?? String(e);
  if (m.includes("duplicate key")) return "That already exists";
  if (m.includes("JWT")) return "Your session expired. Log in again.";
  return m;
}
