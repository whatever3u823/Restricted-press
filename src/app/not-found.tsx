import Link from "next/link";

export default function NotFound() {
  return (
    <div className="page" style={{ textAlign: "center", paddingTop: "18vh" }}>
      <span className="eyebrow">Not found</span>
      <h1 className="h1 mt-2">Nothing is shelved at this address.</h1>
      <p className="muted mt-2">The document may have been removed, or the link mistyped.</p>
      <div className="row mt-4" style={{ justifyContent: "center" }}>
        <Link href="/library" className="btn btn--primary">
          Return to the library
        </Link>
      </div>
    </div>
  );
}
