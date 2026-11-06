import { NextRequest, NextResponse } from "next/server";
import db from "@/lib/server/db";

/**
 * Every re-encryption of the vault (new salt / iteration count) bumps vault_meta.version.
 * Clients send the version their key belongs to on every write, so a device still holding
 * the old key can't mix old ciphertext into the re-encrypted vault.
 */
export const VAULT_VERSION_HEADER = "x-vault-version";

export interface VaultMetaRow {
  id: string;
  salt_b64: string;
  verifier: string;
  auth_secret_hash: string;
  kdf_iterations: number;
  version: number;
}

export function getVaultMeta(): VaultMetaRow | undefined {
  return db.prepare("SELECT * FROM vault_meta WHERE id = 'vault-meta'").get() as VaultMetaRow | undefined;
}

/** 409 when the request's vault version is missing or outdated, otherwise null. */
export function checkVaultVersion(req: NextRequest): NextResponse | null {
  const meta = getVaultMeta();
  const sent = Number(req.headers.get(VAULT_VERSION_HEADER));
  if (!meta || sent !== meta.version) {
    return NextResponse.json(
      { error: "Vault was re-encrypted; unlock again", version: meta?.version ?? null },
      { status: 409 }
    );
  }
  return null;
}
