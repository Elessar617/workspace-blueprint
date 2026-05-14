const HEADER = `ROUTING (authoritative). You MUST invoke each REQUIRED skill via the Skill tool
before responding. Then survey your skill catalog and MCP tools using the
SIGNALS and HINTS below; invoke whichever apply.`;

function fmtList(items) {
  return (items && items.length) ? items.join(', ') : '(none)';
}

const INSTINCT_ACTION_MAX = 120;

function truncate(s, max) {
  return s.length <= max ? s : `${s.slice(0, max - 1)}…`;
}

function fmtInstincts(instincts) {
  if (!instincts || !instincts.length) return '    (none)';
  return instincts
    .map(i => `    - [${i._scope} ${i.confidence.toFixed(2)}] ${truncate(i.action, INSTINCT_ACTION_MAX)}`)
    .join('\n');
}

function fmtHints(hints) {
  if (!hints || !hints.length) return '  (none)';
  return hints
    .map(h => `  - ${h.name} (signaled by ${h.reason})`)
    .join('\n');
}

export function formatOutput(result) {
  const {
    branch, hook_profile, mandatories = [], agents = [],
    mcps_project = [], mcps_plugin = [],
    signals = {}, instincts = [], hints = [],
  } = result;

  const lines = [
    HEADER,
    '',
    `branch: ${branch}   workspace: ${signals.workspace || '(none)'}   profile: ${hook_profile}`,
    `REQUIRED-SKILLS: ${fmtList(mandatories)}`,
    `REQUIRED-AGENTS: ${fmtList(agents)}`,
    `MCPs (project-configured): ${fmtList(mcps_project)}`,
    `MCPs (plugin-available): ${fmtList(mcps_plugin)}`,
    '',
    'SIGNALS:',
    `  files: ${fmtList(signals.files)}`,
    `  languages: ${fmtList(signals.languages)}`,
    `  recent-edits: ${fmtList(signals.recent_edits)}`,
    `  workspace: ${signals.workspace || '(none)'}`,
    `  active-instincts:`,
    fmtInstincts(instincts),
    `  active-rules: ${fmtList(signals.active_rules)}`,
    '',
    'HINTS (consider invoking if relevant):',
    fmtHints(hints),
  ];

  return lines.join('\n');
}
