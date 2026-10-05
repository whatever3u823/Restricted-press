"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useRef, useState, useTransition } from "react";
import { deleteCollection, deleteDocument, renameCollection } from "@/app/actions";
import { SearchIcon } from "./icons";

/** Library filters: applied as you choose them, kept in the address so views can be bookmarked. */
export function FilterBar() {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [q, setQ] = useState(params.get("q") ?? "");
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const set = (key: string, value: string) => {
    const next = new URLSearchParams(params.toString());
    if (value) next.set(key, value);
    else next.delete(key);
    router.replace(`${pathname}${next.toString() ? `?${next}` : ""}`, { scroll: false });
  };

  return (
    <div className="toolbar" role="search">
      <label className="search-inline">
        <SearchIcon />
        <span className="sr-only">Filter by title, author or subject</span>
        <input
          className="input"
          value={q}
          placeholder="Filter by title, author or subject"
          onChange={(e) => {
            setQ(e.target.value);
            if (timer.current) clearTimeout(timer.current);
            const v = e.target.value;
            timer.current = setTimeout(() => set("q", v.trim()), 250);
          }}
        />
      </label>
      <select className="select select--sm" style={{ width: "auto" }} aria-label="Kind" value={params.get("kind") ?? ""} onChange={(e) => set("kind", e.target.value)}>
        <option value="">All kinds</option>
        <option value="book">Books</option>
        <option value="paper">Papers</option>
        <option value="article">Articles</option>
        <option value="notes">Notes</option>
        <option value="other">Other</option>
      </select>
      <select className="select select--sm" style={{ width: "auto" }} aria-label="Reading status" value={params.get("status") ?? ""} onChange={(e) => set("status", e.target.value)}>
        <option value="">Any status</option>
        <option value="unread">Unread</option>
        <option value="reading">Reading</option>
        <option value="finished">Finished</option>
      </select>
      <select className="select select--sm" style={{ width: "auto" }} aria-label="Order" value={params.get("sort") ?? ""} onChange={(e) => set("sort", e.target.value)}>
        <option value="">Recently added</option>
        <option value="read">Recently read</option>
        <option value="title">Title</option>
        <option value="author">Author</option>
        <option value="year">Year</option>
      </select>
    </div>
  );
}

export function CollectionControls({ id, name }: { id: number; name: string }) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(name);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  if (editing) {
    return (
      <form
        className="row"
        onSubmit={(e) => {
          e.preventDefault();
          start(async () => {
            const r = await renameCollection(id, value);
            if (r.ok) {
              setEditing(false);
              router.refresh();
            } else setError(r.message);
          });
        }}
      >
        <input className="input" style={{ width: 220, padding: "7px 10px" }} value={value} onChange={(e) => setValue(e.target.value)} autoFocus aria-label="Collection name" />
        <button className="btn btn--sm" disabled={pending}>
          Save
        </button>
        <button type="button" className="btn btn--sm btn--quiet" onClick={() => setEditing(false)}>
          Cancel
        </button>
        {error ? <span className="error-text">{error}</span> : null}
      </form>
    );
  }
  return (
    <div className="row" style={{ ["--gap" as string]: "6px" }}>
      <button type="button" className="btn btn--sm btn--quiet" onClick={() => setEditing(true)}>
        Rename
      </button>
      <button
        type="button"
        className="btn btn--sm btn--quiet"
        disabled={pending}
        onClick={() => {
          if (!confirm(`Delete the collection “${name}”? Its documents stay in your library.`)) return;
          start(async () => {
            await deleteCollection(id);
            router.push("/library");
            router.refresh();
          });
        }}
      >
        Delete collection
      </button>
    </div>
  );
}

export function DiscardUpload({ id }: { id: number }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  return (
    <button
      type="button"
      className="link"
      disabled={pending}
      onClick={() =>
        start(async () => {
          await deleteDocument(id);
          router.refresh();
        })
      }
    >
      Discard
    </button>
  );
}
