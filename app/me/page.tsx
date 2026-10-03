"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Shell } from "@/components/shell";
import { useAuth } from "@/components/auth";
import { COLORS } from "@/components/auth-forms";
import { Avatar, Button, GroupLabel, GroupNote, List, Row, Toggle, cx, rowInputCls, useToast } from "@/components/ui";
import { supabase, errMsg } from "@/lib/supabase";
import { currentSubscription, disablePush, enablePush, isIos, isStandalone, pushSupported } from "@/lib/push-client";
import { IconCheck, IconChevronDown } from "@/components/icons";

export default function MePage() {
  return (
    <Shell>
      <Me />
    </Shell>
  );
}

function Me() {
  const { profile, session, refreshProfile } = useAuth();
  const router = useRouter();
  const toast = useToast();
  const [name, setName] = useState(profile?.display_name ?? "");
  const [color, setColor] = useState(profile?.color ?? COLORS[0]);
  const [saving, setSaving] = useState(false);
  const [push, setPush] = useState<"loading" | "on" | "off" | "unsupported" | "ios">("loading");
  const [pushBusy, setPushBusy] = useState(false);
  const [how, setHow] = useState(false);

  useEffect(() => {
    if (profile) {
      setName(profile.display_name);
      setColor(profile.color);
    }
  }, [profile]);

  useEffect(() => {
    (async () => {
      if (isIos() && !isStandalone()) return setPush("ios");
      if (!pushSupported()) return setPush("unsupported");
      const sub = await currentSubscription();
      setPush(sub && Notification.permission === "granted" ? "on" : "off");
    })();
  }, []);

  async function save() {
    if (!profile) return;
    setSaving(true);
    const { error } = await supabase.from("profiles").update({ display_name: name.trim() || profile.username, color }).eq("id", profile.id);
    setSaving(false);
    if (error) return toast(errMsg(error), "err");
    await refreshProfile();
    toast("Saved");
  }

  async function togglePush(on: boolean) {
    setPushBusy(true);
    try {
      if (on) {
        await enablePush();
        setPush("on");
        toast("Notifications on");
      } else {
        await disablePush();
        setPush("off");
      }
    } catch (e) {
      toast(errMsg(e), "err");
    } finally {
      setPushBusy(false);
    }
  }

  const dirty = profile && (name.trim() !== profile.display_name || color !== profile.color);

  return (
    <div>
      <div className="flex flex-col items-center pb-1 pt-3 text-center">
        <Avatar profile={{ display_name: name || "?", color }} size={88} />
        <h1 className="mt-3 text-[24px] font-bold tracking-[-0.02em]">{profile?.display_name}</h1>
        <p className="text-[15px] text-muted">@{profile?.username}</p>
      </div>

      <GroupLabel>Profile</GroupLabel>
      <List>
        <label className="flex min-h-[52px] items-center gap-3 px-4">
          <span className="text-[16px]">Name</span>
          <input className={rowInputCls} maxLength={40} value={name} onChange={(e) => setName(e.target.value)} aria-label="Display name" />
        </label>
        <div className="flex min-h-[52px] items-center gap-3 px-4">
          <span className="text-[16px]">Email</span>
          <span className="min-w-0 flex-1 truncate text-right text-[16px] text-muted">{session?.user.email}</span>
        </div>
        <div className="px-4 py-3">
          <span className="text-[16px]">Color</span>
          <div className="mt-2.5 flex flex-wrap justify-between gap-y-2">
            {COLORS.map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => setColor(c)}
                className="flex h-8 w-8 items-center justify-center rounded-full text-white transition active:scale-90"
                style={{ background: c }}
                aria-label={`Color ${c}`}
                aria-pressed={color === c}
              >
                {color === c ? <IconCheck size={16} strokeWidth={3} /> : null}
              </button>
            ))}
          </div>
        </div>
      </List>
      {dirty ? (
        <Button onClick={save} loading={saving} size="lg" className="animate-pop mt-3 w-full">
          Save changes
        </Button>
      ) : null}

      <GroupLabel>Notifications</GroupLabel>
      <List>
        <Row
          title="Reminders and nudges"
          trailing={push === "on" || push === "off" ? <Toggle checked={push === "on"} onChange={(v) => !pushBusy && togglePush(v)} label="Notifications" /> : null}
        />
      </List>
      <GroupNote>
        {push === "ios"
          ? "On iPhone, tap Share, then Add to Home Screen. Open Pinky from your home screen to turn these on."
          : push === "unsupported"
            ? "This browser doesn't support notifications."
            : "A reminder around 9pm if you haven't checked in, plus friend nudges, doubts and invites."}
      </GroupNote>

      <GroupLabel>About</GroupLabel>
      <List>
        <button className="tap flex min-h-[52px] w-full items-center gap-3 px-4 text-left" onClick={() => setHow((v) => !v)} aria-expanded={how}>
          <span className="flex-1 text-[16px] font-medium">How Pinky works</span>
          <IconChevronDown size={16} className={cx("text-faint transition", how && "rotate-180")} />
        </button>
        {how ? (
          <div className="animate-pop space-y-2.5 px-4 pb-4 pt-3 text-[15px] leading-snug text-muted">
            <p>Make a pact with friends: a goal, a price per miss, and what counts as breaking it.</p>
            <p>Check in before midnight. If you don&apos;t, it counts as broke.</p>
            <p>The group streak only grows when everyone keeps it.</p>
            <p>You get one doubt a week per pact. If someone doubts you, post a photo or own up within 24 hours.</p>
            <p>Misses go in the pot. Settle up with an e-transfer when it ends.</p>
          </div>
        ) : null}
      </List>

      <List className="mt-8">
        <Row
          title={<span className="block text-center">Log out</span>}
          tone="danger"
          onClick={async () => {
            await supabase.auth.signOut();
            router.replace("/");
          }}
        />
      </List>
    </div>
  );
}
