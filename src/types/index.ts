export interface Credential {
  id: string;
  /** Legacy plaintext site name; empty for re-encrypted entries (the name is inside `data`). */
  site: string;
  /** encrypted JSON: CredentialPayload */
  data: string;
  createdAt: number;
  updatedAt: number;
}

export interface CredentialPayload {
  type?: undefined;
  /** Site name; missing in entries encrypted before it moved into the payload. */
  site?: string;
  username: string;
  password: string;
  phone?: string;
  url?: string;
  notes?: string;
}

/** Credentials have no `type` (entries predate other item kinds). */
export interface TextDocPayload {
  type: "text";
  title: string;
  content: string;
}

/**
 * The file's bytes live encrypted in the `files` table under the same id as the item. They are
 * encrypted with their own random key (fileKey, a raw AES-256 key in base64) that is stored here,
 * inside the vault-encrypted payload, so re-keying the vault never has to touch the file itself.
 */
export interface FileDocPayload {
  type: "file";
  name: string;
  mime: string;
  size: number;
  fileKey: string;
  notes?: string;
}

export type VaultPayload = CredentialPayload | TextDocPayload | FileDocPayload;

export function isCredentialPayload(p: VaultPayload): p is CredentialPayload {
  return !("type" in p) || p.type === undefined;
}
