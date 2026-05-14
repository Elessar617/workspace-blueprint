---
name: architecture-audit
description: Surface architectural friction in a codebase and propose deepening opportunities — refactors that turn shallow modules into deep ones. Use when the user wants to improve architecture, find refactoring opportunities, consolidate tightly-coupled modules, or make a codebase more testable. Pairs with refactor-protocol for safe execution of approved candidates.
vendored_from: github.com/mattpocock/skills@e74f0061bb67222181640effa98c675bdb2fdaa7
license: MIT
---

# Architecture Audit

Surface architectural friction and propose **deepening opportunities** — refactors that turn shallow modules into deep ones. The aim is testability and AI-navigability. This skill *identifies* candidates; once approved, hand off to `refactor-protocol` for safe execution.

## Vocabulary

Use the terms in [LANGUAGE.md](LANGUAGE.md) exactly. Consistent language is the point — don't drift into "component," "service," "API," or "boundary." Key principles:

- **Deletion test:** imagine deleting the module. If complexity vanishes, it was a pass-through. If complexity reappears across N callers, it was earning its keep.
- **The interface is the test surface.**
- **One adapter = hypothetical seam. Two adapters = real seam.**

## Process

### 1. Explore

Use the Agent tool with `subagent_type=Explore` (or read the codebase directly for small scopes) to walk the area in scope. Don't follow rigid heuristics — explore organically and note where you experience friction:

- Where does understanding one concept require bouncing between many small modules?
- Where are modules **shallow** — interface nearly as complex as the implementation?
- Where have pure functions been extracted just for testability, but the real bugs hide in how they're called (no **locality**)?
- Where do tightly-coupled modules leak across their seams?
- Which parts of the codebase are untested, or hard to test through their current interface?

Apply the **deletion test** to anything you suspect is shallow: would deleting it concentrate complexity, or just move it? A "yes, concentrates" is the signal you want.

### 2. Present candidates

Present a numbered list of deepening opportunities. For each candidate:

- **Files** — which files/modules are involved
- **Problem** — why the current architecture is causing friction
- **Solution** — plain English description of what would change
- **Benefits** — explained in terms of locality and leverage, and also in how tests would improve

Use the architecture vocabulary from [LANGUAGE.md](LANGUAGE.md) consistently. If a candidate would contradict a documented design decision in `spec/adrs/`, surface that explicitly: _"contradicts ADR-0007 — but worth reopening because…"_. Don't list every theoretical refactor an ADR forbids.

Do NOT propose interfaces yet. Ask the user: "Which of these would you like to explore?"

### 3. Grilling loop

Once the user picks a candidate, walk the design tree with them — constraints, dependencies, the shape of the deepened module, what sits behind the seam, what tests survive.

If the user rejects the candidate with a load-bearing reason that a future architecture review would need to know, offer to record it as an ADR in `spec/adrs/` via the `spec-authoring` skill. Frame as: _"Want me to record this as an ADR so future audits don't re-suggest it?"_ Only offer when the reason would actually be needed — skip ephemeral reasons ("not worth it right now") and self-evident ones.

### 4. Hand off

Once a candidate is fully shaped, hand off to `refactor-protocol` for safe execution. The audit skill stops at "here's what to change and why"; refactor-protocol owns "and here's how to change it without regressing behavior."

## When NOT to use this skill

- The architecture is fine and the user wants to add a feature → use `tdd-loop` directly.
- The user wants to execute a known refactor → use `refactor-protocol` directly.
- The user wants behavior-equivalence proof for a structural change → that's `refactor-protocol`'s job, not this skill's.

---

> Adapted in part from mattpocock/skills@e74f0061bb67222181640effa98c675bdb2fdaa7 (MIT). Renamed; upstream-specific glossary and ADR-format references were replaced with this repo's conventions (`spec/adrs/` for decisions). See `THIRD_PARTY_LICENSES.md`.
