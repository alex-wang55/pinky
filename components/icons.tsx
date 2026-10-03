import type { SVGProps } from "react";

/**
 * Pinky's icon set. 24px grid, 1.8 stroke, round joins.
 * Drawn for this app so the UI doesn't lean on emoji.
 */
type P = SVGProps<SVGSVGElement> & { size?: number };

function Base({ size = 18, children, ...rest }: P & { children: React.ReactNode }) {
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
      {...rest}
    >
      {children}
    </svg>
  );
}

/** Two hooked lines, same idea as the logo. */
export function IconPact(p: P) {
  return (
    <Base {...p}>
      <path d="M5.5 16V10.2a3.7 3.7 0 0 1 7.4 0V12" />
      <path d="M18.5 8v5.8a3.7 3.7 0 0 1-7.4 0V12" />
    </Base>
  );
}

export function IconMoon(p: P) {
  return (
    <Base {...p}>
      <path d="M19.5 14.6A7.6 7.6 0 0 1 9.4 4.5a7.6 7.6 0 1 0 10.1 10.1Z" />
    </Base>
  );
}

export function IconFlame(p: P) {
  return (
    <Base {...p}>
      <path d="M12 21c-3.6 0-6-2.4-6-5.6 0-2.6 1.6-4.3 2.9-5.6.2 1.5.9 2.5 1.9 2.9-.3-3.6.9-6.5 3.2-8.7.4 2.8 1.7 4.3 2.9 5.7 1 1.2 1.8 2.6 1.8 4.6 0 3.3-2.6 6.7-6.7 6.7Z" />
      <path d="M12 21c-1.5 0-2.6-1.1-2.6-2.6 0-1.4 1-2.2 1.8-3 .5 1 1.2 1.4 1.9 1.6.4-.9.6-1.8.5-2.8 1 .9 1.7 2 1.7 3.4 0 1.9-1.4 3.4-3.3 3.4Z" />
    </Base>
  );
}

/** A jar with a coin slot: the pot. */
export function IconJar(p: P) {
  return (
    <Base {...p}>
      <path d="M8 3.5h8" />
      <path d="M9 3.5v2.3C7 7 5.8 8.9 5.8 11.6V17a3.5 3.5 0 0 0 3.5 3.5h5.4a3.5 3.5 0 0 0 3.5-3.5v-5.4c0-2.7-1.2-4.6-3.2-5.8V3.5" />
      <path d="M10 12.5h4" />
    </Base>
  );
}

export function IconEye(p: P) {
  return (
    <Base {...p}>
      <path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12Z" />
      <circle cx="12" cy="12" r="2.8" />
    </Base>
  );
}

export function IconCamera(p: P) {
  return (
    <Base {...p}>
      <path d="M4 8.5A1.5 1.5 0 0 1 5.5 7h2l1.4-2h6.2l1.4 2h2A1.5 1.5 0 0 1 20 8.5v9a1.5 1.5 0 0 1-1.5 1.5h-13A1.5 1.5 0 0 1 4 17.5v-9Z" />
      <circle cx="12" cy="12.8" r="3.4" />
    </Base>
  );
}

export function IconPencil(p: P) {
  return (
    <Base {...p}>
      <path d="M4.5 19.5h3.8L19 8.8a2 2 0 0 0 0-2.8l-1-1a2 2 0 0 0-2.8 0L4.5 15.7v3.8Z" />
      <path d="M13.8 6.4l3.8 3.8" />
    </Base>
  );
}

export function IconBell(p: P) {
  return (
    <Base {...p}>
      <path d="M6.3 16.5v-5a5.7 5.7 0 0 1 11.4 0v5l1.6 2H4.7l1.6-2Z" />
      <path d="M10 21a2.2 2.2 0 0 0 4 0" />
    </Base>
  );
}

/** Tap on the shoulder: a bell with a little motion mark. */
export function IconNudge(p: P) {
  return (
    <Base {...p}>
      <path d="M7.3 16.5v-4.6a4.7 4.7 0 0 1 9.4 0v4.6l1.3 1.8H6l1.3-1.8Z" />
      <path d="M10.4 20.8a1.8 1.8 0 0 0 3.2 0" />
      <path d="M3.5 9.5c.3-1.6 1-3 2.1-4.1M20.5 9.5c-.3-1.6-1-3-2.1-4.1" />
    </Base>
  );
}

export function IconSmilePlus(p: P) {
  return (
    <Base {...p}>
      <path d="M20.4 11.2A8.5 8.5 0 1 1 12.8 3.5" />
      <path d="M8.8 14.3c.8 1 1.9 1.6 3.2 1.6s2.4-.6 3.2-1.6" />
      <path d="M9 9.8h.01M14.5 9.8h.01" strokeWidth={2.6} />
      <path d="M19 2.8v5M16.5 5.3h5" />
    </Base>
  );
}

/** Dashed circle: a day nobody filled in. */
export function IconEmpty(p: P) {
  return (
    <Base {...p}>
      <circle cx="12" cy="12" r="8" strokeDasharray="3 3.3" />
    </Base>
  );
}

export function IconClock(p: P) {
  return (
    <Base {...p}>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M12 7.5V12l3 2" />
    </Base>
  );
}

export function IconFlag(p: P) {
  return (
    <Base {...p}>
      <path d="M5.5 21V4.5" />
      <path d="M5.5 4.5c3-1.6 5.4 1.4 8.4 0 1.6-.8 3-.8 4.6 0v8.6c-1.6-.8-3-.8-4.6 0-3 1.4-5.4-1.6-8.4 0" />
    </Base>
  );
}

export function IconTrophy(p: P) {
  return (
    <Base {...p}>
      <path d="M8 4h8v5a4 4 0 0 1-8 0V4Z" />
      <path d="M8 5.5H5.5a2.5 2.5 0 0 0 2.6 3.5M16 5.5h2.5a2.5 2.5 0 0 1-2.6 3.5" />
      <path d="M12 13v3.5M8.5 20h7M9.5 20l.6-3.5h3.8l.6 3.5" />
    </Base>
  );
}

export function IconSearch(p: P) {
  return (
    <Base {...p}>
      <circle cx="10.5" cy="10.5" r="6" />
      <path d="M15 15l5 5" />
    </Base>
  );
}

export function IconGhost(p: P) {
  return (
    <Base {...p}>
      <path d="M5.5 20.5V11a6.5 6.5 0 0 1 13 0v9.5l-2.2-1.6-2.1 1.6-2.2-1.6-2.2 1.6-2.1-1.6-2.2 1.6Z" />
      <path d="M9.8 10.5h.01M14.2 10.5h.01" strokeWidth={2.6} />
    </Base>
  );
}

export function IconArrowRight(p: P) {
  return (
    <Base {...p}>
      <path d="M5 12h14M13.5 6.5 19 12l-5.5 5.5" />
    </Base>
  );
}

export function IconCheck(p: P) {
  return (
    <Base {...p}>
      <path d="M5 12.5l4.5 4.5L19 7.5" />
    </Base>
  );
}

export function IconX(p: P) {
  return (
    <Base {...p}>
      <path d="M6.5 6.5l11 11M17.5 6.5l-11 11" />
    </Base>
  );
}

export function IconChart(p: P) {
  return (
    <Base {...p}>
      <path d="M4.5 19.5h15" />
      <path d="M7.5 16v-4M12 16V7.5M16.5 16v-6" />
    </Base>
  );
}

/** Arrow that dips and comes back up: comeback day. */
export function IconRebound(p: P) {
  return (
    <Base {...p}>
      <path d="M3.5 7.5c2.5 0 3.6 1.6 4.6 4.2 1.1 2.9 2.4 5.3 5.4 5.3 3.6 0 5.6-3.6 6.5-8.5" />
      <path d="M16.6 9.6l3.4-1.6 1.2 3.6" />
    </Base>
  );
}

/** A little burst: hype. */
export function IconSpark(p: P) {
  return (
    <Base {...p}>
      <path d="M12 3.5v4M12 16.5v4M3.5 12h4M16.5 12h4M6 6l2.6 2.6M15.4 15.4 18 18M18 6l-2.6 2.6M8.6 15.4 6 18" />
    </Base>
  );
}

export function IconArrowLeft(p: P) {
  return (
    <Base {...p}>
      <path d="M19 12H5M10.5 6.5 5 12l5.5 5.5" />
    </Base>
  );
}

export function IconCalendar(p: P) {
  return (
    <Base {...p}>
      <rect x="4" y="5.5" width="16" height="15" rx="3" />
      <path d="M8 3.5v4M16 3.5v4M4 10.5h16" />
    </Base>
  );
}

export function IconPlusUser(p: P) {
  return (
    <Base {...p}>
      <circle cx="9.5" cy="8" r="3.5" />
      <path d="M3 20a6.5 6.5 0 0 1 13 0M19 8v6M16 11h6" />
    </Base>
  );
}

export function IconTrash(p: P) {
  return (
    <Base {...p}>
      <path d="M4.5 7h15M9.5 7V5a1.5 1.5 0 0 1 1.5-1.5h2A1.5 1.5 0 0 1 14.5 5v2" />
      <path d="M6.5 7l.8 11.2A2 2 0 0 0 9.3 20h5.4a2 2 0 0 0 2-1.8L17.5 7M10 11v5M14 11v5" />
    </Base>
  );
}

export function IconChevronRight(p: P) {
  return (
    <Base {...p}>
      <path d="M9.5 6l6 6-6 6" />
    </Base>
  );
}

export function IconChevronDown(p: P) {
  return (
    <Base {...p}>
      <path d="M6 9.5l6 6 6-6" />
    </Base>
  );
}

export function IconPlus(p: P) {
  return (
    <Base {...p}>
      <path d="M12 5v14M5 12h14" />
    </Base>
  );
}

export function IconMore(p: P) {
  return (
    <Base {...p}>
      <path d="M6 12h.01M12 12h.01M18 12h.01" strokeWidth={3.2} />
    </Base>
  );
}

/** Box with an arrow out of the top: share. */
export function IconShare(p: P) {
  return (
    <Base {...p}>
      <path d="M12 3.5v11M8 7.5l4-4 4 4" />
      <path d="M8.5 10.5H7a2 2 0 0 0-2 2V18a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-5.5a2 2 0 0 0-2-2h-1.5" />
    </Base>
  );
}
