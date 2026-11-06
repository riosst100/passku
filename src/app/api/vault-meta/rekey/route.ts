import { NextRequest, NextResponse } from "next/server";
import db from "@/lib/server/db";
import { requireSession } from "@/lib/server/requireSession";
import { sha256Hex } from "@/lib/server/hash";
import { getVaultMeta } from "@/lib/server/vault";
import { MAX_ITERATIONS, TARGET_ITERATIONS } from "@/lib/kdf";

interface RekeyBody {
  expectedVersion?: number;
  saltB64?: string;
  iterations?: number;
  verifier?: string;
  authSecret?: string;
  credentials?: Array<{ id: string; data: string; previousUpdatedAt: number }>;
}

/**
 * Replaces the vault's key material and every credential's ciphertext in one transaction
 * (the browser re-encrypted them with a key derived from a new salt / higher iteration count).
 * The client must send exactly the credentials the server has, unchanged since it read them,
 * so a concurrent edit from another device is never overwritten or lost; otherwise 409.
 */
export async function POST(req: NextRequest) {
  const unauthorized = await requireSession(req);
  if (unauthorized) return unauthorized;

  const body = (await req.json()) as RekeyBody;
  const { expectedVersion, saltB64, iterations, verifier, authSecret, credentials } = body;
  if (!saltB64 || !verifier || !authSecret || !Array.isArray(credentials)) {
    return NextResponse.json({ error: "Missing fields" }, { status: 400 });
  }
  if (!Number.isInteger(iterations) || iterations! < TARGET_ITERATIONS || iterations! > MAX_ITERATIONS) {
    return NextResponse.json({ error: "Invalid iterations" }, { status: 400 });
  }
  if (credentials.some((c) => !c?.id || !c.data || typeof c.previousUpdatedAt !== "number")) {
    return NextResponse.json({ error: "Invalid credentials" }, { status: 400 });
  }

  const conflict = () => NextResponse.json({ error: "Vault changed, try again" }, { status: 409 });

  const result = db.transaction(() => {
    const meta = getVaultMeta();
    if (!meta || meta.version !== expectedVersion) return null;

    const current = db.prepare("SELECT id, updated_at FROM credentials").all() as {
      id: string;
      updated_at: number;
    }[];
    const sent = new Map(credentials.map((c) => [c.id, c]));
    if (current.length !== sent.size) return null;
    for (const row of current) {
      if (sent.get(row.id)?.previousUpdatedAt !== row.updated_at) return null;
    }

    const update = db.prepare("UPDATE credentials SET site = '', data = ? WHERE id = ?");
    for (const c of credentials) update.run(c.data, c.id);

    const version = meta.version + 1;
    db.prepare(
      `UPDATE vault_meta SET salt_b64 = ?, verifier = ?, auth_secret_hash = ?, kdf_iterations = ?, version = ?
       WHERE id = 'vault-meta'`
    ).run(saltB64, verifier, sha256Hex(authSecret), iterations, version);
    return version;
  })();

  if (result === null) return conflict();
  return NextResponse.json({ ok: true, version: result });
}
