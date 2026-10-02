import { NextResponse } from "next/server";
import { reminderTargets, sendTo } from "@/lib/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Runs once a day (see vercel.json) and pings anyone who hasn't checked in yet.
export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || req.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const targets = await reminderTargets();
  let sent = 0;
  for (const t of targets) {
    sent += await sendTo([t], {
      title: "Did you keep it today?",
      body: `Still open: ${t.pact_names}. Midnight is the cutoff.`,
      url: "/",
      tag: "daily-reminder",
    });
  }
  return NextResponse.json({ targets: targets.length, sent });
}
