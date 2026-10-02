# Pinky

Pinky promise accountability with your friends. Make a pact, check in every night, be honest, and pay the pot when you slip.

Live: https://pinky-lemon.vercel.app

## Stack

- Next.js 16 (App Router, client pages) + Tailwind 4, deployed on Vercel
- Supabase: auth, Postgres (RLS + security-definer RPCs), storage for proof photos
- Web push (VAPID) via a service worker, with a daily reminder cron on Vercel

## How the rules work

- Check-ins are only accepted for "today" in the pact's timezone. Missing a day counts as broke.
- Goal types: daily yes/no, a daily number (kept if value >= target), or X sessions per Mon-Sun week (prorated for partial weeks).
- Off-days: N per week, don't break streaks, can't be used while a doubt is open.
- Stakes: $X per miss into a shared pot. Escalating doubles misses within the same week, capped at 4x.
- Group streak only counts a day (or week) if every active member kept it.
- Doubts: 1 per person per pact per week, on a "kept" from today or yesterday with no proof. Target has 24h to post a photo or own up. Unanswered = broke.
- All the math lives in `lib/stats.ts`. All enforcement lives in Postgres functions (see `supabase/schema.sql`).

## Env vars

See `.env.example`. `PUSH_SECRET` must match the `push_secret` row in `private.config`.

## Dev

    npm install
    npm run dev
