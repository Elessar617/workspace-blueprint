# ECC as an Agent Harness

This note captures how to use Everything Claude Code (ECC) with this workspace
and how to port the same ideas into Pi plus Pydantic AI Harness.

## What an agent harness is

An agent harness is the layer around a model-driven agent that makes it useful
and governable. The model is the engine. The harness is the runtime chassis:

- instructions and routing
- skills and reusable workflows
- subagent definitions
- tools and MCP servers
- hooks around lifecycle and tool calls
- permission policy
- memory and context management
- verification loops and evals
- observability and stop controls

ECC is a harness because it packages those surfaces together. In this repo, the
portable subset is not copied wholesale into the always-loaded prompt. Instead:

- `external/ecc/` pins the upstream ECC catalog.
- `.claude/registry/*.json` snapshots agents, skills, commands, MCPs, hook
  profiles, and language rules.
- `ROUTING.md` and `.claude/routing/*.md` narrow the inventory per task.
- `.claude/settings.json` wires hooks, MCPs, and permission policy.
- The native build loop keeps planner, implementer, reviewer, and adversary as
  separate roles with file outputs.

That keeps ECC as an indexed capability layer, not a giant context blob.

## Best use with multiple agents

Default to one orchestrator. Add agents only when their work is scoped enough
that a small output can be trusted and reviewed.

Good parallelism:

- main session edits code; side sessions answer bounded codebase questions
- reviewer and adversary validate the same diff in parallel
- separate worktrees handle code changes with disjoint file ownership
- research agent gathers external docs while implementer works locally

Risky parallelism:

- multiple agents editing the same files
- subagents receiving vague goals instead of concrete inputs
- long-lived memory shared with untrusted web, email, PDF, or PR content
- extra MCPs enabled "just in case"

Easy local setup for overlapping code work:

```bash
git fetch
git worktree add ../workspace-blueprint-feature-a -b codex/feature-a main
git worktree add ../workspace-blueprint-feature-b -b codex/feature-b main

cd ../workspace-blueprint-feature-a
./scripts/bootstrap.sh
./scripts/with-profile.sh standard <agent-command>
```

Give each session one ownership packet:

```markdown
Task:
Files owned:
Files off limits:
Input docs:
Expected output file:
Verification command:
Stop condition:
```

For this repo's native build loop, use the existing sequence:

1. Planner reads a source artifact and writes `01-spec/SPEC.md`.
2. Implementer reads the spec and writes code plus `02-implement/notes-N.md`.
3. Reviewer checks the diff against spec and rules.
4. Adversary probes edge cases, attack surface, race conditions, and missing
   assumptions.
5. Orchestrator promotes only after review passes and adversary findings are
   `none` or `minor`.

## Porting to Pi plus Pydantic AI Harness

Pi is a minimal terminal coding harness. Its useful primitives line up well with
this repo's ECC bridge:

- `AGENTS.md` files load project instructions at startup.
- Skills provide reusable, on-demand capabilities.
- Prompt templates give slash-command-like workflow entry points.
- Extensions can add tools, commands, events, UI, context injection, and history
  filtering.
- Packages can bundle extensions, skills, prompts, and themes.
- Print/JSON, RPC, and SDK modes make Pi embeddable from other runtimes.
- Subagents, MCP, plan mode, permission gates, path protection, and sandboxing
  are extension/package territory rather than required core features.

That means the clean port is not "replace ECC with Pi." It is "use the
workspace-blueprint routing/contracts as the portable harness policy, then expose
the pieces through Pi primitives."

Port ECC by mapping each surface to Pi and typed Pydantic components:

| ECC / blueprint surface | Pi equivalent | Pydantic AI / harness equivalent |
| --- | --- | --- |
| `ROUTING.md` decision tree | prompt template or extension route hook | `RouteDecision` model plus router function |
| `.claude/registry/*.json` | package metadata or extension-local catalog | typed `AgentSpec`, `SkillSpec`, `ToolSpec` catalog |
| skills | Pi skills | skills capability or directory-backed instruction loader |
| subagents | subagent extension spawning isolated `pi` subprocesses | agent delegation, programmatic handoff, or graph nodes |
| hooks | Pi extension events and context filters | model/tool lifecycle hooks and guardrails |
| MCP servers | CLI-backed skills or MCP extension | Pydantic AI MCP capability or custom toolsets |
| review/adversary loop | prompt templates chaining worker/reviewer runs | graph state machine with typed reports |
| permission denies | permission-gate/path-protection extensions | tool guard / approval policy |
| memory files | extension-managed dynamic context or session summaries | scoped memory capability with rotation |
| CI and audit scripts | `pi -p` / JSON event stream jobs | evals plus preflight checks |

Minimal type shape:

```python
from typing import Literal
from pydantic import BaseModel

class RouteDecision(BaseModel):
    branch: Literal["build", "bug", "refactor", "spike", "spec-author", "ship", "fallback"]
    agents: list[str]
    skills: list[str]
    tools: list[str]
    hook_profile: Literal["minimal", "standard", "strict"]

class ReviewReport(BaseModel):
    verdict: Literal["pass", "fail"]
    verdict_reason: str
    findings: list[str]

class AdversaryReport(BaseModel):
    findings: Literal["none", "minor", "critical"]
    findings_summary: str
    probes: list[str]
```

Recommended control flow:

```text
user request
  -> router returns RouteDecision
  -> Pi loads only selected skills/prompts/extensions
  -> planner or researcher produces one typed artifact
  -> implementer works in a sandbox/worktree or delegated Pi subprocess
  -> reviewer and adversary run as independent Pi/Pydantic agents
  -> gate promotes or loops
  -> audit logs record tool calls, approvals, files touched, and costs
```

Practical hybrid shape:

```text
Pi TUI
  -> extension reads ROUTING.md + registries
  -> extension calls Pydantic router/reviewer/adversary over RPC or HTTP
  -> Pydantic agents return typed JSON reports
  -> Pi renders progress, streams subprocess output, and writes repo artifacts
```

Security baseline for the port:

- deny reads from `~/.ssh`, cloud credentials, env files, and memory stores
- require approval for network egress, shell execution, off-workspace writes, and
  deployment
- keep MCP/tool count small and task-specific
- separate untrusted content extraction from action-taking agents
- rotate or disable memory after untrusted runs
- log agent name, task id, tool calls, approvals, files touched, token use, and
  stop reason
- use process-group kill and heartbeat supervision for long-running workers

Prefer JSON catalogs, small typed outputs, and short-lived Pi subprocess workers
over a large always-on multi-agent runtime. The port should preserve ECC's main
lesson: the harness narrows, gates, records, and verifies what the model can do.
