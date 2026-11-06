"use client";

import { useEffect, useRef, useState } from "react";
import { useVaultStore } from "@/store/useVaultStore";
import { IdleLockWatcher } from "@/components/IdleLockWatcher";

function LockIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <rect x="4" y="11" width="16" height="10" rx="2" />
      <path d="M8 11V7a4 4 0 0 1 8 0v4" />
    </svg>
  );
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

export function VaultGate({ children }: { children: React.ReactNode }) {
  const { status, error, syncing, init, setupMasterPassword, unlock } = useVaultStore();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [revealPassword, setRevealPassword] = useState(false);
  const [revealConfirm, setRevealConfirm] = useState(false);
  const [online, setOnline] = useState(true);
  const revealTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const confirmRevealTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    init();
  }, [init]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- reading current online status on mount
    setOnline(navigator.onLine);
    const onOnline = () => setOnline(true);
    const onOffline = () => setOnline(false);
    window.addEventListener("online", onOnline);
    window.addEventListener("offline", onOffline);
    return () => {
      window.removeEventListener("online", onOnline);
      window.removeEventListener("offline", onOffline);
    };
  }, []);

  useEffect(() => {
    const timers = [revealTimer, confirmRevealTimer];
    return () => {
      timers.forEach((ref) => {
        if (ref.current) clearTimeout(ref.current);
      });
    };
  }, []);

  const revealBriefly = (
    setter: (v: boolean) => void,
    timerRef: React.RefObject<ReturnType<typeof setTimeout> | null>
  ) => {
    setter(true);
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => setter(false), 500);
  };

  if (status === "checking") {
    return (
      <div className="flex min-h-dvh items-center justify-center bg-gradient-to-br from-indigo-50 via-white to-neutral-50 dark:from-neutral-950 dark:via-neutral-950 dark:to-indigo-950/20">
        <div className="flex flex-col items-center gap-3 text-sm text-neutral-500 dark:text-neutral-400">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-neutral-200 border-t-indigo-600 dark:border-neutral-800 dark:border-t-indigo-400" />
          {syncing ? "Menyinkronkan credentials..." : "Memuat vault..."}
        </div>
      </div>
    );
  }

  if (status === "unlocked") {
    return (
      <>
        <IdleLockWatcher />
        {children}
      </>
    );
  }

  const isSetup = status === "needs-setup";

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      if (isSetup) {
        if (password.length < 8) {
          useVaultStore.setState({ error: "Master password minimal 8 karakter." });
          return;
        }
        if (password !== confirm) {
          useVaultStore.setState({ error: "Konfirmasi password tidak cocok." });
          return;
        }
        await setupMasterPassword(password);
      } else {
        await unlock(password);
      }
    } finally {
      setSubmitting(false);
      setPassword("");
      setConfirm("");
    }
  };

  return (
    <div className="flex min-h-dvh items-center justify-center bg-gradient-to-br from-indigo-50 via-white to-neutral-50 px-4 dark:from-neutral-950 dark:via-neutral-950 dark:to-indigo-950/20">
      <form
        onSubmit={handleSubmit}
        autoComplete="off"
        data-lpignore="true"
        data-1p-ignore
        data-bwignore
        className="w-full max-w-sm animate-[fade-in_0.35s_ease-out] rounded-2xl border border-neutral-200/80 bg-white/90 p-7 shadow-xl shadow-indigo-900/5 backdrop-blur-sm dark:border-neutral-800 dark:bg-neutral-900/90 dark:shadow-black/30"
      >
        <div
          aria-hidden="true"
          style={{ position: "absolute", width: 1, height: 1, overflow: "hidden", clip: "rect(0,0,0,0)" }}
        >
          <input type="text" name="username" tabIndex={-1} autoComplete="username" />
          <input type="password" name="password" tabIndex={-1} autoComplete="current-password" />
        </div>

        <div className="mb-5 flex items-center justify-between">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-600 to-violet-600 text-white shadow-lg shadow-indigo-600/20">
            <LockIcon />
          </div>
          <span className="inline-flex items-center gap-1.5 rounded-full border border-neutral-200 bg-white/60 px-2.5 py-1 text-xs font-medium text-neutral-500 dark:border-neutral-800 dark:bg-neutral-800/60 dark:text-neutral-400">
            <span className={`h-1.5 w-1.5 rounded-full ${online ? "bg-emerald-500" : "bg-neutral-400"}`} />
            {online ? "Online" : "Offline"}
          </span>
        </div>

        <h1 className="mb-1 text-xl font-semibold tracking-tight text-neutral-900 dark:text-neutral-100">
          Passku
        </h1>
        <p className="mb-6 text-sm leading-relaxed text-neutral-500 dark:text-neutral-400">
          {isSetup
            ? "Buat master password untuk mengenkripsi vault kamu. Password ini tidak disimpan di mana pun — kalau lupa, data tidak bisa dipulihkan."
            : online
              ? "Masukkan master password untuk membuka vault."
              : "Tidak ada koneksi internet. Passku butuh koneksi untuk membuka vault."}
        </p>

        <div className="space-y-3">
          <div>
            <label className="mb-1.5 block text-xs font-medium text-neutral-600 dark:text-neutral-400">
              Master Password
            </label>
            <div className="relative">
              <input
                type={revealPassword ? "text" : "password"}
                autoFocus
                autoComplete="off"
                name="passku-master-secret"
                data-lpignore="true"
                data-1p-ignore
                data-bwignore
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full rounded-xl border border-neutral-300 bg-white px-3.5 py-2.5 pr-10 text-sm text-neutral-900 outline-none transition focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/15 dark:border-neutral-700 dark:bg-neutral-800 dark:text-neutral-100 dark:focus:border-indigo-400 dark:focus:ring-indigo-400/15"
                required
              />
              <button
                type="button"
                onClick={() => revealBriefly(setRevealPassword, revealTimer)}
                title="Lihat password (0.5 detik)"
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-neutral-400 transition hover:text-indigo-600 dark:hover:text-indigo-400"
              >
                <EyeIcon open={revealPassword} />
              </button>
            </div>
          </div>

          {isSetup && (
            <div>
              <label className="mb-1.5 block text-xs font-medium text-neutral-600 dark:text-neutral-400">
                Konfirmasi Password
              </label>
              <div className="relative">
                <input
                  type={revealConfirm ? "text" : "password"}
                  autoComplete="off"
                  name="passku-master-secret-confirm"
                  data-lpignore="true"
                  data-1p-ignore
                  data-bwignore
                  value={confirm}
                  onChange={(e) => setConfirm(e.target.value)}
                  className="w-full rounded-xl border border-neutral-300 bg-white px-3.5 py-2.5 pr-10 text-sm text-neutral-900 outline-none transition focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/15 dark:border-neutral-700 dark:bg-neutral-800 dark:text-neutral-100 dark:focus:border-indigo-400 dark:focus:ring-indigo-400/15"
                  required
                />
                <button
                  type="button"
                  onClick={() => revealBriefly(setRevealConfirm, confirmRevealTimer)}
                  title="Lihat password (0.5 detik)"
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-neutral-400 transition hover:text-indigo-600 dark:hover:text-indigo-400"
                >
                  <EyeIcon open={revealConfirm} />
                </button>
              </div>
            </div>
          )}
        </div>

        {error && (
          <p className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-xs text-red-600 dark:bg-red-950/50 dark:text-red-400">
            {error}
          </p>
        )}

        <button
          type="submit"
          disabled={submitting}
          className="mt-5 flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-br from-indigo-600 to-violet-600 px-3 py-2.5 text-sm font-medium text-white shadow-md shadow-indigo-600/20 transition hover:from-indigo-500 hover:to-violet-500 disabled:opacity-50"
        >
          {submitting && (
            <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-white/40 border-t-white" />
          )}
          {submitting
            ? syncing
              ? "Menyinkronkan..."
              : "Memproses..."
            : isSetup
              ? "Buat Vault"
              : "Buka Vault"}
        </button>
      </form>
    </div>
  );
}
