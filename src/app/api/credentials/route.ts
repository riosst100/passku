import { NextRequest, NextResponse } from "next/server";
import db from "@/lib/server/db";
import { requireSession } from "@/lib/server/requireSession";
import { checkVaultVersion, getVaultMeta, VAULT_VERSION_HEADER } from "@/lib/server/vault";

interface CredentialRow {
  id: string;
  site: string;
  data: string;
  created_at: number;
  updated_at: number;
}

export async function GET(req: NextRequest) {
  const unauthorized = await requireSession(req);
  if (unauthorized) return unauthorized;

  const rows = db.prepare("SELECT * FROM credentials").all() as CredentialRow[];

  return NextResponse.json(
    rows.map((r) => ({
      id: r.id,
      site: r.site,
      data: r.data,
      createdAt: r.created_at,
      updatedAt: r.updated_at,
    })),
    { headers: { [VAULT_VERSION_HEADER]: String(getVaultMeta()?.version ?? "") } }
  );
}

export async function POST(req: NextRequest) {
  const unauthorized = await requireSession(req);
  if (unauthorized) return unauthorized;
  const stale = checkVaultVersion(req);
  if (stale) return stale;

  const body = await req.json();
  const { id, data, createdAt, updatedAt } = body as {
    id: string;
    data: string;
    createdAt: number;
    updatedAt: number;
  };

  if (!id || !data) {
    return NextResponse.json({ error: "Missing fields" }, { status: 400 });
  }

  // The site name lives inside the encrypted `data`; the plaintext column is always left empty.
  db.prepare(
    `INSERT INTO credentials (id, site, data, created_at, updated_at)
     VALUES (?, '', ?, ?, ?)
     ON CONFLICT(id) DO UPDATE SET site = '', data = excluded.data, updated_at = excluded.updated_at`
  ).run(id, data, createdAt ?? Date.now(), updatedAt ?? Date.now());

  return NextResponse.json({ ok: true });
}
