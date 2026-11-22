"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { Shell } from "@/components/shell";
import { useAuth } from "@/components/auth";
import { COLORS } from "@/components/auth-forms";
import { Avatar, Button, Card, Field, SectionTitle, Spinner, Toggle, inputCls, cx, useToast } from "@/components/ui";
import { supabase, errMsg } from "@/lib/supabase";
import { squareImage } from "@/lib/image";
import { currentSubscription, disablePush, enablePush, isIos, isStandalone, pushSupported } from "@/lib/push-client";
import { IconCamera, IconEye, IconFlame, IconJar, IconMoon, IconPact, IconTrash } from "@/components/icons";
import { HistorySummary, MyConfessions, PastPacts, YearGrid, useHistory } from "@/components/history";

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
  const [photoBusy, setPhotoBusy] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const [push, setPush] = useState<"loading" | "on" | "off" | "unsupported" | "ios">("loading");
  const [pushBusy, setPushBusy] = useState(false);
  const history = useHistory(session!.user.id);

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

  /** Point the profile at a new photo (or none) and clean up the old file. */
  async function setPhoto(path: string | null) {
    if (!profile) return;
    const old = profile.avatar_path;
    const { error } = await supabase.from("profiles").update({ avatar_path: path }).eq("id", profile.id);
    if (error) {
      if (path) await supabase.storage.from("avatars").remove([path]);
      throw error;
    }
    if (old) await supabase.storage.from("avatars").remove([old]);
    await refreshProfile();
  }

  async function pickPhoto(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file || !profile) return;
    setPhotoBusy(true);
    try {
      const blob = await squareImage(file);
      const path = `${profile.id}/${crypto.randomUUID()}.jpg`;
      const up = await supabase.storage.from("avatars").upload(path, blob, { contentType: "image/jpeg", upsert: false });
      if (up.error) throw up.error;
      await setPhoto(path);
      toast("Photo updated");
    } catch (err) {
      toast(errMsg(err), "err");
    } finally {
      setPhotoBusy(false);
    }
  }

  async function removePhoto() {
    setPhotoBusy(true);
    try {
      await setPhoto(null);
      toast("Photo removed");
    } catch (err) {
      toast(errMsg(err), "err");
    } finally {
      setPhotoBusy(false);
    }
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
  const hasPhoto = Boolean(profile?.avatar_path);

  return (
    <div>
      <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={pickPhoto} />
      <div className="flex flex-col items-center pb-2 pt-2 text-center">
        <button
          type="button"
          onClick={() => fileRef.current?.click()}
          disabled={photoBusy}
          aria-label={hasPhoto ? "Change profile photo" : "Add profile photo"}
          className="relative rounded-full transition hover:brightness-95 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-pink"
        >
          <Avatar profile={{ display_name: name || "?", color, avatar_path: profile?.avatar_path }} size={84} />
          <span className="absolute -bottom-0.5 -right-0.5 flex h-8 w-8 items-center justify-center rounded-full border-2 border-bg bg-pink text-pink-ink">
            {photoBusy ? <Spinner small /> : <IconCamera size={16} />}
          </span>
        </button>
        <h1 className="mt-3 font-display text-2xl font-bold">{profile?.display_name}</h1>
        <p className="text-sm text-muted">@{profile?.username} · {session?.user.email}</p>
      </div>

      <SectionTitle>Your history</SectionTitle>
      <Card className="space-y-3 p-4">
        {history ? (
          <>
            <HistorySummary h={history} />
            <YearGrid h={history} />
            <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted" aria-hidden="true">
              <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-[3px] bg-kept" /> kept it</span>
              <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-[3px] bg-broke" /> broke it</span>
              <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-[3px] bg-off" /> off-day</span>
              <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-[3px] bg-surface-2" /> no pact</span>
            </div>
          </>
        ) : (
          <div className="h-32 animate-pulse rounded-xl bg-surface-2" />
        )}
      </Card>

      <div className="lg:grid lg:grid-cols-2 lg:items-start lg:gap-8">
      <div>
        <SectionTitle>Past pacts</SectionTitle>
        {history ? <PastPacts h={history} /> : null}
        <SectionTitle>Your confessions</SectionTitle>
        {history ? <MyConfessions h={history} /> : null}
      </div>

      <div>
      <SectionTitle>Profile</SectionTitle>
      <Card className="space-y-4 p-4">
        <div>
          <span className="mb-1.5 block text-sm font-semibold">Photo</span>
          <div className="flex flex-wrap gap-2">
            <Button size="sm" variant="soft" loading={photoBusy} onClick={() => fileRef.current?.click()}>
              {photoBusy ? null : <IconCamera size={16} />}
              {hasPhoto ? "Change photo" : "Add photo"}
            </Button>
            {hasPhoto ? (
              <Button size="sm" variant="ghost" disabled={photoBusy} onClick={removePhoto}>
                <IconTrash size={16} />
                Remove
              </Button>
            ) : null}
          </div>
        </div>
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
