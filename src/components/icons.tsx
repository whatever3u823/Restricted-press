/** Line icons, drawn on a 16-unit grid with one stroke weight. */
type P = { className?: string };
const base = { width: 16, height: 16, viewBox: "0 0 16 16", fill: "none", stroke: "currentColor", strokeWidth: 1.3, strokeLinecap: "round", strokeLinejoin: "round", "aria-hidden": true } as const;

export const LibraryIcon = (p: P) => (
  <svg {...base} {...p}><path d="M2.5 2.5v11M5.5 2.5v11M8.5 3l3.2 10.4M13.5 13.5h-11" /></svg>
);
export const ArchivistIcon = (p: P) => (
  <svg {...base} {...p}><path d="M8 1.8 9.4 6.6 14.2 8 9.4 9.4 8 14.2 6.6 9.4 1.8 8 6.6 6.6z" /></svg>
);
export const ConnectionsIcon = (p: P) => (
  <svg {...base} {...p}><circle cx="3.5" cy="4" r="1.7" /><circle cx="12.5" cy="4" r="1.7" /><circle cx="8" cy="12.5" r="1.7" /><path d="M5.2 4h5.6M4.4 5.5l2.7 5.4M11.6 5.5l-2.7 5.4" /></svg>
);
export const HighlightIcon = (p: P) => (
  <svg {...base} {...p}><path d="M4 2.5h8v11l-4-2.8-4 2.8z" /></svg>
);
export const SearchIcon = (p: P) => (
  <svg {...base} {...p}><circle cx="7" cy="7" r="4.6" /><path d="m10.4 10.4 3.6 3.6" /></svg>
);
export const PlusIcon = (p: P) => (
  <svg {...base} {...p}><path d="M8 3v10M3 8h10" /></svg>
);
export const UploadIcon = (p: P) => (
  <svg {...base} {...p}><path d="M8 10.5V2.5M4.8 5.6 8 2.4l3.2 3.2M2.5 10.5v3h11v-3" /></svg>
);
export const FolderIcon = (p: P) => (
  <svg {...base} {...p}><path d="M2 4.5h4l1.2 1.4H14v7.6H2z" /></svg>
);
export const AccountIcon = (p: P) => (
  <svg {...base} {...p}><circle cx="8" cy="5.5" r="2.7" /><path d="M2.8 14c.6-2.6 2.7-4.2 5.2-4.2s4.6 1.6 5.2 4.2" /></svg>
);
export const MenuIcon = (p: P) => (
  <svg {...base} {...p}><path d="M2.5 5h11M2.5 11h11" /></svg>
);
export const CloseIcon = (p: P) => (
  <svg {...base} {...p}><path d="m4 4 8 8M12 4l-8 8" /></svg>
);
export const ArrowLeftIcon = (p: P) => (
  <svg {...base} {...p}><path d="M13 8H3M7 4 3 8l4 4" /></svg>
);
export const ArrowRightIcon = (p: P) => (
  <svg {...base} {...p}><path d="M3 8h10M9 4l4 4-4 4" /></svg>
);
export const TocIcon = (p: P) => (
  <svg {...base} {...p}><path d="M2.5 4h1M6 4h7.5M2.5 8h1M6 8h7.5M2.5 12h1M6 12h7.5" /></svg>
);
export const TypeIcon = (p: P) => (
  <svg {...base} {...p}><path d="M2 13 5.5 3h1L10 13M3.3 9.5h5.4M10.5 13l2-5.5h.3l2 5.5M11.2 11.3h3" /></svg>
);
export const AskIcon = (p: P) => (
  <svg {...base} {...p}><path d="M2.5 3h11v7.5H8L5 13v-2.5H2.5z" /></svg>
);
export const TrashIcon = (p: P) => (
  <svg {...base} {...p}><path d="M3 4.5h10M6.5 4.5V3h3v1.5M4.5 4.5l.6 9h5.8l.6-9" /></svg>
);
export const EditIcon = (p: P) => (
  <svg {...base} {...p}><path d="M10.5 2.8 13.2 5.5 6 12.7l-3.2.5.5-3.2z" /></svg>
);
export const NoteIcon = (p: P) => (
  <svg {...base} {...p}><path d="M3 2.5h10v8l-3 3H3zM10 13.5v-3h3M5.5 6h5M5.5 8.5h3" /></svg>
);
export const DocIcon = (p: P) => (
  <svg {...base} {...p}><path d="M3.5 1.8h6l3 3v9.4h-9zM9.5 1.8v3h3" /></svg>
);
export const CheckIcon = (p: P) => (
  <svg {...base} {...p}><path d="m3 8.5 3.2 3L13 4.5" /></svg>
);
export const ReturnIcon = (p: P) => (
  <svg {...base} {...p}><path d="M13 3.5v4.5H3.5M6.5 5 3.5 8l3 3" /></svg>
);
