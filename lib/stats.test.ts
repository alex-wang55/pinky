import { describe, it, expect } from "vitest";
import { missCost, doubtExpired, effectiveStatus } from "./stats";
import type { Checkin, Doubt, Pact } from "./types";

const now = Date.parse("2026-10-12T12:00:00Z");
const HOUR = 3600 * 1000;

const pact = (escalating: boolean) => ({ stake_cents: 500, escalating }) as Pact;
const checkin = (status: Checkin["status"], id = "c1") => ({ id, status }) as Checkin;
const doubt = (status: Doubt["status"], hoursAgo: number, checkinId = "c1") =>
  ({ id: "d1", checkin_id: checkinId, status, created_at: new Date(now - hoursAgo * HOUR).toISOString() }) as Doubt;

describe("missCost", () => {
  it("charges a flat stake when the pact isn't escalating", () => {
    expect([0, 1, 2, 3].map((n) => missCost(pact(false), n))).toEqual([500, 500, 500, 500]);
  });

  it("doubles each miss in a week and caps at 4x", () => {
    expect([0, 1, 2, 3, 4].map((n) => missCost(pact(true), n))).toEqual([500, 1000, 2000, 2000, 2000]);
  });
});

describe("doubtExpired", () => {
  it("expires an open doubt after 24 hours", () => {
    expect(doubtExpired(doubt("open", 25), now)).toBe(true);
    expect(doubtExpired(doubt("open", 23), now)).toBe(false);
  });

  it("never expires a doubt that was answered", () => {
    expect(doubtExpired(doubt("proved", 48), now)).toBe(false);
    expect(doubtExpired(doubt("confessed", 48), now)).toBe(false);
  });
});

describe("effectiveStatus", () => {
  it("turns a kept check-in into broke when its doubt goes unanswered", () => {
    expect(effectiveStatus(checkin("kept"), [doubt("open", 25)], now)).toEqual({ status: "broke", viaDoubt: true });
  });

  it("leaves a kept check-in alone while the doubt is still inside 24 hours", () => {
    expect(effectiveStatus(checkin("kept"), [doubt("open", 2)], now)).toEqual({ status: "kept", viaDoubt: false });
  });

  it("leaves a kept check-in alone when proof was posted", () => {
    expect(effectiveStatus(checkin("kept"), [doubt("proved", 30)], now)).toEqual({ status: "kept", viaDoubt: false });
  });

  it("ignores doubts on other check-ins", () => {
    expect(effectiveStatus(checkin("kept"), [doubt("open", 25, "c2")], now)).toEqual({ status: "kept", viaDoubt: false });
  });
});
