"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { supabase, errMsg } from "@/lib/supabase";
import { useAuth } from "./auth";
import { Button, Field, inputCls as baseInput } from "./ui";

// These forms sit on the page background, so fields get a white fill instead of grey.
const inputCls = baseInput + " !bg-surface shadow-card";
import { LogoMark } from "./logo";

export const COLORS = ["#f2316f", "#7c5cff", "#0ea5a4", "#f59e0b", "#3b82f6", "#ef6c3a", "#16a34a", "#c026d3"];

function useNext() {
  const sp = useSearchParams();
  const n = sp.get("next");
  return n && n.startsWith("/") && !n.startsWith("//") ? n : "/";
}

function AuthFrame({ title, sub, children }: { title: string; sub: string; children: React.ReactNode }) {
  return (
    <div className="mx-auto flex min-h-dvh max-w-sm flex-col justify-center px-5 py-10">
      <Link href="/" className="mb-8 self-start" aria-label="Pinky home">
        <LogoMark size={44} />
      </Link>
      <h1 className="title-lg">{title}</h1>
      <p className="mt-1 text-[17px] text-muted">{sub}</p>
      <div className="mt-8">{children}</div>
    </div>
  );
}

export function LoginForm() {
  const router = useRouter();
  const next = useNext();
  const { session } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  useEffect(() => {
    if (session) router.replace(next);
  }, [session, next, router]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setErr("");
    const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
    setBusy(false);
    if (error) setErr(error.message === "Invalid login credentials" ? "Wrong email or password" : errMsg(error));
    else router.replace(next);
  }

  return (
    <AuthFrame title="Welcome back" sub="Time to be honest.">
      <form onSubmit={submit} className="space-y-4">
        <Field label="Email">
          <input className={inputCls} type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
        </Field>
        <Field label="Password">
          <input className={inputCls} type="password" autoComplete="current-password" required value={password} onChange={(e) => setPassword(e.target.value)} />
        </Field>
        {err ? <p className="px-1 text-[14px] font-medium text-broke">{err}</p> : null}
        <Button type="submit" size="lg" className="w-full" loading={busy}>
          Log in
        </Button>
      </form>
      <p className="mt-6 text-center text-[15px] text-muted">
        New here?{" "}
        <Link className="font-semibold text-pink" href={`/signup${next !== "/" ? `?next=${encodeURIComponent(next)}` : ""}`}>
          Make an account
        </Link>
      </p>
    </AuthFrame>
  );
}

export function SignupForm() {
  const router = useRouter();
  const next = useNext();
  const { session } = useAuth();
  const [name, setName] = useState("");
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [avail, setAvail] = useState<null | boolean>(null);

  useEffect(() => {
    if (session) router.replace(next);
  }, [session, next, router]);

  const uname = username.trim().toLowerCase();
  const unameValid = /^[a-z0-9_]{3,20}$/.test(uname);

  useEffect(() => {
    setAvail(null);
    if (!unameValid) return;
    const t = setTimeout(async () => {
      const { data } = await supabase.rpc("username_available", { p_username: uname });
      setAvail(Boolean(data));
    }, 350);
    return () => clearTimeout(t);
  }, [uname, unameValid]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!unameValid) return setErr("Usernames are 3 to 20 letters, numbers or underscores");
    if (avail === false) return setErr("That username is taken");
    if (password.length < 6) return setErr("Password needs at least 6 characters");
    setBusy(true);
    setErr("");
    const color = COLORS[Math.floor(Math.random() * COLORS.length)];
    const { data, error } = await supabase.auth.signUp({
      email: email.trim(),
      password,
      options: { data: { username: uname, display_name: name.trim() || uname, color } },
    });
    if (error) {
      setBusy(false);
      setErr(error.message.includes("Database error") ? "That username was just taken. Try another." : errMsg(error));
      return;
    }
    if (!data.session) {
      const { error: e2 } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
      if (e2) {
        setBusy(false);
        setErr(errMsg(e2));
        return;
      }
    }
    router.replace(next);
  }

  return (
    <AuthFrame title="Make it official" sub="Your friends will hold you to it.">
      <form onSubmit={submit} className="space-y-4">
        <Field label="Your name">
          <input className={inputCls} autoComplete="given-name" required maxLength={40} value={name} onChange={(e) => setName(e.target.value)} placeholder="Alex" />
        </Field>
        <Field
          label="Username"
          hint={
            !uname ? "Friends add you with this" : !unameValid ? "3 to 20 letters, numbers or _" : avail === null ? "Checking..." : avail ? "Nice, it's free" : "Taken, try another"
          }
        >
          <div className="relative">
            <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-muted">@</span>
            <input
              className={inputCls + " pl-8"}
              autoCapitalize="none"
              autoCorrect="off"
              spellCheck={false}
              required
              maxLength={20}
              value={username}
              onChange={(e) => setUsername(e.target.value.replace(/\s/g, ""))}
              placeholder="alex"
            />
          </div>
        </Field>
        <Field label="Email">
          <input className={inputCls} type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
        </Field>
        <Field label="Password" hint="At least 6 characters">
          <input className={inputCls} type="password" autoComplete="new-password" required value={password} onChange={(e) => setPassword(e.target.value)} />
        </Field>
        {err ? <p className="px-1 text-[14px] font-medium text-broke">{err}</p> : null}
        <Button type="submit" size="lg" className="w-full" loading={busy}>
          Create account
        </Button>
      </form>
      <p className="mt-6 text-center text-[15px] text-muted">
        Already have one?{" "}
        <Link className="font-semibold text-pink" href={`/login${next !== "/" ? `?next=${encodeURIComponent(next)}` : ""}`}>
          Log in
        </Link>
      </p>
    </AuthFrame>
  );
}
