export function LogoMark({ size = 32 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 512 512" aria-hidden="true">
      <rect width="512" height="512" rx="128" fill="var(--pink)" />
      <g fill="none" stroke="#fff" strokeWidth="46" strokeLinecap="round" strokeLinejoin="round">
        <path d="M140 336 V230 A80 80 0 0 1 300 230 V272" />
        <path d="M372 176 V282 A80 80 0 0 1 212 282 V240" />
      </g>
    </svg>
  );
}

export function Wordmark() {
  return (
    <span className="flex items-center gap-2">
      <LogoMark size={28} />
      <span className="font-display text-[22px] font-extrabold">pinky</span>
    </span>
  );
}
