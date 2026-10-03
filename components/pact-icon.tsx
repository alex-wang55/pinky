import type { ReactNode } from "react";
import { cx } from "./ui";

/*
 * Pact icons. The database still stores an emoji in pacts.emoji (so old pacts
 * keep working), but the app draws one of these instead of showing the emoji.
 * Same grid and stroke as components/icons.tsx.
 */

type Def = { key: string; label: string; tint: string; draw: ReactNode };

export const PACT_ICONS: Def[] = [
  {
    key: "🥗",
    label: "Eat clean",
    tint: "kept",
    draw: (
      <>
        <path d="M3.5 12.5h17a8.5 7 0 0 1-17 0Z" />
        <path d="M8.5 12.5c-.8-3 .8-5.8 3.8-6.6.4 2.9-1 5.4-3.8 6.6" />
        <path d="M13 12.5c.4-2.6 2.3-4.3 5-4.5-.2 2.3-1.8 3.9-4.2 4.5" />
      </>
    ),
  },
  {
    key: "🍔",
    label: "No junk food",
    tint: "off",
    draw: (
      <>
        <path d="M4.5 10.5c0-3.3 3.4-5.5 7.5-5.5s7.5 2.2 7.5 5.5Z" />
        <path d="M3.5 13.5c1.4 0 1.4 1 2.8 1s1.4-1 2.9-1 1.4 1 2.8 1 1.4-1 2.8-1 1.5 1 2.9 1 1.4-1 2.8-1" />
        <path d="M5 17h14a2.5 2.5 0 0 1-2.5 2.5h-9A2.5 2.5 0 0 1 5 17Z" />
        <path d="M9 8h.01M12.5 7.3h.01M15 8.5h.01" strokeWidth={2.4} />
      </>
    ),
  },
  {
    key: "🏋️",
    label: "Gym",
    tint: "blue",
    draw: (
      <>
        <path d="M7 7.5v9M17 7.5v9M4.5 9.5v5M19.5 9.5v5M7 12h10" />
      </>
    ),
  },
  {
    key: "🏃",
    label: "Run",
    tint: "pink",
    draw: (
      <>
        <path d="M3.5 17.5v-6.3l3.3-.7 2.3 2.6 4.4 1.2 5.3 1.1a2.4 2.4 0 0 1 1.9 2.4v.7Z" />
        <path d="M3.5 17.5v1.5h17.2v-1.5" />
        <path d="M9.8 13.5l1.4-1.6M12.2 14.2l1.4-1.6" />
      </>
    ),
  },
  {
    key: "💧",
    label: "Drink water",
    tint: "blue",
    draw: (
      <>
        <path d="M12 3.5c3.6 4.2 6.2 7.6 6.2 10.8a6.2 6.2 0 0 1-12.4 0c0-3.2 2.6-6.6 6.2-10.8Z" />
        <path d="M9.3 14.6a2.8 2.8 0 0 0 2.3 2.6" />
      </>
    ),
  },
  {
    key: "📚",
    label: "Read",
    tint: "off",
    draw: (
      <>
        <path d="M4.5 5h3.8v14H4.5zM8.3 6.5h3.8V19H8.3z" />
        <path d="M13.4 7.4l3.6-1 3.4 12.3-3.6 1z" />
        <path d="M4.5 8h3.8M8.3 9.5h3.8" />
      </>
    ),
  },
  {
    key: "😴",
    label: "Sleep",
    tint: "violet",
    draw: (
      <>
        <path d="M17.5 15A7 7 0 0 1 9 6.5a7 7 0 1 0 8.5 8.5Z" />
        <path d="M14.5 4h3.5l-3.5 4h3.5" />
      </>
    ),
  },
  {
    key: "🧘",
    label: "Meditate",
    tint: "kept",
    draw: (
      <>
        <path d="M12 18c-1.6-2.6-1.6-6.4 0-9.8 1.6 3.4 1.6 7.2 0 9.8Z" />
        <path d="M12 18c-3-.9-5.2-3.5-5.5-7 2.8.3 4.8 2.8 5.5 7Z" />
        <path d="M12 18c3-.9 5.2-3.5 5.5-7-2.8.3-4.8 2.8-5.5 7Z" />
        <path d="M4.5 19.5c2.5.6 5 .6 7.5-.5 2.5 1.1 5 1.1 7.5.5" />
      </>
    ),
  },
  {
    key: "🚭",
    label: "No smoking",
    tint: "broke",
    draw: (
      <>
        <path d="M3.5 13.5h12v3h-12z" />
        <path d="M18 13.5v3M20.5 13.5v3" />
        <path d="M17.2 10.5c0-1.6 1.6-1.6 1.6-3.2s-1.6-1.6-1.6-3.1" />
        <path d="M4 4.5l16 15" />
      </>
    ),
  },
  {
    key: "📵",
    label: "Less phone",
    tint: "broke",
    draw: (
      <>
        <rect x="7" y="3.5" width="10" height="17" rx="2" />
        <path d="M11 17.5h2" />
        <path d="M4 5l16 14" />
      </>
    ),
  },
  {
    key: "🍺",
    label: "No drinking",
    tint: "off",
    draw: (
      <>
        <path d="M5.5 8.5h9.5v10a1.5 1.5 0 0 1-1.5 1.5H7a1.5 1.5 0 0 1-1.5-1.5Z" />
        <path d="M15 10.5h2a2 2 0 0 1 2 2v2a2 2 0 0 1-2 2h-2" />
        <path d="M5 8.5a2.6 2.6 0 0 1 3-3.2 3 3 0 0 1 5.4.2 2.4 2.4 0 0 1 2.2 3" />
        <path d="M8.5 12v5M12 12v5" />
      </>
    ),
  },
  {
    key: "✍️",
    label: "Write",
    tint: "violet",
    draw: (
      <>
        <path d="M14 5.5l4.5 4.5L9.5 19H5v-4.5Z" />
        <path d="M12 7.5l4.5 4.5" />
        <path d="M13.5 19.5h6" />
      </>
    ),
  },
  {
    key: "💸",
    label: "Save money",
    tint: "kept",
    draw: (
      <>
        <rect x="3" y="6.5" width="18" height="11" rx="2" />
        <circle cx="12" cy="12" r="2.6" />
        <path d="M6.5 9.5v.01M17.5 14.5v.01" strokeWidth={2.4} />
      </>
    ),
  },
  {
    key: "🤙",
    label: "Anything",
    tint: "pink",
    draw: (
      <>
        <path d="M5.5 16V10.2a3.7 3.7 0 0 1 7.4 0V12" />
        <path d="M18.5 8v5.8a3.7 3.7 0 0 1-7.4 0V12" />
      </>
    ),
  },
];

const BY_KEY = Object.fromEntries(PACT_ICONS.map((d) => [d.key, d]));
// Old pacts might have the emoji without the variation selector, e.g. "🏋" vs "🏋️".
const norm = (s: string) => s.replace(/️/g, "");
const BY_NORM = Object.fromEntries(PACT_ICONS.map((d) => [norm(d.key), d]));

export function pactIconDef(emoji: string | null | undefined): Def {
  return (emoji && (BY_KEY[emoji] ?? BY_NORM[norm(emoji)])) || BY_KEY["🤙"];
}

const TINTS: Record<string, string> = {
  pink: "bg-pink-soft text-pink",
  kept: "bg-kept-soft text-kept",
  off: "bg-off-soft text-off",
  broke: "bg-broke-soft text-broke",
  blue: "bg-[var(--blue-soft)] text-[var(--blue)]",
  violet: "bg-[var(--violet-soft)] text-[var(--violet)]",
};

const TEXT: Record<string, string> = {
  pink: "text-pink",
  kept: "text-kept",
  off: "text-off",
  broke: "text-broke",
  blue: "text-[var(--blue)]",
  violet: "text-[var(--violet)]",
};

/** Text color class matching a pact's icon, for inline glyphs. */
export const pactTint = (emoji: string | null | undefined) => TEXT[pactIconDef(emoji).tint];

/** Just the drawing, in currentColor. */
export function PactGlyph({ emoji, size = 20, className }: { emoji: string | null | undefined; size?: number; className?: string }) {
  const d = pactIconDef(emoji);
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className={className}
    >
      {d.draw}
    </svg>
  );
}

/** The icon on a tinted rounded tile. */
export function PactIcon({ emoji, size = 40, className }: { emoji: string | null | undefined; size?: number; className?: string }) {
  const d = pactIconDef(emoji);
  return (
    <span
      className={cx("inline-flex shrink-0 items-center justify-center", TINTS[d.tint], className)}
      style={{ width: size, height: size, borderRadius: Math.round(size * 0.3) }}
      role="img"
      aria-label={d.label}
    >
      <PactGlyph emoji={emoji} size={Math.round(size * 0.58)} />
    </span>
  );
}
