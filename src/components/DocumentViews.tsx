"use client";

import { useEffect, useRef, useState } from "react";
import { useVaultStore } from "@/store/useVaultStore";
import { deleteCredential, listItems, saveItem } from "@/lib/credentials";
import { downloadFile, formatBytes, MAX_FILE_BYTES, uploadFile } from "@/lib/files";
import type { FileDocPayload, TextDocPayload } from "@/types";

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

type FileItem = { id: string; payload: FileDocPayload; updatedAt: number };

export function DocumentsView({ refreshToken, onCount }: { refreshToken: number; onCount: (n: number) => void }) {
  const { key } = useVaultStore();
  const [items, setItems] = useState<FileItem[]>([]);
  const [query, setQuery] = useState("");
  const [uploading, setUploading] = useState(false);
  const [editing, setEditing] = useState<FileItem | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [preview, setPreview] = useState<{ item: FileItem; url: string } | null>(null);

  const refresh = async () => {
    if (!key) return;
    const all = await listItems(key);
    const list = all
      .filter((i): i is typeof i & { payload: FileDocPayload } => "type" in i.payload && i.payload.type === "file")
      .sort(byName((i) => i.payload.name));
    setItems(list);
    onCount(list.length);
  };

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- decrypts the in-memory vault on mount / after sync
    void refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, refreshToken]);

  useEffect(() => () => {
    if (preview) URL.revokeObjectURL(preview.url);
  }, [preview]);

  const fetchBlob = async (item: FileItem): Promise<Blob | null> => {
    setBusyId(item.id);
    try {
      return await downloadFile(item.id, item.payload);
    } catch (e) {
      window.alert((e as Error).message);
      return null;
    } finally {
      setBusyId(null);
    }
  };

  const view = async (item: FileItem) => {
    const blob = await fetchBlob(item);
    if (!blob) return;
    const url = URL.createObjectURL(blob);
    if (item.payload.mime.startsWith("image/")) {
      setPreview({ item, url });
    } else {
      window.open(url, "_blank", "noopener");
      setTimeout(() => URL.revokeObjectURL(url), 60_000);
    }
  };

  const download = async (item: FileItem) => {
    const blob = await fetchBlob(item);
    if (!blob) return;
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = item.payload.name;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 10_000);
  };

  const q = query.trim().toLowerCase();
  const filtered = items.filter(
    (i) =>
      !q || i.payload.name.toLowerCase().includes(q) || (i.payload.notes ?? "").toLowerCase().includes(q)
  );

  return (
    <>
      <SearchBar
        query={query}
        setQuery={setQuery}
        placeholder="Cari nama file atau catatan..."
        onAdd={() => setUploading(true)}
        addLabel="Upload"
      />
      <ul className="space-y-2">
        {filtered.map((item) => (
          <li key={item.id} className={CARD}>
            <div className="flex items-start gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-sky-500 to-indigo-500 text-white shadow-sm">
                <FileIcon />
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-neutral-900 dark:text-neutral-100">
                  {item.payload.name}
                </p>
                <p className="mt-0.5 text-xs text-neutral-500 dark:text-neutral-400">
                  {formatBytes(item.payload.size)} · {item.payload.mime}
                </p>
                {item.payload.notes && (
                  <p className="mt-1 whitespace-pre-wrap break-words text-xs text-neutral-500 dark:text-neutral-400">
                    {item.payload.notes}
                  </p>
                )}
              </div>
              <div className="flex shrink-0 gap-1">
                {busyId === item.id ? (
                  <span className="m-2 h-4 w-4 animate-spin rounded-full border-2 border-indigo-300 border-t-indigo-600" />
                ) : (
                  <>
                    <button onClick={() => view(item)} title="Lihat" className={ICON_BTN}>
                      <EyeIcon />
                    </button>
                    <button onClick={() => download(item)} title="Download" className={ICON_BTN}>
                      <DownloadIcon />
                    </button>
                  </>
                )}
                <button onClick={() => setEditing(item)} title="Edit catatan" className={ICON_BTN}>
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
        ))}
        {filtered.length === 0 && (
          <Empty
            icon={<FileIcon />}
            text={
              items.length === 0
                ? "Belum ada dokumen. Upload foto, PDF, atau file lain (maks. 10 MB)."
                : "Tidak ada hasil untuk pencarian ini."
            }
          />
        )}
      </ul>

      {uploading && (
        <UploadForm
          onClose={() => setUploading(false)}
          onSaved={async () => {
            setUploading(false);
            await refresh();
          }}
        />
      )}
      {editing && (
        <FileEditForm
          item={editing}
          onClose={() => setEditing(null)}
          onSaved={async () => {
            setEditing(null);
            await refresh();
          }}
        />
      )}
      {preview && (
        <Modal onClose={() => setPreview(null)} wide>
          <div className="mb-4 flex items-center justify-between gap-3">
            <p className="truncate text-sm font-medium text-neutral-900 dark:text-neutral-100">
              {preview.item.payload.name}
            </p>
            <button onClick={() => setPreview(null)} className={SECONDARY_BTN + " !flex-none"}>
              Tutup
            </button>
          </div>
          {/* eslint-disable-next-line @next/next/no-img-element -- decrypted blob URL */}
          <img src={preview.url} alt={preview.item.payload.name} className="mx-auto max-h-[70dvh] rounded-lg" />
        </Modal>
      )}
    </>
  );
}

function UploadForm({ onClose, onSaved }: { onClose: () => void; onSaved: () => void }) {
  const { key } = useVaultStore();
  const [files, setFiles] = useState<File[]>([]);
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);
  const [progress, setProgress] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  const tooBig = files.filter((f) => f.size > MAX_FILE_BYTES);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!key || files.length === 0 || tooBig.length > 0) return;
    setSaving(true);
    try {
      for (let i = 0; i < files.length; i++) {
        setProgress(`${i + 1}/${files.length}`);
        await uploadFile(key, files[i], notes.trim());
      }
      onSaved();
    } catch (err) {
      window.alert((err as Error).message);
    } finally {
      setSaving(false);
      setProgress("");
    }
  };

  return (
    <Modal onClose={saving ? () => {} : onClose}>
      <form onSubmit={submit}>
        <h2 className="mb-5 text-lg font-semibold text-neutral-900 dark:text-neutral-100">Upload Dokumen</h2>
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          className="flex w-full flex-col items-center gap-2 rounded-xl border-2 border-dashed border-neutral-300 px-4 py-8 text-sm text-neutral-500 transition hover:border-indigo-400 hover:text-indigo-600 dark:border-neutral-700"
        >
          <FileIcon />
          {files.length === 0 ? "Pilih file (foto, PDF, dll — maks. 10 MB)" : `${files.length} file dipilih`}
        </button>
        <input
          ref={inputRef}
          type="file"
          multiple
          className="hidden"
          onChange={(e) => setFiles(Array.from(e.target.files ?? []))}
        />
        {files.length > 0 && (
          <ul className="mt-3 space-y-1 text-xs">
            {files.map((f) => (
              <li
                key={f.name + f.size}
                className={`flex justify-between gap-2 ${f.size > MAX_FILE_BYTES ? "text-red-600" : "text-neutral-600 dark:text-neutral-400"}`}
              >
                <span className="truncate">{f.name}</span>
                <span className="shrink-0">{formatBytes(f.size)}</span>
              </li>
            ))}
          </ul>
        )}
        {tooBig.length > 0 && <p className="mt-2 text-xs text-red-600">File melebihi batas 10 MB.</p>}
        <div className="mt-4">
          <label className="mb-1.5 block text-xs font-medium text-neutral-600 dark:text-neutral-400">
            Catatan <span className="text-neutral-400">(opsional)</span>
          </label>
          <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} className={`${INPUT} resize-none`} />
        </div>
        <p className="mt-3 text-xs text-neutral-400">File dienkripsi di browser sebelum dikirim ke server.</p>
        <div className="mt-6 flex gap-2">
          <button type="button" onClick={onClose} disabled={saving} className={SECONDARY_BTN}>
            Batal
          </button>
          <button
            type="submit"
            disabled={saving || files.length === 0 || tooBig.length > 0}
            className={`${PRIMARY_BTN} flex-1`}
          >
            {saving ? `Mengupload ${progress}...` : "Upload"}
          </button>
        </div>
      </form>
    </Modal>
  );
}

function FileEditForm({ item, onClose, onSaved }: { item: FileItem; onClose: () => void; onSaved: () => void }) {
  const { key } = useVaultStore();
  const [name, setName] = useState(item.payload.name);
  const [notes, setNotes] = useState(item.payload.notes ?? "");
  const [saving, setSaving] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!key || !name.trim()) return;
    setSaving(true);
    try {
      await saveItem(key, { ...item.payload, name: name.trim(), notes: notes.trim() || undefined }, item.id);
      onSaved();
    } catch (err) {
      window.alert((err as Error).message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal onClose={onClose}>
      <form onSubmit={submit}>
        <h2 className="mb-5 text-lg font-semibold text-neutral-900 dark:text-neutral-100">Edit Dokumen</h2>
        <div className="space-y-3">
          <div>
            <label className="mb-1.5 block text-xs font-medium text-neutral-600 dark:text-neutral-400">Nama file</label>
            <input value={name} onChange={(e) => setName(e.target.value)} required className={INPUT} />
          </div>
          <div>
            <label className="mb-1.5 block text-xs font-medium text-neutral-600 dark:text-neutral-400">Catatan</label>
            <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={3} className={`${INPUT} resize-none`} />
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
