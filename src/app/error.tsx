"use client";

export default function ErrorPage({ reset }: { error: Error; reset: () => void }) {
  return (
    <div className="wrap narrow" style={{ padding: "96px var(--gutter)", textAlign: "center" }}>
      <span className="stamp stamp--accent stamp--large">Retrieval failed</span>
      <h1 className="title-l mt-4">This record could not be brought up.</h1>
      <p className="meta mt-2">A temporary fault in the archive. Please try again.</p>
      <button type="button" className="btn mt-4" onClick={reset}>
        Try again
      </button>
    </div>
  );
}
