import type { Metadata } from "next";
import Link from "next/link";
import { getViewer } from "@/lib/viewer";

export const metadata: Metadata = { title: "Privacy", description: "What Athenaeum keeps, who can see it, and what leaves it." };

export default async function PrivacyPage() {
  const viewer = await getViewer();
  return (
    <div className={viewer.user ? "page" : "wrap"} style={{ maxWidth: 820, paddingTop: viewer.user ? undefined : "clamp(48px, 8vw, 96px)" }}>
      <header className="page-head" style={{ display: "block" }}>
        <span className="eyebrow eyebrow--rule">Privacy</span>
        <h1 className="h1">What Athenaeum keeps, and who sees it.</h1>
        <p className="page-head__sub">A plain account of how the software handles your library.</p>
      </header>

      <div className="policy">
        <section>
          <h2>What is kept</h2>
          <p>
            Your name, email address and a hashed password. The <em>text</em> of the documents you add — divided into
            sections and passages so it can be read and searched — with the title, author and other details you see on
            each document. Your highlights, notes, collections and reading progress. The questions you put to the
            Archivist, with its answers, so you can return to them.
          </p>
        </section>
        <section>
          <h2>What is not kept</h2>
          <p>
            The original files. Documents are read in your browser when you add them; only their extracted text is sent
            to your library. A PDF’s layout, images and fonts never leave your device.
          </p>
        </section>
        <section>
          <h2>Who can see your library</h2>
          <p>
            Only you. Every document, passage, highlight and question belongs to your account, and every search and
            every answer is confined to it. Nothing is shared, listed or published, and there is no public profile.
          </p>
        </section>
        <section>
          <h2>What leaves Athenaeum</h2>
          <p>
            When you ask the Archivist a question, the passages it has found in your library are sent, with your
            question, to Anthropic’s API, which composes the cited answer. When a document arrives, an excerpt of it is
            sent the same way so the Archivist can write its catalogue entry. Nothing is sent when you read, search,
            highlight or organise.
          </p>
        </section>
        <section>
          <h2>Deleting</h2>
          <p>
            Removing a document deletes its text, highlights and notes. Deleting your account — from{" "}
            {viewer.user ? (
              <Link href="/account" className="link">
                your account page
              </Link>
            ) : (
              "your account page"
            )}{" "}
            — deletes everything listed above, immediately.
          </p>
        </section>
      </div>
    </div>
  );
}
