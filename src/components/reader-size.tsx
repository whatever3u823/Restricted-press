"use client";

import { useEffect, useState } from "react";

const SIZES = [1.12, 1.22, 1.3, 1.42, 1.56];
const KEY = "rp-reader-size";

/** Per-reader type size, remembered in this browser only. */
export function ReaderSize() {
  const [i, setI] = useState(2);
  useEffect(() => {
    try {
      const saved = Number(localStorage.getItem(KEY));
      if (saved >= 0 && saved < SIZES.length) setI(saved);
    } catch {}
  }, []);
  useEffect(() => {
    document.documentElement.style.setProperty("--reader-size", `${SIZES[i]}rem`);
    try {
      localStorage.setItem(KEY, String(i));
    } catch {}
  }, [i]);
  return (
    <span className="row" style={{ gap: 4 }} role="group" aria-label="Text size">
      <button type="button" className="icon-btn" onClick={() => setI((x) => Math.max(0, x - 1))} aria-label="Smaller text" disabled={i === 0}>
        <span style={{ fontFamily: "var(--serif)", fontSize: 13 }}>A</span>
      </button>
      <button type="button" className="icon-btn" onClick={() => setI((x) => Math.min(SIZES.length - 1, x + 1))} aria-label="Larger text" disabled={i === SIZES.length - 1}>
        <span style={{ fontFamily: "var(--serif)", fontSize: 18 }}>A</span>
      </button>
    </span>
  );
}
