const HEADER = `ROUTING (authoritative). You MUST invoke each REQUIRED skill via the Skill tool
before responding. Then survey your skill catalog and MCP tools using the
SIGNALS and HINTS below; invoke whichever apply.`;

function fmtList(items) {
  return (items && items.length) ? items.join(', ') : '(none)';
}

function recordRef(record) {
  if (!record) return '';
  const target = record.path || record.plugin_path || record.command || '';
  return target ? ` [${record.source}:${target}]` : ` [${record.source}]`;
}

function fmtResolvedList(items, records) {
  if (!items || !items.length) return '(none)';
  const byName = new Map((records || []).map((record) => [record.display_name || record.name, record]));
  return items.map((item) => `${item}${recordRef(byName.get(item))}`).join(', ');
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

function fmtUnresolved(unresolved) {
  if (!unresolved || !unresolved.length) return '(none)';
  return unresolved.map((item) => `${item.name}:${item.kind || 'unknown'}`).join(', ');
}

export function formatOutput(result) {
  const {
    branch, hook_profile, mandatories = [], agents = [],
    mcps_project = [], mcps_plugin = [],
    signals = {}, instincts = [], hints = [],
    resolved = {}, unresolved = [],
  } = result;

  const lines = [
    HEADER,
    '',
    `branch: ${branch}   workspace: ${signals.workspace || '(none)'}   profile: ${hook_profile}`,
    `REQUIRED-SKILLS: ${fmtResolvedList(mandatories, resolved.skills)}`,
    `REQUIRED-AGENTS: ${fmtResolvedList(agents, resolved.agents)}`,
    `MCPs (project-configured): ${fmtResolvedList(mcps_project, resolved.mcps_project)}`,
    `MCPs (plugin-available): ${fmtResolvedList(mcps_plugin, resolved.mcps_plugin)}`,
    `UNRESOLVED: ${fmtUnresolved(unresolved)}`,
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
