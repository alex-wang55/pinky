import "server-only";
import webpush from "web-push";
import { createClient } from "@supabase/supabase-js";

const URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const SECRET = process.env.PUSH_SECRET ?? "";

export function sbAs(token?: string) {
  return createClient(URL, KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: token ? { headers: { Authorization: `Bearer ${token}` } } : undefined,
  });
}

let ready: boolean | null = null;
function setup(): boolean {
  if (ready !== null) return ready;
  const pub = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  const priv = process.env.VAPID_PRIVATE_KEY;
  if (!pub || !priv || !SECRET) return (ready = false);
  webpush.setVapidDetails(process.env.VAPID_SUBJECT || "https://pinky.vercel.app", pub, priv);
  return (ready = true);
}

export type PushPayload = { title: string; body: string; url?: string; tag?: string };
type Target = { endpoint: string; p256dh: string; auth_key: string };

export async function sendTo(targets: Target[], payload: PushPayload): Promise<number> {
  if (!setup()) return 0;
  const sb = sbAs();
  let sent = 0;
  await Promise.all(
    targets.map(async (t) => {
      try {
        await webpush.sendNotification(
          { endpoint: t.endpoint, keys: { p256dh: t.p256dh, auth: t.auth_key } },
          JSON.stringify(payload),
          { TTL: 60 * 60 * 6 },
        );
        sent++;
      } catch (e) {
        const code = (e as { statusCode?: number }).statusCode;
        if (code === 404 || code === 410) {
          await sb.rpc("drop_push_subscription", { p_secret: SECRET, p_endpoint: t.endpoint });
        }
      }
    }),
  );
  return sent;
}

export async function pushToUser(userId: string, payload: PushPayload): Promise<number> {
  if (!setup()) return 0;
  const { data, error } = await sbAs().rpc("push_targets_for_user", { p_secret: SECRET, p_user: userId });
  if (error || !data) return 0;
  return sendTo(data as Target[], payload);
}

export async function wrapTargets() {
  const { data, error } = await sbAs().rpc("wrap_targets", { p_secret: SECRET });
  if (error) throw error;
  return (data ?? []) as (Target & { target_user: string })[];
}

export async function reminderTargets() {
  const { data, error } = await sbAs().rpc("reminder_targets", { p_secret: SECRET });
  if (error) throw error;
  return (data ?? []) as (Target & { target_user: string; pact_names: string })[];
}
