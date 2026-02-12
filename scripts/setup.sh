#!/usr/bin/env bash
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

if command -v npm >/dev/null 2>&1; then
  echo "Installing MCP server dependencies..."
  npm --prefix "$REPO_ROOT/mcp-servers/gluestack-mcp" install
  npm --prefix "$REPO_ROOT" install
else
  echo "npm not found; skipping dependency installation."
fi

echo "Starter setup complete."
echo "Next steps:"
echo "1) Update .codex/config.toml Supabase URL"
echo "2) Export env vars from .env.example"
echo "3) Commit your project-specific AGENTS/memories changes"
