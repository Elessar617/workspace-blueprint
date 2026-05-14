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
