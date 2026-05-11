# Code Style & Conventions

## Naming

- **Files:** kebab-case (`route-inject.sh`, `ecc-scraper.mjs`, `unix-philosophy.md`)
- **JS functions:** camelCase (`parseMarkdown`, `scrapeEcc`, `detectTransition`)
- **JS constants:** UPPER_SNAKE_CASE (`TASK_RULES`, `LANGUAGE_BY_EXT`, `BRANCH_BASE`)
- **Test names:** descriptive sentences (`'detectTaskType matches "add" -> build'`)
- **Bash env vars:** UPPER_SNAKE_CASE (`BLUEPRINT_HOOK_PROFILE`, `REPO_ROOT`)

## JavaScript

- ESM only via `.mjs` extension; no CommonJS
- Use `node:` prefix for built-in imports (`import { readFileSync } from 'node:fs'`)
- Top-level await is OK
- Prefer pure functions; isolate I/O at the boundaries
- Atomic file writes via temp + rename pattern (see `scripts/rebuild-registry.mjs:writeJsonAtomic`)

## Bash

- `#!/usr/bin/env bash` shebang
- `set -e` for fail-fast lifecycle scripts; `set -u` for hook scripts
- Quote variables religiously: `"$REPO_ROOT"`, never `$REPO_ROOT`
- Resolve `REPO_ROOT` portably: `REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"`
- Use `spawnSync` from Node when invoking subprocesses from JS — array args, no shell

## Commit messages (Conventional Commits)

- Format: `<type>(<scope>): <imperative summary under 72 chars>`
- Types: `feat`, `fix`, `refactor`, `test`, `docs`, `chore`, `perf`, `build`, `ci`, `revert`
- One logical change per commit
- Body explains *why* if non-obvious (after blank line)
- See `.claude/rules/commit-discipline.md`

## TDD discipline

- Write tests BEFORE implementation (red → green → refactor)
- Enforced by `.claude/hooks/pre-commit-tdd.sh` (override: `BLUEPRINT_HOOK_PROFILE=minimal`)
- No `skip`/`only`/`xit`/`it.todo` in committed tests
- Don't mock the layer under test; mock boundaries only
- See `.claude/rules/testing-discipline.md`

## Portability discipline (strict)

- `.claude/rules/` and `.claude/skills/` must be domain-agnostic
- Project-specific terms (vendor names, table names, internal endpoints) belong in `.claude/reference/`
- Enforced mechanically by `.claude/hooks/enforce-portability.sh` + `.claude/.portability-deny.txt`
- See `.claude/rules/portability-discipline.md`

## Two newer rules (added in feat/ecc-bridge)

- `.claude/rules/unix-philosophy.md` — applies to CLI/script/module design; the "shape" of contracts, not the deployment model
- `.claude/rules/nasa-power-of-10.md` — apply selectively; the universal subset (#2, #4, #6, #7, #10) is cost-free; the full set is for safety-critical work only

## Review discipline (multi-agent gate)

- Reviewer (compliance) + adversary (corner cases) both run on each build cycle
- Promotion to `04-output/` requires `verdict: pass` AND `findings: none|minor`
- 5-cycle cap before escalation to human
- See `.claude/rules/review-discipline.md`
