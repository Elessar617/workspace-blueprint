# v1 Limitations and Deferred Work

> Snapshot of what the ECC-bridge v1 does NOT do, and what's intentionally left for later. Kept here so a contributor (or future-you) doesn't re-discover the gaps as "bugs."
>
> Related: `docs/superpowers/specs/2026-05-11-ecc-bridge-and-routing-design.md` (§10 Resolved Decisions, §12 Future Work).

---

## 1. Acknowledged limitations in v1

### 1.1 Registry validation is strict

`scripts/rebuild-registry.mjs` validates that every backticked name in `ROUTING.md` and `.claude/routing/*.md` resolves to an entry in some `.claude/registry/*.json`. Native workspace-blueprint agents/skills/rules/MCPs are indexed into `native-inventory.json`; hook profile keys are indexed as hook-profile records; project MCPs are read from `.claude/settings.json`.

**Status:** Resolved after the post-merge audit. New dangling references fail the rebuild instead of being logged as informational warnings.

**Remaining caveat:** Harness plugin entries still describe the local operator's installed plugin set. Paths are now portable relative to the plugin cache, but another machine must install matching plugins or refresh the harness registry after setup.

### 1.2 `BLUEPRINT_HOOK_PROFILE` activation

The 4 native hooks honor the env var (`minimal` → exit 0; `standard`/`strict` → run). Activation flows two ways: `./scripts/with-profile.sh <profile> <command>` (per-task, since 2026-05-12) or `export BLUEPRINT_HOOK_PROFILE=<profile>` (shell-wide).

**Status:** Resolved. The `with-profile.sh` wrapper closes the auto-activation gap from spec §12 (F3). The auto-selector still recommends a profile in its injected context; the operator now has a one-liner to adopt it instead of typing `export`.

**Remaining caveat:** The wrapper does not currently update `.current.json`'s recommended profile from `route.mjs` output automatically; the operator chooses the profile at invocation time. If you want truly hands-off activation, that's an additional follow-up (e.g., a shell alias that reads the cache before exec'ing).

### 1.3 MCP routing is recommendation-only

`route.mjs` produces an `mcps:` list in its output, but Claude Code MCP servers are session-scoped — there's no per-task enable/disable. The selector advises; the agent uses them when relevant.

**Status:** Working as designed (spec §10.5).

**Resolution path:** Build the Option B MCP routing server (spec §12 F2) if LLM compliance with preamble-driven routing proves unreliable.

### 1.4 ECC submodule has one parse-skipped file

The ECC scraper reports `skipped: 1` on the current pin (SHA `7fa1e5b6`). One markdown file in ECC has frontmatter that `gray-matter` rejects.

**Status:** Working as designed (defensive schema in spec §6.6). The file is logged to stderr at rebuild time so the operator can investigate; it doesn't block the rest of the scrape.

**Resolution path:** Inspect the skipped file when convenient. If it's a legitimate ECC item, file an upstream issue; otherwise leave the skip in place.

### 1.5 Partial cross-IDE alignment check

The unit snapshot suite now verifies that `route.mjs` emits only registry-resolvable names for the routing cases. It does not yet run each non-CC harness through the inline Markdown traversal and compare the agent's chosen inventory.

**Status:** Deterministic selector coverage exists; real cross-IDE agent-compliance testing is still trust-based.

**Resolution path:** Spec §12 F1 (CI alignment check). Run the agent against the snapshot test cases periodically; diff against `route.mjs` output; surface drift.

---

## 2. Deferred future-work items (from spec §12)

| # | Item | Rationale for deferring | When to revisit |
|---|------|-------------------------|-----------------|
| F1 | Periodic cross-IDE alignment check (CI) | Needs CI infra and harness drivers; nice-to-have | If we observe non-CC routing drift |
| F2 | Custom MCP routing server (Option B) | Only justified if Option A preamble proves unreliable | If LLM compliance is consistently poor in Cursor/Codex/Gemini |
| F3 (auto-activation) | ~~Shell-launcher wrapper for `BLUEPRINT_HOOK_PROFILE`~~ | **Shipped 2026-05-12** as `scripts/with-profile.sh`. See §1.2 above. | — |
| F4 | `/refresh-routing` slash command | Cache invalidation works via transition phrases; explicit refresh is UX nice-to-have | If we observe cache staleness in real use |
| F5 | Multi-repo support (additional submodules) | YAGNI for v1; mechanism generalizes naturally | When we want to bring in `obra/superpowers` (or similar) as a second source |

---

## 3. Open questions resolved during spec review (now closed)

All five "open questions" from the original spec §10 were resolved before implementation. Captured here for posterity:

| # | Question | Resolution |
|---|----------|------------|
| Q1 | Frontmatter normalization | Defensive schema in `scripts/lib/frontmatter.mjs` — required vs optional fields, type coercion, parse-error catch-and-skip |
| Q2 | Slash command description fallback | 3-tier: frontmatter → first paragraph → filename derivation |
| Q3 | `route.mjs` runtime | ESM `.mjs` (Node 18+); `.mjs` extension per-file, no `"type": "module"` in package.json |
| Q4 | Hook profile mechanism | Pulled from §12 future-work into v1; 3-line gate in each of the 4 hooks, env-var driven |
| Q5 | MCP server activation per task | Recommendation-only; no dynamic enable/disable |

---

## 4. Pragmatic deviations from the plan during execution

These were operational choices made by the implementer during the 39-task run; they don't change the design but are worth recording.

- **`scripts/lib/ecc-scraper.mjs` path bug.** Plan's `.slice(eccPath.length)` was buggy when `eccPath` was relative (e.g., `./external/ecc`); fixed to `path.relative(eccPath, file)` in commit `8af6b20`.
- **`package.json` `test:unit` script.** Plan used `node --test tests/unit/`; Node 25's `--test` doesn't auto-discover `.test.mjs` files in directory mode. Fixed to explicit glob `node --test tests/unit/*.test.mjs` in commit `9a9e972`.
- **`go-patterns` / `nextjs-patterns` name drift.** Final code reviewer caught these as real dangling references in the original validator. Renamed to `golang-patterns`; removed `nextjs-patterns` entirely (no ECC equivalent). Commit `7a47ebe`.

---

## 5. Things that are NOT limitations (by design)

So they're not re-investigated:

- **Registry JSONs are committed.** They're snapshots like a lockfile; `bootstrap.sh` re-runs `rebuild-registry` to refresh from the local ECC submodule + local harness on first checkout. The committed copy lets a fresh clone work immediately even before bootstrap.
- **Worktree's `.serena/` was not committed.** Per-user IDE state; gitignored. See commit history.
- **Update scripts stage but don't auto-commit.** Matches the operator's established preference for surgical commits.
- **No tests for the deterministic-module/agent-inline-routing alignment.** Listed in §1.5 above; trust-based for v1, CI job for later.

---

*Last updated: post-merge to `main`. Maintain this file alongside the spec and plan when v1 limitations are addressed or new deferred work is identified.*
