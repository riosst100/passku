import { decryptString, encryptString } from "@/lib/crypto";
import type { Credential, CredentialPayload } from "@/types";

/**
 * Online-only: the credential ciphertext is kept in memory while the vault is unlocked and is gone
 * when the tab closes or the vault locks. Nothing is written to IndexedDB, so a lost device holds
 * nothing to guess the master password against.
 */
const credentials = new Map<string, Credential>();
/** Server vault version the current key belongs to (set on unlock). */
let vaultVersion = 1;

/** Must match VAULT_VERSION_HEADER in lib/server/vault.ts. */
const VAULT_VERSION_HEADER = "x-vault-version";

/**
 * Fired when the server says the vault was re-encrypted (new salt / iteration count) since this
 * device got its key: the key is outdated, so the vault store locks and asks for the master
 * password again (see useVaultStore).
 */
export const VAULT_STALE_EVENT = "passku:vault-stale";

export class OfflineError extends Error {
  constructor() {
    super("Tidak bisa terhubung ke server. Periksa koneksi internet lalu coba lagi.");
  }
}

class StaleVaultError extends Error {}

function notifyStale(): void {
  window.dispatchEvent(new Event(VAULT_STALE_EVENT));
}

export function setVaultVersion(version: number): void {
  vaultVersion = version;
}

export function getVaultVersion(): number {
  return vaultVersion;
}

/** Credentials as last pulled from the server (still encrypted). */
export function cachedCredentials(): Credential[] {
  return [...credentials.values()];
}

export function replaceCachedCredentials(rows: Credential[]): void {
  credentials.clear();
  for (const row of rows) credentials.set(row.id, row);
}

export function clearCredentialCache(): void {
  credentials.clear();
}

function writeHeaders(): Record<string, string> {
  return { "Content-Type": "application/json", [VAULT_VERSION_HEADER]: String(vaultVersion) };
}

const LAST_SYNCED_KEY = "passku_last_synced_at";

export function getLastSyncedAt(): number | null {
  const raw = localStorage.getItem(LAST_SYNCED_KEY);
  return raw ? Number(raw) : null;
}

/**
 * Pulls the full credential set from the server into memory. Returns "stale" when the vault was
 * re-encrypted elsewhere (VAULT_STALE_EVENT is fired too) and "offline" when the server can't be reached.
 */
export async function syncCredentials(): Promise<"ok" | "stale" | "offline"> {
  try {
    const res = await fetch("/api/credentials");
    if (!res.ok) return "offline";
    const serverVersion = Number(res.headers.get(VAULT_VERSION_HEADER));
    if (serverVersion && serverVersion !== vaultVersion) throw new StaleVaultError();
    replaceCachedCredentials((await res.json()) as Credential[]);
    localStorage.setItem(LAST_SYNCED_KEY, String(Date.now()));
    return "ok";
  } catch (e) {
    if (e instanceof StaleVaultError) {
      notifyStale();
      return "stale";
    }
    return "offline";
  }
}

export async function listCredentials(
  key: CryptoKey
): Promise<Array<{ id: string; site: string; payload: CredentialPayload; updatedAt: number }>> {
  const entries = await Promise.all(
    cachedCredentials().map(async (row) => {
      const payload = JSON.parse(await decryptString(key, row.data)) as CredentialPayload;
      return {
        id: row.id,
        // Entries encrypted before the site name moved into the payload still have it in plaintext.
        site: payload.site ?? row.site,
        updatedAt: row.updatedAt,
        payload,
      };
    })
  );
  return entries.sort((a, b) => a.site.localeCompare(b.site, undefined, { sensitivity: "base" }));
}

/** Saves to the server; throws OfflineError when it can't be reached (nothing is queued locally). */
export async function saveCredential(
  key: CryptoKey,
  site: string,
  payload: CredentialPayload,
  id?: string
): Promise<void> {
  const now = Date.now();
  const record: Credential = {
    id: id ?? crypto.randomUUID(),
    site: "",
    data: await encryptString(key, JSON.stringify({ ...payload, site })),
    createdAt: id ? credentials.get(id)?.createdAt ?? now : now,
    updatedAt: now,
  };

  const res = await fetch("/api/credentials", {
    method: "POST",
    headers: writeHeaders(),
    body: JSON.stringify(record),
  }).catch(() => null);
  if (res?.status === 409) {
    notifyStale();
    return;
  }
  if (!res?.ok) throw new OfflineError();
  credentials.set(record.id, record);
}

/** Deletes on the server; throws OfflineError when it can't be reached. */
export async function deleteCredential(id: string): Promise<void> {
  const res = await fetch(`/api/credentials/${id}`, {
    method: "DELETE",
    headers: writeHeaders(),
  }).catch(() => null);
  if (res?.status === 409) {
    notifyStale();
    return;
  }
  if (!res?.ok) throw new OfflineError();
  credentials.delete(id);
}
