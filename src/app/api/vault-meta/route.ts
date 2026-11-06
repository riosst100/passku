import { NextRequest, NextResponse } from "next/server";
import db from "@/lib/server/db";
import { sha256Hex } from "@/lib/server/hash";
import { getVaultMeta } from "@/lib/server/vault";
import { MAX_ITERATIONS, TARGET_ITERATIONS } from "@/lib/kdf";

/**
 * Public: only what a client needs to derive its auth secret (salt + iteration count).
 * The verifier is withheld until the master password is accepted (POST /api/auth), so
 * nobody can download what an offline guessing attack would need.
 */
export async function GET() {
  const row = getVaultMeta();
  if (!row) {
    return NextResponse.json({ exists: false });
  }
  return NextResponse.json({
    exists: true,
    saltB64: row.salt_b64,
    iterations: row.kdf_iterations,
    version: row.version,
  });
}

export async function POST(req: NextRequest) {
  const existing = db.prepare("SELECT id FROM vault_meta WHERE id = 'vault-meta'").get();
  if (existing) {
    return NextResponse.json({ error: "Vault already set up" }, { status: 409 });
  }

  const body = await req.json();
  const { saltB64, verifier, authSecret, iterations } = body as {
    saltB64?: string;
    verifier?: string;
    authSecret?: string;
    iterations?: number;
  };
  if (!saltB64 || !verifier || !authSecret) {
    return NextResponse.json({ error: "Missing fields" }, { status: 400 });
  }
  if (!Number.isInteger(iterations) || iterations! < TARGET_ITERATIONS || iterations! > MAX_ITERATIONS) {
    return NextResponse.json({ error: "Invalid iterations" }, { status: 400 });
  }

  db.prepare(
    `INSERT INTO vault_meta (id, salt_b64, verifier, auth_secret_hash, kdf_iterations, version)
     VALUES ('vault-meta', ?, ?, ?, ?, 1)`
  ).run(saltB64, verifier, sha256Hex(authSecret), iterations);

  return NextResponse.json({ ok: true });
}
