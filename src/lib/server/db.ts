import Database from "better-sqlite3";
import path from "node:path";
import fs from "node:fs";

const dataDir = process.env.PASSKU_DATA_DIR ?? path.join(process.cwd(), "data");
if (!fs.existsSync(/*turbopackIgnore: true*/ dataDir)) {
  fs.mkdirSync(/*turbopackIgnore: true*/ dataDir, { recursive: true });
}

const db = new Database(path.join(dataDir, "passku.db"));
db.pragma("journal_mode = WAL");

db.exec(`
  CREATE TABLE IF NOT EXISTS vault_meta (
    id TEXT PRIMARY KEY,
    salt_b64 TEXT NOT NULL,
    verifier TEXT NOT NULL,
    auth_secret_hash TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS credentials (
    id TEXT PRIMARY KEY,
    site TEXT NOT NULL,
    data TEXT NOT NULL,
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL
  );

  -- Encrypted file contents (iv || AES-GCM ciphertext); item_id is the document in credentials.
  CREATE TABLE IF NOT EXISTS files (
    id TEXT PRIMARY KEY,
    item_id TEXT,
    data BLOB NOT NULL,
    created_at INTEGER NOT NULL
  );

  CREATE TABLE IF NOT EXISTS sessions (
    id TEXT PRIMARY KEY,
    ip TEXT,
    user_agent TEXT,
    created_at INTEGER NOT NULL,
    last_seen_at INTEGER NOT NULL,
    revoked_at INTEGER
  );
`);

// Added later: vaults created before these columns existed used 250k iterations and are version 1.
const vaultMetaColumns = (db.prepare("PRAGMA table_info(vault_meta)").all() as { name: string }[]).map(
  (c) => c.name
);
if (!vaultMetaColumns.includes("kdf_iterations")) {
  db.exec("ALTER TABLE vault_meta ADD COLUMN kdf_iterations INTEGER NOT NULL DEFAULT 250000");
}
if (!vaultMetaColumns.includes("version")) {
  db.exec("ALTER TABLE vault_meta ADD COLUMN version INTEGER NOT NULL DEFAULT 1");
}

const fileColumns = (db.prepare("PRAGMA table_info(files)").all() as { name: string }[]).map((c) => c.name);
if (!fileColumns.includes("item_id")) {
  db.exec("ALTER TABLE files ADD COLUMN item_id TEXT");
}
db.exec("CREATE INDEX IF NOT EXISTS files_item_id ON files(item_id)");

export default db;
