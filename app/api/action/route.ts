import { NextResponse } from "next/server";
import { pushToUser, sbAs } from "@/lib/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function bad(error: string, status = 400) {
  return NextResponse.json({ error }, { status });
}

export async function POST(req: Request) {
  const token = req.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  if (!token) return bad("Not signed in", 401);
  const sb = sbAs(token);
  const { data: auth } = await sb.auth.getUser(token);
  const user = auth?.user;
  if (!user) return bad("Not signed in", 401);

  const body = (await req.json().catch(() => ({}))) as Record<string, string | string[]>;
  const { data: me } = await sb.from("profiles").select("display_name").eq("id", user.id).single();
  const myName = me?.display_name ?? "A friend";

  const pactInfo = async (id: string) => {
    const { data } = await sb.from("pacts").select("name, emoji").eq("id", id).single();
    return data ? `${data.emoji} ${data.name}` : "your pact";
  };

  try {
    switch (body.action) {
      case "friend_request": {
        const username = String(body.username ?? "");
        const { data, error } = await sb.rpc("send_friend_request", { p_username: username });
        if (error) return bad(error.message);
        if (data === "sent" || data === "accepted") {
          const { data: target } = await sb
            .from("profiles")
            .select("id")
            .eq("username", username.replace(/^@/, "").trim().toLowerCase())
            .single();
          if (target) {
            await pushToUser(target.id, {
              title: data === "sent" ? `${myName} wants to be accountability buddies` : `${myName} accepted your request`,
              body: data === "sent" ? "Open Pinky to accept." : "Make a pact together.",
              url: "/friends",
              tag: "friends",
            });
          }
        }
        return NextResponse.json({ result: data });
      }

      case "nudge": {
        const pactId = String(body.pactId);
        const toUser = String(body.toUser);
        const { error } = await sb.rpc("send_nudge", { p_pact: pactId, p_to: toUser });
        if (error) return bad(error.message);
        const name = await pactInfo(pactId);
        await pushToUser(toUser, {
          title: `${myName} nudged you`,
          body: `Check in for ${name} before midnight.`,
          url: `/pacts/${pactId}`,
          tag: `nudge-${pactId}`,
        });
        return NextResponse.json({ ok: true });
      }

      case "doubt": {
        const { data, error } = await sb.rpc("raise_doubt", { p_checkin: String(body.checkinId) });
        if (error) return bad(error.message);
        const res = data as { target_user: string; pact_id: string };
        const name = await pactInfo(res.pact_id);
        await pushToUser(res.target_user, {
          title: `${myName} doubts your check-in`,
          body: `Post a proof photo or own up within 24 hours (${name}).`,
          url: `/pacts/${res.pact_id}`,
          tag: `doubt-${res.pact_id}`,
        });
        return NextResponse.json({ ok: true });
      }

      case "hype": {
        const pactId = String(body.pactId);
        const toUser = String(body.toUser);
        const streak = Number(body.streak);
        const unit = body.unit === "week" ? "week" : "day";
        const { error } = await sb.rpc("send_hype", { p_pact: pactId, p_to: toUser, p_streak: streak });
        if (error) return bad(error.message);
        const name = await pactInfo(pactId);
        await pushToUser(toUser, {
          title: `${myName} hyped your ${streak}-${unit} streak`,
          body: `${name}. Keep it going.`,
          url: `/pacts/${pactId}`,
          tag: `hype-${pactId}`,
        });
        return NextResponse.json({ ok: true });
      }

      case "invite": {
        const pactId = String(body.pactId);
        const users = (Array.isArray(body.users) ? body.users : [body.users]).filter(Boolean).map(String);
        for (const u of users) {
          const { error } = await sb.rpc("invite_to_pact", { p_pact: pactId, p_user: u });
          if (error) return bad(error.message);
        }
        const name = await pactInfo(pactId);
        await Promise.all(
          users.map((u) =>
            pushToUser(u, { title: `${myName} invited you to a pact`, body: `${name}. Pinky promise?`, url: "/", tag: "invite" }),
          ),
        );
        return NextResponse.json({ ok: true });
      }

      case "notify_invites": {
        // After create_pact: ping everyone who was invited.
        const pactId = String(body.pactId);
        const { data: invited } = await sb
          .from("pact_members")
          .select("user_id")
          .eq("pact_id", pactId)
          .eq("status", "invited")
          .eq("invited_by", user.id);
        const name = await pactInfo(pactId);
        await Promise.all(
          (invited ?? []).map((m) =>
            pushToUser(m.user_id, { title: `${myName} invited you to a pact`, body: `${name}. Pinky promise?`, url: "/", tag: "invite" }),
          ),
        );
        return NextResponse.json({ ok: true });
      }

      default:
        return bad("Unknown action");
    }
  } catch (e) {
    return bad((e as Error).message || "Something went wrong", 500);
  }
}
