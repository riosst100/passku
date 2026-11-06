/**
 * Passku no longer stores anything offline: the vault lives in memory while unlocked (lib/credentials.ts)
 * and every unlock goes to the server. Older versions cached the ciphertext, salt and verifier in this
 * IndexedDB database, which let anyone holding the device guess the master password offline; it is
 * deleted on every start so devices that still have it get cleaned up.
 */
const LEGACY_DB_NAME = "passku-db";

export function purgeLegacyOfflineData(): Promise<void> {
  if (typeof indexedDB === "undefined") return Promise.resolve();
  return new Promise((resolve) => {
    const req = indexedDB.deleteDatabase(LEGACY_DB_NAME);
    req.onsuccess = req.onerror = req.onblocked = () => resolve();
  });
}
