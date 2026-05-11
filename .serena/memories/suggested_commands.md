# Suggested Commands

## Initial setup on a new machine

```bash
git clone --recursive git@github.com:Elessar617/workspace-blueprint.git
cd workspace-blueprint
./scripts/bootstrap.sh
```

`bootstrap.sh` is idempotent — safe to re-run.

## Daily development

```bash
npm test                         # full suite (unit + hook + integration tests)
npm run test:unit                # unit tests only (Node --test, all *.test.mjs)
npm run rebuild-registry         # rebuild .claude/registry/ from ECC + harness scan
npm run rebuild-harness          # rebuild only harness side (fast; for after /plugin install)
```

## Maintenance

```bash
./scripts/update-ecc.sh          # bump ECC submodule + rebuild + STAGE (no auto-commit)
./scripts/refresh-harness.sh     # rescan ~/.claude/plugins + settings.json + STAGE
./scripts/bootstrap.sh           # idempotent setup verifier
```

## Hook profile override

```bash
export BLUEPRINT_HOOK_PROFILE=minimal     # bypass all 4 native hooks for the session
export BLUEPRINT_HOOK_PROFILE=standard    # default behavior
export BLUEPRINT_HOOK_PROFILE=strict      # reserved for ship/ workflows
```

## Git submodule (if external/ecc/ is empty)

```bash
git submodule update --init --recursive
```

## System (Darwin / macOS)

- Default shell tools are BSD variants; prefer GNU coreutils via Homebrew if you need GNU semantics
- `find` syntax: `find . -name '*.mjs' -type f`
- `grep -E` for extended regex (BSD grep supports `-E`)
- `sed -i ''` (BSD requires the empty-string backup arg, unlike GNU)
- `jq` is available for JSON; install via `brew install jq` if absent

## Manual routing test

```bash
node scripts/route.mjs --prompt "add a rate limiter to gateway.go"
# Prints routing summary; writes .claude/routing/.current.json cache

echo '{"prompt":"fix the broken login"}' | ./.claude/hooks/route-inject.sh
# Emits CC hook injection JSON
```
