#!/bin/sh
set -eu
cd "$(dirname "$0")/.."
docker compose config --quiet
docker compose up -d --build --wait --wait-timeout 180
docker compose exec -T homepage node -e "fetch('http://127.0.0.1:3000/api/healthcheck').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
docker compose restart homepage
docker compose up -d --wait --wait-timeout 120
docker compose exec -T homepage node -e "fetch('http://127.0.0.1:3000/api/healthcheck').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
docker compose ps
