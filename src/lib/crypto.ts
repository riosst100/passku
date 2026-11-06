import { TARGET_ITERATIONS } from "@/lib/kdf";

function bufToBase64(buf: ArrayBufferLike): string {
  return btoa(String.fromCharCode(...new Uint8Array(buf)));
}

function base64ToBuf(b64: string): ArrayBuffer {
  return Uint8Array.from(atob(b64), (c) => c.charCodeAt(0)).buffer as ArrayBuffer;
}

async function deriveKey(password: string, salt: Uint8Array, iterations: number): Promise<CryptoKey> {
  const keyMaterial = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(password),
    "PBKDF2",
    false,
    ["deriveKey"]
  );

  return crypto.subtle.deriveKey(
    {
      name: "PBKDF2",
      salt: salt as BufferSource,
      iterations,
      hash: "SHA-256",
    },
    keyMaterial,
    { name: "AES-GCM", length: 256 },
    true,
    ["encrypt", "decrypt"]
  );
}

export async function exportKeyToJwk(key: CryptoKey): Promise<JsonWebKey> {
  return crypto.subtle.exportKey("jwk", key);
}

export async function importKeyFromJwk(jwk: JsonWebKey): Promise<CryptoKey> {
  return crypto.subtle.importKey("jwk", jwk, { name: "AES-GCM" }, true, ["encrypt", "decrypt"]);
}

export function generateSalt(): Uint8Array {
  return crypto.getRandomValues(new Uint8Array(16));
}

export async function deriveKeyFromPassword(
  password: string,
  saltB64: string,
  iterations: number
): Promise<CryptoKey> {
  const salt = new Uint8Array(base64ToBuf(saltB64));
  return deriveKey(password, salt, iterations);
}

/** New random salt + key at the current iteration count (vault setup and re-encryption). */
export async function deriveNewKey(
  password: string
): Promise<{ key: CryptoKey; saltB64: string; iterations: number }> {
  const salt = generateSalt();
  const key = await deriveKey(password, salt, TARGET_ITERATIONS);
  return { key, saltB64: bufToBase64(salt.buffer), iterations: TARGET_ITERATIONS };
}

/**
 * Derives a second, independent secret from the same password for server
 * authentication, so the value sent to the server is never the encryption
 * key itself. Uses a different PBKDF2 salt (derived deterministically from
 * the encryption salt) so it can be recomputed from saltB64 alone.
 */
export async function deriveAuthSecret(
  password: string,
  saltB64: string,
  iterations: number
): Promise<string> {
  const encSalt = new Uint8Array(base64ToBuf(saltB64));
  const authSaltInput = new Uint8Array(encSalt.length + 5);
  authSaltInput.set(encSalt);
  authSaltInput.set(new TextEncoder().encode("auth1"), encSalt.length);
  const authSalt = new Uint8Array(await crypto.subtle.digest("SHA-256", authSaltInput));

  const keyMaterial = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(password),
    "PBKDF2",
    false,
    ["deriveBits"]
  );
  const bits = await crypto.subtle.deriveBits(
    {
      name: "PBKDF2",
      salt: authSalt as BufferSource,
      iterations,
      hash: "SHA-256",
    },
    keyMaterial,
    256
  );
  return bufToBase64(bits);
}

export async function encryptString(key: CryptoKey, plaintext: string): Promise<string> {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ciphertext = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv: iv as BufferSource },
    key,
    new TextEncoder().encode(plaintext)
  );
  return `${bufToBase64(iv.buffer)}.${bufToBase64(ciphertext)}`;
}

export async function decryptString(key: CryptoKey, payload: string): Promise<string> {
  const [ivB64, ctB64] = payload.split(".");
  const iv = new Uint8Array(base64ToBuf(ivB64));
  const plaintext = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv: iv as BufferSource },
    key,
    base64ToBuf(ctB64)
  );
  return new TextDecoder().decode(plaintext);
}

export const VERIFIER_PLAINTEXT = "passku-verifier";
