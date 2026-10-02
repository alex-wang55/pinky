import { NextResponse } from "next/server";
import { reminderTargets, sendTo, wrapTargets } from "@/lib/server";

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
  // Sunday evening (Eastern): everyone in an active pact gets their weekly wrap.
  let wraps = 0;
  const weekday = new Intl.DateTimeFormat("en-US", { timeZone: "America/Toronto", weekday: "short" }).format(new Date());
  if (weekday === "Sun") {
    for (const t of await wrapTargets()) {
      wraps += await sendTo([t], {
        title: "Your weekly wrap is in",
        body: "See how the week went and who carried the group.",
        url: "/",
        tag: "weekly-wrap",
      });
    }
  }
  return NextResponse.json({ targets: targets.length, sent, wraps });
}
