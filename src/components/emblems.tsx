/**
 * Shelf emblems — engraved-style line marks, one per category. Stamped in
 * foil on book covers; deliberately plain (no sigils, no pentagrams).
 */
const common = {
  viewBox: "0 0 64 64",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.1,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
};

const EMBLEMS: Record<string, React.ReactNode> = {
  // Alembic over a flame
  alchemy: (
    <>
      <circle cx="26" cy="40" r="13" />
      <path d="M22 28.5V18h8v10.5" />
      <path d="M21 18h10" />
      <path d="M30 20.5 52 12" />
      <path d="M52 12v8" />
      {[0, 1, 2, 3, 4].map((i) => (
        <path key={i} d={`M${16 + i * 4} ${44 + (i % 2)}l${4} ${-6}`} strokeWidth={0.6} />
      ))}
      <path d="M20 58c2-3 1-5 3-7 0 3 3 3 3 7M26 58c1-2 2-3 4-4" strokeWidth={0.8} />
    </>
  ),
  // Scales of judgement
  witchcraft: (
    <>
      <path d="M32 8v44M20 56h24M32 52l-5 4M32 52l5 4" />
      <path d="M12 16h40" />
      <circle cx="32" cy="10" r="2" />
      <path d="M12 16 6 34h12zM52 16l-6 18h12z" strokeWidth={0.8} />
      <path d="M6 34c0 4 12 4 12 0M46 34c0 4 12 4 12 0" />
    </>
  ),
  // Circle, triangle and square — the squared circle
  esoterica: (
    <>
      <rect x="10" y="10" width="44" height="44" />
      <path d="M32 13 52.5 50h-41z" />
      <circle cx="32" cy="37" r="9.5" />
      <circle cx="32" cy="37" r="1.4" fill="currentColor" />
    </>
  ),
  // Armillary sphere
  magic: (
    <>
      <circle cx="32" cy="28" r="18" />
      <ellipse cx="32" cy="28" rx="18" ry="6" />
      <ellipse cx="32" cy="28" rx="18" ry="6" transform="rotate(-28 32 28)" />
      <ellipse cx="32" cy="28" rx="6" ry="18" />
      <path d="M20 10 44 46" strokeWidth={0.8} />
      <path d="M32 46v8M24 58h16M26 54h12" />
    </>
  ),
  // Radiant star
  mysticism: (
    <>
      <path d="M32 8 36 28 56 32 36 36 32 56 28 36 8 32 28 28z" />
      <path d="M32 16 34 30 48 32 34 34 32 48 30 34 16 32 30 30z" strokeWidth={0.7} />
      {Array.from({ length: 8 }).map((_, i) => {
        const a = (i * Math.PI) / 4 + Math.PI / 8;
        return (
          <path
            key={i}
            d={`M${32 + Math.cos(a) * 14} ${32 + Math.sin(a) * 14}L${32 + Math.cos(a) * 22} ${32 + Math.sin(a) * 22}`}
            strokeWidth={0.6}
          />
        );
      })}
    </>
  ),
  // Temple portico
  "ancient-religion": (
    <>
      <path d="M8 22 32 8l24 14z" />
      <path d="M10 24h44M10 52h44M8 56h48" />
      {[14, 23, 32, 41, 50].map((x) => (
        <path key={x} d={`M${x} 26v24`} />
      ))}
      <circle cx="32" cy="17" r="2.2" />
    </>
  ),
  // Key
  "secret-societies": (
    <>
      <circle cx="20" cy="32" r="9" />
      <circle cx="20" cy="32" r="4" strokeWidth={0.7} />
      <path d="M29 32h26M47 32v7M53 32v5M41 32v4" />
    </>
  ),
};

export function Emblem({ category, className }: { category?: string | null; className?: string }) {
  return (
    <svg {...common} className={className} aria-hidden="true">
      {EMBLEMS[category ?? ""] ?? EMBLEMS.esoterica}
    </svg>
  );
}

/** Small lozenge used in ornamental rules. */
export function Lozenge() {
  return (
    <svg viewBox="0 0 16 16" aria-hidden="true">
      <path d="M8 1 15 8 8 15 1 8z" fill="none" stroke="currentColor" strokeWidth="1" />
      <path d="M8 5 11 8 8 11 5 8z" fill="currentColor" />
    </svg>
  );
}
