# Codebase Structure

## Top level

```
workspace-blueprint/
├─ CLAUDE.md             always-loaded MAP (Layer 1 routing)
├─ CONTEXT.md            task router (Layer 2: which workspace?)
├─ ROUTING.md            auto-selector decision tree entry
├─ AGENTS.md             cross-IDE preamble (Codex, OpenCode)
├─ .cursorrules          Cursor preamble
├─ GEMINI.md             Gemini CLI preamble
├─ START-HERE.md / README.md
├─ package.json / .gitmodules / .gitignore
└─ external/ecc/         git submodule -> affaan-m/everything-claude-code
```

## Workspaces (the chassis)

- `spec/` — RFCs, ADRs, briefs
- `lab/` — numbered exploratory iterations (`NN-slug/`)
- `build/` — production pipeline (`workflows/NN-slug/` × 4 stages × 4 agents)
- `ship/` — release artifacts (changelog, docs, deploy)

## Agent infrastructure (.claude/)

- `rules/` — always-loaded constraints (7 files: code-quality, commit-discipline, testing-discipline, portability-discipline, review-discipline, unix-philosophy, nasa-power-of-10)
- `skills/` — on-demand procedures
- `agents/` — planner, implementer, reviewer, adversary specs
- `hooks/` — 5 bash hooks (pre-commit-tdd, block-cycle-overrun, block-output-without-signoff, enforce-portability, route-inject)
- `routing/` — 6 branch files (build, bug, refactor, spike, spec-author, ship) + `.current.json` cache (gitignored)
- `registry/` — generated JSON catalogs (ecc-*.json + harness-*.json + ecc-config.json)
- `reference/` — project-specific facts (only place where vendor names, tools, etc. may appear)
- `settings.json` — wires hooks, MCP servers, permissions

## Scripts

- `route.mjs` — deterministic routing module + CLI mode
- `rebuild-registry.mjs` — scrape orchestrator (with `--harness-only`)
- `lib/frontmatter.mjs` / `lib/validate.mjs` / `lib/ecc-scraper.mjs` / `lib/harness-scraper.mjs`
- `bootstrap.sh` / `update-ecc.sh` / `refresh-harness.sh`

## Tests

- `unit/*.test.mjs` — Node --test files (frontmatter, validate, route, cache, routing-snapshots)
- `routing-cases/*.json` — snapshot test cases
- `hook/*.test.sh` — bash hook tests
- `integration/*.sh` — bash integration tests (bootstrap idempotency, etc.)
- `run.mjs` — orchestrator (npm test runs this)

## Documentation

- `docs/superpowers/specs/` — design specs from brainstorming
- `docs/superpowers/plans/` — implementation plans
- `docs/maintainer-notes/` — how-to-adapt notes + private-notes Notes PDFs
- `docs/iteration-process.md`, `docs/orchestrator-process.md` — process docs
