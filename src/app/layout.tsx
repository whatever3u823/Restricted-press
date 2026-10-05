import "@fontsource-variable/inter-tight/wght.css";
import "@fontsource-variable/newsreader/opsz.css";
import "@fontsource-variable/newsreader/opsz-italic.css";
import "@fontsource/ibm-plex-mono/400.css";
import "@fontsource/ibm-plex-mono/500.css";
import "./globals.css";

import { and, count, eq } from "drizzle-orm";
import type { Metadata, Viewport } from "next";
import { AppShell } from "@/components/app-shell";
import { PublicFooter, PublicHeader } from "@/components/public-chrome";
import { db } from "@/db";
import { documents, highlights } from "@/db/schema";
import { SITE } from "@/lib/config";
import { listCollections } from "@/lib/library";
import { getViewer } from "@/lib/viewer";

export const metadata: Metadata = {
  title: { default: `${SITE.name} — ${SITE.tagline}`, template: `%s — ${SITE.name}` },
  description: SITE.description,
};

export const viewport: Viewport = {
  themeColor: "#09090a",
  colorScheme: "dark",
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const viewer = await getViewer();

  if (viewer.user) {
    const [cols, [docs], [marks]] = await Promise.all([
      listCollections(viewer.user.id),
      db.select({ n: count() }).from(documents).where(and(eq(documents.ownerId, viewer.user.id), eq(documents.status, "ready"))),
      db.select({ n: count() }).from(highlights).where(eq(highlights.userId, viewer.user.id)),
    ]);
    return (
      <html lang="en">
        <body>
          <a className="skip-link" href="#main">
            Skip to content
          </a>
          <AppShell
            user={{ name: viewer.user.name, email: viewer.user.email }}
            plan={viewer.plan}
            collections={cols.map((c) => ({ id: c.id, name: c.name, n: c.n }))}
            documents={docs.n}
            highlights={marks.n}
          >
            {children}
          </AppShell>
        </body>
      </html>
    );
  }

  return (
    <html lang="en">
      <body>
        <a className="skip-link" href="#main">
          Skip to content
        </a>
        <PublicHeader />
        <main id="main" style={{ position: "relative", zIndex: 1 }}>
          {children}
        </main>
        <PublicFooter />
      </body>
    </html>
  );
}
