"use client";

import { Fragment, type ReactNode } from "react";
import { Avatar, cx } from "./ui";
import type { Profile } from "@/lib/types";
import type { MemberStats } from "@/lib/stats";
import { firstName, joinAnd, type Quote } from "@/lib/wrap-story";

/*
 * Pieces for the weekly wrap and the recap. The idea is a fridge, not a
 * dashboard: hand-marked charts, sticky notes, a receipt for the pot.
 */

/* Small seeded random so every mark wobbles a little, but the same way every render. */
function rng(key: string) {
  let h = 2166136261;
  for (let i = 0; i < key.length; i++) {
    h ^= key.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return () => {
    h ^= h << 13;
    h ^= h >>> 17;
    h ^= h << 5;
    return ((h >>> 0) % 10000) / 10000;
  };
}

export type MarkKind = "kept" | "broke" | "ghost" | "off" | "open" | "blank";

export const MARK_LABEL: Record<MarkKind, string> = {
  kept: "kept it",
  broke: "broke it",
  ghost: "no check-in",
  off: "off-day",
  open: "not in yet",
  blank: "",
};

/** A pen mark: check, cross, dashed circle, squiggle or a faint dot. */
export function Mark({ kind, seed, size = 22, half }: { kind: MarkKind; seed: string; size?: number; half?: boolean }) {
  if (kind === "blank") return <span className="inline-block" style={{ width: size, height: size }} />;
  const r = rng(seed + kind);
  const j = (n: number) => +((r() - 0.5) * n).toFixed(2);
  const rot = j(18);
  let body: ReactNode;
  if (kind === "kept") {
    body = (
      <path
        stroke="var(--kept)"
        d={`M${4.8 + j(1.4)} ${12.6 + j(1.6)}C${6.8 + j(1)} ${14 + j(1)} ${8.4 + j(1)} ${15.9 + j(0.8)} ${9.8 + j(0.8)} ${18 + j(0.8)}C${12 + j(1.5)} ${13 + j(1.5)} ${15.4 + j(1.5)} ${8.6 + j(1.5)} ${19.6 + j(1.2)} ${5.6 + j(1.6)}`}
      />
    );
  } else if (kind === "broke") {
    body = (
      <g stroke="var(--broke)">
        <path d={`M${6.2 + j(1.2)} ${6.4 + j(1.2)}Q${12 + j(2.4)} ${11.6 + j(2.4)} ${17.8 + j(1.2)} ${17.6 + j(1.2)}`} />
        <path d={`M${17.6 + j(1.2)} ${6 + j(1.2)}Q${12.4 + j(2.4)} ${12.4 + j(2.4)} ${6.4 + j(1.2)} ${18 + j(1.2)}`} />
      </g>
    );
  } else if (kind === "ghost") {
    body = <circle cx="12" cy="12" r={7 + j(0.8)} stroke="var(--broke)" strokeDasharray="2.4 3.4" strokeWidth={2} />;
  } else if (kind === "off") {
    body = (
      <path
        stroke="var(--off)"
        d={`M${5.2 + j(1)} ${12.6 + j(1.4)}C${8.2 + j(1)} ${9.8 + j(1.4)} ${10.6 + j(1)} ${14.6 + j(1.4)} ${13.6 + j(1)} ${12 + j(1)}S${17.4 + j(1)} ${10.8 + j(1)} ${18.8 + j(1)} ${11.8 + j(1)}`}
      />
    );
  } else {
    body = <circle cx="12" cy="12" r="1.7" fill="var(--muted)" stroke="none" opacity={0.45} />;
  }
  return (
    <span className="relative inline-flex" style={{ width: size, height: size }}>
      <svg
        width={size}
        height={size}
        viewBox="0 0 24 24"
        fill="none"
        strokeWidth={2.7}
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
        style={{ transform: `rotate(${rot}deg)` }}
      >
        {body}
      </svg>
      {half ? <span className="absolute -right-2 -top-1.5 text-[10px] font-bold text-muted">½</span> : null}
    </span>
  );
}

/** What to draw for one member on one day of a daily/count pact. */
export function dayMark(s: MemberStats | undefined, day: string): { kind: MarkKind; half: boolean } {
  const st = s?.days[day];
  if (!s || !st) return { kind: "blank", half: false };
  if (st === "kept") return { kind: "kept", half: false };
  if (st === "off") return { kind: "off", half: false };
  if (st === "pending") return { kind: "open", half: false };
  const m = s.misses.find((x) => x.day === day);
  return { kind: m?.kind === "auto" ? "ghost" : "broke", half: !!m?.comeback };
}

export function Heading({ children, aside }: { children: ReactNode; aside?: ReactNode }) {
  return (
    <div className="mb-3 mt-9 flex items-baseline justify-between gap-3 px-1">
      <h2 className="font-display text-xl font-bold">{children}</h2>
      {aside ? <span className="text-xs text-muted">{aside}</span> : null}
    </div>
  );
}

/** Only explains the marks that are actually on the chart. */
export function Legend({ kinds, extra, labels }: { kinds: MarkKind[]; extra?: ReactNode; labels?: Partial<Record<MarkKind, string>> }) {
  const order: MarkKind[] = ["kept", "broke", "ghost", "off"];
  const shown = order.filter((k) => kinds.includes(k));
  if (!shown.length && !extra) return null;
  return (
    <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 px-1 text-xs text-muted">
      {shown.map((k) => (
        <span key={k} className="flex items-center gap-1">
          <Mark kind={k} seed={"legend" + k} size={16} />
          {labels?.[k] ?? MARK_LABEL[k]}
        </span>
      ))}
      {extra}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* One week, one row per person                                         */
/* ------------------------------------------------------------------ */
export type ChartRow = {
  id: string;
  profile: Profile;
  cells: { key: string; kind: MarkKind; half?: boolean; label: string }[];
  tally: string;
  done?: boolean;
};

export function WeekChart({ heads, rows }: { heads: { key: string; label: string; faint?: boolean }[]; rows: ChartRow[] }) {
  return (
    <div className="rounded-3xl border border-line bg-surface px-3 pb-1 pt-3 shadow-card">
      <div className="grid items-center" style={{ gridTemplateColumns: `minmax(0,1fr) repeat(${heads.length}, 28px) 38px` }}>
        <span />
        {heads.map((h) => (
          <span key={h.key} className={cx("pb-1 text-center text-xs font-semibold text-muted", h.faint && "opacity-35")}>
            {h.label}
          </span>
        ))}
        <span />
        {rows.map((r) => (
          <Fragment key={r.id}>
            <span className="flex min-w-0 items-center gap-1.5 border-t border-dashed border-line py-3">
              <Avatar profile={r.profile} size={22} />
              <span className="truncate text-sm font-semibold">{firstName(r.profile)}</span>
            </span>
            {r.cells.map((c) => (
              <span
                key={c.key}
                role={c.kind === "blank" ? undefined : "img"}
                aria-label={c.kind === "blank" ? undefined : `${firstName(r.profile)}, ${c.label}: ${MARK_LABEL[c.kind]}`}
                className="flex justify-center border-t border-dashed border-line py-3"
              >
                <Mark kind={c.kind} half={c.half} seed={r.id + c.key} />
              </span>
            ))}
            <span className={cx("border-t border-dashed border-line py-3 text-right text-sm font-semibold tabular", r.done ? "text-kept" : "text-muted")}>
              {r.tally}
            </span>
          </Fragment>
        ))}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* The whole pact as a wall calendar                                    */
/* ------------------------------------------------------------------ */
export type CalCell = {
  day: string;
  num: string;
  kind: "kept" | "broke" | "open" | "future" | "out" | "none";
  who: { initial: string; color: string; name: string }[];
};

export function Calendar({ weeks }: { weeks: CalCell[][] }) {
  return (
    <div className="overflow-hidden rounded-3xl border border-line bg-line shadow-card">
      <div className="grid grid-cols-7 gap-px">
        {["M", "T", "W", "T", "F", "S", "S"].map((d, i) => (
          <span key={i} className="bg-surface py-1.5 text-center text-xs font-semibold text-muted">
            {d}
          </span>
        ))}
        {weeks.flat().map((c) => {
          const label =
            c.kind === "kept"
              ? "everyone kept it"
              : c.kind === "broke"
                ? `${joinAnd(c.who.map((w) => w.name))} slipped`
                : c.kind === "open"
                  ? "today, not in yet"
                  : "";
          return (
            <span
              key={c.day}
              role={label ? "img" : undefined}
              aria-label={label ? `${c.num}: ${label}` : undefined}
              className={cx("relative flex h-11 items-center justify-center", c.kind === "out" ? "bg-surface-2/60" : "bg-surface")}
            >
              {c.kind !== "out" ? (
                <span className={cx("absolute left-1 top-0.5 text-[9px] leading-none tabular text-muted", c.kind === "future" && "opacity-50")}>{c.num}</span>
              ) : null}
              {c.kind === "kept" ? <Mark kind="kept" seed={c.day} size={20} /> : null}
              {c.kind === "open" ? <Mark kind="open" seed={c.day} size={20} /> : null}
              {c.kind === "broke" ? <Initials who={c.who} seed={c.day} /> : null}
            </span>
          );
        })}
      </div>
    </div>
  );
}

function Initials({ who, seed }: { who: CalCell["who"]; seed: string }) {
  const r = rng(seed);
  const shown = who.slice(0, 2);
  return (
    <span className="mt-1 flex items-baseline gap-px font-display text-[15px] font-bold leading-none" style={{ transform: `rotate(${((r() - 0.5) * 14).toFixed(1)}deg)` }}>
      {shown.map((w) => (
        <span key={w.name} style={{ color: w.color }}>
          {w.initial}
        </span>
      ))}
      {who.length > 2 ? <span className="text-[11px] text-muted">+</span> : null}
    </span>
  );
}

/* ------------------------------------------------------------------ */
/* Weekly-goal pacts: weeks down, people across                         */
/* ------------------------------------------------------------------ */
export function WeeksGrid({
  people,
  rows,
}: {
  people: { id: string; profile: Profile }[];
  rows: { key: string; label: string; cells: { id: string; kind: MarkKind; label: string }[] }[];
}) {
  return (
    <div className="rounded-3xl border border-line bg-surface px-3 pb-1 pt-3 shadow-card">
      <div className="grid items-center" style={{ gridTemplateColumns: `minmax(0,1fr) repeat(${people.length}, 44px)` }}>
        <span />
        {people.map((p) => (
          <span key={p.id} className="flex justify-center pb-2">
            <Avatar profile={p.profile} size={26} />
          </span>
        ))}
        {rows.map((r) => (
          <Fragment key={r.key}>
            <span className="border-t border-dashed border-line py-2.5 text-sm text-muted">{r.label}</span>
            {r.cells.map((c) => (
              <span
                key={c.id}
                role={c.kind === "blank" ? undefined : "img"}
                aria-label={c.kind === "blank" ? undefined : `${r.label}, ${c.label}: ${MARK_LABEL[c.kind]}`}
                className="flex justify-center border-t border-dashed border-line py-2.5"
              >
                <Mark kind={c.kind} seed={c.id + r.key} />
              </span>
            ))}
          </Fragment>
        ))}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Confessions as sticky notes                                          */
/* ------------------------------------------------------------------ */
const TILT = [-1.8, 1.2, -0.7, 1.6, -1.2, 0.8];

export function Notes({ items, when }: { items: Quote[]; when: (day: string) => string }) {
  return (
    <div className="flex flex-col gap-4 px-1">
      {items.map((q, i) => (
        <figure
          key={q.id}
          className={cx("relative max-w-[86%] rounded-[4px] bg-note px-4 pb-3 pt-5 shadow-card", i % 2 ? "self-end" : "self-start")}
          style={{ transform: `rotate(${TILT[i % TILT.length]}deg)` }}
        >
          <span aria-hidden="true" className="absolute -top-2 left-1/2 h-4 w-14 -translate-x-1/2 -rotate-3 rounded-[2px]" style={{ background: "var(--tape)" }} />
          <blockquote className="line-clamp-6 whitespace-pre-wrap break-words text-[16px] leading-snug">&ldquo;{q.text}&rdquo;</blockquote>
          <figcaption className="mt-2.5 flex items-center gap-1.5 text-xs text-muted">
            <Avatar profile={q.who} size={18} />
            <span>
              {firstName(q.who)}, {when(q.day)}
            </span>
            {q.reacts.length ? (
              <span className="ml-auto flex gap-2 pl-3">
                {q.reacts.map((r) => (
                  <span key={r.e}>
                    {r.e} {r.n}
                  </span>
                ))}
              </span>
            ) : null}
          </figcaption>
        </figure>
      ))}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* The pot, as a receipt                                                */
/* ------------------------------------------------------------------ */
export type ReceiptLine = { left: string; mid?: string; cents: number; minus?: boolean; sub?: boolean };

const dollars = (c: number) => `$${(c / 100).toFixed(2)}`;

export function Receipt({
  head,
  lines,
  totalLabel,
  total,
  empty,
  foot,
  seed,
}: {
  head: string[];
  lines: ReceiptLine[];
  totalLabel: string;
  total: number;
  empty: string;
  foot: string[];
  seed: string;
}) {
  return (
    <div className="mx-auto max-w-[340px] -rotate-[0.6deg]" style={{ filter: "drop-shadow(0 1px 1px rgb(40 20 30 / 0.12)) drop-shadow(0 8px 14px rgb(40 20 30 / 0.12))" }}>
      <div className="receipt bg-paper px-5 py-8 font-mono text-[13px] leading-relaxed text-paper-ink">
        <div className="text-center">
          <div className="font-bold tracking-[0.2em]">PINKY POT</div>
          {head.map((h) => (
            <div key={h} className="text-paper-muted">
              {h}
            </div>
          ))}
        </div>
        <Rule />
        {lines.length === 0 ? (
          <div className="py-1 text-center text-paper-muted">{empty}</div>
        ) : (
          lines.map((l, i) => (
            <div key={i} className={cx("flex gap-2", l.sub && "pl-4 text-paper-muted")}>
              <span className="shrink-0">{l.left}</span>
              <span className="min-w-0 flex-1 truncate">{l.mid}</span>
              <span className="shrink-0 tabular">
                {l.minus ? "-" : ""}
                {dollars(l.cents)}
              </span>
            </div>
          ))
        )}
        <Rule />
        <div className="flex justify-between font-bold">
          <span>{totalLabel}</span>
          <span className="tabular">{dollars(total)}</span>
        </div>
        {foot.length ? (
          <div className="mt-4 text-center text-paper-muted">
            {foot.map((f) => (
              <div key={f}>{f}</div>
            ))}
          </div>
        ) : null}
        <Barcode seed={seed} />
      </div>
    </div>
  );
}

function Rule() {
  return (
    <div aria-hidden="true" className="my-2 overflow-hidden whitespace-nowrap text-paper-muted">
      {"- ".repeat(40)}
    </div>
  );
}

function Barcode({ seed }: { seed: string }) {
  const r = rng(seed);
  const bars: { x: number; w: number }[] = [];
  for (let x = 0; x < 176; ) {
    const w = 1 + Math.floor(r() * 3);
    if (r() > 0.3) bars.push({ x, w });
    x += w + 1 + Math.floor(r() * 2);
  }
  return (
    <svg aria-hidden="true" className="mx-auto mt-4 block" width="176" height="26" viewBox="0 0 176 26">
      {bars.map((b) => (
        <rect key={b.x} x={b.x} y="0" width={b.w} height="26" fill="var(--paper-ink)" />
      ))}
    </svg>
  );
}

/* ------------------------------------------------------------------ */
/* Yearbook superlatives                                                */
/* ------------------------------------------------------------------ */
export type Superlative = { title: string; who: Profile[]; why: string };

export function Superlatives({ items }: { items: Superlative[] }) {
  return (
    <div className="space-y-4 px-1">
      {items.map((a) => (
        <div key={a.title}>
          <div className="flex items-end gap-2">
            <span className="font-semibold">{a.title}</span>
            <span aria-hidden="true" className="mb-1.5 min-w-4 flex-1 border-b-2 border-dotted border-line" />
            <span className="flex items-center gap-1.5">
              <span className="flex -space-x-1.5">
                {a.who.map((p) => (
                  <Avatar key={p.id} profile={p} size={20} ring="ring-2 ring-bg" />
                ))}
              </span>
              <span className="font-display font-bold">{joinAnd(a.who.map((p) => firstName(p)))}</span>
            </span>
          </div>
          <div className="mt-0.5 text-right text-sm text-muted">{a.why}</div>
        </div>
      ))}
    </div>
  );
}

/** Everyone tied for the top score, or null if nobody scored or it's a full tie in a group. */
export function leaders<T>(arr: T[], score: (x: T) => number, min = 1, allowFullTie = true): T[] | null {
  if (!arr.length) return null;
  const best = Math.max(...arr.map(score));
  if (!(best >= min)) return null;
  const top = arr.filter((x) => score(x) === best);
  if (!allowFullTie && arr.length > 1 && top.length === arr.length) return null;
  return top;
}
