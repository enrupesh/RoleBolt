#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")"
rm -rf node_modules .next .cache
npm install --no-audit --no-fund
npm run build
