#!/usr/bin/env bash
set -euo pipefail

REPO_NAME="${1:-codex-expo-starter}"

if ! command -v gh >/dev/null 2>&1; then
  echo "gh CLI is required. Install: https://cli.github.com/"
  exit 1
fi

if [[ ! -d .git ]]; then
  echo "Run this from the root of the starter repository."
  exit 1
fi

git add .
git commit -m "chore: initialize codex expo starter" || true
git branch -M main

gh repo create "$REPO_NAME" --private --source=. --remote=origin --push
echo "Repository created."
echo "Now enable Template repository in GitHub Settings > General."
