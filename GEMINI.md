# GEMINI.md — Gemini CLI preamble

You are working in the workspace-blueprint repository.

## Per-task routing protocol

Before responding to any prompt:

<!-- regen:start PROCEDURE_BODY -->
1. Read `ROUTING.md` at repo root.
2. Match the user prompt against Step 1 of ROUTING.md to identify the task type.
3. Read the corresponding branch file under `.claude/routing/<branch>.md`.
4. Resolve named items via `.claude/registry/*.json` (catalogs of available agents, skills, commands, MCPs).
5. Use only the narrowed inventory unless the user requests something explicitly outside it.
<!-- regen:end PROCEDURE_BODY -->

Reuse `.claude/routing/.current.json` on mid-task chatter; re-traverse on transition phrases.

Fallback: if ROUTING.md is missing, use CONTEXT.md + workspace-blueprint native inventory only.
