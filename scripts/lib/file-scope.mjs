export const WORKSPACE_ROOTS = ['src', 'lab', 'build', 'spec', 'ship', 'docs', 'shared', 'scripts', 'tests'];
export const EXTENSIONS = [
  'py', 'go', 'ts', 'tsx', 'js', 'jsx', 'mjs', 'cjs',
  'java', 'kt', 'kts', 'rs', 'cpp', 'cc', 'h', 'hpp',
  'cs', 'dart', 'rb', 'php', 'swift',
  'md', 'json', 'yaml', 'yml', 'toml', 'sh',
];

const MAX_FILES = 20;

const EXTENSION_GROUP = EXTENSIONS.join('|');
const ROOT_GROUP = WORKSPACE_ROOTS.join('|');

const WORKSPACE_ROOTED_RE = new RegExp(
  `\\b(${ROOT_GROUP})/[A-Za-z0-9_./()~-]+`,
  'g',
);
const EXTENSION_BEARING_RE = new RegExp(
  `\\b[A-Za-z0-9_./()~-]+\\.(${EXTENSION_GROUP})\\b`,
  'g',
);
const QUOTED_PATH_RE = new RegExp(
  `["'\`]((?:${ROOT_GROUP})/[^"'\`]+?\\.(${EXTENSION_GROUP}))["'\`]`,
  'g',
);

function cleanPath(path) {
  return path
    .trim()
    .replace(/^[<([{]+/, '')
    .replace(/[.,;:!?]+$/, '');
}

function extractFromPrompt(prompt) {
  const out = new Set();
  let unquoted = prompt;
  for (const m of prompt.matchAll(QUOTED_PATH_RE)) {
    out.add(cleanPath(m[1]));
    unquoted = unquoted.replace(m[0], ' ');
  }
  for (const m of unquoted.matchAll(WORKSPACE_ROOTED_RE)) out.add(cleanPath(m[0]));
  for (const m of unquoted.matchAll(EXTENSION_BEARING_RE)) out.add(cleanPath(m[0]));
  return out;
}

function extractFromGitStatus(output) {
  const out = new Set();
  for (const line of output.split('\n')) {
    const m = line.match(/^[ MADRCU?!]{2}\s+(?:.*-> )?(.+)$/);
    if (m && m[1]) out.add(m[1].trim());
  }
  return out;
}

function extractFromGitDiff(output) {
  const out = new Set();
  for (const line of output.split('\n')) {
    const trimmed = line.trim();
    if (trimmed) out.add(trimmed);
  }
  return out;
}

export function extractFileScope({ prompt = '', gitStatusOutput = '', gitDiffOutput = '' }) {
  const combined = new Set([
    ...extractFromPrompt(prompt),
    ...extractFromGitStatus(gitStatusOutput),
    ...extractFromGitDiff(gitDiffOutput),
  ]);
  return [...combined].slice(0, MAX_FILES);
}
