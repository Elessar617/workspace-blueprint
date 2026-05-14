# Mattpocock Skills Integration — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add 5 new mattpocock skills (`caveman`, `handoff`, `zoom-out`, `write-a-skill`, `architecture-audit`) + hybridize 3 native skills (`tdd-loop`, `bug-investigation`, `spike-protocol`) per the design at `docs/superpowers/specs/2026-05-14-mattpocock-skills-integration-design.md`.

**Architecture:** Project skills with attribution. Copy upstream SKILL.md content into `.claude/skills/<name>/` with `vendored_from` frontmatter pinned to commit `e74f0061bb67222181640effa98c675bdb2fdaa7`. Native skills are auto-discovered by `scripts/lib/native-scraper.mjs` and emitted to `.claude/registry/native-inventory.json` via `npm run rebuild-registry`. Only `architecture-audit` joins auto-routing (in `.claude/routing/refactor.md`).

**Tech Stack:** Markdown skill files with YAML frontmatter; Node 18+ for the registry rebuild script; bash hooks for portability enforcement.

**Pinned upstream commit:** `e74f0061bb67222181640effa98c675bdb2fdaa7` (mattpocock/skills @ 2026-05-13).

**Post-review follow-up (2026-05-14):** `caveman` moved from explicit-invocation-only to every routing branch and fallback as an always-loaded token-discipline skill. The executable router (`scripts/route.mjs`) must stay aligned with branch-file always-load agents/skills, and current attribution metadata uses the full upstream SHA above.

---

## Pre-flight check

Before starting Task 1, verify the working tree is clean and on the right commit:

```bash
cd <repo-root>
git status                    # expect: clean
git log -1 --oneline          # expect: 4f66d48 docs(spec): add mattpocock skills integration design
node --version                # expect: v18+ (any v18+ works; package.json sets engines >=18)
```

If any of these fails, stop and resolve before proceeding.

---

## Task 1: Update THIRD_PARTY_LICENSES.md with mattpocock-skills section

**Files:**
- Modify: `.claude/skills/THIRD_PARTY_LICENSES.md` (append a new section after existing sections)

- [ ] **Step 1.1: Open the file and confirm current shape**

```bash
wc -l .claude/skills/THIRD_PARTY_LICENSES.md
tail -5 .claude/skills/THIRD_PARTY_LICENSES.md
```
Expected: file ends after the `andrej-karpathy-skills` MIT license block (last line is the closing triple-backtick of the karpathy license).

- [ ] **Step 1.2: Append the mattpocock-skills section**

Append this exact content to the end of `.claude/skills/THIRD_PARTY_LICENSES.md` (use the `Edit` tool with `old_string` set to the final closing triple-backtick from the karpathy section, plus enough surrounding context to make it unique):

````markdown

---

## mattpocock-skills — Matt Pocock

- **Upstream:** https://github.com/mattpocock/skills
- **Commit pinned:** `e74f0061bb67222181640effa98c675bdb2fdaa7` (2026-05-13)
- **Skills imported as new files:** `caveman`, `handoff`, `zoom-out`, `write-a-skill`, `architecture-audit` (adapted from `improve-codebase-architecture`)
- **Partial adoption (ideas hybridized into existing native skills):** upstream `tdd` → `tdd-loop`; upstream `diagnose` → `bug-investigation`; upstream `prototype` → `spike-protocol/PROTOTYPE-SHAPES.md`
- **License:** MIT

```
MIT License

Copyright (c) 2026 Matt Pocock

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
```
````

- [ ] **Step 1.3: Verify the file ends correctly**

```bash
tail -30 .claude/skills/THIRD_PARTY_LICENSES.md
```
Expected: the new section is at the bottom, ending with the closing triple-backtick of the MIT license block.

- [ ] **Step 1.4: Commit**

```bash
git add .claude/skills/THIRD_PARTY_LICENSES.md
git commit -m "docs(licenses): add mattpocock-skills MIT block (pinned @e74f0061)"
```

---

## Task 2: Add `caveman` skill (verbatim copy)

**Files:**
- Create: `.claude/skills/caveman/SKILL.md`

- [ ] **Step 2.1: Create the directory**

```bash
mkdir -p .claude/skills/caveman
```

- [ ] **Step 2.2: Write SKILL.md**

Write this exact content to `.claude/skills/caveman/SKILL.md`:

````markdown
---
name: caveman
description: >
  Ultra-compressed communication mode. Cuts token usage ~75% by dropping
  filler, articles, and pleasantries while keeping full technical accuracy.
  Use when user says "caveman mode", "talk like caveman", "use caveman",
  "less tokens", "be brief", or invokes /caveman.
vendored_from: github.com/mattpocock/skills@e74f0061bb67222181640effa98c675bdb2fdaa7
license: MIT
---

Respond terse like smart caveman. All technical substance stay. Only fluff die.

## Persistence

ACTIVE EVERY RESPONSE once triggered. No revert after many turns. No filler drift. Still active if unsure. Off only when user says "stop caveman" or "normal mode".

## Rules

Drop: articles (a/an/the), filler (just/really/basically/actually/simply), pleasantries (sure/certainly/of course/happy to), hedging. Fragments OK. Short synonyms (big not extensive, fix not "implement a solution for"). Abbreviate common terms (DB/auth/config/req/res/fn/impl). Strip conjunctions. Use arrows for causality (X -> Y). One word when one word enough.

Technical terms stay exact. Code blocks unchanged. Errors quoted exact.

Pattern: `[thing] [action] [reason]. [next step].`

Not: "Sure! I'd be happy to help you with that. The issue you're experiencing is likely caused by..."
Yes: "Bug in auth middleware. Token expiry check use `<` not `<=`. Fix:"

### Examples

**"Why React component re-render?"**

> Inline obj prop -> new ref -> re-render. `useMemo`.

**"Explain database connection pooling."**

> Pool = reuse DB conn. Skip handshake -> fast under load.

## Auto-Clarity Exception

Drop caveman temporarily for: security warnings, irreversible action confirmations, multi-step sequences where fragment order risks misread, user asks to clarify or repeats question. Resume caveman after clear part done.

Example -- destructive op:

> **Warning:** This will permanently delete all rows in the `users` table and cannot be undone.
>
> ```sql
> DROP TABLE users;
> ```
>
> Caveman resume. Verify backup exist first.
````

- [ ] **Step 2.3: Verify the file structure**

```bash
ls -la .claude/skills/caveman/
head -8 .claude/skills/caveman/SKILL.md
```
Expected: directory contains only `SKILL.md`. First 8 lines show valid YAML frontmatter with `name: caveman`, `vendored_from: github.com/mattpocock/skills@e74f...`.

- [ ] **Step 2.4: Verify portability hook does not flag the content**

```bash
DENY=$(grep -v '^#' .claude/.portability-deny.txt | grep -v '^$')
if [[ -z "$DENY" ]]; then
  echo "PORTABILITY: deny list empty; PASS by default"
else
  echo "$DENY" | grep -i -F -f /dev/stdin .claude/skills/caveman/SKILL.md && echo "PORTABILITY: FAIL" || echo "PORTABILITY: PASS"
fi
```
Expected: `PORTABILITY: PASS`. The deny list ships with only commented examples, so this passes by default unless the consumer added terms.

- [ ] **Step 2.5: Commit**

```bash
git add .claude/skills/caveman/
git commit -m "feat(skills): add caveman skill from mattpocock@e74f0061"
```

---

## Task 3: Add `handoff` skill (verbatim copy)

**Files:**
- Create: `.claude/skills/handoff/SKILL.md`

- [ ] **Step 3.1: Create the directory**

```bash
mkdir -p .claude/skills/handoff
```

- [ ] **Step 3.2: Write SKILL.md**

Write this exact content to `.claude/skills/handoff/SKILL.md`:

```markdown
---
name: handoff
description: Compact the current conversation into a handoff document for another agent to pick up.
argument-hint: "What will the next session be used for?"
vendored_from: github.com/mattpocock/skills@e74f0061bb67222181640effa98c675bdb2fdaa7
license: MIT
---

Write a handoff document summarising the current conversation so a fresh agent can continue the work. Save it to a path produced by `mktemp -t handoff-XXXXXX.md` (read the file before you write to it).

Suggest the skills to be used, if any, by the next session.

Do not duplicate content already captured in other artifacts (PRDs, plans, ADRs, issues, commits, diffs). Reference them by path or URL instead.

If the user passed arguments, treat them as a description of what the next session will focus on and tailor the doc accordingly.
```

- [ ] **Step 3.3: Verify**

```bash
head -7 .claude/skills/handoff/SKILL.md
```
Expected: valid frontmatter with `name: handoff`, `argument-hint`, `vendored_from`.

- [ ] **Step 3.4: Commit**

```bash
git add .claude/skills/handoff/
git commit -m "feat(skills): add handoff skill from mattpocock@e74f0061"
```

---

## Task 4: Add `zoom-out` skill (verbatim, drop `disable-model-invocation` flag)

**Files:**
- Create: `.claude/skills/zoom-out/SKILL.md`

- [ ] **Step 4.1: Create the directory**

```bash
mkdir -p .claude/skills/zoom-out
```

- [ ] **Step 4.2: Write SKILL.md**

Note: upstream has `disable-model-invocation: true` in its frontmatter. Drop this — our skill loader does not honor it. Content otherwise verbatim.

Write this exact content to `.claude/skills/zoom-out/SKILL.md`:

```markdown
---
name: zoom-out
description: Tell the agent to zoom out and give broader context or a higher-level perspective. Use when you're unfamiliar with a section of code or need to understand how it fits into the bigger picture.
vendored_from: github.com/mattpocock/skills@e74f0061bb67222181640effa98c675bdb2fdaa7
license: MIT
---

I don't know this area of code well. Go up a layer of abstraction. Give me a map of all the relevant modules and callers, using the project's domain glossary vocabulary.
```

- [ ] **Step 4.3: Verify the dropped flag**

```bash
grep -c "disable-model-invocation" .claude/skills/zoom-out/SKILL.md
```
Expected: `0` (flag was intentionally stripped).

- [ ] **Step 4.4: Commit**

```bash
git add .claude/skills/zoom-out/
git commit -m "feat(skills): add zoom-out skill from mattpocock@e74f0061

Strip 'disable-model-invocation: true' frontmatter; skill loader doesn't
honor it (deferred to future routing enhancement)."
```

---

## Task 5: Add `write-a-skill` skill (verbatim + description tweak)

**Files:**
- Create: `.claude/skills/write-a-skill/SKILL.md`

- [ ] **Step 5.1: Create the directory**

```bash
mkdir -p .claude/skills/write-a-skill
```

- [ ] **Step 5.2: Write SKILL.md**

Note: the description is extended with a one-sentence pointer to `spec-authoring` so the skill loader can disambiguate skill-authoring vs spec-authoring requests.

Write this exact content to `.claude/skills/write-a-skill/SKILL.md`:

````markdown
---
name: write-a-skill
description: Create new agent skills with proper structure, progressive disclosure, and bundled resources. Use when user wants to create, write, or build a new skill. For spec-shaped artifacts (RFC, ADR, brief) use 'spec-authoring' instead.
vendored_from: github.com/mattpocock/skills@e74f0061bb67222181640effa98c675bdb2fdaa7
license: MIT
---

# Writing Skills

## Process

1. **Gather requirements** - ask user about:
   - What task/domain does the skill cover?
   - What specific use cases should it handle?
   - Does it need executable scripts or just instructions?
   - Any reference materials to include?

2. **Draft the skill** - create:
   - SKILL.md with concise instructions
   - Additional reference files if content exceeds 500 lines
   - Utility scripts if deterministic operations needed

3. **Review with user** - present draft and ask:
   - Does this cover your use cases?
   - Anything missing or unclear?
   - Should any section be more/less detailed?

## Skill Structure

```
skill-name/
├── SKILL.md           # Main instructions (required)
├── REFERENCE.md       # Detailed docs (if needed)
├── EXAMPLES.md        # Usage examples (if needed)
└── scripts/           # Utility scripts (if needed)
    └── helper.js
```

## SKILL.md Template

```md
---
name: skill-name
description: Brief description of capability. Use when [specific triggers].
---

# Skill Name

## Quick start

[Minimal working example]

## Workflows

[Step-by-step processes with checklists for complex tasks]

## Advanced features

[Link to separate files: See [REFERENCE.md](REFERENCE.md)]
```

## Description Requirements

The description is **the only thing your agent sees** when deciding which skill to load. It's surfaced in the system prompt alongside all other installed skills. Your agent reads these descriptions and picks the relevant skill based on the user's request.

**Goal**: Give your agent just enough info to know:

1. What capability this skill provides
2. When/why to trigger it (specific keywords, contexts, file types)

**Format**:

- Max 1024 chars
- Write in third person
- First sentence: what it does
- Second sentence: "Use when [specific triggers]"

**Good example**:

```
Extract text and tables from PDF files, fill forms, merge documents. Use when working with PDF files or when user mentions PDFs, forms, or document extraction.
```

**Bad example**:

```
Helps with documents.
```

The bad example gives your agent no way to distinguish this from other document skills.

## When to Add Scripts

Add utility scripts when:

- Operation is deterministic (validation, formatting)
- Same code would be generated repeatedly
- Errors need explicit handling

Scripts save tokens and improve reliability vs generated code.

## When to Split Files

Split into separate files when:

- SKILL.md exceeds 100 lines
- Content has distinct domains (finance vs sales schemas)
- Advanced features are rarely needed

## Review Checklist

After drafting, verify:

- [ ] Description includes triggers ("Use when...")
- [ ] SKILL.md under 100 lines
- [ ] No time-sensitive info
- [ ] Consistent terminology
- [ ] Concrete examples included
- [ ] References one level deep
````

- [ ] **Step 5.3: Verify the description cross-link**

```bash
grep -c "spec-authoring" .claude/skills/write-a-skill/SKILL.md
```
Expected: `1` (the cross-link in the description).

- [ ] **Step 5.4: Commit**

```bash
git add .claude/skills/write-a-skill/
git commit -m "feat(skills): add write-a-skill from mattpocock@e74f0061

Description extended with cross-link to spec-authoring so the skill
loader disambiguates skill-authoring vs spec-authoring."
```

---

## Task 6: Add `architecture-audit` skill (adapted from `improve-codebase-architecture`)

**Files:**
- Create: `.claude/skills/architecture-audit/SKILL.md`
- Create: `.claude/skills/architecture-audit/LANGUAGE.md`

This is the most adapted of the new skills. Changes from upstream:
1. Renamed `improve-codebase-architecture` → `architecture-audit`
2. `LANGUAGE.md` inlined as a sibling supporting file (vocabulary kept verbatim — domain-agnostic)
3. References to `CONTEXT.md` (his glossary file) are dropped — our `CONTEXT.md` is a workspace router
4. References to `docs/adr/` (his ADR location) are dropped — we use `spec/adrs/`
5. References to `INTERFACE-DESIGN.md` are removed (we don't carry that supporting file)
6. Cross-link to `refactor-protocol` added for the execution handoff

- [ ] **Step 6.1: Create the directory**

```bash
mkdir -p .claude/skills/architecture-audit
```

- [ ] **Step 6.2: Write LANGUAGE.md (supporting file with the glossary)**

Write this exact content to `.claude/skills/architecture-audit/LANGUAGE.md`:

```markdown
<!-- Adapted from github.com/mattpocock/skills/skills/engineering/improve-codebase-architecture/LANGUAGE.md @ e74f0061bb67222181640effa98c675bdb2fdaa7 -->

# Architecture Audit — Vocabulary

Use these terms exactly. Consistent language is the point — don't drift into "component," "service," "API," or "boundary."

## Terms

- **Module** — anything with an interface and an implementation. A function, class, package, or feature slice all qualify if they have both.
- **Interface** — everything a caller must know to use the module: types, invariants, error modes, ordering, configuration. Not just the type signature.
- **Implementation** — the code inside the module.
- **Depth** — leverage at the interface: a lot of behaviour available through a small interface. **Deep** modules = high leverage. **Shallow** = the interface is nearly as complex as the implementation it hides.
- **Seam** — a place in the system where an interface lives; a place where behaviour can be altered without editing in place. Use this word, not "boundary."
- **Adapter** — a concrete thing that satisfies an interface at a seam. A `PostgresOrderRepository` is an adapter for an `OrderRepository` seam.
- **Leverage** — what callers get from depth: more behaviour per unit of interface complexity they have to learn.
- **Locality** — what maintainers get from depth: change, bugs, and knowledge are concentrated in one place rather than scattered.

## Key principles

- **Deletion test** — imagine deleting the module. If complexity vanishes, it was a pass-through (shallow). If complexity reappears, scattered across N callers, it was earning its keep (deep).
- **The interface is the test surface.** If you can't test behaviour through the interface, the interface is wrong.
- **One adapter = a hypothetical seam.** Two adapters of the same interface = a real seam. Don't introduce a seam before you have at least two real reasons for it.
```

- [ ] **Step 6.3: Write SKILL.md**

Write this exact content to `.claude/skills/architecture-audit/SKILL.md`:

```markdown
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

> Adapted in part from mattpocock/skills@e74f0061bb67222181640effa98c675bdb2fdaa7 (MIT). Renamed; CONTEXT.md/ADR-format references replaced with this repo's conventions. See `THIRD_PARTY_LICENSES.md`.
```

- [ ] **Step 6.4: Verify the adaptations**

```bash
# Should be 0 hits (we removed his CONTEXT.md refs)
grep -c "CONTEXT.md" .claude/skills/architecture-audit/SKILL.md
# Should be 0 hits (we removed his docs/adr/ refs in favor of spec/adrs/)
grep -c "docs/adr/" .claude/skills/architecture-audit/SKILL.md
# Should be >=1 hit (cross-link to refactor-protocol)
grep -c "refactor-protocol" .claude/skills/architecture-audit/SKILL.md
# Should be >=1 hit (the spec/adrs/ replacement)
grep -c "spec/adrs/" .claude/skills/architecture-audit/SKILL.md
```
Expected: `0`, `0`, `>=1`, `>=1` in order.

- [ ] **Step 6.5: Verify portability hook**

```bash
DENY=$(grep -v '^#' .claude/.portability-deny.txt | grep -v '^$')
if [[ -z "$DENY" ]]; then
  echo "PORTABILITY: deny list empty; PASS by default"
else
  for f in .claude/skills/architecture-audit/SKILL.md .claude/skills/architecture-audit/LANGUAGE.md; do
    echo "$DENY" | grep -i -F -f /dev/stdin "$f" && echo "PORTABILITY: FAIL ($f)" || true
  done
  echo "PORTABILITY: PASS"
fi
```
Expected: `PORTABILITY: PASS`.

- [ ] **Step 6.6: Commit**

```bash
git add .claude/skills/architecture-audit/
git commit -m "feat(skills): add architecture-audit adapted from mattpocock@e74f0061

Renamed from improve-codebase-architecture. Inline LANGUAGE.md glossary
(domain-agnostic terms). Drop CONTEXT.md/docs/adr references; use
spec/adrs/ convention. Cross-link to refactor-protocol for execution."
```

---

## Task 7: Hybridize `tdd-loop` (add vertical-slicing anti-pattern)

**Files:**
- Modify: `.claude/skills/tdd-loop/SKILL.md` (current: 36 lines)

The current `tdd-loop` is tight and integrates with the build/ pipeline hook. We add a new section explicitly naming the "vertical vs horizontal slicing" anti-pattern with the ASCII diagram, plus a one-line principle about testing through public interfaces. Footnote attribution at the bottom.

- [ ] **Step 7.1: Read the current file to ground the edits**

```bash
cat .claude/skills/tdd-loop/SKILL.md
```
Confirm it ends at line 36 with the bullet about `Commenting out a failing test`.

- [ ] **Step 7.2: Insert a new section before `## When to break the cycle`**

Use the `Edit` tool. Find this `old_string` (the closing bullet of "Per-stage discipline" + the next heading):

```
- **Refactor:** if a refactor breaks a different test, the refactor changed behavior. Revert the refactor; either keep the duplication or update the test (separately).

## When to break the cycle
```

Replace with this `new_string`:

````
- **Refactor:** if a refactor breaks a different test, the refactor changed behavior. Revert the refactor; either keep the duplication or update the test (separately).

## What you're testing

Tests should verify behavior through public interfaces, not implementation details. Code can change entirely; tests shouldn't. A good test reads like a specification — `test_user_can_log_in_with_valid_credentials` tells you exactly what capability exists. These tests survive refactors because they don't care about internal structure. The warning sign of an implementation-coupled test: it breaks when you refactor but behavior hasn't changed.

## Vertical vs horizontal slicing

**DO NOT write all tests first, then all implementation.** That is "horizontal slicing" — treating Red as "write all tests" and Green as "write all code." It produces crap tests: they verify imagined behavior, lock you into the shape of things before you understand the implementation, and pass when behavior breaks because they were written without seeing what mattered.

Correct shape is **vertical slices via tracer bullets**: one test → one implementation → next test responds to what you just learned.

```
WRONG (horizontal):
  RED:   test1, test2, test3, test4, test5
  GREEN: impl1, impl2, impl3, impl4, impl5

RIGHT (vertical):
  RED→GREEN: test1→impl1
  RED→GREEN: test2→impl2
  RED→GREEN: test3→impl3
  ...
```

## When to break the cycle
````

- [ ] **Step 7.3: Add the attribution footnote at the end of the file**

Use the `Edit` tool. Find this `old_string` (the last bullet of anti-patterns):

```
- Commenting out a failing test to "fix later." Delete it or fix it; do not leave it as silent debt.
```

Replace with:

```
- Commenting out a failing test to "fix later." Delete it or fix it; do not leave it as silent debt.

---

> Vertical-vs-horizontal slicing and the public-interface principle are adapted in part from mattpocock/skills@e74f0061bb67222181640effa98c675bdb2fdaa7 (MIT). See `THIRD_PARTY_LICENSES.md`.
```

- [ ] **Step 7.4: Verify**

```bash
wc -l .claude/skills/tdd-loop/SKILL.md
grep -c "horizontal slicing" .claude/skills/tdd-loop/SKILL.md
grep -c "vertical slices" .claude/skills/tdd-loop/SKILL.md
grep -c "mattpocock/skills" .claude/skills/tdd-loop/SKILL.md
```
Expected (in order): line count ~60-65 (was 36); `>=1`; `>=1`; `1`.

- [ ] **Step 7.5: Commit**

```bash
git add .claude/skills/tdd-loop/SKILL.md
git commit -m "feat(skills): hybridize tdd-loop with vertical-slicing anti-pattern

Lift 'vertical vs horizontal slicing' anti-pattern and 'test through
public interfaces' principle from mattpocock/skills@e74f0061bb67222181640effa98c675bdb2fdaa7. Native cycle
mechanic, hook integration, and existing anti-patterns unchanged."
```

---

## Task 8: Hybridize `bug-investigation` (6-phase + feedback-loop primacy)

**Files:**
- Modify: `.claude/skills/bug-investigation/SKILL.md` (current: 41 lines; target: ~95 lines)

This is the largest hybrid edit. We restructure around mattpocock's 6 phases while preserving the SPEC.md diagnosis format (folded into Phase 5 and Phase 6) and the build/ pipeline integration.

- [ ] **Step 8.1: Read the current file**

```bash
cat .claude/skills/bug-investigation/SKILL.md
```

- [ ] **Step 8.2: Replace the file contents**

Use the `Write` tool to overwrite `.claude/skills/bug-investigation/SKILL.md` with this exact content (it is a full rewrite, not a patch):

```markdown
---
name: bug-investigation
description: Use when starting work on a reported bug or unexpected behavior. Enforces reproduce-before-fix, root-cause-before-patch, and a feedback-loop-first discipline. Drives a build/ iteration whose 01-spec/ is the diagnosis, not a feature plan.
---

# Bug Investigation

Bug fix work flows through the same `build/` pipeline as feature work, but the SPEC.md in `01-spec/` is shaped differently — it documents diagnosis instead of design. The six phases below are mandatory in order; skip a phase only when you can explicitly justify the skip.

## Phase 1 — Build a feedback loop

**This is the skill.** Everything else is mechanical. If you have a fast, deterministic, agent-runnable pass/fail signal for the bug, you will find the cause — bisection, hypothesis-testing, and instrumentation all just consume that signal. If you don't have one, no amount of staring at code will save you. Spend disproportionate effort here.

Try these loop shapes, roughly in order of preference:

1. **Failing test** at whatever seam reaches the bug — unit, integration, e2e.
2. **Curl / HTTP script** against a running dev server.
3. **CLI invocation** with a fixture input, diffing stdout against a known-good snapshot.
4. **Headless browser script** (Playwright / Puppeteer) — drives the UI, asserts on DOM/console/network.
5. **Replay a captured trace.** Save a real request / payload / event log to disk; replay it through the code path in isolation.
6. **Throwaway harness.** Spin up a minimal subset of the system (one service, mocked deps) that exercises the bug code path with a single function call.
7. **Property / fuzz loop.** If the bug is "sometimes wrong output", run many random inputs and look for the failure mode.
8. **Bisection harness.** If the bug appeared between two known states (commit, dataset, version), automate "boot at state X, check, repeat" so `git bisect run` can drive it.
9. **Differential loop.** Run the same input through old-version vs new-version (or two configs) and diff outputs.
10. **HITL bash script.** Last resort. If a human must click, drive *them* with a scripted prompt so the loop is still structured. Captured output feeds back to you.

Iterate on the loop itself once it works: make it faster (cache setup, skip unrelated init), sharper (assert on the specific symptom, not "didn't crash"), and more deterministic (pin time, seed RNG, isolate filesystem, freeze network). A 30-second flaky loop is barely better than no loop; a 2-second deterministic loop is a debugging superpower.

For non-deterministic bugs, the goal is not a clean repro but a **higher reproduction rate**. Loop the trigger many times, parallelise, add stress, narrow timing windows. A 50%-flake bug is debuggable; 1% is not — keep raising the rate until it is.

If you genuinely cannot build a loop, stop and say so explicitly. List what you tried. Ask for: (a) access to whatever environment reproduces it, (b) a captured artifact (HAR file, log dump, core dump, screen recording with timestamps), or (c) permission to add temporary production instrumentation. Do **not** proceed without a loop.

## Phase 2 — Reproduce

Run the loop. Watch the bug appear. Confirm:

- [ ] The loop produces the failure mode the **user** described — not a different failure that happens to be nearby. Wrong bug = wrong fix.
- [ ] The failure reproduces across multiple runs (or, for non-deterministic bugs, at a high enough rate to debug against).
- [ ] You have captured the exact symptom (error message, wrong output, slow timing) so later phases can verify the fix actually addresses it.

Do not proceed until you reproduce the bug.

## Phase 3 — Hypothesise

Generate **3–5 ranked hypotheses** before testing any of them. Single-hypothesis generation anchors on the first plausible idea. Each hypothesis must be **falsifiable**: state the prediction it makes.

> Format: "If <X> is the cause, then <changing Y> will make the bug disappear / <changing Z> will make it worse."

If you cannot state the prediction, the hypothesis is a vibe — discard or sharpen it.

Show the ranked list before testing. Reviewers (the build/ pipeline's reviewer agent, or the human) often have context that re-ranks instantly. Cheap checkpoint, big time saver. Don't block on it — proceed with your ranking if no one is around.

## Phase 4 — Instrument

Each probe must map to a specific prediction from Phase 3. **Change one variable at a time.** Tool preference:

1. **Debugger / REPL inspection** if the env supports it. One breakpoint beats ten logs.
2. **Targeted logs** at the boundaries that distinguish hypotheses.
3. Never "log everything and grep."

**Tag every debug log** with a unique prefix, e.g. `[DEBUG-a4f2]`. Cleanup at the end becomes a single grep. Untagged logs survive; tagged logs die.

For performance regressions, logs are usually wrong. Establish a baseline measurement (timing harness, `performance.now()`, profiler, query plan), then bisect. Measure first, fix second.

## Phase 5 — Fix + regression test

Write the regression test **before the fix** — but only if there is a **correct seam** for it. A correct seam is one where the test exercises the **real bug pattern** as it occurs at the call site. If the only available seam is too shallow (single-caller test when the bug needs multiple callers, unit test that can't replicate the chain that triggered the bug), a regression test there gives false confidence. If no correct seam exists, that itself is the finding — document it in the iteration's SPEC.md as an architecture flag.

If a correct seam exists:
1. Turn the minimised repro into a failing test at that seam.
2. Watch it fail.
3. Apply the fix.
4. Watch it pass.
5. Re-run the Phase 1 feedback loop against the original (un-minimised) scenario.

Document the diagnosis in the iteration's `01-spec/SPEC.md`:

- **Trigger:** how to reproduce (link to the test)
- **Symptom:** what the user / system observed
- **Root cause:** the code-level reason (file:line)
- **Why prior tests didn't catch it:** what's missing from coverage

## Phase 6 — Cleanup + post-mortem

Required before declaring done:

- [ ] Original repro no longer reproduces (re-run the Phase 1 loop)
- [ ] Regression test passes (or absence of seam is documented in `01-spec/SPEC.md`)
- [ ] All `[DEBUG-...]` instrumentation removed (`grep` the prefix)
- [ ] Throwaway prototypes deleted (or moved to a clearly-marked debug location under `lab/`)
- [ ] The hypothesis that turned out correct is stated in the commit / PR message — so the next debugger learns

Then ask: what would have prevented this bug? If the answer involves architectural change (no good test seam, tangled callers, hidden coupling), hand off to `architecture-audit` with the specifics. Make the recommendation **after** the fix is in, not before — you have more information now than when you started.

## Anti-patterns

- "Fixing" a bug by patching the symptom (catching the exception, defaulting the null) without understanding why the bad state arose. The trigger is what the user did; the root cause is the code-level reason that input produces wrong output. State both.
- Closing a bug as "cannot reproduce" without asking the reporter for the missing context. Cannot-reproduce is a Phase 1 failure, not a fix.
- Deleting the reproduction test after the fix lands. The test prevents recurrence.
- Bundling the bug fix with unrelated cleanup. Fix in one commit; cleanup in another.
- Proceeding past Phase 1 without a feedback loop. Without one, you're guessing.

---

> Phase structure, feedback-loop primacy, ranked-hypotheses discipline, and `[DEBUG-xxxx]` tagging are adapted in part from mattpocock/skills@e74f0061bb67222181640effa98c675bdb2fdaa7 (MIT). The build/-pipeline integration, `01-spec/SPEC.md` diagnosis format, and architecture-audit handoff are native. See `THIRD_PARTY_LICENSES.md`.
```

- [ ] **Step 8.3: Verify the rewrite**

```bash
wc -l .claude/skills/bug-investigation/SKILL.md
grep -c "Phase 1 — Build a feedback loop" .claude/skills/bug-investigation/SKILL.md
grep -c "Phase 6 — Cleanup" .claude/skills/bug-investigation/SKILL.md
grep -c "01-spec/SPEC.md" .claude/skills/bug-investigation/SKILL.md
grep -c "architecture-audit" .claude/skills/bug-investigation/SKILL.md
grep -c "mattpocock/skills" .claude/skills/bug-investigation/SKILL.md
```
Expected (in order): line count ~95 (was 41); `1`; `1`; `>=2`; `1`; `1`.

- [ ] **Step 8.4: Verify portability**

```bash
DENY=$(grep -v '^#' .claude/.portability-deny.txt | grep -v '^$')
if [[ -z "$DENY" ]]; then
  echo "PORTABILITY: deny list empty; PASS by default"
else
  echo "$DENY" | grep -i -F -f /dev/stdin .claude/skills/bug-investigation/SKILL.md && echo "PORTABILITY: FAIL" || echo "PORTABILITY: PASS"
fi
```
Expected: `PORTABILITY: PASS`.

- [ ] **Step 8.5: Commit**

```bash
git add .claude/skills/bug-investigation/SKILL.md
git commit -m "feat(skills): hybridize bug-investigation with 6-phase + feedback-loop primacy

Restructure around mattpocock/skills@e74f0061bb67222181640effa98c675bdb2fdaa7's six phases (build feedback
loop, reproduce, hypothesise, instrument, fix+regression, cleanup).
Preserve native 01-spec/SPEC.md diagnosis format (folded into Phase 5)
and add architecture-audit handoff in Phase 6."
```

---

## Task 9: Hybridize `spike-protocol` (add PROTOTYPE-SHAPES.md supporting file)

**Files:**
- Create: `.claude/skills/spike-protocol/PROTOTYPE-SHAPES.md`
- Modify: `.claude/skills/spike-protocol/SKILL.md` (add link + attribution footnote)

- [ ] **Step 9.1: Create PROTOTYPE-SHAPES.md**

Write this exact content to `.claude/skills/spike-protocol/PROTOTYPE-SHAPES.md`:

```markdown
<!-- Adapted in part from github.com/mattpocock/skills/skills/engineering/prototype/SKILL.md @ e74f0061bb67222181640effa98c675bdb2fdaa7 -->

# Prototype Shapes

A spike's `prototype/` directory holds throwaway code that answers the spike's question. The shape of the code depends on what the question is.

## Pick a branch

- **"Does this logic / state model feel right?"** → terminal app. Build a tiny interactive script that pushes the state machine through cases that are hard to reason about on paper. Print full state after every action.
- **"What should this look like?"** → UI variations. Generate several radically different UI variations on a single route, switchable via a URL search param and a floating bottom bar. Don't pick a winner inside the prototype; the spike's PREFLIGHT.md says how to compare them.

The two branches produce very different artifacts. Getting it wrong wastes the whole prototype. If the question is genuinely ambiguous, default to whichever branch better matches the surrounding code (backend module → logic; page/component → UI) and state the assumption at the top of the prototype.

## Rules that apply to both shapes

1. **Throwaway from day one, and clearly marked as such.** Locate the prototype close to where it will eventually be used (next to the module or page it's prototyping for) so context is obvious — but name it so a casual reader can see it's a prototype, not production. For throwaway UI routes, obey whatever routing convention the project already uses; don't invent a new top-level structure.
2. **One command to run.** Whatever the project's task runner supports — `pnpm <name>`, `python <path>`, `bun <path>`. The user must be able to start it without thinking.
3. **No persistence by default.** State lives in memory. Persistence is the thing the prototype is *checking*, not something it should depend on. If the question explicitly involves a database, hit a scratch DB or a local file with a clear `PROTOTYPE — wipe me` name.
4. **Skip the polish.** No tests, no error handling beyond what makes the prototype *runnable*, no abstractions. The point is to learn something fast and then delete it.
5. **Surface the state.** After every action (logic) or on every variant switch (UI), print or render the full relevant state so the user can see what changed.
6. **Delete or absorb when done.** When the prototype has answered its question, either delete it or fold the validated decision into the real code — don't leave it rotting in the repo.

## What to do with the answer

The answer is the only thing worth keeping. Capture it in the spike's `VERIFY.md` and `REPORT.md` along with the question it was answering. If `REPORT.md`'s outcome is "Abandon," also write a `docs/explorations/NN-<slug>.md` so the next person investigating the same question doesn't repeat the work. Then delete the prototype code.
```

- [ ] **Step 9.2: Add the PROTOTYPE-SHAPES.md link to `SKILL.md`**

Use the `Edit` tool on `.claude/skills/spike-protocol/SKILL.md`. Find this `old_string`:

```
2. **`prototype/`** — the code. Throwaway. No production patterns required (no tests, no error handling, no logging) unless they're part of what you're testing.
```

Replace with:

```
2. **`prototype/`** — the code. Throwaway. No production patterns required (no tests, no error handling, no logging) unless they're part of what you're testing. See [PROTOTYPE-SHAPES.md](PROTOTYPE-SHAPES.md) for the two prototype shapes (logic vs UI) and the rules that apply to both.
```

- [ ] **Step 9.3: Add attribution footnote to `SKILL.md`**

Use the `Edit` tool on `.claude/skills/spike-protocol/SKILL.md`. Find this `old_string` (the last line of the "When NOT to use this skill" section):

```
- You already know the answer — that's a spec, not a spike.
```

Replace with:

```
- You already know the answer — that's a spec, not a spike.

---

> `PROTOTYPE-SHAPES.md` is adapted in part from mattpocock/skills@e74f0061bb67222181640effa98c675bdb2fdaa7 (MIT). See `THIRD_PARTY_LICENSES.md`.
```

- [ ] **Step 9.4: Verify**

```bash
ls .claude/skills/spike-protocol/
grep -c "PROTOTYPE-SHAPES" .claude/skills/spike-protocol/SKILL.md
grep -c "mattpocock/skills" .claude/skills/spike-protocol/SKILL.md
```
Expected: directory contains `PROTOTYPE-SHAPES.md` and `SKILL.md`; `1`; `1`.

- [ ] **Step 9.5: Commit**

```bash
git add .claude/skills/spike-protocol/
git commit -m "feat(skills): hybridize spike-protocol with PROTOTYPE-SHAPES.md

Add supporting file covering logic-vs-UI prototype branches and shared
rules (throwaway, one command, no persistence, surface state). Adapted
from mattpocock/skills@e74f0061bb67222181640effa98c675bdb2fdaa7. Spike methodology, timebox discipline, and
docs/explorations/ outcome capture unchanged."
```

---

## Task 10: Update `.claude/routing/refactor.md` to add `architecture-audit`

**Files:**
- Modify: `.claude/routing/refactor.md`

- [ ] **Step 10.1: Edit the file**

Use the `Edit` tool. Find this `old_string`:

```
- Skills: `tdd-loop`, `karpathy-guidelines`
```

Replace with this `new_string`:

```
- Skills: `tdd-loop`, `karpathy-guidelines`, `architecture-audit`
```

- [ ] **Step 10.2: Verify**

```bash
grep "architecture-audit" .claude/routing/refactor.md
```
Expected: one match on the Skills line.

- [ ] **Step 10.3: Do not commit yet** — bundled with Task 12 (after `rebuild-registry` validates the routing reference).

---

## Task 11: Update `SKILLS.md` (human-readable inventory)

**Files:**
- Modify: `SKILLS.md` (root of repo)

`SKILLS.md` is for human orientation. Add entries for the 5 new skills and a note acknowledging the 3 hybrid edits.

- [ ] **Step 11.1: Find the section listing native skills**

```bash
grep -n "tdd-loop\|spike-protocol\|bug-investigation" SKILLS.md
```
Use the line numbers to locate where native skill entries belong. Read 20 lines of context around the first match to see the existing list style (one-line bullet vs multi-line, alphabetical or grouped, etc.).

- [ ] **Step 11.2: Insert 5 new skill entries**

Use the `Edit` tool to add these lines into the native-skills section of `SKILLS.md`. Match the existing list style — if the existing list uses `- **name** — description`, use the same shape:

```markdown
- **architecture-audit** — Surface architectural friction; propose deepening-opportunity refactors. Pairs with refactor-protocol. Auto-routes in `.claude/routing/refactor.md`. Adapted from mattpocock/skills@e74f0061bb67222181640effa98c675bdb2fdaa7.
- **caveman** — Ultra-compressed response mode. Always loads in every routing branch for token discipline; explicit invocation activates persistent caveman mode. From mattpocock/skills@e74f0061bb67222181640effa98c675bdb2fdaa7.
- **handoff** — Compact the current conversation into a handoff markdown for another agent. Explicit invocation only. From mattpocock/skills@e74f0061bb67222181640effa98c675bdb2fdaa7.
- **write-a-skill** — Walkthrough for authoring new skills with proper SKILL.md structure and trigger discipline. Explicit invocation only. From mattpocock/skills@e74f0061bb67222181640effa98c675bdb2fdaa7.
- **zoom-out** — Ask the agent to step up a layer of abstraction and map relevant modules/callers. Explicit invocation only. From mattpocock/skills@e74f0061bb67222181640effa98c675bdb2fdaa7.
```

Place the entries to match the existing convention (alphabetical or grouped by category).

- [ ] **Step 11.3: Add a hybridization note**

In the same section (after the new entries, or in the most natural location), add this one-line note. Match the existing format if the file uses block-quote notes elsewhere:

```markdown
> **Hybridized 2026-05-14:** `tdd-loop`, `bug-investigation`, and `spike-protocol` incorporate ideas from mattpocock/skills@e74f0061bb67222181640effa98c675bdb2fdaa7. See each skill's footer and `THIRD_PARTY_LICENSES.md`.
```

- [ ] **Step 11.4: Verify**

```bash
grep -c "architecture-audit\|caveman\|handoff\|write-a-skill\|zoom-out" SKILLS.md
grep -c "Hybridized 2026-05-14" SKILLS.md
```
Expected: `>=5`; `1`.

- [ ] **Step 11.5: Do not commit yet** — bundled with Task 12.

---

## Task 12: Run `rebuild-registry`, validate, smoke-test, and final commit

**Files (modified by this task):**
- `.claude/registry/native-inventory.json` (regenerated by `npm run rebuild-registry`)
- Possibly other JSONs in `.claude/registry/` (regenerated; review the diff)
- `docs/superpowers/specs/2026-05-14-mattpocock-skills-integration-design.md` (status flip from Draft to Implemented)

- [ ] **Step 12.1: Run `rebuild-registry`**

```bash
npm run rebuild-registry
```
Expected: prints counts for ECC / harness / native scrapes; reports `Native: N items` where N is the prior count + 5; writes registries; reports zero validation errors.

If the script reports errors (e.g., "skill referenced in routing but not found in registry"), stop and resolve before continuing — the most likely cause is a typo in `.claude/routing/refactor.md` or a missing `SKILL.md` file.

- [ ] **Step 12.2: Inspect what changed in the registry**

```bash
git diff --stat .claude/registry/
git diff .claude/registry/native-inventory.json | grep -E '\+.*"name":' | head -20
```
Expected: among the additions, see entries for `caveman`, `handoff`, `zoom-out`, `write-a-skill`, `architecture-audit`.

- [ ] **Step 12.3: Run the test suite**

```bash
npm test
```
Expected: all tests pass with zero failures.

- [ ] **Step 12.4: Smoke-test each new skill via the Skill tool**

Invoke each new skill explicitly using the `Skill` tool. For each of `caveman`, `handoff`, `zoom-out`, `write-a-skill`, `architecture-audit`:

1. Call the `Skill` tool with the skill's name as the argument.
2. Confirm the response contains the SKILL.md content (not a "skill not found" error).
3. Note any unexpected behavior.

Expected: each invocation returns the SKILL.md content. No errors.

- [ ] **Step 12.5: Run the portability hook check against all new/modified skill files**

```bash
DENY=$(grep -v '^#' .claude/.portability-deny.txt | grep -v '^$')
if [[ -z "$DENY" ]]; then
  echo "PORTABILITY: deny list empty; PASS by default"
else
  ALL_FAILS=""
  for f in .claude/skills/caveman/SKILL.md \
           .claude/skills/handoff/SKILL.md \
           .claude/skills/zoom-out/SKILL.md \
           .claude/skills/write-a-skill/SKILL.md \
           .claude/skills/architecture-audit/SKILL.md \
           .claude/skills/architecture-audit/LANGUAGE.md \
           .claude/skills/tdd-loop/SKILL.md \
           .claude/skills/bug-investigation/SKILL.md \
           .claude/skills/spike-protocol/SKILL.md \
           .claude/skills/spike-protocol/PROTOTYPE-SHAPES.md; do
    if echo "$DENY" | grep -i -F -f /dev/stdin "$f" > /dev/null; then
      ALL_FAILS="$ALL_FAILS\n$f"
    fi
  done
  if [[ -z "$ALL_FAILS" ]]; then
    echo "PORTABILITY: PASS"
  else
    echo -e "PORTABILITY: FAIL on:$ALL_FAILS"
  fi
fi
```
Expected: `PORTABILITY: PASS`.

- [ ] **Step 12.6: Flip the spec status from Draft to Implemented**

Use the `Edit` tool on `docs/superpowers/specs/2026-05-14-mattpocock-skills-integration-design.md`. Find this `old_string`:

```
**Status:** Draft (awaiting user review)
```

Replace with:

```
**Status:** Implemented (2026-05-14)
```

- [ ] **Step 12.7: Final commit**

```bash
git add .claude/routing/refactor.md \
        SKILLS.md \
        .claude/registry/ \
        docs/superpowers/specs/2026-05-14-mattpocock-skills-integration-design.md
git commit -m "feat(routing): wire architecture-audit; refresh registry; update SKILLS.md

Add architecture-audit to .claude/routing/refactor.md alongside
refactor-protocol. Regenerate native-inventory.json via
rebuild-registry. List 5 new skills in SKILLS.md and note the 3
hybridizations. Mark integration spec as Implemented."
```

- [ ] **Step 12.8: Verify the final state**

```bash
git log --oneline -15
git status
ls .claude/skills/ | sort
```
Expected: 12 new commits on top of `4f66d48`; clean working tree; `.claude/skills/` includes all originals + `architecture-audit`, `caveman`, `handoff`, `write-a-skill`, `zoom-out`.

```bash
npm run rebuild-registry && npm test
```
Expected: both pass.

---

## Acceptance checklist (mirrors spec §9)

After Task 12 completes, confirm every acceptance criterion from the spec is met:

- [ ] All 8 new files exist (5 new SKILL.md + LANGUAGE.md + PROTOTYPE-SHAPES.md + the design spec which was committed earlier as `4f66d48`).
- [ ] All 5 edited files reflect described changes (`tdd-loop`, `bug-investigation`, `spike-protocol`, `THIRD_PARTY_LICENSES.md`, `SKILLS.md`).
- [ ] `THIRD_PARTY_LICENSES.md` contains the `mattpocock-skills` section with the pinned SHA and the full MIT license text.
- [ ] `.claude/routing/refactor.md` references `architecture-audit`.
- [ ] `.claude/registry/native-inventory.json` includes the 5 new skills (auto-generated).
- [ ] `npm run rebuild-registry` returns zero errors.
- [ ] `npm test` passes.
- [ ] No portability denials.
- [ ] Each new skill loads cleanly via the `Skill` tool (manual smoke test).
- [ ] `SKILLS.md` lists the 5 new entries and the hybridization note.

---

## References

- Spec: [`docs/superpowers/specs/2026-05-14-mattpocock-skills-integration-design.md`](../specs/2026-05-14-mattpocock-skills-integration-design.md)
- Upstream: https://github.com/mattpocock/skills @ `e74f0061bb67222181640effa98c675bdb2fdaa7`
- Native scraper: `scripts/lib/native-scraper.mjs`
- Registry rebuild: `scripts/rebuild-registry.mjs` (entry point `npm run rebuild-registry`)
- Portability hook: `.claude/hooks/enforce-portability.sh` (PostToolUse trigger; deny list at `.claude/.portability-deny.txt`)
