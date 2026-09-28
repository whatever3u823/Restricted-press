/**
 * Business configuration. Prices and limits live here — nowhere else — so
 * they can change without touching the application.
 */

export const MEMBERSHIP = {
  name: "Inner Archive",
  /** Indicative monthly price in cents. Not final; shown with a note. */
  monthlyPriceCents: 1200,
  currency: "USD",
  pricingNote: "Introductory price, subject to change before launch.",
} as const;

/** Archivist questions allowed per rolling 24 hours. null = unlimited. */
export const ARCHIVIST_LIMITS = {
  visitor: 3,
  reader: 10,
  inner: null,
} as const;

export const ARCHIVIST = {
  /** Passages retrieved for a standard answer and for deep research. */
  standardPassages: 8,
  deepPassages: 16,
  /** Max passages from any single work, to keep answers cross-textual. */
  perWorkCap: 3,
} as const;

export const SITE = {
  name: "Restricted Press",
  tagline: "Forgotten knowledge. Restored access.",
  description:
    "A curated archive of obscure, forgotten and historically significant texts — with an AI research archivist that answers from the sources.",
} as const;

export function formatPrice(cents: number, currency: string = MEMBERSHIP.currency) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
    minimumFractionDigits: cents % 100 === 0 ? 0 : 2,
  }).format(cents / 100);
}
