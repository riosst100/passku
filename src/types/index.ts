export interface VaultMeta {
  id: "vault-meta";
  saltB64: string;
  verifier: string;
  /** PBKDF2 iterations for this salt; missing in caches from before it was stored (= LEGACY_ITERATIONS). */
  iterations?: number;
  /** Server vault version the cached key material belongs to; missing = 1. */
  version?: number;
}

export interface Credential {
  id: string;
  /** Legacy plaintext site name; empty for re-encrypted entries (the name is inside `data`). */
  site: string;
  /** encrypted JSON: CredentialPayload */
  data: string;
  createdAt: number;
  updatedAt: number;
  /** set when a local change hasn't been pushed to the server yet */
  pendingOp?: "upsert" | "delete";
}

export interface CredentialPayload {
  /** Site name; missing in entries encrypted before it moved into the payload. */
  site?: string;
  username: string;
  password: string;
  phone?: string;
  url?: string;
  notes?: string;
}
