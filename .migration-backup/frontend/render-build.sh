#!/usr/bin/env bash
set -euo pipefail

# Render build entrypoint. Works with dashboard `bash render-build.sh` or legacy
# `pnpm install && pnpm run build` (frontend is now a pnpm workspace package).
cd "$(dirname "$0")"

rm -rf node_modules .next .cache

if command -v pnpm >/dev/null 2>&1 && [[ "${RENDER_USE_NPM:-}" != "1" ]]; then
  pnpm install --no-frozen-lockfile
  pnpm run build
else
  npm install --no-audit --no-fund
  npm run build
fi
