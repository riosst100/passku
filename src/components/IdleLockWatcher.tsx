"use client";

import { useEffect, useState } from "react";
import { useVaultStore } from "@/store/useVaultStore";
import { getLoadedAt, IDLE_TIMEOUT_MS, isIdleLockEnabled } from "@/lib/sessionKey";

export function IdleLockWatcher() {
  const status = useVaultStore((s) => s.status);
  const lock = useVaultStore((s) => s.lock);
  const [remainingMs, setRemainingMs] = useState(IDLE_TIMEOUT_MS);
  const [enabled, setEnabled] = useState(true);

  useEffect(() => {
    setEnabled(isIdleLockEnabled());
  }, []);

  useEffect(() => {
    if (status !== "unlocked" || !enabled) return;

    const loadedAt = getLoadedAt() ?? Date.now();
    const deadline = loadedAt + IDLE_TIMEOUT_MS;

    const tick = () => {
      const remaining = deadline - Date.now();
      if (remaining <= 0) {
        lock();
        return;
      }
      setRemainingMs(remaining);
    };

    tick();
    const interval = setInterval(tick, 1000);
    return () => clearInterval(interval);
  }, [status, lock, enabled]);

  if (status !== "unlocked" || !enabled) return null;

  const totalSeconds = Math.ceil(remainingMs / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  const isWarning = remainingMs <= 60_000;

  return (
    <div
      className={`fixed bottom-4 right-4 z-50 rounded-full border px-3 py-1.5 text-xs font-medium shadow-sm ${
        isWarning
          ? "border-red-300 bg-red-50 text-red-600 dark:border-red-800 dark:bg-red-950 dark:text-red-400"
          : "border-neutral-200 bg-white text-neutral-500 dark:border-neutral-800 dark:bg-neutral-900 dark:text-neutral-400"
      }`}
    >
      Logout otomatis dalam {minutes}:{seconds.toString().padStart(2, "0")}
    </div>
  );
}
