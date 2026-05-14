#!/usr/bin/env bash
# UserPromptSubmit hook for Claude Code. Reads stdin (CC hook input JSON),
# extracts prompt + file scope, runs scripts/route.mjs, returns CC injection JSON.
set -u
INPUT="$(cat)"
REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"

# Extract prompt via Node (safe parse; falls back to empty on error).
PROMPT="$(printf '%s' "$INPUT" | node -e 'let raw=""; process.stdin.on("data",d=>raw+=d); process.stdin.on("end",()=>{try{const j=JSON.parse(raw);console.log(j.prompt||j.tool_input?.prompt||"");}catch{console.log("");}})' 2>/dev/null)"

if [ -z "$PROMPT" ]; then exit 0; fi

# Collect file scope from git status + git diff. Fail-open if git unavailable.
GIT_STATUS="$(git -C "$REPO_ROOT" status --porcelain 2>/dev/null || true)"
GIT_DIFF="$(git -C "$REPO_ROOT" diff --name-only HEAD~3..HEAD 2>/dev/null || true)"

# Combine the file scope; cap to 20; comma-separate for CLI arg.
FILES_IN_SCOPE="$(
  {
    printf '%s\n' "$PROMPT" \
      | grep -oE '(src|lab|build|spec|ship|docs|shared|scripts|tests)/[A-Za-z0-9_./-]+' || true
    printf '%s\n' "$PROMPT" \
      | grep -oE '[A-Za-z0-9_./-]+\.(py|go|ts|tsx|js|jsx|mjs|cjs|java|kt|kts|rs|cpp|cc|h|hpp|cs|dart|rb|php|swift|md|json|yaml|yml|toml|sh)\b' || true
    printf '%s\n' "$GIT_STATUS" | awk '{sub(/^.. /,""); print}' | grep -v '^$' || true
    printf '%s\n' "$GIT_DIFF" | grep -v '^$' || true
  } \
  | sort -u \
  | head -20 \
  | paste -sd, -
)"

# Run route.mjs; capture output; fail silent on error.
NARROWING="$(node "$REPO_ROOT/scripts/route.mjs" --prompt "$PROMPT" --files-in-scope "$FILES_IN_SCOPE" 2>/dev/null || true)"

if [ -z "$NARROWING" ]; then exit 0; fi

# Emit CC hook output as JSON, using python3 for safe string escaping.
ESCAPED="$(printf '%s' "$NARROWING" | head -c 6000 | python3 -c 'import json,sys; print(json.dumps(sys.stdin.read()))' 2>/dev/null || printf '""')"
printf '{"hookSpecificOutput":{"additionalContext":%s}}\n' "$ESCAPED"
