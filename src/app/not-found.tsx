import Link from "next/link";
import { InkStamp } from "@/components/period";

export default function NotFound() {
  return (
    <div className="wrap narrow" style={{ padding: "96px var(--gutter)", textAlign: "center" }}>
      <InkStamp sub="Error 404" tilt={-4}>
        No such file
      </InkStamp>
      <h1 className="title-l mt-4">The archive holds nothing at this address.</h1>
      <p className="meta mt-2">The file may have been withdrawn, or the reference mistyped.</p>
      <div className="row mt-4" style={{ justifyContent: "center" }}>
        <Link href="/archive" className="btn">
          Return to the Archive
        </Link>
        <Link href="/archivist" className="btn btn--ghost">
          Ask the Archivist
        </Link>
      </div>
    </div>
  );
}
