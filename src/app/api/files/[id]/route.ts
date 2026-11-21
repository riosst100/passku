import { NextRequest, NextResponse } from "next/server";
import db from "@/lib/server/db";
import { requireSession } from "@/lib/server/requireSession";
import { checkVaultVersion } from "@/lib/server/vault";

/** Must match MAX_FILE_BYTES in lib/files.ts (plus the 12-byte IV and 16-byte GCM tag). */
const MAX_UPLOAD_BYTES = 10 * 1024 * 1024 + 28;
const ID_PATTERN = /^[0-9a-f-]{36}$/i;

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const unauthorized = await requireSession(req);
  if (unauthorized) return unauthorized;

  const { id } = await params;
  const row = db.prepare("SELECT data FROM files WHERE id = ?").get(id) as { data: Buffer } | undefined;
  if (!row) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return new NextResponse(new Uint8Array(row.data), {
    headers: { "Content-Type": "application/octet-stream", "Cache-Control": "no-store" },
  });
}

/** Stores the already-encrypted bytes; the server never sees the file key. */
export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const unauthorized = await requireSession(req);
  if (unauthorized) return unauthorized;
  const stale = checkVaultVersion(req);
  if (stale) return stale;

  const { id } = await params;
  if (!ID_PATTERN.test(id)) return NextResponse.json({ error: "Invalid id" }, { status: 400 });
  if (Number(req.headers.get("content-length") ?? 0) > MAX_UPLOAD_BYTES) {
    return NextResponse.json({ error: "File too large" }, { status: 413 });
  }
  const data = Buffer.from(await req.arrayBuffer());
  if (data.length < 28) return NextResponse.json({ error: "Empty file" }, { status: 400 });
  if (data.length > MAX_UPLOAD_BYTES) return NextResponse.json({ error: "File too large" }, { status: 413 });

  db.prepare(
    `INSERT INTO files (id, data, created_at) VALUES (?, ?, ?)
     ON CONFLICT(id) DO UPDATE SET data = excluded.data`
  ).run(id, data, Date.now());
  return NextResponse.json({ ok: true });
}
