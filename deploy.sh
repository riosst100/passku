#!/usr/bin/env bash
# Production deploy: pull the latest master, rebuild the image and swap the container.
# Run from this folder, or by GitHub Actions over SSH (.github/workflows/deploy.yml).
# Wrapped in { } so bash reads the whole script before `git merge` can replace this file.
{
set -euo pipefail
cd "$(dirname "$0")"
git fetch --prune origin master
git merge --ff-only origin/master
# Build first: if it fails, the running container keeps serving the old version.
docker compose build
docker compose up -d
docker image prune -f >/dev/null
echo "Deployed passku $(git rev-parse --short HEAD)"
exit
}
