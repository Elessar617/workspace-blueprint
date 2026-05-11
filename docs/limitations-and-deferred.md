# v1 Limitations and Deferred Work

> Snapshot of what the ECC-bridge v1 does NOT do, and what's intentionally left for later. Kept here so a contributor (or future-you) doesn't re-discover the gaps as "bugs."
>
> Related: `docs/superpowers/specs/2026-05-11-ecc-bridge-and-routing-design.md` (§10 Resolved Decisions, §12 Future Work).

---

## 1. Acknowledged limitations in v1

### 1.1 Validator emits "dangling references" warnings

`scripts/rebuild-registry.mjs` validates that every backticked name in `ROUTING.md` and `.claude/routing/*.md` resolves to an entry in some `.claude/registry/*.json`. It currently warns on:

- **Native workspace-blueprint names** (`planner`, `implementer`, `reviewer`, `adversary`, `tdd-loop`, `bug-investigation`, `spike-protocol`, `data-analysis`, `spec-authoring`, `docx`, `pptx`, `xlsx`, `pdf`). These live in `.claude/agents/` and `.claude/skills/` but aren't indexed into a registry JSON yet. The plan made `native-inventory.json` optional; T8 skipped it.
- **Hook profile keys** (`minimal`, `standard`, `strict`). These are values, not catalog items, but the regex picks them up as backticked tokens.
- **Harness MCP server names** (`filesystem`, `git`, `fetch`, `github`, `brave-search`). Indexed by `scripts/lib/harness-scraper.mjs` from `~/.claude/settings.json`, but on this machine that file's `mcpServers` is empty (the user's MCPs are registered via the plugin manifest path, which the scraper doesn't walk).

**Status:** Working as designed (fail-open at runtime; warn loud at rebuild time, per spec §8). No agent behavior is affected — these warnings are informational. Routing itself uses `route.mjs`'s in-code constants, not name resolution.

**Resolution path:** Implement the optional `native-inventory.json` scraper (plan §6.4 step 5) and extend `harness-scraper.mjs` to walk plugin manifests, not just `~/.claude/settings.json`. Filter hook-profile keys from `extractNames` in `scripts/lib/validate.mjs`.

### 1.2 `BLUEPRINT_HOOK_PROFILE` is manual

The 4 native hooks honor the env var (`minimal` → exit 0; `standard`/`strict` → run). But there's no shell-launcher wrapper that sets the var per-task.

**Status:** Operator runs `export BLUEPRINT_HOOK_PROFILE=minimal` manually (e.g., before starting a spike). The auto-selector recommends a profile in its injected context, but does not activate it.

**Resolution path:** Spec §12 future-work item ("Auto-activation"). Add `scripts/with-profile.sh <profile> <command>` that sets the env var and execs the command. Selector output references this wrapper as the recommended way to activate.

### 1.3 MCP routing is recommendation-only

`route.mjs` produces an `mcps:` list in its output, but Claude Code MCP servers are session-scoped — there's no per-task enable/disable. The selector advises; the agent uses them when relevant.

**Status:** Working as designed (spec §10.5).

**Resolution path:** Build the Option B MCP routing server (spec §12 F2) if LLM compliance with preamble-driven routing proves unreliable.

### 1.4 ECC submodule has one parse-skipped file

The ECC scraper reports `skipped: 1` on the current pin (SHA `7fa1e5b6`). One markdown file in ECC has frontmatter that `gray-matter` rejects.

**Status:** Working as designed (defensive schema in spec §6.6). The file is logged to stderr at rebuild time so the operator can investigate; it doesn't block the rest of the scrape.

**Resolution path:** Inspect the skipped file when convenient. If it's a legitimate ECC item, file an upstream issue; otherwise leave the skip in place.

### 1.5 No cross-IDE alignment check

The spec promises that `route.mjs`'s output and an agent's inline-routing traversal (in non-CC harnesses) should match. v1 does NOT verify this.

**Status:** Trust-based for non-CC IDEs. Claude Code has the hook for hard enforcement; other IDEs rely on agent compliance with the preamble's instructions.

**Resolution path:** Spec §12 F1 (CI alignment check). Run the agent against the snapshot test cases periodically; diff against `route.mjs` output; surface drift.

---

## 2. Deferred future-work items (from spec §12)

| # | Item | Rationale for deferring | When to revisit |
|---|------|-------------------------|-----------------|
| F1 | Periodic alignment check (CI) | Needs CI infra; nice-to-have | If we observe non-CC routing drift |
| F2 | Custom MCP routing server (Option B) | Only justified if Option A preamble proves unreliable | If LLM compliance is consistently poor in Cursor/Codex/Gemini |
| F3 (auto-activation) | Shell-launcher wrapper for `BLUEPRINT_HOOK_PROFILE` | The manual `export` is fine for solo use | If multiple operators or many task transitions per day |
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
- **`go-patterns` / `nextjs-patterns` name drift.** Final code reviewer caught these as real dangling references (vs. the acknowledged-noise ones in §1.1). Renamed to `golang-patterns`; removed `nextjs-patterns` entirely (no ECC equivalent). Commit `7a47ebe`.

---

## 5. Things that are NOT limitations (by design)

So they're not re-investigated:

- **Registry JSONs are committed.** They're snapshots like a lockfile; `bootstrap.sh` re-runs `rebuild-registry` to refresh from the local ECC submodule + local harness on first checkout. The committed copy lets a fresh clone work immediately even before bootstrap.
- **Worktree's `.serena/` was not committed.** Per-user IDE state; gitignored. See commit history.
- **Update scripts stage but don't auto-commit.** Matches the operator's established preference for surgical commits.
- **No tests for the deterministic-module/agent-inline-routing alignment.** Listed in §1.5 above; trust-based for v1, CI job for later.

---

*Last updated: post-merge to `main`. Maintain this file alongside the spec and plan when v1 limitations are addressed or new deferred work is identified.*
