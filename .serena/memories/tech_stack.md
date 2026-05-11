# Tech Stack

## Languages

- **Node.js 18+** for scripts/tests (`.mjs` ESM extensions; no `"type": "module"` in package.json to keep `.js` files non-ESM by default)
- **Bash** for hooks and lifecycle scripts (`set -e` for fail-fast, `set -u` where input is structured)
- **Markdown** for routing trees, specs, plans, agent/skill content

## Dependencies

- **One npm dep:** `gray-matter` (YAML frontmatter parsing)
- No transpilation, no bundler, no TypeScript

## Test framework

- Node's built-in `node --test` (no Jest/Mocha/Vitest)
- Test files: `tests/unit/*.test.mjs`
- Snapshot tests: `tests/routing-cases/*.json` consumed by `tests/unit/routing-snapshots.test.mjs`
- Hook + integration tests: bash scripts in `tests/hook/`, `tests/integration/`
- Orchestrator: `tests/run.mjs` (runs all three types in sequence)

## Subprocess discipline

- Use `spawnSync('cmd', ['arg1', 'arg2'])` with array args — NEVER `execSync('cmd "arg with $var"')`.
- Project security hook flags shell-templated `execSync`. Use `spawnSync` array form to avoid shell parsing entirely.

## MCP servers (configured in .claude/settings.json)

- `filesystem`, `git`, `fetch` — credential-free, work out of the box
- `github` — requires `GITHUB_TOKEN` env var (see `.claude/MCP-SETUP.md`)

## Plugins (installed globally via /plugin install)

- `obra/superpowers`, `affaan-m/everything-claude-code` — recommended, documented in MCP-SETUP.md
