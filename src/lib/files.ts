import { notifyStale, OfflineError, writeHeaders } from "@/lib/credentials";
import type { FileDocPayload, LegacyFilePayload, StoredFile } from "@/types";

/** Must match MAX_UPLOAD_BYTES in app/api/files/[id]/route.ts. */
export const MAX_FILE_BYTES = 10 * 1024 * 1024;
const THUMB_PX = 240;

/** Thrown after the stale-vault event fired (the vault store locks itself). */
export class StaleError extends Error {
  constructor() {
    super("Vault dienkripsi ulang di device lain.");
  }
}

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

/** Older single-file items are shown as a document holding that one file. */
export function normalizeDoc(itemId: string, p: FileDocPayload | LegacyFilePayload): FileDocPayload {
  if (p.type === "doc") return p;
  return {
    type: "doc",
    title: p.name,
    notes: p.notes,
    files: [{ id: itemId, name: p.name, mime: p.mime, size: p.size, fileKey: p.fileKey }],
  };
}

async function makeThumb(file: File): Promise<string | undefined> {
  if (!file.type.startsWith("image/")) return undefined;
  try {
    const bitmap = await createImageBitmap(file);
    const scale = Math.min(1, THUMB_PX / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(bitmap.width * scale);
    canvas.height = Math.round(bitmap.height * scale);
    canvas.getContext("2d")!.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    bitmap.close();
    return canvas.toDataURL("image/jpeg", 0.7);
  } catch {
    return undefined; // format the browser can't decode (e.g. HEIC): no thumbnail
  }
}

/** Encrypts the file with a fresh random key and uploads the ciphertext for document `itemId`. */
export async function uploadFile(itemId: string, file: File): Promise<StoredFile> {
  if (file.size > MAX_FILE_BYTES) throw new Error(`${file.name}: terlalu besar (maksimal 10 MB).`);

  const fileKey = bytesToBase64(crypto.getRandomValues(new Uint8Array(32)));
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
  const res = await fetch(`/api/files/${id}?item=${itemId}`, {
    method: "PUT",
    headers: writeHeaders("application/octet-stream"),
    body,
  }).catch(() => null);
  if (res?.status === 409) {
    notifyStale();
    throw new StaleError();
  }
  if (res?.status === 413) throw new Error(`${file.name}: terlalu besar (maksimal 10 MB).`);
  if (!res?.ok) throw new OfflineError();

  return {
    id,
    name: file.name,
    mime: file.type || "application/octet-stream",
    size: file.size,
    fileKey,
    thumb: await makeThumb(file),
  };
}

/** Best effort: a file left behind is still removed when its document is deleted. */
export async function deleteFile(id: string): Promise<void> {
  await fetch(`/api/files/${id}`, { method: "DELETE", headers: writeHeaders() }).catch(() => null);
}

/** Downloads and decrypts a file into a Blob. */
export async function downloadFile(f: StoredFile): Promise<Blob> {
  const res = await fetch(`/api/files/${f.id}`).catch(() => null);
  if (!res) throw new OfflineError();
  if (!res.ok) throw new Error("File tidak ditemukan di server.");
  const data = new Uint8Array(await res.arrayBuffer());
  const plain = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv: data.subarray(0, 12) as BufferSource },
    await importFileKey(f.fileKey),
    data.subarray(12) as BufferSource
  );
  return new Blob([plain], { type: f.mime });
}

export function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / 1024 / 1024).toFixed(1)} MB`;
}
