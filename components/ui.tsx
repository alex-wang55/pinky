"use client";

import Link from "next/link";
import { createContext, useCallback, useContext, useRef, useState, type ReactNode } from "react";
import type { Profile } from "@/lib/types";

export function cx(...c: (string | false | null | undefined)[]) {
  return c.filter(Boolean).join(" ");
}

type BtnProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "ghost" | "soft" | "kept" | "broke" | "off" | "danger";
  size?: "sm" | "md" | "lg";
  loading?: boolean;
  href?: string;
};

const variants: Record<NonNullable<BtnProps["variant"]>, string> = {
  primary: "bg-pink text-pink-ink hover:brightness-105 active:brightness-95",
  ghost: "bg-transparent text-ink hover:bg-surface-2",
  soft: "bg-surface-2 text-ink hover:brightness-[0.98]",
  kept: "bg-kept text-kept-ink hover:brightness-105",
  broke: "bg-broke-soft text-broke hover:brightness-[0.98]",
  off: "bg-off-soft text-off hover:brightness-[0.98]",
  danger: "bg-broke text-white hover:brightness-105",
};
const sizes = {
  sm: "h-9 px-3 text-sm rounded-xl",
  md: "h-11 px-4 text-[15px] rounded-2xl",
  lg: "h-14 px-5 text-base rounded-2xl",
};

export function Button({ variant = "primary", size = "md", loading, className, children, href, disabled, ...rest }: BtnProps) {
  const cls = cx(
    "inline-flex items-center justify-center gap-2 font-semibold transition select-none disabled:opacity-50 disabled:pointer-events-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-pink",
    variants[variant],
    sizes[size],
    className,
  );
  if (href) {
    return (
      <Link href={href} className={cls}>
        {children}
      </Link>
    );
  }
  return (
    <button className={cls} disabled={disabled || loading} {...rest}>
      {loading ? <Spinner small /> : null}
      {children}
    </button>
  );
}

export function Card({ className, children, ...rest }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={cx("rounded-3xl bg-surface border border-line shadow-card", className)} {...rest}>
      {children}
    </div>
  );
}

export function Spinner({ small }: { small?: boolean }) {
  return (
    <span
      aria-label="Loading"
      className={cx("inline-block animate-spin rounded-full border-2 border-current border-r-transparent", small ? "h-4 w-4" : "h-6 w-6")}
    />
  );
}

export function PageLoader() {
  return (
    <div className="flex min-h-[50dvh] items-center justify-center text-pink">
      <Spinner />
    </div>
  );
}

export function Avatar({ profile, size = 36, ring }: { profile?: Pick<Profile, "display_name" | "color"> | null; size?: number; ring?: string }) {
  const name = profile?.display_name ?? "?";
  const initials = name
    .split(/\s+/)
    .map((w) => w[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
  return (
    <span
      className={cx("inline-flex shrink-0 items-center justify-center rounded-full font-bold text-white", ring)}
      style={{ width: size, height: size, background: profile?.color ?? "#999", fontSize: size * 0.4 }}
      title={name}
    >
      {initials}
    </span>
  );
}

export function StatusPill({ status, small }: { status: "kept" | "broke" | "off" | "pending"; small?: boolean }) {
  const map = {
    kept: ["bg-kept-soft text-kept", "Kept it"],
    broke: ["bg-broke-soft text-broke", "Broke it"],
    off: ["bg-off-soft text-off", "Off-day"],
    pending: ["bg-surface-2 text-muted", "Not yet"],
  } as const;
  const [cls, label] = map[status];
  return (
    <span className={cx("inline-flex items-center rounded-full font-semibold", small ? "px-2 py-0.5 text-[11px]" : "px-2.5 py-1 text-xs", cls)}>
      {label}
    </span>
  );
}

export function Field({ label, hint, children }: { label: string; hint?: ReactNode; children: ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-sm font-semibold">{label}</span>
      {children}
      {hint ? <span className="mt-1 block text-xs text-muted">{hint}</span> : null}
    </label>
  );
}

export const inputCls =
  "w-full rounded-2xl border border-line bg-surface px-4 py-3 text-ink placeholder:text-muted/70 outline-none focus:border-pink focus:ring-4 focus:ring-pink/15 transition";

export function Segmented<T extends string>({
  value,
  onChange,
  options,
}: {
  value: T;
  onChange: (v: T) => void;
  options: { value: T; label: ReactNode }[];
}) {
  return (
    <div className="flex rounded-2xl bg-surface-2 p-1" role="tablist">
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          role="tab"
          aria-selected={value === o.value}
          onClick={() => onChange(o.value)}
          className={cx(
            "flex-1 rounded-xl px-3 py-2 text-sm font-semibold transition",
            value === o.value ? "bg-surface text-ink shadow-card" : "text-muted hover:text-ink",
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

export function Stepper({ value, onChange, min, max }: { value: number; onChange: (n: number) => void; min: number; max: number }) {
  return (
    <div className="inline-flex items-center rounded-2xl border border-line bg-surface">
      <button type="button" className="h-11 w-11 text-xl font-bold text-muted disabled:opacity-30" disabled={value <= min} onClick={() => onChange(value - 1)} aria-label="Less">
        −
      </button>
      <span className="w-8 text-center font-bold tabular">{value}</span>
      <button type="button" className="h-11 w-11 text-xl font-bold text-muted disabled:opacity-30" disabled={value >= max} onClick={() => onChange(value + 1)} aria-label="More">
        +
      </button>
    </div>
  );
}

export function Toggle({ checked, onChange, label }: { checked: boolean; onChange: (b: boolean) => void; label: string }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      onClick={() => onChange(!checked)}
      className={cx("relative h-7 w-12 shrink-0 rounded-full transition", checked ? "bg-pink" : "bg-line")}
    >
      <span className={cx("absolute top-0.5 h-6 w-6 rounded-full bg-white shadow transition-all", checked ? "left-[22px]" : "left-0.5")} />
    </button>
  );
}

export function SectionTitle({ children, right }: { children: ReactNode; right?: ReactNode }) {
  return (
    <div className="mb-2 mt-6 flex items-center justify-between px-1">
      <h2 className="text-[13px] font-bold uppercase tracking-wider text-muted">{children}</h2>
      {right}
    </div>
  );
}

/* ---------- toasts ---------- */
type Toast = { id: number; text: string; tone: "ok" | "err" };
const ToastCtx = createContext<(text: string, tone?: "ok" | "err") => void>(() => {});
export const useToast = () => useContext(ToastCtx);

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const id = useRef(0);
  const push = useCallback((text: string, tone: "ok" | "err" = "ok") => {
    const t = { id: ++id.current, text, tone };
    setToasts((x) => [...x, t]);
    setTimeout(() => setToasts((x) => x.filter((y) => y.id !== t.id)), 3200);
  }, []);
  return (
    <ToastCtx.Provider value={push}>
      {children}
      <div className="pointer-events-none fixed inset-x-0 top-3 z-50 flex flex-col items-center gap-2 px-4" aria-live="polite">
        {toasts.map((t) => (
          <div
            key={t.id}
            className={cx(
              "animate-pop pointer-events-auto max-w-sm rounded-2xl px-4 py-3 text-sm font-semibold shadow-card",
              t.tone === "err" ? "bg-broke text-white" : "bg-ink text-bg",
            )}
          >
            {t.text}
          </div>
        ))}
      </div>
    </ToastCtx.Provider>
  );
}
