#!/usr/bin/env bash
set -e
REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$REPO_ROOT"

OLD_SHA="$(git -C external/ecc rev-parse HEAD)"
echo "[update-ecc] current ECC SHA: $OLD_SHA"

git submodule update --remote external/ecc

NEW_SHA="$(git -C external/ecc rev-parse HEAD)"
echo "[update-ecc] new ECC SHA:     $NEW_SHA"

if [ "$OLD_SHA" = "$NEW_SHA" ]; then
  echo "[update-ecc] no upstream changes; exiting."
  exit 0
fi

OLD_AGENTS="$(jq 'length' .claude/registry/ecc-agents.json 2>/dev/null || echo 0)"
OLD_SKILLS="$(jq 'length' .claude/registry/ecc-skills.json 2>/dev/null || echo 0)"
OLD_COMMANDS="$(jq 'length' .claude/registry/ecc-commands.json 2>/dev/null || echo 0)"

npm run rebuild-registry

NEW_AGENTS="$(jq 'length' .claude/registry/ecc-agents.json)"
NEW_SKILLS="$(jq 'length' .claude/registry/ecc-skills.json)"
NEW_COMMANDS="$(jq 'length' .claude/registry/ecc-commands.json)"

echo
echo "[update-ecc] inventory diff:"
echo "  agents:   $OLD_AGENTS -> $NEW_AGENTS"
echo "  skills:   $OLD_SKILLS -> $NEW_SKILLS"
echo "  commands: $OLD_COMMANDS -> $NEW_COMMANDS"

echo
echo "[update-ecc] ECC surface audit (routed vs. available):"
ROUTED_NAMES=$(grep -hoE '`[a-z][a-z0-9-]+`' .claude/routing/*.md 2>/dev/null | tr -d '`' | sort -u)
count_routed() {
  local registry="$1"
  echo "$ROUTED_NAMES" | while read name; do
    [ -n "$name" ] || continue
    jq -r --arg n "$name" '.[] | select(.name==$n) | .name' "$registry" 2>/dev/null
  done | sort -u | wc -l | tr -d ' '
}
ROUTED_ECC_AGENTS=$(count_routed .claude/registry/ecc-agents.json)
ROUTED_ECC_SKILLS=$(count_routed .claude/registry/ecc-skills.json)
ROUTED_ECC_COMMANDS=$(count_routed .claude/registry/ecc-commands.json)
printf "  agents:    %4d routed / %4d total\n" "$ROUTED_ECC_AGENTS" "$NEW_AGENTS"
printf "  skills:    %4d routed / %4d total\n" "$ROUTED_ECC_SKILLS" "$NEW_SKILLS"
printf "  commands:  %4d routed / %4d total\n" "$ROUTED_ECC_COMMANDS" "$NEW_COMMANDS"
echo
echo "[update-ecc] NOTE: every ECC item is invocable explicitly even when not"
echo "  routed. Agents: dispatch via Task/Agent tool. Skills: Skill tool or"
echo "  /ecc:<name>. Commands: /ecc:<name>. Routing only controls AUTO-LOAD"
echo "  per task type for token efficiency. Unrouted != disabled."
echo

git add external/ecc .claude/registry/ scripts/update-ecc.sh
echo
echo "[update-ecc] staged the submodule bump and registry updates."
echo "Review with:  git diff --staged"
echo "Commit when ready."
