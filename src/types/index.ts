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
  /** Site name; missing in entries encrypted before it moved into the payload. */
  site?: string;
  username: string;
  password: string;
  phone?: string;
  url?: string;
  notes?: string;
}
