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
DIFF_RANGE="$(printf '%s\n' "$PROMPT" | grep -oE '[A-Za-z0-9_./~^-]+\.{2,3}[A-Za-z0-9_./~^-]+' | head -1 || true)"
if [ -n "$DIFF_RANGE" ]; then
  GIT_DIFF="$(git -C "$REPO_ROOT" diff --name-only "$DIFF_RANGE" 2>/dev/null || true)"
else
  GIT_DIFF="$(git -C "$REPO_ROOT" diff --name-only HEAD~3..HEAD 2>/dev/null || true)"
fi

# Combine the file scope via the tested JS helper; prompt paths stay ahead of
# git-derived paths before the helper caps the list.
FILES_IN_SCOPE="$(
  ROUTING_PROMPT="$PROMPT" \
  ROUTING_GIT_STATUS="$GIT_STATUS" \
  ROUTING_GIT_DIFF="$GIT_DIFF" \
  node --input-type=module - "$REPO_ROOT" <<'NODE' 2>/dev/null || true
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

const repoRoot = process.argv[2];
const { extractFileScope } = await import(pathToFileURL(join(repoRoot, 'scripts/lib/file-scope.mjs')));
const files = extractFileScope({
  prompt: process.env.ROUTING_PROMPT || '',
  gitStatusOutput: process.env.ROUTING_GIT_STATUS || '',
  gitDiffOutput: process.env.ROUTING_GIT_DIFF || '',
});
process.stdout.write(files.join(','));
NODE
)"

# Run route.mjs; capture output; fail silent on error.
NARROWING="$(node "$REPO_ROOT/scripts/route.mjs" --prompt "$PROMPT" --files-in-scope "$FILES_IN_SCOPE" 2>/dev/null || true)"

if [ -z "$NARROWING" ]; then exit 0; fi

# Emit CC hook output as JSON, using python3 for safe string escaping and
# character-level truncation so UTF-8 is not cut mid-byte.
ESCAPED="$(printf '%s' "$NARROWING" | python3 -c 'import json,sys; print(json.dumps(sys.stdin.read()[:6000]))' 2>/dev/null || printf '""')"
printf '{"hookSpecificOutput":{"additionalContext":%s}}\n' "$ESCAPED"
