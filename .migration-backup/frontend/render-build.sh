#!/usr/bin/env bash
set -euo pipefail

# Standalone npm build for Render. Do not use pnpm here — the repo root is a
# separate pnpm workspace and will not install this package's dependencies.
cd "$(dirname "$0")"

rm -rf node_modules .next .cache

if command -v npm >/dev/null 2>&1; then
  npm install --no-audit --no-fund
  npm run build
else
  echo "npm is required for recruit-frontend builds." >&2
  exit 1
fi
