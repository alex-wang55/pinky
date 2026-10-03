"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Shell } from "@/components/shell";
import { useAuth } from "@/components/auth";
import { COLORS } from "@/components/auth-forms";
import { Avatar, Button, Card, Field, SectionTitle, Toggle, inputCls, cx, useToast } from "@/components/ui";
import { supabase, errMsg } from "@/lib/supabase";
import { currentSubscription, disablePush, enablePush, isIos, isStandalone, pushSupported } from "@/lib/push-client";
import { IconEye, IconFlame, IconJar, IconMoon, IconPact } from "@/components/icons";

export default function MePage() {
  return (
    <Shell wide>
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
      <div className="flex flex-col items-center pb-2 pt-2 text-center">
        <Avatar profile={{ display_name: name || "?", color }} size={84} />
        <h1 className="mt-3 font-display text-2xl font-bold">{profile?.display_name}</h1>
        <p className="text-sm text-muted">@{profile?.username} · {session?.user.email}</p>
      </div>

      <div className="lg:grid lg:grid-cols-2 lg:items-start lg:gap-8">
      <div>
      <SectionTitle>Profile</SectionTitle>
      <Card className="space-y-4 p-4">
        <Field label="Display name">
          <input className={inputCls} maxLength={40} value={name} onChange={(e) => setName(e.target.value)} />
        </Field>
        <div>
          <span className="mb-1.5 block text-sm font-semibold">Color</span>
          <div className="flex flex-wrap gap-2">
            {COLORS.map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => setColor(c)}
                className={cx("h-9 w-9 rounded-full transition", color === c && "ring-2 ring-ink ring-offset-2 ring-offset-surface")}
                style={{ background: c }}
                aria-label={`Color ${c}`}
              />
            ))}
          </div>
        </div>
        {dirty ? (
          <Button onClick={save} loading={saving} className="w-full">
            Save
          </Button>
        ) : null}
      </Card>
      </div>

      <div>
      <SectionTitle>Notifications</SectionTitle>
      <Card className="p-4">
        <div className="flex items-center justify-between gap-4">
          <div>
            <div className="font-semibold">Nudges and reminders</div>
            <div className="text-sm text-muted">
              {push === "ios"
                ? "On iPhone: tap Share, then Add to Home Screen. Open Pinky from your home screen to turn these on."
                : push === "unsupported"
                  ? "This browser doesn't support notifications."
                  : "Friend nudges, doubts, invites, and a reminder around 9pm if you haven't checked in."}
            </div>
          </div>
          {push === "on" || push === "off" ? (
            <Toggle checked={push === "on"} onChange={(v) => !pushBusy && togglePush(v)} label="Notifications" />
          ) : null}
        </div>
      </Card>

      <SectionTitle>How Pinky works</SectionTitle>
      <Card className="space-y-3 p-4 text-sm text-muted">
        {[
          [IconPact, "Make a pact with friends: a goal, a stake per miss, and what counts as breaking it."],
          [IconMoon, "Check in before midnight. If you don't, it counts as broke."],
          [IconFlame, "The group streak only grows if everyone keeps it."],
          [IconEye, "One doubt a week per pact. Doubted? Post a photo or own up within 24h."],
          [IconJar, "Misses go in the pot. Settle up with e-transfer when it ends."],
        ].map(([Icon, text]) => {
          const I = Icon as typeof IconPact;
          return (
            <p key={text as string} className="flex gap-2.5">
              <I size={18} className="mt-px shrink-0 text-pink" />
              <span>{text as string}</span>
            </p>
          );
        })}
      </Card>

      <div className="mt-6">
        <Button
          variant="soft"
          className="w-full"
          onClick={async () => {
            await supabase.auth.signOut();
            router.replace("/");
          }}
        >
          Log out
        </Button>
      </div>
      </div>
      </div>
    </div>
  );
}
