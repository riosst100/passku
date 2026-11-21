import { notifyStale, OfflineError, saveItem, writeHeaders } from "@/lib/credentials";
import type { FileDocPayload } from "@/types";

/** Must match MAX_UPLOAD_BYTES in app/api/files/[id]/route.ts. */
export const MAX_FILE_BYTES = 10 * 1024 * 1024;

function bytesToBase64(bytes: Uint8Array): string {
  let s = "";
  for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(s);
}

function base64ToBytes(b64: string): Uint8Array {
  return Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
}

function importFileKey(b64: string): Promise<CryptoKey> {
  return crypto.subtle.importKey("raw", base64ToBytes(b64) as BufferSource, "AES-GCM", false, [
    "encrypt",
    "decrypt",
  ]);
}

/**
 * Encrypts the file with a fresh random key, uploads the ciphertext, then saves the vault item that
 * holds the key and metadata. Throws OfflineError on network failure.
 */
export async function uploadFile(vaultKey: CryptoKey, file: File, notes: string): Promise<void> {
  if (file.size > MAX_FILE_BYTES) throw new Error("File terlalu besar (maksimal 10 MB).");

  const rawKey = crypto.getRandomValues(new Uint8Array(32));
  const fileKey = bytesToBase64(rawKey);
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ciphertext = new Uint8Array(
    await crypto.subtle.encrypt(
      { name: "AES-GCM", iv: iv as BufferSource },
      await importFileKey(fileKey),
      await file.arrayBuffer()
    )
  );
  const body = new Uint8Array(iv.length + ciphertext.length);
  body.set(iv);
  body.set(ciphertext, iv.length);

  const id = crypto.randomUUID();
  const res = await fetch(`/api/files/${id}`, {
    method: "PUT",
    headers: writeHeaders("application/octet-stream"),
    body,
  }).catch(() => null);
  if (res?.status === 409) {
    notifyStale();
    return;
  }
  if (res?.status === 413) throw new Error("File terlalu besar (maksimal 10 MB).");
  if (!res?.ok) throw new OfflineError();

  const payload: FileDocPayload = {
    type: "file",
    name: file.name,
    mime: file.type || "application/octet-stream",
    size: file.size,
    fileKey,
    notes: notes || undefined,
  };
  await saveItem(vaultKey, payload, id);
}

/** Downloads and decrypts a file into a Blob. */
export async function downloadFile(id: string, payload: FileDocPayload): Promise<Blob> {
  const res = await fetch(`/api/files/${id}`).catch(() => null);
  if (!res) throw new OfflineError();
  if (!res.ok) throw new Error("File tidak ditemukan di server.");
  const data = new Uint8Array(await res.arrayBuffer());
  const plain = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv: data.subarray(0, 12) as BufferSource },
    await importFileKey(payload.fileKey),
    data.subarray(12) as BufferSource
  );
  return new Blob([plain], { type: payload.mime });
}

export function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / 1024 / 1024).toFixed(1)} MB`;
}
