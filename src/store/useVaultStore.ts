import { create } from "zustand";
import { purgeLegacyOfflineData } from "@/lib/db";
import {
  deriveKeyFromPassword,
  deriveNewKey,
  deriveAuthSecret,
  decryptString,
  encryptString,
  VERIFIER_PLAINTEXT,
} from "@/lib/crypto";
import { LEGACY_ITERATIONS, TARGET_ITERATIONS } from "@/lib/kdf";
import { persistSessionKey, restoreSessionKey, clearSessionKey } from "@/lib/sessionKey";
import {
  cachedCredentials,
  clearCredentialCache,
  getVaultVersion,
  replaceCachedCredentials,
  setVaultVersion,
  syncCredentials,
  VAULT_STALE_EVENT,
} from "@/lib/credentials";
import type { CredentialPayload } from "@/types";

interface VaultState {
  status: "checking" | "needs-setup" | "locked" | "unlocked";
  key: CryptoKey | null;
  error: string | null;
  syncing: boolean;
  init: () => Promise<void>;
  setupMasterPassword: (password: string) => Promise<void>;
  unlock: (password: string) => Promise<boolean>;
  lock: () => void;
}

/** What GET /api/vault-meta gives anyone: enough to derive the auth secret, nothing to test guesses with. */
interface PublicMeta {
  saltB64: string;
  iterations: number;
  version: number;
}

/** Full key material, returned by POST /api/auth only after the master password is accepted. */
type FullMeta = PublicMeta & { verifier: string };

type AuthResult =
  | { ok: true; meta: FullMeta }
  | { ok: false; reason: "invalid" }
  | { ok: false; reason: "rate-limited"; retryAfter: number };

const OFFLINE_MESSAGE = "Tidak bisa terhubung ke server. Passku butuh koneksi internet untuk membuka vault.";

async function fetchPublicMeta(): Promise<PublicMeta | null> {
  const res = await fetch("/api/vault-meta");
  if (!res.ok) throw new Error("server unreachable");
  const body = await res.json();
  return body.exists
    ? { saltB64: body.saltB64, iterations: body.iterations ?? LEGACY_ITERATIONS, version: body.version ?? 1 }
    : null;
}

async function authenticate(password: string, meta: PublicMeta): Promise<AuthResult> {
  const authSecret = await deriveAuthSecret(password, meta.saltB64, meta.iterations);
  const res = await fetch("/api/auth", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ authSecret }),
  });
  if (res.status === 429) {
    const body = await res.json().catch(() => ({}));
    return { ok: false, reason: "rate-limited", retryAfter: Number(body.retryAfter) || 60 };
  }
  if (!res.ok) return { ok: false, reason: "invalid" };
  const body = await res.json();
  return {
    ok: true,
    meta: { saltB64: body.saltB64, iterations: body.iterations, version: body.version, verifier: body.verifier },
  };
}

function rateLimitMessage(retryAfter: number): string {
  const minutes = Math.ceil(retryAfter / 60);
  return `Terlalu banyak percobaan password salah. Coba lagi dalam ${minutes} menit.`;
}

/**
 * One-time upgrade after unlock: re-encrypts the vault with a fresh salt at TARGET_ITERATIONS
 * and moves plaintext site names into the encrypted payload. The server swaps everything in one
 * transaction (POST /api/vault-meta/rekey) and refuses if anything changed meanwhile; then this
 * simply runs again on the next unlock. Returns the key to use.
 */
async function upgradeVaultIfNeeded(password: string, key: CryptoKey, meta: FullMeta): Promise<CryptoKey> {
  const rows = cachedCredentials();
  if (meta.iterations >= TARGET_ITERATIONS && rows.every((r) => r.site === "")) return key;

  try {
    const decrypted = await Promise.all(
      rows.map(async (row) => ({
        row,
        payload: JSON.parse(await decryptString(key, row.data)) as CredentialPayload,
      }))
    );

    const { key: newKey, saltB64, iterations } = await deriveNewKey(password);
    const verifier = await encryptString(newKey, VERIFIER_PLAINTEXT);
    const authSecret = await deriveAuthSecret(password, saltB64, iterations);
    const credentials = await Promise.all(
      decrypted.map(async ({ row, payload }) => ({
        id: row.id,
        previousUpdatedAt: row.updatedAt,
        data: await encryptString(newKey, JSON.stringify({ ...payload, site: payload.site ?? row.site })),
      }))
    );

    const res = await fetch("/api/vault-meta/rekey", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ expectedVersion: meta.version, saltB64, iterations, verifier, authSecret, credentials }),
    });
    if (!res.ok) return key;
    const { version } = (await res.json()) as { version: number };

    const byId = new Map(credentials.map((c) => [c.id, c.data]));
    replaceCachedCredentials(rows.map((r) => ({ ...r, site: "", data: byId.get(r.id)! })));
    setVaultVersion(version);
    await persistSessionKey(newKey, version);
    return newKey;
  } catch {
    // Network error or unreadable entry: keep using the current key, retry on the next unlock.
    return key;
  }
}

export const useVaultStore = create<VaultState>((set) => ({
  status: "checking",
  key: null,
  error: null,
  syncing: false,

  init: async () => {
    // Older versions kept the vault in IndexedDB for offline use; remove it from this device.
    await purgeLegacyOfflineData();

    const restored = await restoreSessionKey();
    if (restored) {
      set({ syncing: true });
      setVaultVersion(restored.version);
      const result = await syncCredentials();
      if (result === "stale") return; // the stale handler below locked the vault
      if (result === "ok") {
        set({ status: "unlocked", key: restored.key, error: null, syncing: false });
        return;
      }
      clearSessionKey();
      set({ syncing: false });
    }

    try {
      const publicMeta = await fetchPublicMeta();
      set({ status: publicMeta ? "locked" : "needs-setup", error: null });
    } catch {
      set({ status: "locked", error: OFFLINE_MESSAGE });
    }
  },

  setupMasterPassword: async (password: string) => {
    const { key, saltB64, iterations } = await deriveNewKey(password);
    const verifier = await encryptString(key, VERIFIER_PLAINTEXT);
    const authSecret = await deriveAuthSecret(password, saltB64, iterations);

    const res = await fetch("/api/vault-meta", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ saltB64, verifier, authSecret, iterations }),
    }).catch(() => null);
    if (!res?.ok) {
      set({ error: "Gagal setup vault di server. Coba lagi." });
      return;
    }

    const auth = await authenticate(password, { saltB64, iterations, version: 1 }).catch(() => null);
    if (!auth?.ok) {
      set({ status: "locked", error: "Setup berhasil tapi login otomatis gagal. Coba unlock manual." });
      return;
    }

    setVaultVersion(auth.meta.version);
    await persistSessionKey(key, auth.meta.version);
    set({ syncing: true });
    await syncCredentials();
    set({ status: "unlocked", key, error: null, syncing: false });
  },

  unlock: async (password: string) => {
    let meta: FullMeta;
    try {
      const publicMeta = await fetchPublicMeta();
      if (!publicMeta) {
        set({ error: "Vault belum di-setup." });
        return false;
      }
      const auth = await authenticate(password, publicMeta);
      if (!auth.ok) {
        set({
          error: auth.reason === "rate-limited" ? rateLimitMessage(auth.retryAfter) : "Master password salah.",
        });
        return false;
      }
      meta = auth.meta;
    } catch {
      set({ error: OFFLINE_MESSAGE });
      return false;
    }

    try {
      let key = await deriveKeyFromPassword(password, meta.saltB64, meta.iterations);
      const check = await decryptString(key, meta.verifier);
      if (check !== VERIFIER_PLAINTEXT) throw new Error("mismatch");

      setVaultVersion(meta.version);
      set({ syncing: true });
      const result = await syncCredentials();
      if (result === "stale") return false;
      if (result === "offline") {
        set({ error: OFFLINE_MESSAGE, syncing: false });
        return false;
      }
      key = await upgradeVaultIfNeeded(password, key, meta);
      // After an upgrade both the key and the version are new.
      await persistSessionKey(key, getVaultVersion());
      set({ status: "unlocked", key, error: null, syncing: false });
      return true;
    } catch {
      set({ error: "Master password salah.", syncing: false });
      return false;
    }
  },

  lock: () => {
    fetch("/api/auth", { method: "DELETE" }).catch(() => {});
    clearSessionKey();
    clearCredentialCache();
    set({ status: "locked", key: null });
  },
}));

// The vault was re-encrypted on another device: this device's key is outdated.
// Lock and drop the in-memory copy; unlocking again fetches the new key material.
if (typeof window !== "undefined") {
  window.addEventListener(VAULT_STALE_EVENT, () => {
    clearSessionKey();
    clearCredentialCache();
    useVaultStore.setState({
      status: "locked",
      key: null,
      syncing: false,
      error: "Vault dienkripsi ulang di device lain. Masukkan master password lagi.",
    });
  });
}
