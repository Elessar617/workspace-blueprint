export const TASK_RULES = [
  { branch: 'review',      keywords: ['review', 'audit', 'evaluate', 'critique', 'act as reviewer'], profile: 'standard' },
  { branch: 'build',       keywords: ['add ', 'implement', 'feature', 'build ', 'create '], profile: 'standard' },
  { branch: 'bug',         keywords: ['fix', 'bug', 'broken', 'crash'],                     profile: 'standard' },
  { branch: 'refactor',    keywords: ['refactor', 'migrate', 'rename', 'restructure', 'cleanup'], profile: 'standard' },
  { branch: 'spike',       keywords: ['investigate', 'spike', 'explore', 'prototype'],      profile: 'minimal' },
  { branch: 'spec-author', keywords: ['rfc', 'adr', 'design ', 'spec ', 'brief', 'propose'], profile: 'minimal' },
  { branch: 'ship',        keywords: ['release', 'ship', 'changelog', 'publish', 'cut a v'], profile: 'strict' },
];

const LANGUAGE_BY_EXT = {
  '.py': 'python', '.go': 'go', '.ts': 'typescript', '.tsx': 'typescript',
  '.js': 'javascript', '.jsx': 'javascript', '.mjs': 'javascript', '.cjs': 'javascript',
  '.java': 'java', '.kt': 'kotlin',
  '.cpp': 'cpp', '.cc': 'cpp', '.h': 'cpp', '.hpp': 'cpp', '.cs': 'csharp',
  '.dart': 'dart', '.rs': 'rust', '.rb': 'ruby', '.php': 'php', '.swift': 'swift',
};

export const AGENTS_BY_BRANCH = {
  build:        ['planner', 'implementer', 'reviewer', 'adversary'],
  bug:          ['implementer', 'reviewer'],
  refactor:     ['planner', 'implementer', 'reviewer', 'adversary', 'refactor-cleaner', 'code-simplifier'],
  spike:        ['general-purpose', 'Explore', 'code-explorer'],
  'spec-author': ['planner', 'architect', 'Plan'],
  ship:         ['reviewer', 'adversary', 'doc-updater', 'opensource-packager'],
  review:       ['reviewer', 'adversary'],
  fallback:     ['planner', 'implementer', 'reviewer', 'adversary'],
};

// caveman stays mandatory per d91240e "always load caveman" — token-discipline utility.
export const ALWAYS_LOADED_SKILLS = ['caveman'];

const NATIVE_FALLBACK_NAMES = new Set([
  'planner', 'implementer', 'reviewer', 'adversary',
  'caveman', 'tdd-loop', 'bug-investigation', 'systematic-debugging',
  'refactor-protocol', 'architecture-audit', 'karpathy-guidelines',
  'spike-protocol', 'data-analysis', 'brainstorming', 'spec-authoring',
  'writing-plans', 'filesystem', 'git', 'fetch', 'github',
]);

export const MANDATORIES_BY_BRANCH = {
  build:        ['tdd-loop', 'karpathy-guidelines', 'superpowers:verification-before-completion'],
  bug:          ['bug-investigation', 'systematic-debugging', 'tdd-loop', 'superpowers:verification-before-completion'],
  refactor:     ['refactor-protocol', 'architecture-audit', 'karpathy-guidelines', 'tdd-loop', 'superpowers:verification-before-completion'],
  spike:        ['spike-protocol', 'data-analysis'],
  'spec-author': ['brainstorming', 'spec-authoring', 'writing-plans'],
  ship:         ['superpowers:verification-before-completion', 'superpowers:finishing-a-development-branch'],
  review:       ['karpathy-guidelines', 'superpowers:requesting-code-review'],
  fallback:     [],
};

export const MCPS_BY_BRANCH = {
  build:        { project: ['filesystem', 'git'], plugin: ['serena', 'context7', 'sequential-thinking', 'memory'] },
  bug:          { project: ['filesystem', 'git'], plugin: ['serena', 'sequential-thinking', 'memory'] },
  refactor:     { project: ['filesystem', 'git'], plugin: ['serena', 'context7', 'memory'] },
  spike:        { project: ['filesystem', 'fetch'], plugin: ['exa', 'context7', 'brave-search', 'firecrawl', 'mempalace'] },
  'spec-author': { project: ['filesystem', 'fetch'], plugin: ['exa', 'context7', 'brave-search', 'mempalace'] },
  ship:         { project: ['filesystem', 'git', 'github'], plugin: ['sentry', 'puppeteer'] },
  review:       { project: ['filesystem', 'git', 'github'], plugin: ['sequential-thinking', 'serena'] },
  fallback:     { project: ['filesystem'], plugin: [] },
};

// Scales by branch complexity: build/refactor signal-rich -> 10; bug/ship/review medium -> 6;
// spike/spec-author/fallback exploratory -> 3.
const INSTINCT_CAP_BY_BRANCH = {
  build: 10, refactor: 10,
  bug: 6, ship: 6, review: 6,
  spike: 3, 'spec-author': 3, fallback: 3,
};

const HINTS_BY_LANGUAGE = {
  go:         [{ name: 'golang-patterns', reason: 'language=go' },
               { name: 'go-reviewer', reason: 'language=go (agent)' },
               { name: 'go-build-resolver', reason: 'language=go (build issues)' }],
  python:     [{ name: 'python-patterns', reason: 'language=python' },
               { name: 'python-reviewer', reason: 'language=python (agent)' }],
  typescript: [{ name: 'typescript-reviewer', reason: 'language=typescript (agent)' }],
  javascript: [{ name: 'typescript-reviewer', reason: 'language=javascript (agent)' }],
  rust:       [{ name: 'rust-patterns', reason: 'language=rust' },
               { name: 'rust-reviewer', reason: 'language=rust (agent)' }],
  kotlin:     [{ name: 'kotlin-reviewer', reason: 'language=kotlin (agent)' },
               { name: 'kotlin-build-resolver', reason: 'language=kotlin (build issues)' }],
};

const HINT_KEYWORD_PATTERNS = [
  { re: /\b(docs|api|library|framework)\b/i, hint: { name: 'context7', reason: 'docs/API references' } },
  { re: /\b(find|where is|explore the codebase)\b/i, hint: { name: 'zoom-out', reason: 'codebase exploration' } },
  { re: /\b(serena|symbol|definition)\b/i, hint: { name: 'serena', reason: 'symbol-level navigation' } },
  { re: /\b(search the web|research|look up)\b/i, hint: { name: 'exa', reason: 'web research' } },
];

const NASA_COMMENT_RULE_NOTE = 'NASA-style comments: explain invariants, bounds, assumptions, failure modes, and non-obvious safety tradeoffs; do not narrate obvious code.';

export const BRANCH_TO_PROFILE = {
  build: 'standard', bug: 'standard', refactor: 'standard',
  spike: 'minimal', 'spec-author': 'minimal', ship: 'strict',
  review: 'standard', fallback: 'standard',
};

export function detectTaskType(prompt) {
  const lower = prompt.toLowerCase();
  for (const rule of TASK_RULES) {
    for (const kw of rule.keywords) {
      if (keywordMatches(lower, kw)) return rule.branch;
    }
  }
  return null;
}

function keywordMatches(lowerPrompt, keyword) {
  const phrase = keyword.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return new RegExp(`\\b${phrase}\\b`, 'i').test(lowerPrompt);
}

export function detectLanguages(files) {
  const langs = new Set();
  for (const f of files) {
    const ext = '.' + f.split('.').pop();
    if (LANGUAGE_BY_EXT[ext]) langs.add(LANGUAGE_BY_EXT[ext]);
  }
  return [...langs];
}

export function detectOutputSkills(files) {
  // Public scaffold invariant: source-available document bundles stay local-only
  // until their redistribution license is cleared, so routing must not auto-load them.
  return [];
}

function detectWorkspace(files) {
  const roots = ['spec', 'lab', 'build', 'ship', 'src', 'shared', 'docs'];
  for (const f of files) {
    for (const r of roots) {
      if (f.startsWith(`${r}/`)) return `${r}/`;
    }
  }
  return '(unknown)';
}

function registryRecords(registry = {}) {
  const records = [];
  for (const list of Object.values(registry)) {
    if (!Array.isArray(list)) continue;
    for (const item of list) {
      if (item && item.name) records.push(item);
    }
  }
  return records.sort((a, b) => {
    const rank = { native: 0, ecc: 1, 'harness-builtin': 2, harness: 3 };
    return (rank[a.source] ?? 9) - (rank[b.source] ?? 9);
  });
}

function resolveName(name, kind, records) {
  const [namespace, shortName] = name.includes(':') ? name.split(':') : [null, name];
  return records.find((item) => {
    if (kind && item.kind !== kind) return false;
    if (namespace) return item.namespace === namespace && item.name === shortName;
    return item.name === name;
  }) || null;
}

function filterForMissingRegistry(names) {
  return names.filter((name) => {
    const shortName = name.includes(':') ? name.split(':').pop() : name;
    return NATIVE_FALLBACK_NAMES.has(shortName);
  });
}

function resolveItems(names, kind, records) {
  const resolved = [];
  const unresolved = [];
  for (const name of names) {
    const record = resolveName(name, kind, records);
    if (record) {
      resolved.push({ display_name: name, ...record });
    } else {
      unresolved.push({ name, kind });
    }
  }
  return { resolved, unresolved };
}

function buildResolution({ agents, skills, mcpsProject, mcpsPlugin, hints }, registry) {
  const records = registryRecords(registry);
  const registryAvailable = records.length > 0;

  const routed = registryAvailable ? {
    agents,
    skills,
    mcpsProject,
    mcpsPlugin,
    hints,
  } : {
    agents: filterForMissingRegistry(agents),
    skills: filterForMissingRegistry(skills),
    mcpsProject: filterForMissingRegistry(mcpsProject),
    mcpsPlugin: [],
    hints: hints.filter((hint) => NATIVE_FALLBACK_NAMES.has(hint.name)),
  };

  const agentResolution = resolveItems(routed.agents, 'agent', records);
  const skillResolution = resolveItems(routed.skills, 'skill', records);
  const projectMcpResolution = resolveItems(routed.mcpsProject, 'mcp', records);
  const pluginMcpResolution = resolveItems(routed.mcpsPlugin, 'mcp', records);
  const hintResolution = resolveItems(routed.hints.map((hint) => hint.name), null, records);

  return {
    routed,
    resolved: {
      agents: agentResolution.resolved,
      skills: skillResolution.resolved,
      mcps_project: projectMcpResolution.resolved,
      mcps_plugin: pluginMcpResolution.resolved,
      hints: hintResolution.resolved,
    },
    unresolved: [
      ...agentResolution.unresolved,
      ...skillResolution.unresolved,
      ...projectMcpResolution.unresolved,
      ...pluginMcpResolution.unresolved,
      ...hintResolution.unresolved.map((item) => ({ ...item, kind: 'hint' })),
    ],
  };
}

export function route({ prompt, files_in_scope = [], registry = {}, instincts = [] }) {
  const detected = detectTaskType(prompt) || 'fallback';
  const langs = detectLanguages(files_in_scope);

  const mandatories = [
    ...ALWAYS_LOADED_SKILLS,
    ...(MANDATORIES_BY_BRANCH[detected] || []),
  ];
  const agents = [...(AGENTS_BY_BRANCH[detected] || AGENTS_BY_BRANCH.fallback)];
  const mcps = MCPS_BY_BRANCH[detected] || MCPS_BY_BRANCH.fallback;

  const hints = [];
  for (const lang of langs) {
    if (HINTS_BY_LANGUAGE[lang]) hints.push(...HINTS_BY_LANGUAGE[lang]);
  }
  for (const { re, hint } of HINT_KEYWORD_PATTERNS) {
    if (re.test(prompt) && !hints.some(h => h.name === hint.name)) {
      hints.push(hint);
    }
  }
  if (files_in_scope.length >= 5) {
    hints.push({ name: 'superpowers:dispatching-parallel-agents', reason: `${files_in_scope.length} files in scope` });
  }

  const resolution = buildResolution({
    agents,
    skills: mandatories,
    mcpsProject: mcps.project,
    mcpsPlugin: mcps.plugin,
    hints,
  }, registry);

  const cap = INSTINCT_CAP_BY_BRANCH[detected] || 6;
  const cappedInstincts = instincts.slice(0, cap);

  const workspace = detectWorkspace(files_in_scope);
  const rules = ['all'];
  const rule_notes = rules.includes('all') ? [NASA_COMMENT_RULE_NOTE] : [];

  return {
    branch: detected,
    hook_profile: BRANCH_TO_PROFILE[detected],
    workspace,
    mandatories: resolution.routed.skills,
    agents: resolution.routed.agents,
    skills: resolution.routed.skills,
    mcps_project: resolution.routed.mcpsProject,
    mcps_plugin: resolution.routed.mcpsPlugin,
    mcps: [...resolution.routed.mcpsProject, ...resolution.routed.mcpsPlugin],
    resolved: resolution.resolved,
    unresolved: resolution.unresolved,
    signals: {
      files: files_in_scope,
      languages: langs,
      recent_edits: [],
      workspace,
      active_rules: rules,
    },
    instincts: cappedInstincts,
    hints: resolution.routed.hints,
    languages_detected: langs,
    transition_detected: false,
    rules,
    rule_notes,
    commands: [],
  };
}

const TRANSITION_PHRASES = [
  /\bnow\s+let'?s\b/i,
  /\bswitch\s+to\b/i,
  /\bactually[,\s]/i,
  /\bpivot\s+to\b/i,
];

export function detectTransition(prompt) {
  return TRANSITION_PHRASES.some((re) => re.test(prompt));
}

const CHATTER_RE = /^(yes|yep|yeah|ok|okay|sure|do that|continue|go ahead|sounds good|explain more|tell me more|thanks|thank you)\b/i;

export function isMidTaskChatter(prompt) {
  const trimmed = prompt.trim();
  if (!trimmed) return false;
  if (trimmed.length > 80) return false;
  return CHATTER_RE.test(trimmed);
}

export function mergeWithCache(cache, fresh, transitionDetected, prompt = '') {
  if (transitionDetected || !cache) return fresh;
  const freshFiles = fresh?.signals?.files || [];
  const cacheFiles = cache?.signals?.files || [];
  if (freshFiles.length && JSON.stringify(freshFiles) !== JSON.stringify(cacheFiles)) {
    return fresh;
  }
  if (fresh.branch === 'fallback' && isMidTaskChatter(prompt)) return cache;
  return fresh;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const args = process.argv.slice(2);
  const promptIdx = args.indexOf('--prompt');
  const prompt = promptIdx >= 0 ? args[promptIdx + 1] : '';
  if (!prompt) process.exit(0);

  const filesIdx = args.indexOf('--files-in-scope');
  const filesArg = filesIdx >= 0 ? args[filesIdx + 1] : '';
  const filesInScope = filesArg ? filesArg.split(',').filter(Boolean) : [];

  const fs = await import('node:fs');
  const { join, dirname } = await import('node:path');
  const { fileURLToPath } = await import('node:url');
  const __dirname = dirname(fileURLToPath(import.meta.url));
  const REPO_ROOT = join(__dirname, '..');
  const REG = join(REPO_ROOT, '.claude', 'registry');
  const CACHE = join(REPO_ROOT, '.claude', 'routing', '.current.json');

  const safe = (f) => {
    try { return JSON.parse(fs.readFileSync(join(REG, f), 'utf8')); }
    catch { return []; }
  };
  const registry = {
    agents: [...safe('ecc-agents.json'), ...safe('harness-builtins.json'), ...safe('native-inventory.json')],
    skills: [...safe('ecc-skills.json'), ...safe('harness-skills.json'), ...safe('native-inventory.json')],
    commands: safe('ecc-commands.json'),
    mcps: [...safe('ecc-mcps.json'), ...safe('harness-mcps.json'), ...safe('native-inventory.json')],
  };

  const { detectProjectDir } = await import('./lib/detect-project-dir.mjs');
  const { readInstincts } = await import('./lib/instinct-reader.mjs');
  const { formatOutput } = await import('./lib/format-output.mjs');

  const xdgDataHome = process.env.XDG_DATA_HOME
    || join(process.env.HOME || '', '.local', 'share');
  const ecchomunculus = join(xdgDataHome, 'ecc-homunculus');
  const { projectHash } = detectProjectDir({ cwd: process.cwd() });

  const instincts = readInstincts({
    xdgDataHome: ecchomunculus,
    projectHash,
    maxCount: 20,
  });

  let cache = null;
  try { cache = JSON.parse(fs.readFileSync(CACHE, 'utf8')); } catch {}
  const transition = detectTransition(prompt);
  const fresh = route({ prompt, files_in_scope: filesInScope, registry, instincts });
  const final = mergeWithCache(cache, fresh, transition, prompt);

  try {
    fs.mkdirSync(dirname(CACHE), { recursive: true });
    fs.writeFileSync(CACHE, JSON.stringify(final, null, 2));
  } catch {}

  console.log(formatOutput(final));
}
