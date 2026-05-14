#!/usr/bin/env bash
set -e
REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
HOOK="$REPO_ROOT/.claude/hooks/route-inject.sh"

# Clear routing cache to ensure fresh routing
rm -f "$REPO_ROOT/.claude/routing/.current.json"

echo "[test] hook happy path: Go feature prompt"
OUTPUT="$(echo '{"prompt":"add a rate limiter to the Go gateway"}' | "$HOOK")"
if ! echo "$OUTPUT" | grep -q "additionalContext"; then
  echo "FAIL: no additionalContext in output"; echo "$OUTPUT"; exit 1
fi
if ! echo "$OUTPUT" | grep -q "branch: build"; then
  echo "FAIL: branch: build not in output"; echo "$OUTPUT"; exit 1
fi
if ! echo "$OUTPUT" | grep -q "REQUIRED-SKILLS: caveman"; then
  echo "FAIL: expected mandatories missing"; echo "$OUTPUT"; exit 1
fi
if ! echo "$OUTPUT" | grep -q "tdd-loop"; then
  echo "FAIL: tdd-loop mandatory missing"; echo "$OUTPUT"; exit 1
fi
if ! echo "$OUTPUT" | grep -q "active-instincts:"; then
  echo "FAIL: active-instincts block missing"; echo "$OUTPUT"; exit 1
fi
echo "PASS: happy-path hook output structure correct"
