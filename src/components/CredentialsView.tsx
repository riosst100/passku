"use client";

import { useEffect, useRef, useState } from "react";
import { useVaultStore } from "@/store/useVaultStore";
import {
  listCredentials,
  saveCredential,
  deleteCredential,
  syncCredentials,
  getLastSyncedAt,
} from "@/lib/credentials";
import { DevicesPanel } from "@/components/DevicesPanel";
import { detectNewSessions } from "@/lib/knownSessions";
import type { CredentialPayload } from "@/types";

interface SessionSummary {
  id: string;
  ip: string | null;
  userAgent: string | null;
  revoked: boolean;
  current: boolean;
}

interface Entry {
  id: string;
  site: string;
  payload: CredentialPayload;
  updatedAt: number;
}

function EyeIcon({ open }: { open: boolean }) {
  return open ? (
    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M1 12s4-7 11-7 11 7 11 7-4 7-11 7-11-7-11-7Z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  ) : (
    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M17.94 17.94A10.94 10.94 0 0 1 12 20c-7 0-11-8-11-8a20.3 20.3 0 0 1 5.06-6.06M9.9 4.24A10.94 10.94 0 0 1 12 4c7 0 11 8 11 8a20.4 20.4 0 0 1-3.22 4.44" />
      <path d="M14.12 14.12a3 3 0 1 1-4.24-4.24" />
      <path d="M1 1l22 22" />
    </svg>
  );
}

function TrashIcon() {
  return (
    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M3 6h18" />
      <path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2m3 0-1 14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2L4 6h16Z" />
      <path d="M10 11v6M14 11v6" />
    </svg>
  );
}

function PencilIcon() {
  return (
    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M17 3a2.85 2.85 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z" />
    </svg>
  );
}

function CopyIcon() {
  return (
    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <rect x="9" y="9" width="13" height="13" rx="2" />
      <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
    </svg>
  );
}

function CheckIcon() {
  return (
    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M20 6 9 17l-5-5" />
    </svg>
  );
}

function SearchIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <circle cx="11" cy="11" r="8" />
      <path d="m21 21-4.3-4.3" />
    </svg>
  );
}

function PlusIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
      <path d="M12 5v14M5 12h14" />
    </svg>
  );
}

function LockClosedIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <rect x="4" y="11" width="16" height="10" rx="2" />
      <path d="M8 11V7a4 4 0 0 1 8 0v4" />
    </svg>
  );
}

function DeviceIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <rect x="4" y="2" width="16" height="20" rx="2" />
      <path d="M10 18h4" />
    </svg>
  );
}

function CloseIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M18 6 6 18M6 6l12 12" />
    </svg>
  );
}

function KeyholeIcon() {
  return (
    <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
      <circle cx="12" cy="8" r="4" />
      <path d="M12 12v6M9.5 15.5 12 18l2.5-2.5" />
    </svg>
  );
}

const AVATAR_PALETTE = [
  "from-indigo-500 to-violet-500",
  "from-fuchsia-500 to-pink-500",
  "from-sky-500 to-indigo-500",
  "from-emerald-500 to-teal-500",
  "from-amber-500 to-orange-500",
  "from-rose-500 to-red-500",
];

function avatarGradient(site: string): string {
  let hash = 0;
  for (let i = 0; i < site.length; i++) hash = (hash * 31 + site.charCodeAt(i)) >>> 0;
  return AVATAR_PALETTE[hash % AVATAR_PALETTE.length];
}

function formatLastSync(ts: number | null): string {
  if (!ts) return "belum pernah";
  return (
    new Intl.DateTimeFormat("id-ID", {
      hour: "2-digit",
      minute: "2-digit",
      timeZone: "Asia/Jakarta",
    }).format(ts) + " WIB"
  );
}

export function CredentialsView() {
  const { key, lock } = useVaultStore();
  const [entries, setEntries] = useState<Entry[]>([]);
  const [query, setQuery] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [showDevices, setShowDevices] = useState(false);
  const [editing, setEditing] = useState<Entry | null>(null);
  const [revealed, setRevealed] = useState<Set<string>>(new Set());
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [online, setOnline] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [lastSyncedAt, setLastSyncedAtState] = useState<number | null>(null);
  const [deviceCount, setDeviceCount] = useState<number | null>(null);
  const [newSessionAlert, setNewSessionAlert] = useState<SessionSummary[] | null>(null);
  const revealTimers = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());
  const copyTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const refresh = async () => {
    if (!key) return;
    setEntries(await listCredentials(key));
    setLastSyncedAtState(getLastSyncedAt());
  };

  const refreshDeviceCount = async (checkForNewSessions = false) => {
    try {
      const res = await fetch("/api/sessions");
      if (!res.ok) return;
      const rows = (await res.json()) as SessionSummary[];
      setDeviceCount(rows.filter((r) => !r.revoked).length);

      if (checkForNewSessions) {
        const currentId = rows.find((r) => r.current)?.id ?? null;
        const newIds = detectNewSessions(
          rows.filter((r) => !r.revoked).map((r) => r.id),
          currentId
        );
        if (newIds.length > 0) {
          setNewSessionAlert(rows.filter((r) => newIds.includes(r.id)));
        }
      }
    } catch {
      // leave previous count as-is
    }
  };

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- initial render of the credentials pulled at unlock
    void refresh();
    void refreshDeviceCount(true);
    setOnline(navigator.onLine);
    const onOnline = () => {
      setOnline(true);
      setSyncing(true);
      void syncCredentials()
        .then(refresh)
        .finally(() => setSyncing(false));
    };
    const onOffline = () => setOnline(false);
    window.addEventListener("online", onOnline);
    window.addEventListener("offline", onOffline);
    return () => {
      window.removeEventListener("online", onOnline);
      window.removeEventListener("offline", onOffline);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  useEffect(() => {
    const timers = revealTimers.current;
    return () => {
      timers.forEach((t) => clearTimeout(t));
      if (copyTimer.current) clearTimeout(copyTimer.current);
    };
  }, []);

  const q = query.trim().toLowerCase();
  const filtered = entries.filter((e) => {
    if (!q) return true;
    return (
      e.site.toLowerCase().includes(q) ||
      e.payload.username.toLowerCase().includes(q) ||
      (e.payload.phone ?? "").toLowerCase().includes(q)
    );
  });

  const revealTemporarily = (id: string) => {
    setRevealed((prev) => new Set(prev).add(id));
    const existing = revealTimers.current.get(id);
    if (existing) clearTimeout(existing);
    const timer = setTimeout(() => {
      setRevealed((prev) => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
      revealTimers.current.delete(id);
    }, 500);
    revealTimers.current.set(id, timer);
  };

  const copyPassword = async (id: string, password: string) => {
    try {
      await navigator.clipboard.writeText(password);
    } catch {
      return;
    }
    setCopiedId(id);
    if (copyTimer.current) clearTimeout(copyTimer.current);
    copyTimer.current = setTimeout(() => setCopiedId(null), 1500);

    setTimeout(async () => {
      try {
        if ((await navigator.clipboard.readText()) === password) {
          await navigator.clipboard.writeText("");
        }
      } catch {
        // clipboard read permission denied; nothing we can do
      }
    }, 20_000);
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm("Hapus credential ini?")) return;
    try {
      await deleteCredential(id);
    } catch (e) {
      window.alert((e as Error).message);
    }
    await refresh();
  };

  const closeForm = () => {
    setShowForm(false);
    setEditing(null);
  };

  return (
    <div className="min-h-dvh bg-neutral-50 dark:bg-neutral-950">
      <div className="mx-auto max-w-2xl px-4 py-6 sm:py-10">
        {newSessionAlert && newSessionAlert.length > 0 && (
          <div className="mb-4 animate-[fade-in-up_0.3s_ease-out] rounded-xl border border-amber-200 bg-amber-50 p-4 dark:border-amber-900/60 dark:bg-amber-950/40">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="text-sm font-medium text-amber-800 dark:text-amber-300">
                  {newSessionAlert.length === 1
                    ? "Sesi login baru terdeteksi"
                    : `${newSessionAlert.length} sesi login baru terdeteksi`}
                </p>
                <ul className="mt-1.5 space-y-0.5 text-xs text-amber-700 dark:text-amber-400">
                  {newSessionAlert.map((s) => (
                    <li key={s.id} className="truncate">
                      {s.ip ?? "IP tidak diketahui"} · {s.userAgent ?? "User agent tidak diketahui"}
                    </li>
                  ))}
                </ul>
                <p className="mt-1.5 text-xs text-amber-700 dark:text-amber-400">
                  Bukan kamu? Buka <span className="font-medium">Devices</span> untuk memblokir aksesnya.
                </p>
              </div>
              <button
                onClick={() => setNewSessionAlert(null)}
                title="Tutup"
                className="shrink-0 rounded-lg p-1.5 text-amber-600 transition hover:bg-amber-100 dark:text-amber-400 dark:hover:bg-amber-900/40"
              >
                <CloseIcon />
              </button>
            </div>
          </div>
        )}

        {/* Header */}
        <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-2xl font-semibold tracking-tight text-neutral-900 dark:text-neutral-100">
                Passku
              </h1>
              <span className="inline-flex items-center gap-1.5 rounded-full border border-neutral-200 bg-white px-2.5 py-1 text-xs font-medium text-neutral-500 dark:border-neutral-800 dark:bg-neutral-900 dark:text-neutral-400">
                {syncing ? (
                  <span className="h-2.5 w-2.5 animate-spin rounded-full border-[1.5px] border-indigo-300 border-t-indigo-600 dark:border-indigo-800 dark:border-t-indigo-400" />
                ) : (
                  <span
                    className={`h-1.5 w-1.5 rounded-full ${online ? "bg-emerald-500" : "bg-neutral-400"}`}
                  />
                )}
                {syncing ? "Menyinkronkan..." : online ? "Online" : "Offline"}
              </span>
            </div>
            <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-neutral-500 dark:text-neutral-400">
              <span>{entries.length} credentials</span>
              <span className="text-neutral-300 dark:text-neutral-700">·</span>
              <span>sync terakhir {formatLastSync(lastSyncedAt)}</span>
            </div>
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => setShowDevices(true)}
              className="inline-flex items-center gap-1.5 rounded-lg border border-neutral-200 bg-white px-3 py-2 text-xs font-medium text-neutral-600 transition hover:bg-neutral-100 dark:border-neutral-800 dark:bg-neutral-900 dark:text-neutral-300 dark:hover:bg-neutral-800"
            >
              <DeviceIcon />
              Devices
              {deviceCount !== null && (
                <span className="inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-indigo-100 px-1 text-[10px] font-semibold text-indigo-700 dark:bg-indigo-900/50 dark:text-indigo-300">
                  {deviceCount}
                </span>
              )}
            </button>
            <button
              onClick={lock}
              className="inline-flex items-center gap-1.5 rounded-lg border border-neutral-200 bg-white px-3 py-2 text-xs font-medium text-neutral-600 transition hover:bg-neutral-100 dark:border-neutral-800 dark:bg-neutral-900 dark:text-neutral-300 dark:hover:bg-neutral-800"
            >
              <LockClosedIcon />
              Lock
            </button>
          </div>
        </div>

        {/* Search + add */}
        <div className="mb-5 flex gap-2">
          <div className="relative flex-1">
            <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400">
              <SearchIcon />
            </span>
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Cari site, username/email, atau nomor HP..."
              className="w-full rounded-xl border border-neutral-200 bg-white py-2.5 pl-9 pr-3 text-sm text-neutral-900 outline-none transition focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/15 dark:border-neutral-800 dark:bg-neutral-900 dark:text-neutral-100 dark:focus:border-indigo-400 dark:focus:ring-indigo-400/15"
            />
          </div>
          <button
            onClick={() => {
              setEditing(null);
              setShowForm(true);
            }}
            className="inline-flex items-center gap-1.5 rounded-xl bg-gradient-to-br from-indigo-600 to-violet-600 px-4 py-2.5 text-sm font-medium text-white shadow-sm shadow-indigo-600/20 transition hover:from-indigo-500 hover:to-violet-500"
          >
            <PlusIcon />
            <span className="hidden sm:inline">Tambah</span>
          </button>
        </div>

        {/* List */}
        <ul className="space-y-2">
          {filtered.map((entry, i) => (
            <li
              key={entry.id}
              style={{ animationDelay: `${Math.min(i, 8) * 40}ms`, animationFillMode: "backwards" }}
              className="group animate-[fade-in-up_0.4s_ease-out] rounded-xl border border-neutral-200 bg-white p-4 transition hover:border-indigo-200 hover:shadow-md hover:shadow-indigo-900/5 dark:border-neutral-800 dark:bg-neutral-900 dark:hover:border-indigo-900/60"
            >
              <div className="flex items-start gap-3">
                <div
                  className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-gradient-to-br ${avatarGradient(entry.site)} text-sm font-semibold text-white shadow-sm`}
                >
                  {entry.site.charAt(0).toUpperCase()}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="flex flex-wrap items-center gap-2 text-sm font-medium text-neutral-900 dark:text-neutral-100">
                    <span className="truncate">{entry.site}</span>
                  </p>
                  <p className="mt-0.5 truncate text-xs text-neutral-500 dark:text-neutral-400">
                    {entry.payload.username}
                  </p>
                  {entry.payload.phone && (
                    <p className="truncate text-xs text-neutral-500 dark:text-neutral-400">
                      {entry.payload.phone}
                    </p>
                  )}
                  <p
                    className={`mt-1.5 select-none font-mono text-sm tracking-wide text-neutral-700 dark:text-neutral-300 ${
                      revealed.has(entry.id) ? "animate-[pulse-once_0.3s_ease-out]" : ""
                    }`}
                  >
                    {revealed.has(entry.id) ? entry.payload.password : "••••••••"}
                  </p>
                  {entry.payload.url && (
                    <a
                      href={
                        /^https?:\/\//i.test(entry.payload.url)
                          ? entry.payload.url
                          : `https://${entry.payload.url}`
                      }
                      target="_blank"
                      rel="noopener noreferrer"
                      onClick={(e) => e.stopPropagation()}
                      className="mt-1 block truncate text-xs text-indigo-600 hover:underline dark:text-indigo-400"
                    >
                      {entry.payload.url}
                    </a>
                  )}
                </div>
                <div className="flex shrink-0 gap-1">
                  <button
                    onClick={() => revealTemporarily(entry.id)}
                    title="Lihat password (0.5 detik)"
                    className="rounded-lg p-2 text-neutral-400 transition hover:bg-indigo-50 hover:text-indigo-600 dark:hover:bg-indigo-950/40 dark:hover:text-indigo-400"
                  >
                    <EyeIcon open={revealed.has(entry.id)} />
                  </button>
                  <button
                    onClick={() => copyPassword(entry.id, entry.payload.password)}
                    title="Salin password"
                    className={`rounded-lg p-2 transition ${
                      copiedId === entry.id
                        ? "text-emerald-600 dark:text-emerald-400"
                        : "text-neutral-400 hover:bg-indigo-50 hover:text-indigo-600 dark:hover:bg-indigo-950/40 dark:hover:text-indigo-400"
                    }`}
                  >
                    {copiedId === entry.id ? <CheckIcon /> : <CopyIcon />}
                  </button>
                  <button
                    onClick={() => {
                      setEditing(entry);
                      setShowForm(true);
                    }}
                    title="Edit"
                    className="rounded-lg p-2 text-neutral-400 transition hover:bg-indigo-50 hover:text-indigo-600 dark:hover:bg-indigo-950/40 dark:hover:text-indigo-400"
                  >
                    <PencilIcon />
                  </button>
                  <button
                    onClick={() => handleDelete(entry.id)}
                    title="Hapus"
                    className="rounded-lg p-2 text-neutral-400 transition hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-950/40 dark:hover:text-red-400"
                  >
                    <TrashIcon />
                  </button>
                </div>
              </div>
            </li>
          ))}
          {filtered.length === 0 && (
            <div className="flex animate-[fade-in_0.4s_ease-out] flex-col items-center gap-3 rounded-xl border border-dashed border-neutral-300 py-16 text-center dark:border-neutral-800">
              <div className="flex h-14 w-14 items-center justify-center rounded-full bg-indigo-50 text-indigo-400 dark:bg-indigo-950/40 dark:text-indigo-500">
                <KeyholeIcon />
              </div>
              <p className="text-sm text-neutral-400">
                {entries.length === 0
                  ? "Belum ada credentials. Tambahkan yang pertama."
                  : "Tidak ada hasil untuk pencarian ini."}
              </p>
            </div>
          )}
        </ul>
      </div>

      {showForm && (
        <CredentialFormModal
          initial={editing ?? undefined}
          onCancel={closeForm}
          onSaved={async () => {
            closeForm();
            await refresh();
          }}
        />
      )}

      {showDevices && (
        <DevicesPanel
          onClose={() => {
            setShowDevices(false);
            void refreshDeviceCount();
          }}
        />
      )}
    </div>
  );
}

function CredentialFormModal({
  initial,
  onSaved,
  onCancel,
}: {
  initial?: Entry;
  onSaved: () => void;
  onCancel: () => void;
}) {
  const { key } = useVaultStore();
  const [site, setSite] = useState(initial?.site ?? "");
  const [username, setUsername] = useState(initial?.payload.username ?? "");
  const [password, setPassword] = useState(initial?.payload.password ?? "");
  const [phone, setPhone] = useState(initial?.payload.phone ?? "");
  const [url, setUrl] = useState(initial?.payload.url ?? "");
  const [notes, setNotes] = useState(initial?.payload.notes ?? "");
  const [saving, setSaving] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!key || !site || !username || !password) return;
    setSaving(true);
    try {
      await saveCredential(key, site, { username, password, phone, url, notes }, initial?.id);
      onSaved();
    } catch (e) {
      // Online-only: nothing is queued locally, so the form stays open for a retry.
      window.alert((e as Error).message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-40 flex items-end justify-center bg-black/40 backdrop-blur-sm sm:items-center sm:p-4"
      onClick={onCancel}
    >
      <form
        onClick={(e) => e.stopPropagation()}
        onSubmit={handleSubmit}
        className="max-h-[90dvh] w-full max-w-md animate-[fade-in-up_0.3s_ease-out] overflow-y-auto rounded-t-2xl border border-neutral-200 bg-white p-6 shadow-xl sm:animate-[scale-in_0.2s_ease-out] sm:rounded-2xl dark:border-neutral-800 dark:bg-neutral-900"
      >
        <h2 className="mb-5 text-lg font-semibold text-neutral-900 dark:text-neutral-100">
          {initial ? "Edit Credential" : "Tambah Credential"}
        </h2>

        {/* Decoy fields: absorb Chrome's autofill/save-password heuristics
            before they reach the real fields below. Hidden off-screen, not
            display:none, so the browser still considers them real inputs. */}
        <div
          aria-hidden="true"
          style={{ position: "absolute", width: 1, height: 1, overflow: "hidden", clip: "rect(0,0,0,0)" }}
        >
          <input type="text" name="username" tabIndex={-1} autoComplete="username" />
          <input type="password" name="password" tabIndex={-1} autoComplete="current-password" />
        </div>

        <div className="space-y-3">
          <div>
            <label className="mb-1.5 block text-xs font-medium text-neutral-600 dark:text-neutral-400">
              Site / Aplikasi
            </label>
            <input
              value={site}
              onChange={(e) => setSite(e.target.value)}
              placeholder="mis. Gmail"
              autoFocus
              autoComplete="off"
              name="passku-site"
              className="w-full rounded-xl border border-neutral-300 bg-white px-3.5 py-2.5 text-sm text-neutral-900 outline-none transition focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/15 dark:border-neutral-700 dark:bg-neutral-800 dark:text-neutral-100 dark:focus:border-indigo-400 dark:focus:ring-indigo-400/15"
              required
            />
          </div>
          <div>
            <label className="mb-1.5 block text-xs font-medium text-neutral-600 dark:text-neutral-400">
              Username / Email
            </label>
            <input
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              autoComplete="off"
              name="passku-account-username"
              className="w-full rounded-xl border border-neutral-300 bg-white px-3.5 py-2.5 text-sm text-neutral-900 outline-none transition focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/15 dark:border-neutral-700 dark:bg-neutral-800 dark:text-neutral-100 dark:focus:border-indigo-400 dark:focus:ring-indigo-400/15"
              required
            />
          </div>
          <div>
            <label className="mb-1.5 block text-xs font-medium text-neutral-600 dark:text-neutral-400">
              Password
            </label>
            <div className="relative">
              <input
                type={showPassword ? "text" : "password"}
                autoComplete="off"
                name="passku-account-secret"
                data-lpignore="true"
                data-1p-ignore
                data-bwignore
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full rounded-xl border border-neutral-300 bg-white px-3.5 py-2.5 pr-10 text-sm font-mono text-neutral-900 outline-none transition focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/15 dark:border-neutral-700 dark:bg-neutral-800 dark:text-neutral-100 dark:focus:border-indigo-400 dark:focus:ring-indigo-400/15"
                required
              />
              <button
                type="button"
                onClick={() => setShowPassword((v) => !v)}
                title={showPassword ? "Sembunyikan" : "Lihat password"}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-neutral-400 transition hover:text-indigo-600 dark:hover:text-indigo-400"
              >
                <EyeIcon open={showPassword} />
              </button>
            </div>
          </div>
          <div>
            <label className="mb-1.5 block text-xs font-medium text-neutral-600 dark:text-neutral-400">
              Nomor HP <span className="text-neutral-400">(opsional)</span>
            </label>
            <input
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              className="w-full rounded-xl border border-neutral-300 bg-white px-3.5 py-2.5 text-sm text-neutral-900 outline-none transition focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/15 dark:border-neutral-700 dark:bg-neutral-800 dark:text-neutral-100 dark:focus:border-indigo-400 dark:focus:ring-indigo-400/15"
            />
          </div>
          <div>
            <label className="mb-1.5 block text-xs font-medium text-neutral-600 dark:text-neutral-400">
              URL <span className="text-neutral-400">(opsional)</span>
            </label>
            <input
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              className="w-full rounded-xl border border-neutral-300 bg-white px-3.5 py-2.5 text-sm text-neutral-900 outline-none transition focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/15 dark:border-neutral-700 dark:bg-neutral-800 dark:text-neutral-100 dark:focus:border-indigo-400 dark:focus:ring-indigo-400/15"
            />
          </div>
          <div>
            <label className="mb-1.5 block text-xs font-medium text-neutral-600 dark:text-neutral-400">
              Catatan <span className="text-neutral-400">(opsional)</span>
            </label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
              className="w-full resize-none rounded-xl border border-neutral-300 bg-white px-3.5 py-2.5 text-sm text-neutral-900 outline-none transition focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/15 dark:border-neutral-700 dark:bg-neutral-800 dark:text-neutral-100 dark:focus:border-indigo-400 dark:focus:ring-indigo-400/15"
            />
          </div>
        </div>

        <div className="mt-6 flex gap-2">
          <button
            type="button"
            onClick={onCancel}
            className="flex-1 rounded-xl border border-neutral-300 px-3 py-2.5 text-sm font-medium text-neutral-600 transition hover:bg-neutral-50 dark:border-neutral-700 dark:text-neutral-300 dark:hover:bg-neutral-800"
          >
            Batal
          </button>
          <button
            type="submit"
            disabled={saving}
            className="flex-1 rounded-xl bg-gradient-to-br from-indigo-600 to-violet-600 px-3 py-2.5 text-sm font-medium text-white shadow-sm shadow-indigo-600/20 transition hover:from-indigo-500 hover:to-violet-500 disabled:opacity-50"
          >
            {saving ? "Menyimpan..." : "Simpan"}
          </button>
        </div>
      </form>
    </div>
  );
}
