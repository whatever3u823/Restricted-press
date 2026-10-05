"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useRef, useState } from "react";
import type { ParsedDocument, ParsedSection } from "@/lib/parse/model";
import { CheckIcon, UploadIcon } from "./icons";

type Item = {
  key: number;
  file: File;
  state: "queued" | "reading" | "filing" | "finishing" | "done" | "error";
  detail?: string;
  progress?: number;
  result?: { id: number; title: string; author: string | null; words: number; sections: number };
  gate?: boolean;
};

const BATCH_BYTES = 2_500_000;

function batches(sections: ParsedSection[]) {
  const out: ParsedSection[][] = [];
  let cur: ParsedSection[] = [];
  let size = 0;
  for (const s of sections) {
    const n = JSON.stringify(s).length;
    if (cur.length && (size + n > BATCH_BYTES || cur.length >= 400)) {
      out.push(cur);
      cur = [];
      size = 0;
    }
    cur.push(s);
    size += n;
  }
  if (cur.length) out.push(cur);
  return out;
}

async function post(url: string, body: unknown) {
  const res = await fetch(url, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err = new Error(data.error ?? `The library refused the upload (${res.status}).`) as Error & { gate?: boolean };
    err.gate = Boolean(data.gate);
    throw err;
  }
  return data;
}

export function Uploader({ accept, remaining }: { accept: string; remaining: number | null }) {
  const router = useRouter();
  const [items, setItems] = useState<Item[]>([]);
  const [over, setOver] = useState(false);
  const counter = useRef(0);
  const running = useRef(false);
  const queue = useRef<Item[]>([]);

  const update = (key: number, patch: Partial<Item>) => setItems((xs) => xs.map((x) => (x.key === key ? { ...x, ...patch } : x)));

  const runOne = useCallback(async (item: Item) => {
    update(item.key, { state: "reading", detail: "Reading the file…" });
    let parsed: ParsedDocument;
    try {
      const { parseFile } = await import("@/lib/parse");
      parsed = await parseFile(item.file, (p) => {
        if (p.stage === "extracting" && p.total) update(item.key, { detail: `Extracting text — page ${p.done} of ${p.total}`, progress: (p.done ?? 0) / p.total });
        else if (p.stage === "structuring") update(item.key, { detail: "Finding chapters and paragraphs…", progress: undefined });
      });
    } catch (e) {
      update(item.key, { state: "error", detail: (e as Error).message || "This file could not be read." });
      return;
    }

    try {
      update(item.key, { state: "filing", detail: "Filing in your library…", progress: 0 });
      const { id } = await post("/api/documents", {
        title: parsed.title,
        author: parsed.author,
        year: parsed.year,
        kind: parsed.kind,
        format: parsed.format,
        filename: parsed.filename,
      });
      const parts = batches(parsed.sections);
      for (let i = 0; i < parts.length; i++) {
        await post(`/api/documents/${id}/sections`, { sections: parts[i] });
        update(item.key, { progress: (i + 1) / parts.length, detail: `Filing in your library — ${Math.round(((i + 1) / parts.length) * 100)}%` });
      }
      update(item.key, { state: "finishing", detail: "Indexing…", progress: undefined });
      await post(`/api/documents/${id}/finalize`, {});
      update(item.key, {
        state: "done",
        detail: undefined,
        result: { id, title: parsed.title, author: parsed.author, words: parsed.wordCount, sections: parsed.sections.length },
      });
      router.refresh();
    } catch (e) {
      const err = e as Error & { gate?: boolean };
      update(item.key, { state: "error", detail: err.message, gate: err.gate });
      if (err.gate) {
        // The library is full: the rest of the queue cannot be filed either.
        for (const q of queue.current) update(q.key, { state: "error", detail: "Not filed — your library is full.", gate: true });
        queue.current = [];
      }
    }
  }, [router]);

  const pump = useCallback(async () => {
    if (running.current) return;
    running.current = true;
    while (queue.current.length) {
      const next = queue.current.shift()!;
      await runOne(next);
    }
    running.current = false;
  }, [runOne]);

  const add = (files: FileList | File[]) => {
    const list = Array.from(files).map((file) => ({ key: ++counter.current, file, state: "queued" as const }));
    if (!list.length) return;
    setItems((xs) => [...list, ...xs]);
    queue.current.push(...list);
    void pump();
  };

  const done = items.filter((i) => i.state === "done");

  return (
    <div>
      <label
        className="dropzone panel ticks"
        data-over={over}
        onDragOver={(e) => {
          e.preventDefault();
          setOver(true);
        }}
        onDragLeave={() => setOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setOver(false);
          add(e.dataTransfer.files);
        }}
      >
        <input
          type="file"
          multiple
          accept={accept}
          aria-label="Choose documents to add"
          onChange={(e) => {
            if (e.target.files) add(e.target.files);
            e.target.value = "";
          }}
        />
        <div>
          <UploadIcon className="dropzone__mark" />
          <p className="h2">Drop documents here</p>
          <p className="muted mt-2">or choose files — PDF, EPUB, Word (.docx), text, Markdown, HTML</p>
          <span className="btn btn--primary mt-4" aria-hidden="true">
            Choose files
          </span>
          <p className="hint mt-3">
            Files are read on this device; only their text is filed in your library.
            {remaining !== null ? ` Room for ${remaining} more document${remaining === 1 ? "" : "s"}.` : ""}
          </p>
        </div>
      </label>

      {items.length ? (
        <section className="mt-5" aria-live="polite">
          <div className="spread" style={{ paddingBottom: 12 }}>
            <span className="eyebrow">Arrivals</span>
            {done.length ? (
              <Link href="/library" className="link small">
                View library
              </Link>
            ) : null}
          </div>
          <ul className="queue" role="list">
            {items.map((i) => (
              <li key={i.key} className="qitem">
                <span className="spine" data-format={i.file.name.split(".").pop()?.slice(0, 4)} data-kind="book" aria-hidden="true">
                  {i.state === "done" ? <CheckIcon className="" /> : "·"}
                </span>
                <div style={{ minWidth: 0 }}>
                  <p className="qitem__name">{i.result?.title ?? i.file.name}</p>
                  {i.state === "done" && i.result ? (
                    <p className="qitem__state">
                      {i.result.author ?? "Author not detected"} · {i.result.words.toLocaleString("en-US")} words · {i.result.sections}{" "}
                      section{i.result.sections === 1 ? "" : "s"}
                    </p>
                  ) : (
                    <p className={`qitem__state${i.state === "error" ? " qitem__state--error" : ""}`}>
                      {i.state === "queued" ? "Waiting…" : i.detail}
                      {i.gate ? (
                        <>
                          {" "}
                          <Link href="/membership" className="link">
                            The Fellowship
                          </Link>
                        </>
                      ) : null}
                    </p>
                  )}
                  {["reading", "filing", "finishing"].includes(i.state) ? (
                    <div className={`progress${i.progress === undefined ? " progress--indeterminate" : ""}`}>
                      <span style={i.progress !== undefined ? { width: `${Math.round(i.progress * 100)}%` } : undefined} />
                    </div>
                  ) : null}
                </div>
                {i.state === "done" && i.result ? (
                  <span className="row" style={{ ["--gap" as string]: "6px" }}>
                    <Link href={`/d/${i.result.id}`} className="btn btn--sm">
                      Open
                    </Link>
                  </span>
                ) : (
                  <span />
                )}
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
}
