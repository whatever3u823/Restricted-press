"use client";

export default function ErrorPage({ reset }: { error: Error; reset: () => void }) {
  return (
    <div className="page" style={{ textAlign: "center", paddingTop: "18vh" }}>
      <span className="eyebrow">Interrupted</span>
      <h1 className="h1 mt-2">This page could not be brought up.</h1>
      <p className="muted mt-2">A temporary fault. Nothing in your library has been affected.</p>
      <button type="button" className="btn btn--primary mt-4" onClick={reset}>
        Try again
      </button>
    </div>
  );
}
