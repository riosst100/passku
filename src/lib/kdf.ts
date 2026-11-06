/** PBKDF2-SHA256 iteration counts (shared by browser and server). */

/** Vaults created before iteration counts were stored. */
export const LEGACY_ITERATIONS = 250_000;
/** OWASP's current recommendation for PBKDF2-HMAC-SHA256. New and upgraded vaults use this. */
export const TARGET_ITERATIONS = 600_000;
/** Upper bound the server accepts, so a bad client can't make every unlock take minutes. */
export const MAX_ITERATIONS = 5_000_000;
