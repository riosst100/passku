#!/usr/bin/env bash
# Daily backup of the Passku vault (data/passku.db) with SQLite's online backup, so it is consistent
# while the app runs. Keeps the last 30 days. Cron: 15 3 * * * /var/www/passku/backup.sh
# The vault is already encrypted with the master password, but keep the folder private anyway.
set -euo pipefail
cd "$(dirname "$0")"
DEST="${PASSKU_BACKUP_DIR:-$HOME/backups/passku}"
KEEP_DAYS="${PASSKU_BACKUP_KEEP_DAYS:-30}"
TMP=data/.backup-tmp.db
umask 077
mkdir -p "$DEST"
rm -f "$TMP"

docker exec passku node -e '
  const Database = require("better-sqlite3");
  const src = new Database("/app/data/passku.db", { readonly: true });
  src.backup("/app/data/.backup-tmp.db").then(() => {
    const copy = new Database("/app/data/.backup-tmp.db", { readonly: true });
    const ok = copy.pragma("integrity_check", { simple: true });
    const n = copy.prepare("SELECT count(*) AS n FROM credentials").get().n;
    if (ok !== "ok") { console.error("integrity_check: " + ok); process.exit(1); }
    console.log(n + " credentials");
  }).catch((e) => { console.error(e.message); process.exit(1); });
'
out="$DEST/passku-$(date +%Y%m%d-%H%M%S).db.gz"
gzip -c "$TMP" > "$out"
rm -f "$TMP"
find "$DEST" -name 'passku-*.db.gz' -mtime +"$KEEP_DAYS" -delete
echo "Backup: $out"
