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
