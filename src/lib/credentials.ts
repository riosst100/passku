import { db } from "@/lib/db";
import { decryptString, encryptString } from "@/lib/crypto";
import type { Credential, CredentialPayload } from "@/types";

interface ServerCredential {
  id: string;
  site: string;
  data: string;
  createdAt: number;
  updatedAt: number;
}

/** Must match VAULT_VERSION_HEADER in lib/server/vault.ts. */
const VAULT_VERSION_HEADER = "x-vault-version";

/**
 * Fired when the server says the vault was re-encrypted (new salt / iteration count) since this
 * device got its key: the key and the cached ciphertext are outdated, so the vault store locks
 * and asks for the master password again (see useVaultStore).
 */
export const VAULT_STALE_EVENT = "passku:vault-stale";

class StaleVaultError extends Error {}

function notifyStale(): void {
  window.dispatchEvent(new Event(VAULT_STALE_EVENT));
}

async function localVaultVersion(): Promise<number> {
  return (await db.vaultMeta.get("vault-meta"))?.version ?? 1;
}

async function writeHeaders(): Promise<Record<string, string>> {
  return {
    "Content-Type": "application/json",
    [VAULT_VERSION_HEADER]: String(await localVaultVersion()),
  };
}

/** Pushes any locally queued creates/updates/deletes made while offline. */
async function flushPendingOps(): Promise<void> {
  const all = await db.credentials.toArray();
  const pending = all.filter((r) => r.pendingOp);
  const headers = await writeHeaders();

  for (const row of pending) {
    const res =
      row.pendingOp === "delete"
        ? await fetch(`/api/credentials/${row.id}`, { method: "DELETE", headers }).catch(() => null)
        : await fetch("/api/credentials", {
            method: "POST",
            headers,
            body: JSON.stringify({ ...row, pendingOp: undefined }),
          }).catch(() => null);
    if (res?.status === 409) throw new StaleVaultError();
    if (!res?.ok) continue;
    if (row.pendingOp === "delete") await db.credentials.delete(row.id);
    else await db.credentials.update(row.id, { pendingOp: undefined });
  }
}

/** Pulls the full credential set from the server into the local cache. */
async function pullFromServer(): Promise<void> {
  const res = await fetch("/api/credentials");
  if (!res.ok) return;
  const serverVersion = Number(res.headers.get(VAULT_VERSION_HEADER));
  if (serverVersion && serverVersion !== (await localVaultVersion())) throw new StaleVaultError();
  const rows = (await res.json()) as ServerCredential[];

  const localAll = await db.credentials.toArray();
  const pendingIds = new Set(localAll.filter((r) => r.pendingOp).map((r) => r.id));

  await db.credentials.bulkPut(rows.filter((r) => !pendingIds.has(r.id)));

  const serverIds = new Set(rows.map((r) => r.id));
  const localRows = await db.credentials.toArray();
  const staleIds = localRows
    .filter((r) => !serverIds.has(r.id) && !pendingIds.has(r.id))
    .map((r) => r.id);
  if (staleIds.length) await db.credentials.bulkDelete(staleIds);
}

const LAST_SYNCED_KEY = "passku_last_synced_at";

export function getLastSyncedAt(): number | null {
  const raw = localStorage.getItem(LAST_SYNCED_KEY);
  return raw ? Number(raw) : null;
}

/**
 * Pushes queued offline changes, then refreshes the local cache from the server.
 * Returns "stale" when the vault was re-encrypted elsewhere (VAULT_STALE_EVENT is fired too).
 */
export async function syncCredentials(): Promise<"ok" | "stale"> {
  if (!navigator.onLine) return "ok";
  try {
    await flushPendingOps();
    await pullFromServer();
    localStorage.setItem(LAST_SYNCED_KEY, String(Date.now()));
  } catch (e) {
    if (e instanceof StaleVaultError) {
      notifyStale();
      return "stale";
    }
    // server unreachable mid-sync; local cache stays as the fallback
  }
  return "ok";
}

export async function listCredentials(
  key: CryptoKey
): Promise<
  Array<{ id: string; site: string; payload: CredentialPayload; updatedAt: number; pending: boolean }>
> {
  const rows = await db.credentials.toArray();
  const entries = await Promise.all(
    rows
      .filter((row) => row.pendingOp !== "delete")
      .map(async (row) => {
        const payload = JSON.parse(await decryptString(key, row.data)) as CredentialPayload;
        return {
          id: row.id,
          // Entries encrypted before the site name moved into the payload still have it in plaintext.
          site: payload.site ?? row.site,
          updatedAt: row.updatedAt,
          pending: row.pendingOp === "upsert",
          payload,
        };
      })
  );
  return entries.sort((a, b) => a.site.localeCompare(b.site, undefined, { sensitivity: "base" }));
}

export async function saveCredential(
  key: CryptoKey,
  site: string,
  payload: CredentialPayload,
  id?: string
): Promise<void> {
  const now = Date.now();
  const data = await encryptString(key, JSON.stringify({ ...payload, site }));
  const record: Credential = {
    id: id ?? crypto.randomUUID(),
    site: "",
    data,
    createdAt: id ? (await db.credentials.get(id))?.createdAt ?? now : now,
    updatedAt: now,
  };

  if (!navigator.onLine) {
    await db.credentials.put({ ...record, pendingOp: "upsert" });
    return;
  }

  const res = await fetch("/api/credentials", {
    method: "POST",
    headers: await writeHeaders(),
    body: JSON.stringify(record),
  }).catch(() => null);
  if (res?.status === 409) {
    notifyStale();
    return;
  }

  await db.credentials.put(res?.ok ? record : { ...record, pendingOp: "upsert" });
}

export async function deleteCredential(id: string): Promise<void> {
  if (!navigator.onLine) {
    const existing = await db.credentials.get(id);
    if (existing) await db.credentials.put({ ...existing, pendingOp: "delete" });
    return;
  }

  const res = await fetch(`/api/credentials/${id}`, {
    method: "DELETE",
    headers: await writeHeaders(),
  }).catch(() => null);
  if (res?.status === 409) {
    notifyStale();
    return;
  }
  if (res?.ok) {
    await db.credentials.delete(id);
  } else {
    const existing = await db.credentials.get(id);
    if (existing) await db.credentials.put({ ...existing, pendingOp: "delete" });
  }
}
