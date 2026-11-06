/**
 * In-memory limiter for failed master-password attempts (one container, so memory is enough;
 * a restart resets it). Only failures count; a successful login clears that IP's record.
 *
 * - Per IP: 5 failures per 15 minutes.
 * - Global: 100 failures per hour across all IPs, as a backstop against attackers rotating IPs.
 */
const IP_WINDOW_MS = 15 * 60 * 1000;
const IP_MAX_FAILURES = 5;
const GLOBAL_WINDOW_MS = 60 * 60 * 1000;
const GLOBAL_MAX_FAILURES = 100;
const MAX_TRACKED_IPS = 10_000;

const ipFailures = new Map<string, number[]>();
let globalFailures: number[] = [];

function recent(times: number[], windowMs: number, now: number): number[] {
  return times.filter((t) => now - t < windowMs);
}

/** Seconds until another attempt is allowed, or 0 when the request may proceed. */
export function loginRetryAfter(ip: string | null): number {
  const now = Date.now();
  globalFailures = recent(globalFailures, GLOBAL_WINDOW_MS, now);
  const mine = recent(ipFailures.get(ip ?? "unknown") ?? [], IP_WINDOW_MS, now);

  let waitMs = 0;
  if (mine.length >= IP_MAX_FAILURES) waitMs = Math.max(waitMs, mine[0] + IP_WINDOW_MS - now);
  if (globalFailures.length >= GLOBAL_MAX_FAILURES) {
    waitMs = Math.max(waitMs, globalFailures[0] + GLOBAL_WINDOW_MS - now);
  }
  return Math.ceil(waitMs / 1000);
}

export function recordLoginFailure(ip: string | null): void {
  const now = Date.now();
  const key = ip ?? "unknown";
  if (!ipFailures.has(key) && ipFailures.size >= MAX_TRACKED_IPS) {
    for (const [k, times] of ipFailures) {
      if (recent(times, IP_WINDOW_MS, now).length === 0) ipFailures.delete(k);
    }
  }
  ipFailures.set(key, [...recent(ipFailures.get(key) ?? [], IP_WINDOW_MS, now), now]);
  globalFailures.push(now);
}

export function clearLoginFailures(ip: string | null): void {
  ipFailures.delete(ip ?? "unknown");
}
