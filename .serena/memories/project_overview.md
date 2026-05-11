# workspace-blueprint — Project Overview

An agent-native scaffold for software development work. Serves two roles:

1. **A working lab** — numbered iterations live here for experiments, features, bug investigations, refactors.
2. **A portable scaffold** — directory layout + markdown templates that can be copied into other repos.

## Two structural layers

**Workflow chassis** (workspace-blueprint native):
- 3-layer routing: `CLAUDE.md` → `CONTEXT.md` → workspace `CONTEXT.md`
- 4 workspaces: `spec/`, `lab/`, `build/`, `ship/`
- 4-agent build loop: planner → implementer ↔ reviewer ↔ adversary (cycle cap 5)
- 5 portability rules + 4 enforcement hooks

**ECC bridge** (added in `feat/ecc-bridge`):
- `external/ecc/` — affaan-m/everything-claude-code as git submodule
- `.claude/registry/*.json` — generated catalogs (~47 ECC agents, 246 skills, 68 commands; ~41 harness skills)
- `ROUTING.md` + 6 branch files (`build/bug/refactor/spike/spec-author/ship`) — markdown decision tree
- `.claude/hooks/route-inject.sh` — Claude Code `UserPromptSubmit` hook
- `scripts/route.mjs` — deterministic routing module
- Cross-IDE preambles: `AGENTS.md`, `.cursorrules`, `GEMINI.md`

## Key design decisions

- Strictly additive: only one existing file (`CLAUDE.md`) was modified; everything else is new.
- ECC is consumed read-only via submodule; never modified.
- `BLUEPRINT_HOOK_PROFILE=minimal|standard|strict` env var gates the 4 native hooks.
- Routing fails open: missing registry/ROUTING.md degrades to native-only workspace-blueprint behavior.

## Related artifacts

- Spec: `docs/superpowers/specs/2026-05-11-ecc-bridge-and-routing-design.md`
- Plan: `docs/superpowers/plans/2026-05-11-ecc-bridge-and-routing-plan.md`
- Repo: `Elessar617/workspace-blueprint` (private GitHub)
