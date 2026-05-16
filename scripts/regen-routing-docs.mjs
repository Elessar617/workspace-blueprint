#!/usr/bin/env node
// Regenerate all derived prose surfaces from the routing source of truth.
//
// Source of truth: scripts/route.mjs (TASK_RULES + AGENTS_BY_BRANCH +
// MANDATORIES_BY_BRANCH + MCPS_BY_BRANCH + BRANCH_TO_PROFILE) plus filesystem
// inspection of .claude/{hooks,rules,skills,agents}.
//
// Generated surfaces (each region in each file is bounded by stable comment
// markers OR identified by a stable line-prefix anchor so the generator only
// rewrites the intended sub-region; hand-authored framing is preserved):
//
//   - .claude/routing/<branch>.md  (full file; was already regen-driven)
//   - ROUTING.md                   (Step-1 keyword table region)
//   - AGENTS.md                    (procedure body region)
//   - .cursorrules                 (procedure body region)
//   - GEMINI.md                    (procedure body region)
//   - CLAUDE.md                    (tree-diagram skill+hook counts +
//                                   prose "**N skills**" count)
//   - CONTEXT.md                   ("all N" rules count)
//   - START-HERE.md                (rule + hook counts)
//
// The drift test (tests/unit/routing-docs-in-sync.test.mjs) is the contract:
// running `npm run regen-routing-docs` twice MUST be a no-op (idempotency),
// and the rendered content MUST match every assertion in the drift test.

import { readFileSync, readdirSync, statSync, writeFileSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  AGENTS_BY_BRANCH,
  ALWAYS_LOADED_SKILLS,
  MANDATORIES_BY_BRANCH,
  MCPS_BY_BRANCH,
  BRANCH_TO_PROFILE,
  TASK_RULES,
} from './route.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = join(__dirname, '..');

const BRANCHES = ['build', 'bug', 'refactor', 'spike', 'spec-author', 'ship', 'review'];

const BRANCH_TITLES = {
  build: 'Build (feature implementation)',
  bug: 'Bug (defect fix)',
  refactor: 'Refactor (structural change)',
  spike: 'Spike (exploratory iteration)',
  'spec-author': 'Spec Author (RFC / ADR / brief)',
  ship: 'Ship (release artifacts)',
  review: 'Review (audit / evaluation)',
};

// Workspace mapping for the ROUTING.md Step-1 table. This map mirrors the
// authored table at landing time (commit `9e5d3d9`). It does NOT live in
// scripts/route.mjs because SPEC 01-regen-prose-widen carves route.mjs out
// as the read-only routing engine; routing display metadata is generator-
// owned.
const BRANCH_TO_WORKSPACE = {
  review: '`build/`',
  build: '`build/`',
  bug: '`build/`',
  refactor: '`build/`',
  spike: '`lab/`',
  'spec-author': '`spec/`',
  ship: '`ship/`',
};

// ---------------------------------------------------------------------------
// Region-marker helpers
// ---------------------------------------------------------------------------

// Marker syntax: HTML comments tagged with a stable region NAME so the
// generator can locate exactly one start/end pair per region. Markers are
// invisible in rendered Markdown for normal prose (HTML comments). For fenced
// code blocks (CLAUDE.md tree diagram), the generator uses line-prefix anchors
// rather than HTML markers because comments inside ``` ... ``` render as
// literal text and would harm the human-reading view.

const START = (name) => `<!-- regen:start ${name} -->`;
const END = (name) => `<!-- regen:end ${name} -->`;

/**
 * Replace the content between the start/end markers for `name` with `inner`.
 * Preserves markers exactly. Fails fast if the markers are missing or appear
 * more than once (the regen contract requires exactly one pair per region).
 *
 * @param {string} content - file content
 * @param {string} name - marker region name
 * @param {string} inner - replacement content (no markers)
 * @returns {string} - file content with the region rewritten
 */
function replaceMarkedRegion(content, name, inner) {
  const startMarker = START(name);
  const endMarker = END(name);
  const startIdx = content.indexOf(startMarker);
  const endIdx = content.indexOf(endMarker);
  if (startIdx === -1 || endIdx === -1) {
    throw new Error(`marker region "${name}" missing (start=${startIdx}, end=${endIdx})`);
  }
  // Reject duplicate markers — would silently corrupt the file otherwise.
  if (content.indexOf(startMarker, startIdx + 1) !== -1) {
    throw new Error(`marker region "${name}" has duplicate start marker`);
  }
  if (content.indexOf(endMarker, endIdx + 1) !== -1) {
    throw new Error(`marker region "${name}" has duplicate end marker`);
  }
  if (endIdx < startIdx) {
    throw new Error(`marker region "${name}" end appears before start`);
  }
  const before = content.slice(0, startIdx + startMarker.length);
  const after = content.slice(endIdx);
  return `${before}\n${inner}\n${after}`;
}

/**
 * Replace a single line identified by its `prefix` (line starts with prefix).
 * The replacement is the prefix concatenated with `tail`. Used for in-fence
 * counts in CLAUDE.md tree where HTML markers would render as literal text.
 *
 * Fails fast if zero or multiple lines match the prefix.
 *
 * @param {string} content
 * @param {string} prefix
 * @param {string} tail - text after the prefix (no leading whitespace beyond what `prefix` already contains)
 * @returns {string}
 */
function replacePrefixedLine(content, prefix, tail) {
  const lines = content.split('\n');
  let matchIdx = -1;
  // Bounded loop: lines.length is finite (filesystem-bounded).
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].startsWith(prefix)) {
      if (matchIdx !== -1) {
        throw new Error(`prefix "${prefix}" matches multiple lines (${matchIdx}, ${i})`);
      }
      matchIdx = i;
    }
  }
  if (matchIdx === -1) {
    throw new Error(`prefix "${prefix}" not found`);
  }
  lines[matchIdx] = `${prefix}${tail}`;
  return lines.join('\n');
}

// ---------------------------------------------------------------------------
// Filesystem-derived counts
// ---------------------------------------------------------------------------

/**
 * Count entries that are directories under `.claude/skills/` AND contain a
 * SKILL.md file at the top level (the convention for "this is a skill"). The
 * SKILL.md gate excludes incidental directories or shared docs.
 */
function countSkills() {
  const dir = join(REPO_ROOT, '.claude', 'skills');
  let count = 0;
  for (const entry of readdirSync(dir)) {
    const entryPath = join(dir, entry);
    if (!statSync(entryPath).isDirectory()) continue;
    if (!existsSync(join(entryPath, 'SKILL.md'))) continue;
    count++;
  }
  return count;
}

/**
 * Count `.sh` files directly under `.claude/hooks/`. The convention is "one
 * hook per bash file"; non-`.sh` entries (README etc.) are not counted.
 */
function countHooks() {
  const dir = join(REPO_ROOT, '.claude', 'hooks');
  let count = 0;
  for (const entry of readdirSync(dir)) {
    if (!entry.endsWith('.sh')) continue;
    if (!statSync(join(dir, entry)).isFile()) continue;
    count++;
  }
  return count;
}

/**
 * Count `.md` files directly under `.claude/rules/`. Each file is one always-
 * loaded constraint.
 */
function countRules() {
  const dir = join(REPO_ROOT, '.claude', 'rules');
  let count = 0;
  for (const entry of readdirSync(dir)) {
    if (!entry.endsWith('.md')) continue;
    if (!statSync(join(dir, entry)).isFile()) continue;
    count++;
  }
  return count;
}

/**
 * Count `.md` files directly under `.claude/agents/`. Each file is one subagent
 * spec.
 */
function countAgents() {
  const dir = join(REPO_ROOT, '.claude', 'agents');
  let count = 0;
  for (const entry of readdirSync(dir)) {
    if (!entry.endsWith('.md')) continue;
    if (!statSync(join(dir, entry)).isFile()) continue;
    count++;
  }
  return count;
}

export function computeCounts() {
  return {
    skills: countSkills(),
    hooks: countHooks(),
    rules: countRules(),
    agents: countAgents(),
  };
}

// Expose the upstream TASK_RULES under `computeCounts.__sources` so the drift
// test can assert keyword coverage without re-importing route.mjs (keeps the
// "source of truth visible to one importer" invariant).
computeCounts.__sources = { TASK_RULES };

// ---------------------------------------------------------------------------
// Per-routing-branch file (.claude/routing/<branch>.md) generator
// ---------------------------------------------------------------------------

// The canonical registry-resolution note. Embedded verbatim in every
// .claude/routing/*.md file so a fresh agent reading the branch file knows how
// agent/skill/MCP names resolve to filesystem paths (closes H6 from the
// 2026-05-15 agent-architecture audit).
const REGISTRY_COMMENT = `> **Name resolution.** Agent, skill, and MCP names above resolve to concrete\n> paths via the registries in \`.claude/registry/*.json\` (built by \`scripts/rebuild-\n> registry.mjs\`). When a name is missing from every registry the routing layer\n> falls back to the native inventory only; downstream consumers can re-render\n> by editing constants in \`scripts/route.mjs\` and running \`npm run regen-routing-\n> docs\`.`;

export function renderRegistryComment() {
  return REGISTRY_COMMENT;
}

export function renderBranchDoc(branch) {
  const agents = AGENTS_BY_BRANCH[branch] || [];
  const skills = [...ALWAYS_LOADED_SKILLS, ...(MANDATORIES_BY_BRANCH[branch] || [])];
  const mcps = MCPS_BY_BRANCH[branch] || { project: [], plugin: [] };
  const profile = BRANCH_TO_PROFILE[branch] || 'standard';

  const fmt = (xs) => xs.length ? xs.map(x => `\`${x}\``).join(', ') : '_(none)_';
  const fmtAdvisory = (xs) => xs.length ? xs.join(', ') : '_(none)_';

  return `# Routing Branch: ${BRANCH_TITLES[branch] || branch}

> Generated by \`scripts/regen-routing-docs.mjs\` — do not edit by hand.
> Source of truth: \`scripts/route.mjs\`.

## Always load

- Agents: ${fmt(agents)}
- Required skills (mandatories): ${fmt(skills)}
- Rules: all native rules
- Hook profile: \`${profile}\`
- MCPs (project-configured): ${fmt(mcps.project)}
- MCPs (plugin-available, discretionary): ${fmtAdvisory(mcps.plugin)}

## Notes

This file is regenerated from \`scripts/route.mjs\`. Edit the constants in that
file, then run \`npm run regen-routing-docs\`. Tests in
\`tests/unit/routing-docs-in-sync.test.mjs\` fail if this file drifts from the
runtime data.

${REGISTRY_COMMENT}
`;
}

// ---------------------------------------------------------------------------
// ROUTING.md Step-1 table generator
// ---------------------------------------------------------------------------

// Compact human-readable description for each branch row. These are the
// "Signal in prompt or context" column labels and ARE branch-display text;
// they are intentionally distinct from the keyword list (which is rendered in
// full from TASK_RULES). Keeping them generator-owned (not in route.mjs) keeps
// route.mjs minimal as the routing engine.
//
// Each entry must agree with TASK_RULES order to keep the table stable.

export function renderRoutingStep1Table() {
  // Column widths chosen to match the pre-iteration hand-authored table so
  // byte-identity remains tight. The widths are: signal column wide enough for
  // the longest signal cell; workspace column 9 chars (e.g. "`build/`"); branch
  // file column wide enough for the longest filename.

  const rows = [];
  // Bounded loop: TASK_RULES has fixed length set by scripts/route.mjs.
  for (const rule of TASK_RULES) {
    const signal = rule.keywords.map((kw) => `"${kw}"`).join(', ');
    const workspace = BRANCH_TO_WORKSPACE[rule.branch] || '_(?)_';
    const branchFile = `\`.claude/routing/${rule.branch}.md\``;
    rows.push(`| ${signal} | ${workspace} | ${branchFile} |`);
  }

  return [
    '| Signal in prompt or context | Workspace | Branch file |',
    '|---|---|---|',
    ...rows,
  ].join('\n');
}

// ---------------------------------------------------------------------------
// Per-IDE preamble: shared procedure body
// ---------------------------------------------------------------------------

// The procedure body lists the routing steps every IDE-facing preamble must
// follow. The wrapper around this body — IDE-specific framing, fallback notes,
// cache notes — stays hand-authored per SPEC 01-regen-prose-widen (the
// wrapper differs across Codex/Cursor/Gemini for cache/fallback semantics).
//
// The IDE argument is kept so future per-IDE numbering tweaks have a single
// place to land; today the body is identical across IDEs.

export function renderProcedureBody(_ide) {
  return [
    '1. Read `ROUTING.md` at repo root.',
    '2. Match the user prompt against Step 1 of ROUTING.md to identify the task type.',
    '3. Read the corresponding branch file under `.claude/routing/<branch>.md`.',
    '4. Resolve named items via `.claude/registry/*.json` (catalogs of available agents, skills, commands, MCPs).',
    '5. Use only the narrowed inventory unless the user requests something explicitly outside it.',
  ].join('\n');
}

// ---------------------------------------------------------------------------
// CLAUDE.md / CONTEXT.md / START-HERE.md count transformers
// ---------------------------------------------------------------------------

function applyClaudeMdCounts(content, counts) {
  // Tree-diagram line: in-fence code-block content; prefix-anchored.
  let next = replacePrefixedLine(
    content,
    '│  ├─ skills/            ← ',
    `on-demand procedures (${counts.skills} skills: 6 project + 5 integrations + 4 routing-vendored)`
  );
  next = replacePrefixedLine(
    next,
    '│  ├─ hooks/             ← ',
    `${counts.hooks} bash hooks enforcing rules by construction`
  );

  // Prose line 118: "- **N skills** in `.claude/skills/` — ...". Match by the
  // stable suffix portion so future edits to the breakdown don't dislodge the
  // count.
  const lines = next.split('\n');
  let proseHit = -1;
  // Bounded loop: lines.length is finite.
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    // Anchor: the line begins with "- **" then a number then " skills** in
    // `.claude/skills/`". We only rewrite the leading bullet + count; the
    // breakdown text after the em-dash is preserved verbatim.
    const m = line.match(/^- \*\*(\d+) skills\*\* in `\.claude\/skills\/` — (.+)$/);
    if (m) {
      if (proseHit !== -1) {
        throw new Error('CLAUDE.md "N skills" prose line matched twice');
      }
      lines[i] = `- **${counts.skills} skills** in \`.claude/skills/\` — ${m[2]}`;
      proseHit = i;
    }
  }
  if (proseHit === -1) {
    throw new Error('CLAUDE.md "N skills" prose line not found');
  }
  return lines.join('\n');
}

function applyContextMdCounts(content, counts) {
  // The CONTEXT.md row pattern: "`.claude/rules/` (all N)" inside a table cell.
  // We match the cell text and rewrite only the digit.
  const lines = content.split('\n');
  let hit = -1;
  // Bounded loop: lines.length is finite.
  for (let i = 0; i < lines.length; i++) {
    const m = lines[i].match(/(.*`\.claude\/rules\/` \(all )(\d+)(\)[^|]*\|.*)/);
    if (m) {
      if (hit !== -1) {
        throw new Error('CONTEXT.md "all N rules" pattern matched twice');
      }
      lines[i] = `${m[1]}${counts.rules}${m[3]}`;
      hit = i;
    }
  }
  if (hit === -1) {
    throw new Error('CONTEXT.md "all N rules" pattern not found');
  }
  return lines.join('\n');
}

function applyStartHereCounts(content, counts) {
  // START-HERE.md bullet pattern: "- **`.claude/rules/`** — N ..." and the
  // hooks counterpart. Rewrite only the digit, preserve the trailing text.
  let next = content.replace(
    /^- \*\*`\.claude\/rules\/`\*\* — (\d+) (always-loaded constraints[^\n]*)$/m,
    `- **\`.claude/rules/\`** — ${counts.rules} $2`
  );
  next = next.replace(
    /^- \*\*`\.claude\/hooks\/`\*\* — (\d+) (bash hooks[^\n]*)$/m,
    `- **\`.claude/hooks/\`** — ${counts.hooks} $2`
  );
  return next;
}

// ---------------------------------------------------------------------------
// ROUTING.md / AGENTS.md / .cursorrules / GEMINI.md region transformers
// ---------------------------------------------------------------------------

function applyRoutingMdStep1(content) {
  return replaceMarkedRegion(content, 'ROUTING_STEP1', renderRoutingStep1Table());
}

function applyProcedureBody(content, ide) {
  return replaceMarkedRegion(content, 'PROCEDURE_BODY', renderProcedureBody(ide));
}

// ---------------------------------------------------------------------------
// Multi-surface driver (called by the CLI block AND the idempotency test).
// ---------------------------------------------------------------------------

/**
 * Apply every regen transformation to the matching surface in `files`. Any key
 * not in the file map is skipped (so the test can call this with a subset).
 *
 * @param {Record<string, string>} files - mapping surface name -> current content
 * @returns {Record<string, string>} same shape, with content transformed
 */
export function applyAllRegenSurfaces(files) {
  const counts = computeCounts();
  const out = {};
  for (const [name, original] of Object.entries(files)) {
    out[name] = applyOneSurface(name, original, counts);
  }
  return out;
}

function applyOneSurface(name, original, counts) {
  switch (name) {
    case 'ROUTING.md':
      return applyRoutingMdStep1(original);
    case 'AGENTS.md':
      return applyProcedureBody(original, 'AGENTS.md');
    case '.cursorrules':
      return applyProcedureBody(original, '.cursorrules');
    case 'GEMINI.md':
      return applyProcedureBody(original, 'GEMINI.md');
    case 'CLAUDE.md':
      return applyClaudeMdCounts(original, counts);
    case 'CONTEXT.md':
      return applyContextMdCounts(original, counts);
    case 'START-HERE.md':
      return applyStartHereCounts(original, counts);
    default:
      // Unknown surface: pass through unchanged. The CLI is the only caller
      // that should ever produce this; the test passes only known names.
      return original;
  }
}

// ---------------------------------------------------------------------------
// CLI entry point
// ---------------------------------------------------------------------------

if (import.meta.url === `file://${process.argv[1]}`) {
  // (1) Regenerate the .claude/routing/<branch>.md files (each is full-file
  //     generated content; no markers needed).
  const outDir = join(REPO_ROOT, '.claude', 'routing');
  for (const b of BRANCHES) {
    const target = join(outDir, `${b}.md`);
    writeFileSync(target, renderBranchDoc(b), 'utf8');
    console.log(`wrote ${target}`);
  }

  // (2) Regenerate marker-bounded regions and count fields across the prose
  //     surfaces. Each surface is read from disk, transformed, and written
  //     back. Idempotent by construction (the drift test guards this).
  const surfaces = [
    'ROUTING.md',
    'AGENTS.md',
    '.cursorrules',
    'GEMINI.md',
    'CLAUDE.md',
    'CONTEXT.md',
    'START-HERE.md',
  ];
  for (const surface of surfaces) {
    const path = join(REPO_ROOT, surface);
    const original = readFileSync(path, 'utf8');
    const next = applyAllRegenSurfaces({ [surface]: original })[surface];
    if (next !== original) {
      writeFileSync(path, next, 'utf8');
      console.log(`rewrote ${path}`);
    } else {
      console.log(`unchanged ${path}`);
    }
  }
}
