import type { Pact } from "@/lib/types";
import type { PactStats } from "@/lib/stats";

/* ------------------------------------------------------------------ */
/* The pact pet. Grows with the total number of days everyone kept it  */
/* (never shrinks), and its mood follows today.                        */
/* ------------------------------------------------------------------ */

export type PetMood = "happy" | "waiting" | "sad" | "sleeping";

export const STAGES = [
  { min: 0, name: "Egg" },
  { min: 1, name: "Hatchling" },
  { min: 4, name: "Squish" },
  { min: 10, name: "Pinky" },
  { min: 21, name: "Big Pinky" },
  { min: 40, name: "Legend" },
] as const;

const NAMES = ["Mochi", "Bean", "Tofu", "Pip", "Dumpling", "Noodle", "Biscuit", "Peanut", "Pickle", "Waffle", "Bun", "Gnocchi"];

export function defaultPetName(pactId: string): string {
  let h = 0;
  for (let i = 0; i < pactId.length; i++) h = (h * 31 + pactId.charCodeAt(i)) >>> 0;
  return NAMES[h % NAMES.length];
}

export function petName(p: Pact): string {
  return p.pet_name?.trim() || defaultPetName(p.id);
}

export function petState(pact: Pact, stats: PactStats) {
  // A kept week is worth more than a kept day, so weekly pacts grow at a similar pace.
  const xp = stats.groupDaysKept * (pact.goal_type === "weekly" ? 5 : 1);
  let stage = 0;
  for (let i = 0; i < STAGES.length; i++) if (xp >= STAGES[i].min) stage = i;
  const next = STAGES[stage + 1];
  const pending = Object.values(stats.members).filter((m) => m.today === "pending").length;

  let mood: PetMood;
  if (!stats.started || stats.ended) mood = "sleeping";
  else if (stats.groupBrokeToday) mood = "sad";
  else if (stats.groupToday === "kept") mood = "happy";
  else if (stats.groupBrokeYesterday) mood = "sad";
  else mood = "waiting";

  const name = petName(pact);
  let line: string;
  if (!stats.started) line = `${name} hatches when the pact starts.`;
  else if (stats.ended) line = `${name} is resting. Good pact.`;
  else if (mood === "happy") line = `${name} is thriving. Everyone kept it today.`;
  else if (stats.groupBrokeToday) line = `${name} is a little sad today. A clean day tomorrow cheers it up.`;
  else if (mood === "sad") line = `${name} is still bummed about yesterday. Keep it today to fix that.`;
  else line = `${name} is waiting on ${pending} of you today.`;

  return {
    xp,
    stage,
    stageName: STAGES[stage].name,
    nextAt: next?.min ?? null,
    nextName: next?.name ?? null,
    progress: next ? (xp - STAGES[stage].min) / (next.min - STAGES[stage].min) : 1,
    mood,
    line,
    name,
  };
}

/* ------------------------------------------------------------------ */
/* Drawing                                                              */
/* ------------------------------------------------------------------ */

const INK = "#3a1626"; // face details (always on the pink body)
const LINE = "var(--pet-line)"; // outline, flips light in dark mode
const SIZES = [
  { w: 0, h: 0 },
  { w: 19, h: 16 },
  { w: 25, h: 21 },
  { w: 29, h: 25 },
  { w: 32, h: 28 },
  { w: 34, h: 30 },
];

export function Pet({ stage, mood, size = 120, still }: { stage: number; mood: PetMood; size?: number; still?: boolean }) {
  const anim = still ? "" : mood === "happy" ? "pet-bounce" : mood === "sad" ? "pet-droop" : mood === "waiting" ? "pet-breathe" : "";
  return (
    <svg width={size} height={size} viewBox="0 0 120 120" role="img" aria-label={`${STAGES[stage]?.name ?? "Pet"}, ${mood}`}>
      <ellipse cx="60" cy="107" rx={stage === 0 ? 22 : 18 + SIZES[stage].w * 0.5} ry="4.5" fill={LINE} opacity="0.12" />
      {stage === 0 ? <Egg mood={mood} still={still} /> : <Body stage={stage} mood={mood} anim={anim} />}
    </svg>
  );
}

function Egg({ mood, still }: { mood: PetMood; still?: boolean }) {
  return (
    <g className={still ? "" : "pet-wobble"} style={{ transformBox: "fill-box", transformOrigin: "50% 100%" }}>
      <path d="M60 36c14 0 25 18 25 36 0 18-11 32-25 32S35 90 35 72c0-18 11-36 25-36Z" fill="#fff1ea" stroke={LINE} strokeWidth="2.6" />
      <circle cx="51" cy="60" r="3.6" fill="var(--pink)" opacity="0.75" />
      <circle cx="68" cy="52" r="2.4" fill="var(--pink)" opacity="0.6" />
      <circle cx="70" cy="80" r="4.2" fill="var(--pink)" opacity="0.7" />
      <circle cx="49" cy="88" r="2.2" fill="var(--pink)" opacity="0.55" />
      {mood === "sleeping" ? <Zzz x={84} y={40} /> : <path d="M47 71l5 4 4-5 5 5 4-4 5 4 3-3" fill="none" stroke={INK} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" opacity="0.55" />}
    </g>
  );
}

function Body({ stage, mood, anim }: { stage: number; mood: PetMood; anim: string }) {
  const { w, h } = SIZES[stage];
  const cy = 104 - h;
  const top = cy - h;
  const fill = mood === "sad" ? "#ec8fab" : "var(--pink)";
  const body = `M60 ${top} C ${60 + w * 0.78} ${top}, ${60 + w} ${cy - h * 0.4}, ${60 + w} ${cy + h * 0.3} C ${60 + w} ${cy + h * 0.86}, ${60 + w * 0.62} ${104}, 60 ${104} C ${60 - w * 0.62} ${104}, ${60 - w} ${cy + h * 0.86}, ${60 - w} ${cy + h * 0.3} C ${60 - w} ${cy - h * 0.4}, ${60 - w * 0.78} ${top}, 60 ${top} Z`;

  const ex = w * 0.36;
  const ey = cy - h * 0.02;
  const er = Math.max(2.6, w * 0.105);
  const armW = Math.max(5, w * 0.24);

  // Right arm: raised with the hooked pinky (same hook as the logo) unless sad or asleep.
  const ax = 60 + w * 0.9;
  const ay = cy + h * 0.15;
  const reach = h * 1.05;
  const raised = `M ${ax - 3} ${ay} C ${ax + 6} ${ay - 2}, ${ax + 12} ${ay - reach * 0.4}, ${ax + 13} ${ay - reach * 0.85} C ${ax + 13.5} ${ay - reach * 1.1}, ${ax + 7} ${ay - reach * 1.12}, ${ax + 6} ${ay - reach * 0.92}`;
  const droop = `M ${ax - 2} ${ay} C ${ax + 5} ${ay + 3}, ${ax + 7} ${ay + 8}, ${ax + 6} ${ay + 13}`;

  return (
    <g className={anim} style={{ transformBox: "fill-box", transformOrigin: "50% 100%" }}>
      {/* hair curl */}
      {stage === 4 ? (
        <path d={`M58 ${top + 1} c -2 -7 3 -12 9 -11 c 4 1 4 6 0 7 c -2 0 -3 -2 -2 -3`} fill="none" stroke={LINE} strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" />
      ) : null}
      {/* crown */}
      {stage >= 5 ? (
        <path d={`M47 ${top + 4} l2 -11 6 6 5 -9 5 9 6 -6 2 11 Z`} fill="#f6bd46" stroke={LINE} strokeWidth="2.2" strokeLinejoin="round" transform={`rotate(-12 50 ${top})`} />
      ) : null}

      {/* arms (outline then fill so they read as part of the body) */}
      {stage >= 3 && mood !== "sleeping" ? (
        <>
          <path d={mood === "sad" ? droop : raised} fill="none" stroke={LINE} strokeWidth={armW + 5} strokeLinecap="round" strokeLinejoin="round" />
          <path d={mood === "sad" ? droop : raised} fill="none" stroke={fill} strokeWidth={armW} strokeLinecap="round" strokeLinejoin="round" />
        </>
      ) : null}

      {/* body */}
      <path d={body} fill={fill} stroke={LINE} strokeWidth="2.6" strokeLinejoin="round" />
      {stage >= 3 && mood !== "sleeping" ? (
        <path d={`M ${60 - w * 0.86} ${cy + h * 0.2} q ${-w * 0.2} ${h * 0.1} ${-w * 0.12} ${h * 0.34}`} fill="none" stroke={INK} strokeWidth="2.4" strokeLinecap="round" />
      ) : null}
      {/* belly shine */}
      <path d={`M ${60 - w * 0.55} ${cy - h * 0.35} q ${w * 0.18} ${-h * 0.32} ${w * 0.5} ${-h * 0.42}`} fill="none" stroke="#fff" strokeWidth="2.4" strokeLinecap="round" opacity="0.55" />

      {/* cheeks */}
      {mood !== "sad" ? (
        <>
          <ellipse cx={60 - w * 0.6} cy={cy + h * 0.28} rx={w * 0.13} ry={w * 0.075} fill="#ffb3c8" opacity="0.9" />
          <ellipse cx={60 + w * 0.6} cy={cy + h * 0.28} rx={w * 0.13} ry={w * 0.075} fill="#ffb3c8" opacity="0.9" />
        </>
      ) : null}

      <Face mood={mood} lx={60 - ex} rx={60 + ex} ey={ey} er={er} my={cy + h * 0.3} mw={w * 0.16} />

      {mood === "sad" ? (
        <path d={`M ${60 + w * 0.72} ${top + h * 0.35} c 3 4 4 6 4 8 a 4 4 0 0 1 -8 0 c 0 -2 1 -4 4 -8 Z`} fill="#9fd3ff" stroke={LINE} strokeWidth="1.8" />
      ) : null}
      {mood === "sleeping" ? <Zzz x={60 + w * 0.7} y={top - 2} /> : null}
      {mood === "happy" || stage >= 5 ? (
        <g fill="#f6bd46" stroke={LINE} strokeWidth="1.6" strokeLinejoin="round">
          <Sparkle x={60 - w - 10} y={top + 6} s={1} />
          <Sparkle x={stage >= 3 ? 60 - w - 4 : 60 + w + 12} y={stage >= 3 ? cy + h * 0.55 : top + h * 0.9} s={0.75} />
        </g>
      ) : null}
    </g>
  );
}

function Face({ mood, lx, rx, ey, er, my, mw }: { mood: PetMood; lx: number; rx: number; ey: number; er: number; my: number; mw: number }) {
  const line = { fill: "none", stroke: INK, strokeWidth: 2.4, strokeLinecap: "round" as const, strokeLinejoin: "round" as const };
  if (mood === "happy") {
    return (
      <>
        <path d={`M ${lx - er} ${ey + er * 0.4} Q ${lx} ${ey - er * 1.1} ${lx + er} ${ey + er * 0.4}`} {...line} />
        <path d={`M ${rx - er} ${ey + er * 0.4} Q ${rx} ${ey - er * 1.1} ${rx + er} ${ey + er * 0.4}`} {...line} />
        <path d={`M ${60 - mw} ${my - 1} Q 60 ${my + mw * 1.3} ${60 + mw} ${my - 1} Z`} fill={INK} stroke={INK} strokeWidth="1.5" strokeLinejoin="round" />
      </>
    );
  }
  if (mood === "sleeping") {
    return (
      <>
        <path d={`M ${lx - er} ${ey + 1} Q ${lx} ${ey + er * 0.9} ${lx + er} ${ey + 1}`} {...line} />
        <path d={`M ${rx - er} ${ey + 1} Q ${rx} ${ey + er * 0.9} ${rx + er} ${ey + 1}`} {...line} />
        <ellipse cx="60" cy={my + 1} rx={mw * 0.35} ry={mw * 0.45} fill={INK} opacity="0.8" />
      </>
    );
  }
  if (mood === "sad") {
    return (
      <>
        <circle cx={lx} cy={ey + 1} r={er * 0.85} fill={INK} />
        <circle cx={rx} cy={ey + 1} r={er * 0.85} fill={INK} />
        <path d={`M ${lx - er * 1.3} ${ey - er * 0.9} L ${lx + er * 0.9} ${ey - er * 1.8}`} {...line} />
        <path d={`M ${rx + er * 1.3} ${ey - er * 0.9} L ${rx - er * 0.9} ${ey - er * 1.8}`} {...line} />
        <path d={`M ${60 - mw} ${my + mw * 0.5} Q 60 ${my - mw * 0.5} ${60 + mw} ${my + mw * 0.5}`} {...line} />
      </>
    );
  }
  return (
    <>
      <g className="pet-blink" style={{ transformBox: "fill-box", transformOrigin: "center" }}>
        <circle cx={lx} cy={ey} r={er} fill={INK} />
        <circle cx={rx} cy={ey} r={er} fill={INK} />
        <circle cx={lx + er * 0.35} cy={ey - er * 0.35} r={er * 0.35} fill="#fff" />
        <circle cx={rx + er * 0.35} cy={ey - er * 0.35} r={er * 0.35} fill="#fff" />
      </g>
      <path d={`M ${60 - mw * 0.7} ${my} Q 60 ${my + mw * 0.8} ${60 + mw * 0.7} ${my}`} {...line} />
    </>
  );
}

function Sparkle({ x, y, s }: { x: number; y: number; s: number }) {
  const k = 5 * s;
  return <path d={`M ${x} ${y - k} Q ${x + k * 0.2} ${y - k * 0.2} ${x + k} ${y} Q ${x + k * 0.2} ${y + k * 0.2} ${x} ${y + k} Q ${x - k * 0.2} ${y + k * 0.2} ${x - k} ${y} Q ${x - k * 0.2} ${y - k * 0.2} ${x} ${y - k} Z`} />;
}

function Zzz({ x, y }: { x: number; y: number }) {
  return (
    <g fill="none" stroke={LINE} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" opacity="0.7">
      <path d={`M ${x} ${y} h 7 l -7 7 h 7`} />
      <path d={`M ${x + 10} ${y - 9} h 5 l -5 5 h 5`} />
    </g>
  );
}
