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
 * One encrypted file inside a document. Its bytes live in the `files` table under `id`, encrypted
 * with their own random key (fileKey, raw AES-256 in base64) that is kept here, inside the
 * vault-encrypted payload, so re-keying the vault never has to touch the files.
 */
export interface StoredFile {
  id: string;
  name: string;
  mime: string;
  size: number;
  fileKey: string;
  /** Small JPEG data URL for images, made in the browser at upload. */
  thumb?: string;
}

/** A document (e.g. "KTP") holding one or more files, such as photos from different angles. */
export interface FileDocPayload {
  type: "doc";
  title: string;
  notes?: string;
  files: StoredFile[];
}

/** Single-file item from the first version of Documents; its file id is the item id. */
export interface LegacyFilePayload {
  type: "file";
  name: string;
  mime: string;
  size: number;
  fileKey: string;
  notes?: string;
}

export type VaultPayload = CredentialPayload | TextDocPayload | FileDocPayload | LegacyFilePayload;

export function isCredentialPayload(p: VaultPayload): p is CredentialPayload {
  return !("type" in p) || p.type === undefined;
}
