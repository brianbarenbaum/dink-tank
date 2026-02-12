#!/usr/bin/env bash
set -euo pipefail

usage() {
  cat <<'EOF'
Usage:
  scripts/review-run-all.sh [--mode <base|uncommitted|full>] [--base <git-ref>] [--agents <ids>] [--prompts-dir <dir>] [--results-dir <dir>]

Description:
  1) Runs review dispatch with --write-prompts
  2) Runs codex reviewers for each generated agent prompt in parallel
  3) Writes one result file per agent

Options:
  --mode <value>        Review scope mode: base, uncommitted, or full (default: base)
  --base <git-ref>      Base ref for mode=base (default: origin/main)
  --agents <ids>        Comma-separated agent IDs (1-8). Optional in full mode.
  --prompts-dir <dir>   Prompt output dir (default: .codex/review-prompts)
  --results-dir <dir>   Review result dir (default: .codex/review-results)
  -h, --help            Show this help

Mode details:
  --mode base
    Question answered: "What changed in this branch compared to <base>?"
    Scope: git diff <base>...HEAD
    Best for: PR-quality review and merge readiness.

  --mode uncommitted
    Question answered: "What is currently changed in my working tree right now?"
    Scope: staged + unstaged + untracked changes.
    Best for: local WIP review before commit.

  --mode full
    Question answered: "What are the major risks across the whole project right now?"
    Scope: full repository, regardless of current diffs.
    Best for: periodic deep audits.

Practical difference example:
  If you have 3 commits on your branch and 2 local uncommitted edits:
  - mode=base reviews the 3 commits vs origin/main
  - mode=uncommitted reviews the 2 local edits
  - mode=full reviews the whole project

Rule of thumb:
  - Use mode=base for merge/readiness decisions
  - Use mode=uncommitted for day-to-day coding feedback
  - Use mode=full for periodic full-system audits

Model overrides (env vars):
  REVIEW_MODEL_DEFAULT   Default model for unmatched agents (default: gpt-5.1-codex-mini)
  REVIEW_MODEL_HIGH_RISK Model for agents 2,3,4 (default: gpt-5.3-codex)
  REVIEW_MODEL_GENERAL   Model for agents 1,5,6,7,8 (default: gpt-5.1-codex-mini)
EOF
}

MODE="base"
BASE_REF="origin/main"
AGENTS_FILTER=""
PROMPTS_DIR=".codex/review-prompts"
RESULTS_DIR=".codex/review-results"

while [[ $# -gt 0 ]]; do
  case "$1" in
    --mode)
      MODE="${2:-}"
      shift 2
      ;;
    --base)
      BASE_REF="${2:-}"
      shift 2
      ;;
    --agents)
      AGENTS_FILTER="${2:-}"
      shift 2
      ;;
    --prompts-dir)
      PROMPTS_DIR="${2:-}"
      shift 2
      ;;
    --results-dir)
      RESULTS_DIR="${2:-}"
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

if [[ "$MODE" != "base" && "$MODE" != "uncommitted" && "$MODE" != "full" ]]; then
  echo "Invalid --mode value: $MODE (expected: base, uncommitted, or full)" >&2
  usage
  exit 1
fi

if [[ "$MODE" == "uncommitted" && "$BASE_REF" != "origin/main" ]]; then
  echo "Warning: --base is ignored in --mode uncommitted." >&2
fi

if [[ "$MODE" == "full" && "$BASE_REF" != "origin/main" ]]; then
  echo "Warning: --base is ignored in --mode full." >&2
fi

if ! command -v codex >/dev/null 2>&1; then
  echo "codex CLI not found in PATH." >&2
  exit 1
fi

REPO_ROOT="$(git rev-parse --show-toplevel)"
cd "$REPO_ROOT"

declare -A AGENT_TEMPLATE
AGENT_TEMPLATE[1]=".codex/prompt-templates/review/agent-1-mobile-ui.md"
AGENT_TEMPLATE[2]=".codex/prompt-templates/review/agent-2-supabase-dba.md"
AGENT_TEMPLATE[3]=".codex/prompt-templates/review/agent-3-worker-security.md"
AGENT_TEMPLATE[4]=".codex/prompt-templates/review/agent-4-llm-integration.md"
AGENT_TEMPLATE[5]=".codex/prompt-templates/review/agent-5-test-quality.md"
AGENT_TEMPLATE[6]=".codex/prompt-templates/review/agent-6-ui-parity.md"
AGENT_TEMPLATE[7]=".codex/prompt-templates/review/agent-7-docs-architecture.md"
AGENT_TEMPLATE[8]=".codex/prompt-templates/review/agent-8-appstore-compliance.md"

selected_agents() {
  local filter="$1"
  if [[ -z "$filter" ]]; then
    printf '%s\n' 1 2 3 4 5 6 7 8
    return 0
  fi

  local seen=""
  IFS=',' read -r -a ids <<< "$filter"
  for raw_id in "${ids[@]}"; do
    id="$(printf '%s' "$raw_id" | tr -d '[:space:]')"
    if [[ ! "$id" =~ ^[1-8]$ ]]; then
      echo "Invalid --agents value: '$raw_id' (expected comma-separated IDs in 1..8)" >&2
      return 1
    fi
    if [[ ",$seen," == *",$id,"* ]]; then
      continue
    fi
    seen="${seen:+$seen,}$id"
    printf '%s\n' "$id"
  done
}

build_full_prompts() {
  local out_dir="$1"
  local agents_filter="$2"
  local ids

  ids="$(selected_agents "$agents_filter")" || return 1

  mkdir -p "$out_dir"
  rm -f "$out_dir"/agent-*-prompt.md

  echo "Generating full-project reviewer prompts..."
  while IFS= read -r id; do
    [[ -z "$id" ]] && continue
    template="${AGENT_TEMPLATE[$id]:-}"
    if [[ -z "$template" || ! -f "$template" ]]; then
      echo "Missing template for agent $id: $template" >&2
      return 1
    fi

    out_file="$out_dir/agent-${id}-prompt.md"
    cat "$template" > "$out_file"
    cat >> "$out_file" <<'EOF'

## Dispatch Context

Reason:
Full project review requested (diff-independent).

Scope:
Review the full repository, prioritizing high-risk and high-impact findings.
EOF
    echo "- Wrote $out_file"
  done <<< "$ids"
}

echo "Generating reviewer prompts..."
mkdir -p "$PROMPTS_DIR"
rm -f "$PROMPTS_DIR"/agent-*-prompt.md
if [[ "$MODE" == "base" ]]; then
  bash scripts/review-dispatch.sh --base "$BASE_REF" --write-prompts --out-dir "$PROMPTS_DIR"
elif [[ "$MODE" == "uncommitted" ]]; then
  bash scripts/review-dispatch.sh --write-prompts --out-dir "$PROMPTS_DIR"
else
  build_full_prompts "$PROMPTS_DIR" "$AGENTS_FILTER"
fi

shopt -s nullglob
PROMPT_FILES=("$PROMPTS_DIR"/agent-*-prompt.md)
shopt -u nullglob

if [[ ${#PROMPT_FILES[@]} -eq 0 ]]; then
  echo "No generated reviewer prompts found in $PROMPTS_DIR."
  echo "Nothing to run."
  exit 0
fi

mkdir -p "$RESULTS_DIR"

MODEL_DEFAULT="${REVIEW_MODEL_DEFAULT:-gpt-5.1-codex-mini}"
MODEL_HIGH_RISK="${REVIEW_MODEL_HIGH_RISK:-gpt-5.3-codex}"
MODEL_GENERAL="${REVIEW_MODEL_GENERAL:-gpt-5.1-codex-mini}"

model_for_prompt() {
  local prompt_file="$1"
  local base_name
  base_name="$(basename "$prompt_file")"
  case "$base_name" in
    agent-2-*|agent-3-*|agent-4-*)
      printf '%s' "$MODEL_HIGH_RISK"
      ;;
    agent-1-*|agent-5-*|agent-6-*|agent-7-*|agent-8-*)
      printf '%s' "$MODEL_GENERAL"
      ;;
    *)
      printf '%s' "$MODEL_DEFAULT"
      ;;
  esac
}

echo
echo "Running codex reviewers in parallel..."
declare -a PIDS=()
declare -A PID_TO_PROMPT
declare -A PID_DONE
for prompt_file in "${PROMPT_FILES[@]}"; do
  prompt_name="$(basename "$prompt_file" .md)"
  result_name="${prompt_name%-prompt}-review-results"
  result_file="$RESULTS_DIR/${result_name}.txt"
  result_log_file="$RESULTS_DIR/${result_name}.log"
  model="$(model_for_prompt "$prompt_file")"

  echo "- $prompt_name -> model=$model"
  if [[ "$MODE" == "base" ]]; then
    {
      cat "$prompt_file"
      cat <<EOF

## Base Diff Constraint

Review only the changes introduced by:
\`git diff ${BASE_REF}...HEAD\`

Use \`git diff --name-only ${BASE_REF}...HEAD\` to confirm file scope before reporting findings.
EOF
    } | codex exec -c "model=\"$model\"" -o "$result_file" - > "$result_log_file" 2>&1 &
  elif [[ "$MODE" == "uncommitted" ]]; then
    {
      cat "$prompt_file"
      cat <<'EOF'

## Uncommitted Scope Constraint

Review only current local uncommitted changes:
- staged changes
- unstaged changes
- untracked files

Before reporting findings, confirm scope with:
- `git status --short`
- `git diff --name-only`
- `git diff --name-only --cached`
EOF
    } | codex exec -c "model=\"$model\"" -o "$result_file" - > "$result_log_file" 2>&1 &
  else
    codex exec -c "model=\"$model\"" -o "$result_file" - < "$prompt_file" > "$result_log_file" 2>&1 &
  fi
  pid="$!"
  PIDS+=("$pid")
  PID_TO_PROMPT["$pid"]="$prompt_name"
done

status=0
remaining=${#PIDS[@]}
while [[ "$remaining" -gt 0 ]]; do
  for pid in "${PIDS[@]}"; do
    if [[ -n "${PID_DONE[$pid]:-}" ]]; then
      continue
    fi

    if ! kill -0 "$pid" >/dev/null 2>&1; then
      if wait "$pid"; then
        echo "  [done] ${PID_TO_PROMPT[$pid]} (success) - ${remaining} -> $((remaining - 1)) remaining"
      else
        echo "  [done] ${PID_TO_PROMPT[$pid]} (failed) - ${remaining} -> $((remaining - 1)) remaining"
        status=1
      fi
      PID_DONE["$pid"]=1
      remaining=$((remaining - 1))
    fi
  done
  sleep 0.2
done

echo
echo "Review outputs:"
for prompt_file in "${PROMPT_FILES[@]}"; do
  prompt_name="$(basename "$prompt_file" .md)"
  result_name="${prompt_name%-prompt}-review-results"
  echo "- $RESULTS_DIR/${result_name}.txt"
  echo "  log: $RESULTS_DIR/${result_name}.log"
done

if [[ "$status" -ne 0 ]]; then
  echo
  echo "One or more reviewer runs failed. Check the result files for details." >&2
  exit 1
fi

echo
echo "All reviewer runs completed."
