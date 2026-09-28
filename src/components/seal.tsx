/**
 * The Archive Seal: a ring with a bar struck through it — a record withheld,
 * then opened. `lettered` adds the engraved legend for large sizes.
 */
export function Seal({ className, title, lettered }: { className?: string; title?: string; lettered?: boolean }) {
  if (!lettered) {
    return (
      <svg className={className} viewBox="0 0 32 32" role={title ? "img" : undefined} aria-hidden={title ? undefined : true}>
        {title ? <title>{title}</title> : null}
        <circle cx="16" cy="16" r="14.5" fill="none" stroke="currentColor" strokeWidth="1.25" />
        <circle cx="16" cy="16" r="10.5" fill="none" stroke="currentColor" strokeWidth="0.75" strokeDasharray="1.2 1.6" />
        <rect x="4" y="14.4" width="24" height="3.2" fill="currentColor" />
      </svg>
    );
  }
  return (
    <svg className={className} viewBox="0 0 120 120" role="img" aria-label={title ?? "Seal of Restricted Press"}>
      <defs>
        <path id="seal-ring" d="M60 60 m-44 0 a44 44 0 1 1 88 0 a44 44 0 1 1 -88 0" />
      </defs>
      <circle cx="60" cy="60" r="57" fill="none" stroke="currentColor" strokeWidth="1.4" />
      <circle cx="60" cy="60" r="53" fill="none" stroke="currentColor" strokeWidth="0.6" />
      <circle cx="60" cy="60" r="36" fill="none" stroke="currentColor" strokeWidth="0.8" />
      <circle cx="60" cy="60" r="32" fill="none" stroke="currentColor" strokeWidth="0.5" strokeDasharray="1.5 2" />
      <text fill="currentColor" style={{ fontFamily: "var(--sans)", fontSize: 8.4, letterSpacing: "0.32em", fontWeight: 500 }}>
        <textPath href="#seal-ring" startOffset="0">
          RESTRICTED PRESS · THE ARCHIVE · FORGOTTEN KNOWLEDGE ·
        </textPath>
      </text>
      <rect x="22" y="55" width="76" height="10" fill="currentColor" />
      <text x="60" y="47" textAnchor="middle" fill="currentColor" style={{ fontFamily: "var(--mono)", fontSize: 7, letterSpacing: "0.2em" }}>
        MMXXVI
      </text>
      <text x="60" y="80" textAnchor="middle" fill="currentColor" style={{ fontFamily: "var(--fell)", fontSize: 11, fontStyle: "italic" }}>
        R · P
      </text>
    </svg>
  );
}
