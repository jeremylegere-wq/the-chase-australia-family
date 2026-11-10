#!/usr/bin/env bash
set -e
GAME_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
if command -v xdg-open >/dev/null 2>&1; then
  xdg-open "$GAME_DIR/index.html" >/dev/null 2>&1 &
elif command -v gio >/dev/null 2>&1; then
  gio open "$GAME_DIR/index.html" >/dev/null 2>&1 &
else
  echo "Could not find xdg-open or gio. Open this file in your browser:"
  echo "$GAME_DIR/index.html"
  exit 1
fi
