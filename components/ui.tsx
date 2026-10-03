"use client";

import Link from "next/link";
import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import type { Profile } from "@/lib/types";
import { IconCheck, IconChevronRight, IconX } from "./icons";

export function cx(...c: (string | false | null | undefined)[]) {
  return c.filter(Boolean).join(" ");
}

/* ------------------------------------------------------------------ */
/* Buttons                                                              */
/* ------------------------------------------------------------------ */
type Variant = "primary" | "tinted" | "soft" | "ghost" | "plain" | "kept" | "broke" | "off" | "danger";
type BtnProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: Variant;
  size?: "sm" | "md" | "lg";
  loading?: boolean;
  href?: string;
};

const variants: Record<Variant, string> = {
  primary: "bg-pink text-pink-ink active:brightness-90",
  tinted: "bg-pink-soft text-pink active:brightness-95",
  soft: "bg-surface-2 text-ink active:brightness-95",
  ghost: "bg-transparent text-muted hover:text-ink active:bg-surface-2",
  plain: "bg-transparent text-pink active:opacity-60 !px-1",
  kept: "bg-kept text-kept-ink active:brightness-90",
  broke: "bg-broke-soft text-broke active:brightness-95",
  off: "bg-off-soft text-off active:brightness-95",
  danger: "bg-broke text-white active:brightness-90",
};
const sizes = {
  sm: "h-8 px-3.5 text-[13px] gap-1.5",
  md: "h-11 px-5 text-[15px] gap-2",
  lg: "h-[52px] px-6 text-[17px] gap-2",
};

export function Button({ variant = "primary", size = "md", loading, className, children, href, disabled, ...rest }: BtnProps) {
  const cls = cx(
    "inline-flex items-center justify-center rounded-full font-semibold transition select-none disabled:opacity-40 disabled:pointer-events-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-pink",
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

/** Round icon-only button, for nav bars and row actions. */
export function IconButton({
  label,
  children,
  onClick,
  href,
  tone = "soft",
  className,
}: {
  label: string;
  children: ReactNode;
  onClick?: () => void;
  href?: string;
  tone?: "soft" | "primary" | "ghost";
  className?: string;
}) {
  const cls = cx(
    "inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full transition active:scale-95",
    tone === "primary" ? "bg-pink text-pink-ink" : tone === "soft" ? "bg-surface text-ink shadow-card" : "text-muted hover:text-ink",
    className,
  );
  if (href)
    return (
      <Link href={href} className={cls} aria-label={label}>
        {children}
      </Link>
    );
  return (
    <button type="button" className={cls} onClick={onClick} aria-label={label}>
      {children}
    </button>
  );
}

/* ------------------------------------------------------------------ */
/* Surfaces and lists                                                   */
/* ------------------------------------------------------------------ */
export function Card({ className, children, ...rest }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={cx("rounded-2xl bg-surface shadow-card", className)} {...rest}>
      {children}
    </div>
  );
}

/** A grouped list. Rows get hairlines between them, inset to line up with the text. */
export function List({ children, inset = 16, className }: { children: ReactNode; inset?: number; className?: string }) {
  return (
    <div className={cx("list overflow-hidden rounded-2xl bg-surface shadow-card", className)} style={{ ["--inset" as string]: `${inset}px` }}>
      {children}
    </div>
  );
}

export function Row({
  leading,
  title,
  subtitle,
  trailing,
  href,
  onClick,
  chevron,
  tone,
  className,
}: {
  leading?: ReactNode;
  title: ReactNode;
  subtitle?: ReactNode;
  trailing?: ReactNode;
  href?: string;
  onClick?: () => void;
  chevron?: boolean;
  tone?: "danger" | "pink";
  className?: string;
}) {
  const inner = (
    <>
      {leading ? <span className="flex shrink-0 items-center">{leading}</span> : null}
      <span className="min-w-0 flex-1">
        <span className={cx("block truncate text-[16px] font-medium", tone === "danger" && "text-broke", tone === "pink" && "text-pink")}>{title}</span>
        {subtitle ? <span className="mt-0.5 block text-[13px] leading-snug text-muted">{subtitle}</span> : null}
      </span>
      {trailing ? <span className="flex shrink-0 items-center gap-2">{trailing}</span> : null}
      {chevron ? <IconChevronRight size={18} className="-mr-1 shrink-0 text-faint" /> : null}
    </>
  );
  const cls = cx("flex min-h-[52px] w-full items-center gap-3 px-4 py-2.5 text-left", (href || onClick) && "tap", className);
  if (href)
    return (
      <Link href={href} className={cls}>
        {inner}
      </Link>
    );
  if (onClick)
    return (
      <button type="button" onClick={onClick} className={cls}>
        {inner}
      </button>
    );
  return <div className={cls}>{inner}</div>;
}

/** Square icon tile used as a row's leading visual. */
export function Tile({ children, tone = "pink", size = 32 }: { children: ReactNode; tone?: "pink" | "kept" | "off" | "broke" | "grey"; size?: number }) {
  const map = {
    pink: "bg-pink-soft text-pink",
    kept: "bg-kept-soft text-kept",
    off: "bg-off-soft text-off",
    broke: "bg-broke-soft text-broke",
    grey: "bg-surface-2 text-ink",
  };
  return (
    <span className={cx("inline-flex shrink-0 items-center justify-center rounded-[10px]", map[tone])} style={{ width: size, height: size }}>
      {children}
    </span>
  );
}

/** Page header for top-level tabs: small line above, big title, optional action on the right. */
export function LargeTitle({ eyebrow, title, sub, action }: { eyebrow?: ReactNode; title: ReactNode; sub?: ReactNode; action?: ReactNode }) {
  return (
    <div className="mb-5 flex items-end justify-between gap-3 px-1 pt-2">
      <div className="min-w-0">
        {eyebrow ? <p className="text-[13px] font-medium text-muted">{eyebrow}</p> : null}
        <h1 className="title-lg">{title}</h1>
        {sub ? <p className="mt-1 text-[15px] text-muted">{sub}</p> : null}
      </div>
      {action ? <div className="mb-1 shrink-0">{action}</div> : null}
    </div>
  );
}

/** Section header between groups. Sentence case, with an optional action on the right. */
export function SectionTitle({ children, right, className }: { children: ReactNode; right?: ReactNode; className?: string }) {
  return (
    <div className={cx("mb-2 mt-7 flex items-end justify-between gap-3 px-1", className)}>
      <h2 className="text-[20px] font-bold tracking-[-0.015em]">{children}</h2>
      {right}
    </div>
  );
}

/** Small grey label above a settings-style group. */
export function GroupLabel({ children }: { children: ReactNode }) {
  return <p className="mb-1.5 mt-6 px-4 text-[13px] font-medium text-muted">{children}</p>;
}

/** Small grey text under a group. */
export function GroupNote({ children }: { children: ReactNode }) {
  return <p className="mt-1.5 px-4 text-[13px] leading-snug text-muted">{children}</p>;
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
    <div className="flex min-h-[50dvh] items-center justify-center text-faint">
      <Spinner />
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* People                                                               */
/* ------------------------------------------------------------------ */
export function Avatar({
  profile,
  size = 36,
  ring,
  badge,
}: {
  profile?: Pick<Profile, "display_name" | "color"> | null;
  size?: number;
  ring?: string;
  badge?: "kept" | "broke" | "off" | "pending" | null;
}) {
  const name = profile?.display_name ?? "?";
  const initials = name
    .split(/\s+/)
    .map((w) => w[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
  const face = (
    <span
      className={cx("inline-flex shrink-0 items-center justify-center rounded-full font-semibold text-white", ring)}
      style={{ width: size, height: size, background: profile?.color ?? "#999", fontSize: size * 0.4 }}
      title={name}
    >
      {initials}
    </span>
  );
  if (!badge) return face;
  const b = Math.max(14, Math.round(size * 0.42));
  const map = {
    kept: "bg-kept text-kept-ink",
    broke: "bg-broke text-white",
    off: "bg-off text-white",
    pending: "bg-surface-2 text-faint",
  };
  return (
    <span className="relative inline-flex shrink-0">
      {face}
      <span
        className={cx("absolute -bottom-0.5 -right-0.5 inline-flex items-center justify-center rounded-full ring-2 ring-surface", map[badge])}
        style={{ width: b, height: b }}
        aria-label={badge === "pending" ? "not checked in yet" : badge === "off" ? "off-day" : badge === "kept" ? "kept it" : "broke it"}
      >
        {badge === "kept" ? <IconCheck size={b - 4} strokeWidth={3} /> : badge === "broke" ? <IconX size={b - 5} strokeWidth={3} /> : badge === "off" ? <span className="h-[2px] w-1/2 rounded bg-current" /> : <span className="h-1 w-1 rounded-full bg-current" />}
      </span>
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
    <span className={cx("inline-flex items-center rounded-full font-semibold", small ? "px-2 py-0.5 text-[12px]" : "px-2.5 py-1 text-[13px]", cls)}>
      {label}
    </span>
  );
}

/* ------------------------------------------------------------------ */
/* Forms                                                                */
/* ------------------------------------------------------------------ */
export function Field({ label, hint, children }: { label: string; hint?: ReactNode; children: ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1.5 block px-1 text-[13px] font-medium text-muted">{label}</span>
      {children}
      {hint ? <span className="mt-1.5 block px-1 text-[13px] leading-snug text-muted">{hint}</span> : null}
    </label>
  );
}

export const inputCls =
  "w-full rounded-xl border border-transparent bg-surface-2 px-4 py-3 text-[16px] text-ink placeholder:text-faint outline-none transition focus:border-pink/40 focus:bg-surface focus:ring-4 focus:ring-pink/10";

/** Input that sits inside a list row: no background, right-aligned by default. */
export const rowInputCls = "min-w-0 flex-1 bg-transparent text-right text-[16px] text-ink placeholder:text-faint outline-none";

export function Segmented<T extends string>({
  value,
  onChange,
  options,
  className,
}: {
  value: T;
  onChange: (v: T) => void;
  options: { value: T; label: ReactNode }[];
  className?: string;
}) {
  return (
    <div className={cx("flex rounded-[10px] bg-surface-2 p-0.5", className)} role="tablist">
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          role="tab"
          aria-selected={value === o.value}
          onClick={() => onChange(o.value)}
          className={cx(
            "h-8 flex-1 rounded-lg px-3 text-[13px] font-semibold transition",
            value === o.value ? "bg-surface text-ink shadow-[0_1px_3px_rgb(0_0_0/0.12)]" : "text-muted hover:text-ink",
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

export function Stepper({ value, onChange, min, max, label }: { value: number; onChange: (n: number) => void; min: number; max: number; label?: string }) {
  return (
    <div className="inline-flex items-center gap-3">
      <span className="w-5 text-right text-[17px] font-semibold tabular" aria-live="polite">
        {value}
      </span>
      <div className="inline-flex h-8 items-center rounded-lg bg-surface-2">
        <button type="button" className="h-8 w-11 text-xl leading-none text-ink disabled:text-faint" disabled={value <= min} onClick={() => onChange(value - 1)} aria-label={label ? `Fewer ${label}` : "Less"}>
          −
        </button>
        <span className="h-4 w-px bg-line" />
        <button type="button" className="h-8 w-11 text-xl leading-none text-ink disabled:text-faint" disabled={value >= max} onClick={() => onChange(value + 1)} aria-label={label ? `More ${label}` : "More"}>
          +
        </button>
      </div>
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
      className={cx("relative h-[31px] w-[51px] shrink-0 rounded-full transition-colors", checked ? "bg-kept" : "bg-surface-2 ring-1 ring-inset ring-line")}
    >
      <span className={cx("absolute top-[2px] h-[27px] w-[27px] rounded-full bg-white shadow-[0_2px_4px_rgb(0_0_0/0.2)] transition-all", checked ? "left-[22px]" : "left-[2px]")} />
    </button>
  );
}

/* ------------------------------------------------------------------ */
/* Bottom sheet                                                         */
/* ------------------------------------------------------------------ */
export function Sheet({ open, onClose, title, children }: { open: boolean; onClose: () => void; title?: ReactNode; children: ReactNode }) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [open, onClose]);
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center" role="dialog" aria-modal="true">
      <button className="animate-fade absolute inset-0 bg-black/40" aria-label="Close" onClick={onClose} />
      <div className="animate-sheet pb-safe relative max-h-[88dvh] w-full max-w-lg overflow-y-auto rounded-t-[28px] bg-bg px-4 pt-2 shadow-pop">
        <div className="mx-auto mb-2 h-1.5 w-10 rounded-full bg-line" />
        {title ? (
          <div className="mb-3 flex items-center justify-between gap-3 px-1">
            <h2 className="text-[20px] font-bold tracking-[-0.015em]">{title}</h2>
            <IconButton label="Close" onClick={onClose}>
              <IconX size={16} />
            </IconButton>
          </div>
        ) : null}
        <div className="pb-4">{children}</div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Toasts                                                               */
/* ------------------------------------------------------------------ */
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
      <div className="pointer-events-none fixed inset-x-0 top-[max(12px,env(safe-area-inset-top))] z-[60] flex flex-col items-center gap-2 px-4" aria-live="polite">
        {toasts.map((t) => (
          <div
            key={t.id}
            className={cx(
              "animate-pop pointer-events-auto max-w-sm rounded-full px-4 py-2.5 text-[14px] font-medium shadow-pop",
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
