#!/usr/bin/env bash
set -euo pipefail

usage() {
  cat <<'USAGE'
Usage:
  scripts/review-dispatch.sh [--base <git-ref>] [--write-prompts] [--out-dir <dir>]

Options:
  --base <git-ref>   Compare changes using git diff <base>...HEAD
  --write-prompts    Write ready-to-send reviewer prompts for required agents
  --out-dir <dir>    Output directory for generated prompts (default: .codex/review-prompts)
  -h, --help         Show this help

Examples:
  scripts/review-dispatch.sh
  scripts/review-dispatch.sh --base origin/main
  scripts/review-dispatch.sh --base origin/main --write-prompts
USAGE
}

BASE_REF=""
WRITE_PROMPTS=0
OUT_DIR=".codex/review-prompts"

while [[ $# -gt 0 ]]; do
  case "$1" in
    --base)
      BASE_REF="${2:-}"
      shift 2
      ;;
    --write-prompts)
      WRITE_PROMPTS=1
      shift
      ;;
    --out-dir)
      OUT_DIR="${2:-}"
      shift 2
      ;;
    -h|--help)
      usage
      exit 0
      ;;
    *)
      echo "Unknown argument: $1" >&2
      usage
      exit 1
      ;;
  esac
done

REPO_ROOT="$(git rev-parse --show-toplevel)"
cd "$REPO_ROOT"

collect_changed_files() {
  if [[ -n "$BASE_REF" ]]; then
    if ! git rev-parse --verify "$BASE_REF" >/dev/null 2>&1; then
      echo "Base ref not found: $BASE_REF" >&2
      exit 1
    fi
    git diff --name-only "${BASE_REF}...HEAD" | sed '/^$/d' | sort -u
  else
    {
      git diff --name-only
      git diff --name-only --cached
      git ls-files --others --exclude-standard
    } | sed '/^$/d' | sort -u
  fi
}

declare -A AGENT_NAME
declare -A AGENT_TEMPLATE
declare -A AGENT_REQUIRED
declare -A AGENT_REASONS

AGENT_NAME[1]="Agent 1 - Frontend UI & UX Reviewer"
AGENT_NAME[2]="Agent 2 - Supabase DBA"
AGENT_NAME[3]="Agent 3 - Application Security Reviewer"
AGENT_NAME[4]="Agent 4 - LLM Integration Reviewer"
AGENT_NAME[5]="Agent 5 - Test & Quality Gatekeeper"
AGENT_NAME[6]="Agent 6 - UI Screenshot & Design Parity Reviewer"
AGENT_NAME[7]="Agent 7 - Docs & Architecture Reviewer"
AGENT_NAME[8]="Agent 8 - Web Security, Privacy & Accessibility Reviewer"

AGENT_TEMPLATE[1]=".codex/prompt-templates/review/agent-1-web-ui.md"
AGENT_TEMPLATE[2]=".codex/prompt-templates/review/agent-2-supabase-dba.md"
AGENT_TEMPLATE[3]=".codex/prompt-templates/review/agent-3-app-security.md"
AGENT_TEMPLATE[4]=".codex/prompt-templates/review/agent-4-llm-integration.md"
AGENT_TEMPLATE[5]=".codex/prompt-templates/review/agent-5-test-quality.md"
AGENT_TEMPLATE[6]=".codex/prompt-templates/review/agent-6-ui-parity.md"
AGENT_TEMPLATE[7]=".codex/prompt-templates/review/agent-7-docs-architecture.md"
AGENT_TEMPLATE[8]=".codex/prompt-templates/review/agent-8-web-security-privacy-accessibility.md"

add_agent() {
  local agent_id="$1"
  local reason="$2"
  AGENT_REQUIRED["$agent_id"]=1
  if [[ -z "${AGENT_REASONS[$agent_id]:-}" ]]; then
    AGENT_REASONS["$agent_id"]="$reason"
  elif [[ "${AGENT_REASONS[$agent_id]}" != *"$reason"* ]]; then
    AGENT_REASONS["$agent_id"]+=$'; '"$reason"
  fi
}

CHANGED_FILES="$(collect_changed_files)"

if [[ -z "$CHANGED_FILES" ]]; then
  echo "No changed files found."
  echo "Nothing to dispatch."
  exit 0
fi

while IFS= read -r file; do
  [[ -z "$file" ]] && continue

  if [[ "$file" == src/components/* || "$file" == src/pages/* || "$file" == src/layouts/* || "$file" == src/App.vue || "$file" == src/views/* || "$file" == components/* || "$file" == pages/* || "$file" == layouts/* ]]; then
    add_agent 1 "UI surface changed"
    add_agent 6 "Visual UI flow changed"
  fi

  if [[ "$file" == supabase/* || "$file" == *.sql || "$file" == *migration* || "$file" == lib/repositories/sql.ts ]]; then
    add_agent 2 "DB schema/migration/query surface changed"
  fi

  if [[ "$file" == api/* || "$file" == backend/* || "$file" == server/* || "$file" == supabase/functions/* || "$file" == lib/auth/* || "$file" == src/server/* || "$file" == src/lib/auth/* || "$file" == src/router/* || "$file" == middleware/* || "$file" == docs/security/* || "$file" == vite.config.ts || "$file" == vite.config.js || "$file" == .env.example ]]; then
    add_agent 3 "Application security boundary or config changed"
  fi

  if [[ "$file" == *openai* || "$file" == backend/*llm* || "$file" == backend/*prompts/* || "$file" == src/lib/llm/* || "$file" == src/prompts/* ]]; then
    add_agent 4 "LLM integration surface changed"
  fi

  if [[ "$file" == *__tests__* || "$file" == *.test.ts || "$file" == *.test.tsx || "$file" == *.spec.ts || "$file" == *.spec.tsx || "$file" == e2e/* || "$file" == package.json || "$file" == tsconfig.json || "$file" == tsconfig.* || "$file" == biome.json || "$file" == vitest.config.ts || "$file" == vitest.config.mts || "$file" == playwright.config.ts || "$file" == tailwind.config.ts || "$file" == tailwind.config.js || "$file" == postcss.config.js || "$file" == vite.config.ts || "$file" == vite.config.js || "$file" == components.json || "$file" == scripts/* || "$file" == .devcontainer/* || "$file" == .cursor/* ]]; then
    add_agent 5 "Tests/config/tooling changed"
  fi

  if [[ "$file" == docs/* || "$file" == README.md || "$file" == .codex/AGENTS.md || "$file" == .codex/skills/* || "$file" == .codex/prompt-templates/* || "$file" == .codex/config.toml ]]; then
    add_agent 7 "Docs/architecture guidance changed"
  fi

  if [[ "$file" == vite.config.ts || "$file" == vite.config.js || "$file" == nginx.conf || "$file" == caddy/* || "$file" == server/* || "$file" == docs/ops/privacy-data-disclosure.md || "$file" == docs/security/* || "$file" == src/pages/login* || "$file" == src/pages/settings* || "$file" == src/router/* ]]; then
    add_agent 8 "Web delivery/compliance surface changed"
  fi
done <<< "$CHANGED_FILES"

echo "Dispatch summary"
echo "================"
echo
echo "Changed files:"
while IFS= read -r file; do
  echo "- $file"
done <<< "$CHANGED_FILES"
echo

if [[ ${#AGENT_REQUIRED[@]} -eq 0 ]]; then
  echo "No reviewer agents matched current changes."
  echo "Lead Builder can proceed with standard verification gates."
  exit 0
fi

echo "Required reviewers:"
for id in 1 2 3 4 5 6 7 8; do
  if [[ -n "${AGENT_REQUIRED[$id]:-}" ]]; then
    echo "- ${AGENT_NAME[$id]}"
    echo "  Reason: ${AGENT_REASONS[$id]}"
    echo "  Template: ${AGENT_TEMPLATE[$id]}"
  fi
done

if [[ "$WRITE_PROMPTS" -eq 1 ]]; then
  mkdir -p "$OUT_DIR"
  rm -f "$OUT_DIR"/agent-*-prompt.md
  changed_files_bullets="$(printf '%s\n' "$CHANGED_FILES" | sed 's/^/- /')"

  echo
  echo "Generating prompt files in $OUT_DIR ..."
  for id in 1 2 3 4 5 6 7 8; do
    if [[ -z "${AGENT_REQUIRED[$id]:-}" ]]; then
      continue
    fi

    template="${AGENT_TEMPLATE[$id]}"
    if [[ ! -f "$template" ]]; then
      echo "Missing template for agent $id: $template" >&2
      continue
    fi

    out_file="$OUT_DIR/agent-${id}-prompt.md"
    cat "$template" > "$out_file"
    cat >> "$out_file" <<PROMPT

## Dispatch Context

Reason:
${AGENT_REASONS[$id]}

Changed files:
${changed_files_bullets}
PROMPT
    echo "- Wrote $out_file"
  done
fi
