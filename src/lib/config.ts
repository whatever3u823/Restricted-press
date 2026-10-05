/**
 * Business configuration. Prices and limits live here — nowhere else — so
 * they can change without touching the application.
 */

export const SITE = {
  name: "Athenaeum",
  tagline: "Your library. Total recall.",
  description:
    "A private library and research instrument for serious readers. Bring your books, papers and articles; read them in a room built for concentration; question them with the Archivist.",
} as const;

export const FELLOWSHIP = {
  name: "Fellowship",
  /** Indicative monthly price in cents. Not final; shown with a note. */
  monthlyPriceCents: 1200,
  currency: "USD",
  pricingNote: "Introductory price, subject to change before launch.",
} as const;

/** Documents a library may hold, by plan. */
export const LIBRARY_LIMITS = {
  member: 20,
  fellow: 2000,
} as const;

/** Archivist questions allowed per rolling 24 hours. null = unlimited. */
export const ARCHIVIST_LIMITS = {
  member: 15,
  fellow: null,
} as const;

export const ARCHIVIST = {
  /** Passages retrieved for a standard answer and for deep research. */
  standardPassages: 10,
  deepPassages: 20,
  /** Max passages from any single document, to keep answers cross-textual. */
  perDocumentCap: 4,
} as const;

/** Upload limits, enforced on the server. */
export const UPLOAD = {
  /** Largest file the browser will attempt to read. */
  maxFileBytes: 150 * 1024 * 1024,
  /** Largest document accepted, in words (a very long book is ~600k). */
  maxWords: 2_000_000,
} as const;

export function formatPrice(cents: number, currency: string = FELLOWSHIP.currency) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
    minimumFractionDigits: cents % 100 === 0 ? 0 : 2,
  }).format(cents / 100);
}
