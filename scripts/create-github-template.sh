#!/usr/bin/env bash
set -euo pipefail

REPO_NAME="${1:-codex-vue-starter}"

if ! command -v gh >/dev/null 2>&1; then
  echo "gh CLI is required. Install: https://cli.github.com/"
  exit 1
fi

if [[ ! -d .git ]]; then
  echo "Run this from the root of the starter repository."
  exit 1
fi

# Stage only template source paths so local scratch artifacts are never auto-committed.
declare -a TEMPLATE_PATHS=(
  ".codex"
  ".biomeignore"
  "biome.json"
  ".env.example"
  ".github"
  ".gitignore"
  "AGENTS.md"
  "README.md"
  "docs"
  "e2e"
  "index.html"
  "package-lock.json"
  "package.json"
  "playwright.config.ts"
  "scripts"
  "src"
  "tests"
  "tsconfig.json"
  "vite.config.ts"
  "vitest.config.ts"
)

for path in "${TEMPLATE_PATHS[@]}"; do
  if [[ -e "$path" ]]; then
    git add "$path"
  fi
done

# Block obvious credential leaks before creating the remote repository.
if git diff --cached --name-only | rg -q '\.env$|\.pem$|\.key$'; then
  echo "Staged files include credential-like files. Remove them before continuing."
  exit 1
fi

if ! git diff --cached --quiet; then
  git commit -m "chore: initialize codex vite vue starter"
else
  echo "No staged changes to commit."
fi

git branch -M main

gh repo create "$REPO_NAME" --private --source=. --remote=origin --push
echo "Repository created."
echo "Now enable Template repository in GitHub Settings > General."
