#!/usr/bin/env sh
set -eu

cd "$(dirname "$0")/.."

if ! command -v cargo >/dev/null 2>&1; then
  echo "Rust/Cargo is required to start the Tauri desktop app."
  echo "Install Rust from https://rustup.rs, then run: npm run dev"
  exit 1
fi

if [ ! -d node_modules ]; then
  echo "Installing frontend dependencies..."
  npm install
fi

exec npm run tauri:dev
