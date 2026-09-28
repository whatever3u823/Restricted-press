/** The Archive Seal: a ring, a bar struck through it — a record withheld, then opened. */
export function Seal({ className, title }: { className?: string; title?: string }) {
  return (
    <svg className={className} viewBox="0 0 32 32" role={title ? "img" : undefined} aria-hidden={title ? undefined : true}>
      {title ? <title>{title}</title> : null}
      <circle cx="16" cy="16" r="14.5" fill="none" stroke="currentColor" strokeWidth="1.25" />
      <circle cx="16" cy="16" r="10.5" fill="none" stroke="currentColor" strokeWidth="0.75" strokeDasharray="1.2 1.6" />
      <rect x="4" y="14.4" width="24" height="3.2" fill="currentColor" />
    </svg>
  );
}
