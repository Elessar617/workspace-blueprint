# Task Completion Checklist

Run through this list BEFORE marking any task complete.

## 1. Tests pass

```bash
npm test
```

- Unit tests (`tests/unit/*.test.mjs`) all green
- Hook tests (`tests/hook/*.test.sh`) all green
- Integration tests (`tests/integration/*.sh`) all green
- Summary line: `--- summary: 0 failure(s) ---`

If tests fail, stop and fix.

## 2. Lint / format / type-check (if applicable)

This repo doesn't currently have project-wide lint/format (it's small and ESM/bash). If you added a language with conventions, add the lint command to `.claude/reference/tech-stack.md` and run it here.

## 3. Commits are clean

- One logical change per commit
- Conventional Commits format
- No `--no-verify` bypasses (the TDD hook is mandatory; if blocking, address the root cause)
- No `.env`, credentials, `.DS_Store`, or large binaries
- Stage specific paths (`git add path/to/file`), not `git add -A`

## 4. Hooks fired cleanly

If `BLUEPRINT_HOOK_PROFILE` is set to anything other than `standard`, note WHY in commit message or comment. Don't silently bypass enforcement.

## 5. Registry stays in sync (if you touched ECC or installed/removed plugins)

- After `git submodule update --remote external/ecc`: run `./scripts/update-ecc.sh`
- After `/plugin install` or `/plugin remove`: run `./scripts/refresh-harness.sh`
- After editing `.claude/routing/*.md`: run `npm run rebuild-registry` and check the dangling-references warnings — new ones may signal name drift to fix.

## 6. Routing-cases updated (if route.mjs logic changed)

- New branch / new language detection → add or update `tests/routing-cases/*.json`
- Re-run `node --test tests/unit/routing-snapshots.test.mjs`

## 7. For `build/` workflow iterations

- Reviewer agent verdict: `pass`
- Adversary agent findings: `none` or `minor` (deferred OK)
- Cycle count: ≤ 5 (hook-enforced; override blocks at 6)
- Promotion to `04-output/` requires both signoffs
- See `.claude/rules/review-discipline.md`

## 8. For `ship/` workflow

- All native rules apply at strict level
- `BLUEPRINT_HOOK_PROFILE=strict` recommended (reserved for release work)
- Release notes in `ship/changelog/vX.Y.Z.md`
- See `.claude/rules/code-quality.md`
