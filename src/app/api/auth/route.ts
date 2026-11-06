import { NextRequest, NextResponse } from "next/server";
import { getVaultMeta } from "@/lib/server/vault";
import { clearLoginFailures, loginRetryAfter, recordLoginFailure } from "@/lib/server/rateLimit";
import { createSessionToken, getSessionIdFromToken, revokeSession, SESSION_COOKIE } from "@/lib/server/session";
import { sha256Hex, safeEqual } from "@/lib/server/hash";

function clientIp(req: NextRequest): string | null {
  const forwarded = req.headers.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0].trim();
  return req.headers.get("x-real-ip");
}

/**
 * The client derives authSecret from the master password via PBKDF2 (separate
 * from the encryption key, so this value can't be used to decrypt the vault).
 * The server only ever stores/compares its SHA-256 hash.
 *
 * Failed attempts are rate limited (lib/server/rateLimit.ts). On success the response carries
 * the vault verifier, which the client needs to check its decryption key; it is never public.
 */
export async function POST(req: NextRequest) {
  const ip = clientIp(req);
  const retryAfter = loginRetryAfter(ip);
  if (retryAfter > 0) {
    return NextResponse.json(
      { error: "Too many attempts", retryAfter },
      { status: 429, headers: { "Retry-After": String(retryAfter) } }
    );
  }

  const row = getVaultMeta();
  if (!row) {
    return NextResponse.json({ error: "Vault not set up" }, { status: 404 });
  }

  const { authSecret } = (await req.json()) as { authSecret?: string };
  if (!authSecret) {
    return NextResponse.json({ error: "Missing authSecret" }, { status: 400 });
  }

  const candidateHash = sha256Hex(authSecret);
  if (!safeEqual(candidateHash, row.auth_secret_hash)) {
    recordLoginFailure(ip);
    return NextResponse.json({ error: "Invalid credentials" }, { status: 401 });
  }
  clearLoginFailures(ip);

  const token = await createSessionToken(ip, req.headers.get("user-agent"));
  const res = NextResponse.json({
    ok: true,
    saltB64: row.salt_b64,
    iterations: row.kdf_iterations,
    version: row.version,
    verifier: row.verifier,
  });
  res.cookies.set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: true,
    sameSite: "strict",
    path: "/",
    maxAge: 60 * 60 * 24 * 30,
  });
  return res;
}

export async function DELETE(req: NextRequest) {
  const token = req.cookies.get(SESSION_COOKIE)?.value;
  if (token) {
    const sessionId = await getSessionIdFromToken(token);
    if (sessionId) revokeSession(sessionId);
  }

  const res = NextResponse.json({ ok: true });
  res.cookies.delete(SESSION_COOKIE);
  return res;
}
