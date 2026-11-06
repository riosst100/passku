# Passku

Password vault pribadi berbasis Next.js. Semua credential dienkripsi di browser (client-side, AES via Web Crypto) menggunakan key yang diturunkan dari master password — server hanya menyimpan data terenkripsi dan tidak pernah melihat master password maupun isi vault dalam bentuk plain text.

## Fitur

- **Vault terenkripsi end-to-end**: enkripsi/dekripsi terjadi di browser; server hanya menyimpan ciphertext (lihat [src/lib/crypto.ts](src/lib/crypto.ts)).
- **Online-only, tanpa data offline**: vault hanya ada di memori browser selama terbuka dan hilang saat dikunci atau tab ditutup. Tidak ada yang disimpan di IndexedDB, jadi device yang hilang tidak menyimpan apa pun untuk ditebak master password-nya. Data offline dari versi lama dihapus otomatis ([src/lib/db.ts](src/lib/db.ts)).
- **Auto-lock**: vault otomatis terkunci setelah idle beberapa saat ([src/components/IdleLockWatcher.tsx](src/components/IdleLockWatcher.tsx)).
- **Manajemen device & sesi**: setiap login tercatat di server beserta IP dan User-Agent. Lihat daftar device yang sedang login dan blokir akses device tertentu dari panel Devices ([src/components/DevicesPanel.tsx](src/components/DevicesPanel.tsx)). Sesi login baru yang terdeteksi akan memunculkan alert di halaman utama.
- **PWA-ready**: bisa di-install sebagai aplikasi ([src/components/ServiceWorkerRegister.tsx](src/components/ServiceWorkerRegister.tsx)); service worker tidak menyimpan cache.

## Arsitektur singkat

- **Frontend**: Next.js App Router + React 19, state global via Zustand ([src/store/useVaultStore.ts](src/store/useVaultStore.ts)).
- **Backend**: Next.js API routes ([src/app/api](src/app/api)), data disimpan di SQLite (`better-sqlite3`) — lihat [src/lib/server/db.ts](src/lib/server/db.ts).
- **Autentikasi**: sesi berbasis JWT (cookie httpOnly) yang tervalidasi terhadap tabel `sessions` di database, sehingga sesi bisa dilacak dan di-revoke ([src/lib/server/session.ts](src/lib/server/session.ts)).
- **Data yang disimpan server**: hanya ciphertext credential, hash verifier master password, dan metadata sesi (IP/User-Agent) — bukan master password maupun password asli.

## Menjalankan secara lokal

### Prasyarat

- Node.js
- Environment variable `PASSKU_SESSION_SECRET` (secret untuk menandatangani session JWT)

Buat file `.env.local` di root project:

```bash
PASSKU_SESSION_SECRET=<random-secret-string>
```

Generate secret acak, misalnya:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
```

### Install & jalankan

```bash
npm install
npm run dev
```

Buka [http://localhost:3000](http://localhost:3000) (atau port yang tertera di terminal) di browser. Saat pertama kali dibuka, kamu akan diminta membuat master password untuk setup vault.

### Script lain

```bash
npm run build   # build production
npm run start   # jalankan hasil build
npm run lint    # jalankan eslint
```

## Data & environment variable

| Variable | Wajib | Keterangan |
| --- | --- | --- |
| `PASSKU_SESSION_SECRET` | Ya | Secret untuk menandatangani session token (JWT). |
| `PASSKU_DATA_DIR` | Tidak | Lokasi custom untuk file database SQLite. Default: folder `data/` di root project. |

Database SQLite (`passku.db`) berisi vault metadata, credential terenkripsi, dan catatan sesi login — folder `data/` sudah di-gitignore.

## Deployment

Production (https://passku.inovasionline.com) berjalan di Docker di server, dari folder `/var/www/passku`:

- `Dockerfile` + `docker-compose.yml`: container `passku` di `127.0.0.1:3060`, di belakang Caddy (HTTPS).
- `.env` (tidak di git): `PASSKU_SESSION_SECRET`.
- `data/` (tidak di git): database SQLite vault, di-mount ke container. Wajib di-backup.
- `./deploy.sh`: pull `master`, build ulang image, restart container.

Setiap push ke `master` menjalankan `./deploy.sh` di server lewat GitHub Actions ([.github/workflows/deploy.yml](.github/workflows/deploy.yml)).
Secret yang dipakai: `DEPLOY_HOST`, `DEPLOY_USER`, `DEPLOY_SSH_KEY`, `DEPLOY_KNOWN_HOSTS`. Di server, deploy key ini dibatasi
(forced command di `~/.ssh/authorized_keys`), jadi hanya bisa menjalankan deploy.
