# ROUTING.md — Auto-Selector Decision Tree

> **Agents: BEFORE starting any task, traverse this tree.** Each step narrows scope. Stop at the deepest matching leaf. Item names (e.g., `python-reviewer`) resolve to paths via `.claude/registry/*.json`. Cache the narrowing in `.claude/routing/.current.json`; reuse on mid-task chatter unless a transition signal fires.

## Step 1: Identify task type

<!-- regen:start ROUTING_STEP1 -->
| Signal in prompt or context | Workspace | Branch file |
|---|---|---|
| "review", "audit", "evaluate", "critique", "act as reviewer" | `build/` | `.claude/routing/review.md` |
| "add ", "implement", "feature", "build ", "create " | `build/` | `.claude/routing/build.md` |
| "fix", "bug", "broken", "crash" | `build/` | `.claude/routing/bug.md` |
| "refactor", "migrate", "rename", "restructure", "cleanup" | `build/` | `.claude/routing/refactor.md` |
| "investigate", "spike", "explore", "prototype" | `lab/` | `.claude/routing/spike.md` |
| "rfc", "adr", "design ", "spec ", "brief", "propose" | `spec/` | `.claude/routing/spec-author.md` |
| "release", "ship", "changelog", "publish", "cut a v" | `ship/` | `.claude/routing/ship.md` |
<!-- regen:end ROUTING_STEP1 -->

## Global code-writing rule overlay

When the selected branch loads `all native rules`, that includes `nasa-power-of-10`. Any comments added while editing code must use NASA style: explain invariants, loop bounds, assumptions, failure modes, units/ranges, ownership/lifetime, concurrency expectations, or non-obvious safety tradeoffs. Do not add comments that merely narrate obvious code.

## Task-transition signals (cache invalidation)

Re-traverse this tree (don't reuse cache) when ANY of these apply:

- Prompt contains a transition phrase: "now let's...", "switch to...", "actually...", "next, ...".
- File scope changes substantially: a different language detected, or files now in a different workspace.
- The operator types `/refresh-routing` (future-work feature; ignore for now).

Mid-task chatter ("yes", "explain more", "do that", "ok") preserves the cache.

## Fallback (no branch match)

If no row in Step 1 matches, load only:

- Native agents: `planner`, `implementer`, `reviewer`, `adversary`
- Native skills: `caveman`
- All native rules
- Hook profile: `standard`
- No ECC content

This matches workspace-blueprint's pre-bridge behavior. Fail open.
