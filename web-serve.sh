#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")"

export PATH="$HOME/.local/node/bin:$PATH"
if ! command -v node >/dev/null 2>&1; then
  echo "Node.js not found. Install it (e.g. from https://nodejs.org) and ensure 'node' is on your PATH."
  exit 1
fi

if [ ! -d node_modules ]; then
  echo "Installing dependencies…"
  npm install
fi

echo "🔨 Building…"
npm run build

echo ""
echo "──────────────────────────────────────"
echo "  Serving at http://localhost:8080"
echo "  Press Ctrl+C to stop"
echo "──────────────────────────────────────"
echo ""

npm run preview