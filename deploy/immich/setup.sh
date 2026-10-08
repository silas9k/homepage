#!/bin/sh
set -eu
umask 077
# This audited release is deliberate. Upgrade the URL, hash and env version together.
version=v3.3.1
checksum=2601c893aa3217d3c0c7284c23aaa1699aac75b533c84c0315fd16b7889fd552
target=${1:-/srv/immich/stack}
case "$target" in /srv/*) ;; *) echo 'Choose an absolute directory under /srv.' >&2; exit 1;; esac
script_dir=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)
command -v curl >/dev/null
command -v openssl >/dev/null
command -v sha256sum >/dev/null
if [ -e "$target" ]; then
  echo 'Target already exists; refusing to overwrite an existing Immich installation.' >&2
  exit 1
fi
mkdir -p "$target"
curl --fail --location --proto '=https' --tlsv1.2 \
  "https://github.com/immich-app/immich/releases/download/$version/docker-compose.yml" \
  -o "$target/docker-compose.yml"
printf '%s  %s\n' "$checksum" "$target/docker-compose.yml" | sha256sum --check --status
cp "$script_dir/compose.private.yaml" "$target/compose.private.yaml"
cp "$script_dir/.env.example" "$target/.env"
password=$(openssl rand -hex 32)
sed -i "s/CHANGE_ME_GENERATE_ON_SERVER/$password/" "$target/.env"
unset password
chmod 600 "$target/.env"
printf '%s\n' 'Prepared only; no containers started. Read deploy/immich/README.md before starting.'
