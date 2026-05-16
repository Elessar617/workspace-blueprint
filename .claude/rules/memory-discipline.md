# Rule: Memory discipline

**MCP memory and Serena memory surfaces are stable knowledge stores, not session scratchpads. Writes require justification; reads should verify currency before relying on them.**

**Why:** `.claude/.mcp-memory.json` (the `memory` MCP server's store) and `.serena/memories/*.md` (the Serena LSP's onboarding files) persist across sessions. Without discipline they accumulate stale or wrong information that re-enters future sessions as pseudo-fact. Audit finding M11/F3.2 surfaced that no convention currently constrains either.

**How to apply:**

- **Treat as canonical, not opportunistic.** Information committed to either store should be a true invariant of the project (e.g., "the build command is `npm test`"), not a session-specific observation ("we just ran the test suite").
- **Frontmatter required for Serena memory files.** Each `.serena/memories/*.md` must include `created_by:` (agent or human name), `verified_at:` (ISO date when the content was last checked against current state), and `applies_to:` (scope — repo-wide, a path, a topic).
- **MCP memory writes record provenance.** When an agent writes to `mcp__*_memory__*` tools, the entity name should include a source tag (e.g., `command-shape:test-runner` not just `test-runner`).
- **Reads verify currency.** Before using a memory fact in a recommendation that the user will act on, spot-check against the current code or filesystem. Memory is a snapshot; current state is the source of truth.
- **Stale memories get removed, not patched.** If a memory says X and current state says Y, prefer deleting the memory entry over editing it. The memory record had context that may not survive a patch; clean removal forces a fresh capture.

**Trade-off:** This is procedural, not hook-enforced. A future hook could grep `.serena/memories/*.md` for required frontmatter on write, but the current rule is a contract for agent behavior, not a code gate.
