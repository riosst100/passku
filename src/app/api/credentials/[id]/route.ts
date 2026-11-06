import { NextRequest, NextResponse } from "next/server";
import db from "@/lib/server/db";
import { requireSession } from "@/lib/server/requireSession";
import { checkVaultVersion } from "@/lib/server/vault";

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const unauthorized = await requireSession(req);
  if (unauthorized) return unauthorized;
  const stale = checkVaultVersion(req);
  if (stale) return stale;

  const { id } = await params;
  db.prepare("DELETE FROM credentials WHERE id = ?").run(id);
  return NextResponse.json({ ok: true });
}
