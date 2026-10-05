import Link from "next/link";

/** The Athenaeum mark: a capital A cut into a square plate. */
export function Mark({ className = "wordmark__mark" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 32 32" fill="none" stroke="currentColor" aria-hidden="true">
      <rect x="1.5" y="1.5" width="29" height="29" strokeWidth="1" />
      <rect x="4.5" y="4.5" width="23" height="23" strokeWidth="0.6" opacity="0.45" />
      <path d="M9.5 24 16 8l6.5 16" strokeWidth="1.4" strokeLinejoin="miter" />
      <path d="M12 18.2h8" strokeWidth="1.1" />
      <path d="M8 24h4M20 24h4" strokeWidth="1.1" />
    </svg>
  );
}

export function Wordmark({ href = "/" }: { href?: string }) {
  return (
    <Link href={href} className="wordmark" aria-label="Athenaeum — home">
      <Mark />
      <span className="wordmark__name">Athenaeum</span>
    </Link>
  );
}
