"use client";

import { useEffect, useRef, useState } from "react";
import { useVaultStore } from "@/store/useVaultStore";
import { deleteCredential, listItems, saveItem } from "@/lib/credentials";
import {
  deleteFile,
  downloadFile,
  formatBytes,
  MAX_FILE_BYTES,
  normalizeDoc,
  StaleError,
  uploadFile,
} from "@/lib/files";
import type { FileDocPayload, LegacyFilePayload, StoredFile, TextDocPayload } from "@/types";

const INPUT =
  "w-full rounded-xl border border-neutral-300 bg-white px-3.5 py-2.5 text-sm text-neutral-900 outline-none transition focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/15 dark:border-neutral-700 dark:bg-neutral-800 dark:text-neutral-100 dark:focus:border-indigo-400 dark:focus:ring-indigo-400/15";
const ICON_BTN =
  "rounded-lg p-2 text-neutral-400 transition hover:bg-indigo-50 hover:text-indigo-600 dark:hover:bg-indigo-950/40 dark:hover:text-indigo-400";
const DANGER_BTN =
  "rounded-lg p-2 text-neutral-400 transition hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-950/40 dark:hover:text-red-400";
const PRIMARY_BTN =
  "inline-flex items-center justify-center gap-1.5 rounded-xl bg-gradient-to-br from-indigo-600 to-violet-600 px-4 py-2.5 text-sm font-medium text-white shadow-sm shadow-indigo-600/20 transition hover:from-indigo-500 hover:to-violet-500 disabled:opacity-50";
const SECONDARY_BTN =
  "flex-1 rounded-xl border border-neutral-300 px-3 py-2.5 text-sm font-medium text-neutral-600 transition hover:bg-neutral-50 dark:border-neutral-700 dark:text-neutral-300 dark:hover:bg-neutral-800";
const CARD =
  "animate-[fade-in-up_0.4s_ease-out] rounded-xl border border-neutral-200 bg-white p-4 transition hover:border-indigo-200 hover:shadow-md hover:shadow-indigo-900/5 dark:border-neutral-800 dark:bg-neutral-900 dark:hover:border-indigo-900/60";

function Svg({ children, size = 17 }: { children: React.ReactNode; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      {children}
    </svg>
  );
}
const TrashIcon = () => (
  <Svg>
    <path d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2m3 0-1 14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2L4 6h16Z" />
  </Svg>
);
const PencilIcon = () => (
  <Svg>
    <path d="M17 3a2.85 2.85 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z" />
  </Svg>
);
const CopyIcon = () => (
  <Svg>
    <rect x="9" y="9" width="13" height="13" rx="2" />
    <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
  </Svg>
);
const CheckIcon = () => (
  <Svg>
    <path d="M20 6 9 17l-5-5" />
  </Svg>
);
const EyeIcon = () => (
  <Svg>
    <path d="M1 12s4-7 11-7 11 7 11 7-4 7-11 7-11-7-11-7Z" />
    <circle cx="12" cy="12" r="3" />
  </Svg>
);
const DownloadIcon = () => (
  <Svg>
    <path d="M12 3v12m-5-5 5 5 5-5M4 21h16" />
  </Svg>
);
const PlusIcon = () => (
  <Svg size={16}>
    <path d="M12 5v14M5 12h14" />
  </Svg>
);
const SearchIcon = () => (
  <Svg size={16}>
    <circle cx="11" cy="11" r="8" />
    <path d="m21 21-4.3-4.3" />
  </Svg>
);
const FileIcon = () => (
  <Svg size={20}>
    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8Z" />
    <path d="M14 2v6h6" />
  </Svg>
);
const NoteIcon = () => (
  <Svg size={20}>
    <path d="M4 4h16v16H4z" />
    <path d="M8 9h8M8 13h8M8 17h5" />
  </Svg>
);

function byName<T>(get: (x: T) => string) {
  return (a: T, b: T) => get(a).localeCompare(get(b), undefined, { sensitivity: "base" });
}

function SearchBar({
  query,
  setQuery,
  placeholder,
  onAdd,
  addLabel,
}: {
  query: string;
  setQuery: (q: string) => void;
  placeholder: string;
  onAdd: () => void;
  addLabel: string;
}) {
  return (
    <div className="mb-5 flex gap-2">
      <div className="relative flex-1">
        <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400">
          <SearchIcon />
        </span>
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={placeholder}
          className="w-full rounded-xl border border-neutral-200 bg-white py-2.5 pl-9 pr-3 text-sm text-neutral-900 outline-none transition focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/15 dark:border-neutral-800 dark:bg-neutral-900 dark:text-neutral-100"
        />
      </div>
      <button onClick={onAdd} className={PRIMARY_BTN}>
        <PlusIcon />
        <span className="hidden sm:inline">{addLabel}</span>
      </button>
    </div>
  );
}

function Empty({ text, icon }: { text: string; icon: React.ReactNode }) {
  return (
    <div className="flex animate-[fade-in_0.4s_ease-out] flex-col items-center gap-3 rounded-xl border border-dashed border-neutral-300 py-16 text-center dark:border-neutral-800">
      <div className="flex h-14 w-14 items-center justify-center rounded-full bg-indigo-50 text-indigo-400 dark:bg-indigo-950/40 dark:text-indigo-500">
        {icon}
      </div>
      <p className="text-sm text-neutral-400">{text}</p>
    </div>
  );
}

function Modal({ children, onClose, wide }: { children: React.ReactNode; onClose: () => void; wide?: boolean }) {
  return (
    <div
      className="fixed inset-0 z-40 flex items-end justify-center bg-black/40 backdrop-blur-sm sm:items-center sm:p-4"
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className={`max-h-[90dvh] w-full ${wide ? "max-w-3xl" : "max-w-md"} animate-[fade-in-up_0.3s_ease-out] overflow-y-auto rounded-t-2xl border border-neutral-200 bg-white p-6 shadow-xl sm:animate-[scale-in_0.2s_ease-out] sm:rounded-2xl dark:border-neutral-800 dark:bg-neutral-900`}
      >
        {children}
      </div>
    </div>
  );
}

async function confirmDelete(id: string, what: string): Promise<boolean> {
  if (!window.confirm(`Hapus ${what} ini?`)) return false;
  try {
    await deleteCredential(id);
  } catch (e) {
    window.alert((e as Error).message);
  }
  return true;
}

/* ───────────────────────── Text Documents ───────────────────────── */

type TextItem = { id: string; payload: TextDocPayload; updatedAt: number };

export function TextDocsView({ refreshToken, onCount }: { refreshToken: number; onCount: (n: number) => void }) {
  const { key } = useVaultStore();
  const [items, setItems] = useState<TextItem[]>([]);
  const [query, setQuery] = useState("");
  const [editing, setEditing] = useState<TextItem | "new" | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  const refresh = async () => {
    if (!key) return;
    const all = await listItems(key);
    const list = all
      .filter((i): i is typeof i & { payload: TextDocPayload } => "type" in i.payload && i.payload.type === "text")
      .sort(byName((i) => i.payload.title));
    setItems(list);
    onCount(list.length);
  };

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- decrypts the in-memory vault on mount / after sync
    void refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, refreshToken]);

  const copy = async (id: string, text: string) => {
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      return;
    }
    setCopiedId(id);
    setTimeout(() => setCopiedId((c) => (c === id ? null : c)), 1500);
  };

  const q = query.trim().toLowerCase();
  const filtered = items.filter(
    (i) => !q || i.payload.title.toLowerCase().includes(q) || i.payload.content.toLowerCase().includes(q)
  );

  return (
    <>
      <SearchBar
        query={query}
        setQuery={setQuery}
        placeholder="Cari judul atau isi dokumen..."
        onAdd={() => setEditing("new")}
        addLabel="Tambah"
      />
      <ul className="space-y-2">
        {filtered.map((item) => {
          const open = expanded.has(item.id);
          return (
            <li key={item.id} className={CARD}>
              <div className="flex items-start gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-emerald-500 to-teal-500 text-white shadow-sm">
                  <NoteIcon />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-neutral-900 dark:text-neutral-100">
                    {item.payload.title}
                  </p>
                  <p
                    className={`mt-1 whitespace-pre-wrap break-words font-mono text-sm text-neutral-700 dark:text-neutral-300 ${
                      open ? "" : "select-none"
                    }`}
                  >
                    {open ? item.payload.content : "••••••••"}
                  </p>
                </div>
                <div className="flex shrink-0 gap-1">
                  <button
                    onClick={() =>
                      setExpanded((prev) => {
                        const next = new Set(prev);
                        if (next.has(item.id)) next.delete(item.id);
                        else next.add(item.id);
                        return next;
                      })
                    }
                    title={open ? "Sembunyikan" : "Lihat isi"}
                    className={ICON_BTN}
                  >
                    <EyeIcon />
                  </button>
                  <button
                    onClick={() => copy(item.id, item.payload.content)}
                    title="Salin isi"
                    className={copiedId === item.id ? "rounded-lg p-2 text-emerald-600" : ICON_BTN}
                  >
                    {copiedId === item.id ? <CheckIcon /> : <CopyIcon />}
                  </button>
                  <button onClick={() => setEditing(item)} title="Edit" className={ICON_BTN}>
                    <PencilIcon />
                  </button>
                  <button
                    onClick={async () => (await confirmDelete(item.id, "dokumen")) && refresh()}
                    title="Hapus"
                    className={DANGER_BTN}
                  >
                    <TrashIcon />
                  </button>
                </div>
              </div>
            </li>
          );
        })}
        {filtered.length === 0 && (
          <Empty
            icon={<NoteIcon />}
            text={
              items.length === 0
                ? "Belum ada dokumen teks. Simpan mis. nomor KTP, NPWP, rekening."
                : "Tidak ada hasil untuk pencarian ini."
            }
          />
        )}
      </ul>

      {editing && (
        <TextDocForm
          initial={editing === "new" ? undefined : editing}
          onClose={() => setEditing(null)}
          onSaved={async () => {
            setEditing(null);
            await refresh();
          }}
        />
      )}
    </>
  );
}

function TextDocForm({
  initial,
  onClose,
  onSaved,
}: {
  initial?: TextItem;
  onClose: () => void;
  onSaved: () => void;
}) {
  const { key } = useVaultStore();
  const [title, setTitle] = useState(initial?.payload.title ?? "");
  const [content, setContent] = useState(initial?.payload.content ?? "");
  const [saving, setSaving] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!key || !title.trim() || !content) return;
    setSaving(true);
    try {
      await saveItem(key, { type: "text", title: title.trim(), content }, initial?.id);
      onSaved();
    } catch (err) {
      window.alert((err as Error).message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal onClose={onClose}>
      <form onSubmit={submit} autoComplete="off">
        <h2 className="mb-5 text-lg font-semibold text-neutral-900 dark:text-neutral-100">
          {initial ? "Edit Dokumen Teks" : "Tambah Dokumen Teks"}
        </h2>
        <div className="space-y-3">
          <div>
            <label className="mb-1.5 block text-xs font-medium text-neutral-600 dark:text-neutral-400">Judul</label>
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="mis. Nomor KTP"
              autoFocus
              required
              className={INPUT}
            />
          </div>
          <div>
            <label className="mb-1.5 block text-xs font-medium text-neutral-600 dark:text-neutral-400">Isi</label>
            <textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              rows={6}
              required
              className={`${INPUT} resize-y font-mono`}
            />
          </div>
        </div>
        <div className="mt-6 flex gap-2">
          <button type="button" onClick={onClose} className={SECONDARY_BTN}>
            Batal
          </button>
          <button type="submit" disabled={saving} className={`${PRIMARY_BTN} flex-1`}>
            {saving ? "Menyimpan..." : "Simpan"}
          </button>
        </div>
      </form>
    </Modal>
  );
}

/* ───────────────────────── Documents (files) ───────────────────────── */

type DocItem = { id: string; payload: FileDocPayload; updatedAt: number };

const ChevronIcon = ({ left }: { left?: boolean }) => (
  <Svg size={20}>
    <path d={left ? "m15 18-6-6 6-6" : "m9 18 6-6-6-6"} />
  </Svg>
);
const XIcon = () => (
  <Svg size={14}>
    <path d="M18 6 6 18M6 6l12 12" />
  </Svg>
);

function saveBlob(blob: Blob, name: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}

/** Thumbnail from the stored preview; images uploaded without one are decrypted on demand. */
function Thumb({ file, className, onClick }: { file: StoredFile; className: string; onClick?: () => void }) {
  const [lazyUrl, setLazyUrl] = useState<string | null>(null);
  const isImage = file.mime.startsWith("image/");

  useEffect(() => {
    if (file.thumb || !isImage) return;
    let url: string | null = null;
    let cancelled = false;
    downloadFile(file)
      .then((blob) => {
        if (cancelled) return;
        url = URL.createObjectURL(blob);
        setLazyUrl(url);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
      if (url) URL.revokeObjectURL(url);
    };
  }, [file, isImage]);

  const src = file.thumb ?? lazyUrl;
  return (
    <button
      type="button"
      onClick={onClick}
      title={file.name}
      className={`${className} flex shrink-0 items-center justify-center overflow-hidden rounded-lg border border-neutral-200 bg-neutral-100 text-neutral-400 dark:border-neutral-700 dark:bg-neutral-800`}
    >
      {src ? (
        // eslint-disable-next-line @next/next/no-img-element -- local data/blob URL
        <img src={src} alt={file.name} className="h-full w-full object-cover" />
      ) : (
        <span className="flex flex-col items-center gap-0.5 px-1">
          <FileIcon />
          <span className="max-w-full truncate text-[9px] font-medium uppercase">
            {file.name.split(".").pop()}
          </span>
        </span>
      )}
    </button>
  );
}

export function DocumentsView({ refreshToken, onCount }: { refreshToken: number; onCount: (n: number) => void }) {
  const { key } = useVaultStore();
  const [items, setItems] = useState<DocItem[]>([]);
  const [query, setQuery] = useState("");
  const [editing, setEditing] = useState<DocItem | "new" | null>(null);
  const [gallery, setGallery] = useState<{ item: DocItem; index: number } | null>(null);

  const refresh = async () => {
    if (!key) return;
    const all = await listItems(key);
    const list = all
      .flatMap((i) =>
        "type" in i.payload && (i.payload.type === "doc" || i.payload.type === "file")
          ? [{ id: i.id, updatedAt: i.updatedAt, payload: normalizeDoc(i.id, i.payload as FileDocPayload | LegacyFilePayload) }]
          : []
      )
      .sort(byName((i) => i.payload.title));
    setItems(list);
    onCount(list.length);
  };

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- decrypts the in-memory vault on mount / after sync
    void refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, refreshToken]);

  const q = query.trim().toLowerCase();
  const filtered = items.filter(
    (i) =>
      !q ||
      i.payload.title.toLowerCase().includes(q) ||
      (i.payload.notes ?? "").toLowerCase().includes(q) ||
      i.payload.files.some((f) => f.name.toLowerCase().includes(q))
  );

  return (
    <>
      <SearchBar
        query={query}
        setQuery={setQuery}
        placeholder="Cari dokumen, nama file, atau catatan..."
        onAdd={() => setEditing("new")}
        addLabel="Tambah"
      />
      <ul className="space-y-2">
        {filtered.map((item) => {
          const files = item.payload.files;
          const totalSize = files.reduce((n, f) => n + f.size, 0);
          return (
            <li key={item.id} className={CARD}>
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-neutral-900 dark:text-neutral-100">
                    {item.payload.title}
                  </p>
                  <p className="mt-0.5 text-xs text-neutral-500 dark:text-neutral-400">
                    {files.length} file · {formatBytes(totalSize)}
                  </p>
                  {item.payload.notes && (
                    <p className="mt-1 whitespace-pre-wrap break-words text-xs text-neutral-500 dark:text-neutral-400">
                      {item.payload.notes}
                    </p>
                  )}
                </div>
                <div className="flex shrink-0 gap-1">
                  <button onClick={() => setEditing(item)} title="Edit" className={ICON_BTN}>
                    <PencilIcon />
                  </button>
                  <button
                    onClick={async () => (await confirmDelete(item.id, "dokumen beserta semua file-nya")) && refresh()}
                    title="Hapus"
                    className={DANGER_BTN}
                  >
                    <TrashIcon />
                  </button>
                </div>
              </div>
              {files.length > 0 && (
                <div className="mt-3 flex gap-2 overflow-x-auto pb-1">
                  {files.map((f, index) => (
                    <Thumb
                      key={f.id}
                      file={f}
                      className="h-20 w-20 transition hover:opacity-80"
                      onClick={() => setGallery({ item, index })}
                    />
                  ))}
                </div>
              )}
            </li>
          );
        })}
        {filtered.length === 0 && (
          <Empty
            icon={<FileIcon />}
            text={
              items.length === 0
                ? "Belum ada dokumen. Tambahkan mis. KTP dengan beberapa foto, PDF, dll."
                : "Tidak ada hasil untuk pencarian ini."
            }
          />
        )}
      </ul>

      {editing && (
        <DocForm
          initial={editing === "new" ? undefined : editing}
          onClose={() => setEditing(null)}
          onSaved={async () => {
            setEditing(null);
            await refresh();
          }}
        />
      )}
      {gallery && (
        <Gallery
          files={gallery.item.payload.files}
          title={gallery.item.payload.title}
          start={gallery.index}
          onClose={() => setGallery(null)}
        />
      )}
    </>
  );
}

function Gallery({
  files,
  title,
  start,
  onClose,
}: {
  files: StoredFile[];
  title: string;
  start: number;
  onClose: () => void;
}) {
  const [index, setIndex] = useState(start);
  const [loaded, setLoaded] = useState<{ id: string; blob: Blob; url: string } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const file = files[index];
  const current = loaded?.id === file.id ? loaded : null;

  useEffect(() => {
    let url: string | null = null;
    let cancelled = false;
    downloadFile(file)
      .then((blob) => {
        if (cancelled) return;
        url = URL.createObjectURL(blob);
        setError(null);
        setLoaded({ id: file.id, blob, url });
      })
      .catch((e: Error) => !cancelled && setError(e.message));
    return () => {
      cancelled = true;
      if (url) URL.revokeObjectURL(url);
    };
  }, [file]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "ArrowLeft") setIndex((i) => (i - 1 + files.length) % files.length);
      if (e.key === "ArrowRight") setIndex((i) => (i + 1) % files.length);
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [files.length, onClose]);

  const isImage = file.mime.startsWith("image/");

  return (
    <Modal onClose={onClose} wide>
      <div className="mb-3 flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate text-sm font-medium text-neutral-900 dark:text-neutral-100">{title}</p>
          <p className="truncate text-xs text-neutral-500 dark:text-neutral-400">
            {index + 1}/{files.length} · {file.name} · {formatBytes(file.size)}
          </p>
        </div>
        <div className="flex shrink-0 gap-1">
          <button
            onClick={() => current && saveBlob(current.blob, file.name)}
            disabled={!current}
            title="Download"
            className={ICON_BTN}
          >
            <DownloadIcon />
          </button>
          <button onClick={onClose} title="Tutup" className={ICON_BTN}>
            <XIcon />
          </button>
        </div>
      </div>

      <div className="relative flex min-h-[40dvh] items-center justify-center rounded-xl bg-neutral-100 dark:bg-neutral-950">
        {error ? (
          <p className="text-sm text-red-600">{error}</p>
        ) : !current ? (
          <span className="h-6 w-6 animate-spin rounded-full border-2 border-indigo-300 border-t-indigo-600" />
        ) : isImage ? (
          // eslint-disable-next-line @next/next/no-img-element -- decrypted blob URL
          <img src={current.url} alt={file.name} className="max-h-[65dvh] max-w-full rounded-lg object-contain" />
        ) : (
          <div className="flex flex-col items-center gap-3 p-8 text-neutral-500">
            <FileIcon />
            <button onClick={() => window.open(current.url, "_blank", "noopener")} className={PRIMARY_BTN}>
              Buka file
            </button>
          </div>
        )}
        {files.length > 1 && (
          <>
            <button
              onClick={() => setIndex((i) => (i - 1 + files.length) % files.length)}
              className="absolute left-2 top-1/2 -translate-y-1/2 rounded-full bg-black/40 p-1.5 text-white hover:bg-black/60"
              title="Sebelumnya"
            >
              <ChevronIcon left />
            </button>
            <button
              onClick={() => setIndex((i) => (i + 1) % files.length)}
              className="absolute right-2 top-1/2 -translate-y-1/2 rounded-full bg-black/40 p-1.5 text-white hover:bg-black/60"
              title="Berikutnya"
            >
              <ChevronIcon />
            </button>
          </>
        )}
      </div>

      {files.length > 1 && (
        <div className="mt-3 flex gap-2 overflow-x-auto pb-1">
          {files.map((f, i) => (
            <Thumb
              key={f.id}
              file={f}
              onClick={() => setIndex(i)}
              className={`h-14 w-14 ${i === index ? "ring-2 ring-indigo-500" : "opacity-70 hover:opacity-100"}`}
            />
          ))}
        </div>
      )}
    </Modal>
  );
}

type Pending = { key: string; file: File; preview?: string };

function DocForm({ initial, onClose, onSaved }: { initial?: DocItem; onClose: () => void; onSaved: () => void }) {
  const { key } = useVaultStore();
  const [title, setTitle] = useState(initial?.payload.title ?? "");
  const [notes, setNotes] = useState(initial?.payload.notes ?? "");
  const [kept, setKept] = useState<StoredFile[]>(initial?.payload.files ?? []);
  const [pending, setPending] = useState<Pending[]>([]);
  const [saving, setSaving] = useState(false);
  const [progress, setProgress] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const pendingRef = useRef(pending);
  useEffect(() => {
    pendingRef.current = pending;
  }, [pending]);

  useEffect(
    () => () => pendingRef.current.forEach((p) => p.preview && URL.revokeObjectURL(p.preview)),
    []
  );

  const addFiles = (list: FileList | null) => {
    const added = Array.from(list ?? []).map((file) => ({
      key: crypto.randomUUID(),
      file,
      preview: file.type.startsWith("image/") ? URL.createObjectURL(file) : undefined,
    }));
    setPending((prev) => [...prev, ...added]);
    if (inputRef.current) inputRef.current.value = "";
  };

  const removePending = (k: string) =>
    setPending((prev) => {
      const p = prev.find((x) => x.key === k);
      if (p?.preview) URL.revokeObjectURL(p.preview);
      return prev.filter((x) => x.key !== k);
    });

  const tooBig = pending.some((p) => p.file.size > MAX_FILE_BYTES);
  const total = kept.length + pending.length;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!key || !title.trim() || total === 0 || tooBig) return;
    setSaving(true);
    const itemId = initial?.id ?? crypto.randomUUID();
    const uploaded: StoredFile[] = [];
    try {
      for (let i = 0; i < pending.length; i++) {
        setProgress(` ${i + 1}/${pending.length}`);
        uploaded.push(await uploadFile(itemId, pending[i].file));
      }
      setProgress("");
      await saveItem(
        key,
        { type: "doc", title: title.trim(), notes: notes.trim() || undefined, files: [...kept, ...uploaded] },
        itemId
      );
      const keptIds = new Set(kept.map((f) => f.id));
      await Promise.all(
        (initial?.payload.files ?? []).filter((f) => !keptIds.has(f.id) && f.id !== itemId).map((f) => deleteFile(f.id))
      );
      onSaved();
    } catch (err) {
      // Files uploaded before the failure are not referenced by the vault: remove them again.
      await Promise.all(uploaded.map((f) => deleteFile(f.id)));
      if (!(err instanceof StaleError)) window.alert((err as Error).message);
    } finally {
      setSaving(false);
      setProgress("");
    }
  };

  return (
    <Modal onClose={saving ? () => {} : onClose}>
      <form onSubmit={submit} autoComplete="off">
        <h2 className="mb-5 text-lg font-semibold text-neutral-900 dark:text-neutral-100">
          {initial ? "Edit Dokumen" : "Tambah Dokumen"}
        </h2>
        <div className="space-y-3">
          <div>
            <label className="mb-1.5 block text-xs font-medium text-neutral-600 dark:text-neutral-400">
              Nama dokumen
            </label>
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="mis. KTP"
              autoFocus={!initial}
              required
              className={INPUT}
            />
          </div>

          <div>
            <label className="mb-1.5 block text-xs font-medium text-neutral-600 dark:text-neutral-400">
              File ({total})
            </label>
            <div className="grid grid-cols-4 gap-2">
              {kept.map((f) => (
                <div key={f.id} className="relative">
                  <Thumb file={f} className="aspect-square w-full" />
                  <button
                    type="button"
                    onClick={() => setKept((prev) => prev.filter((x) => x.id !== f.id))}
                    title="Hapus file"
                    className="absolute -right-1.5 -top-1.5 rounded-full bg-red-600 p-1 text-white shadow"
                  >
                    <XIcon />
                  </button>
                </div>
              ))}
              {pending.map((p) => (
                <div key={p.key} className="relative">
                  <div
                    title={p.file.name}
                    className={`flex aspect-square w-full items-center justify-center overflow-hidden rounded-lg border bg-neutral-100 text-neutral-400 dark:bg-neutral-800 ${
                      p.file.size > MAX_FILE_BYTES ? "border-red-500" : "border-indigo-300 dark:border-indigo-700"
                    }`}
                  >
                    {p.preview ? (
                      // eslint-disable-next-line @next/next/no-img-element -- local blob URL
                      <img src={p.preview} alt={p.file.name} className="h-full w-full object-cover" />
                    ) : (
                      <span className="flex flex-col items-center gap-0.5 px-1">
                        <FileIcon />
                        <span className="max-w-full truncate text-[9px] uppercase">{p.file.name.split(".").pop()}</span>
                      </span>
                    )}
                  </div>
                  <button
                    type="button"
                    onClick={() => removePending(p.key)}
                    title="Batalkan"
                    className="absolute -right-1.5 -top-1.5 rounded-full bg-red-600 p-1 text-white shadow"
                  >
                    <XIcon />
                  </button>
                </div>
              ))}
              <button
                type="button"
                onClick={() => inputRef.current?.click()}
                className="flex aspect-square w-full flex-col items-center justify-center gap-1 rounded-lg border-2 border-dashed border-neutral-300 text-neutral-400 transition hover:border-indigo-400 hover:text-indigo-600 dark:border-neutral-700"
              >
                <PlusIcon />
                <span className="text-[10px]">Tambah</span>
              </button>
            </div>
            <input ref={inputRef} type="file" multiple className="hidden" onChange={(e) => addFiles(e.target.files)} />
            <p className="mt-1.5 text-xs text-neutral-400">
              Bisa beberapa foto (mis. depan/belakang), PDF, dll. Maks. 10 MB per file.
            </p>
            {tooBig && <p className="mt-1 text-xs text-red-600">Ada file yang melebihi 10 MB.</p>}
          </div>

          <div>
            <label className="mb-1.5 block text-xs font-medium text-neutral-600 dark:text-neutral-400">
              Catatan <span className="text-neutral-400">(opsional)</span>
            </label>
            <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} className={`${INPUT} resize-none`} />
          </div>
        </div>
        <p className="mt-3 text-xs text-neutral-400">File dienkripsi di browser sebelum dikirim ke server.</p>
        <div className="mt-6 flex gap-2">
          <button type="button" onClick={onClose} disabled={saving} className={SECONDARY_BTN}>
            Batal
          </button>
          <button type="submit" disabled={saving || total === 0 || tooBig} className={`${PRIMARY_BTN} flex-1`}>
            {saving ? (progress ? `Mengupload${progress}...` : "Menyimpan...") : "Simpan"}
          </button>
        </div>
      </form>
    </Modal>
  );
}
