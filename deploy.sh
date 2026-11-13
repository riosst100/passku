#!/usr/bin/env bash
# Production deploy: pull the latest master and the image CI built, swap the container.
# GitHub Actions (.github/workflows/deploy.yml) builds and pushes the image (ghcr.io) and sends a
# short-lived token on stdin so this server only pulls it. Run by hand (no token), it builds locally.
# Wrapped in { } so bash reads the whole script before `git merge` can replace this file.
{
set -euo pipefail
cd "$(dirname "$0")"
git fetch --prune origin master
git merge --ff-only origin/master

# stdin from CI: line 1 = GitHub user, line 2 = token.
user=""; token=""
[ -t 0 ] || { IFS= read -r -t 10 user && IFS= read -r -t 10 token; } || true
if [ -n "$token" ]; then
  # Throwaway login: the token never lands in ~/.docker/config.json.
  DOCKER_CONFIG="$(mktemp -d)"; export DOCKER_CONFIG
  trap 'rm -rf "$DOCKER_CONFIG"' EXIT
  printf '%s' "$token" | docker login ghcr.io -u "$user" --password-stdin >/dev/null
  docker compose pull
else
  # Build first: if it fails, the running container keeps serving the old version.
  docker compose build
fi
docker compose up -d --no-build
docker image prune -f >/dev/null
echo "Deployed passku $(git rev-parse --short HEAD)"
exit
}
