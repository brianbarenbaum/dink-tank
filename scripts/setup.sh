#!/usr/bin/env bash
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

if command -v npm >/dev/null 2>&1; then
  echo "Installing starter dependencies..."
  npm --prefix "$REPO_ROOT" install
else
  echo "npm not found; skipping dependency installation."
fi

echo "Starter setup complete."
echo "Next steps:"
echo "1) Set this repo's origin to your new project URL"
echo "2) Update .codex/config.toml (Context7/Supabase as needed)"
echo "3) Export env vars from .env.example"
echo "4) Customize .codex/AGENTS.md and memories for your project domain"
