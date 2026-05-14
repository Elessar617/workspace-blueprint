import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = join(__dirname, '..');

function fail(message) {
  console.error(`[agent-surface-audit] ${message}`);
  process.exit(1);
}

function git(args) {
  const result = spawnSync('git', args, { cwd: REPO_ROOT, encoding: 'buffer' });
  if (result.status !== 0) fail(result.stderr.toString('utf8').trim() || `git ${args.join(' ')} failed`);
  return result.stdout;
}

function readText(relativePath) {
  const buffer = readFileSync(join(REPO_ROOT, relativePath));
  if (buffer.includes(0)) return null;
  return buffer.toString('utf8');
}

function lineNumber(text, index) {
  return text.slice(0, index).split('\n').length;
}

function isInstructionSurface(file) {
  if (file.startsWith('.claude/registry/')) return false;
  if (file.startsWith('.claude/')) return true;
  if (file.startsWith('.github/workflows/')) return true;
  if (file.startsWith('scripts/')) return true;
  return [
    'AGENTS.md',
    'CLAUDE.md',
    'CONTEXT.md',
    'GEMINI.md',
    'ROUTING.md',
    'README.md',
    'SECURITY.md',
    'SKILLS.md',
    'START-HERE.md',
    'package.json',
  ].includes(file);
}

const files = git(['ls-files', '-z', '--cached', '--others', '--exclude-standard'])
  .toString('utf8')
  .split('\0')
  .filter(Boolean)
  .filter((file) => file !== 'external/ecc' && !file.startsWith('node_modules/'));

const findings = [];

function addFinding(rule, file, line, detail) {
  findings.push({ rule, file, line, detail });
}

function scan(filesToScan, regex, rule, detail) {
  for (const file of filesToScan) {
    const text = readText(file);
    if (text === null) continue;
    for (const match of text.matchAll(regex)) {
      addFinding(rule, file, lineNumber(text, match.index ?? 0), detail(match[0]));
    }
  }
}

const textFiles = files.filter((file) => readText(file) !== null);
const surfaces = textFiles.filter(isInstructionSurface);
const signatureFiles = new Set(['scripts/agent-surface-audit.mjs']);
const scannedSurfaces = surfaces.filter((file) => !signatureFiles.has(file));
const executableSurfaces = scannedSurfaces.filter((file) => file !== '.claude/settings.json');

scan(
  scannedSurfaces,
  /[\u200B\u200C\u200D\u2060\uFEFF\u202A-\u202E]/gu,
  'hidden-unicode',
  () => 'zero-width or bidi control character in an agent-loaded file',
);

scan(
  scannedSurfaces,
  /<!--|<script\b|data:text\/html|base64,/giu,
  'hidden-or-active-content',
  (value) => `suspicious hidden/active content marker: ${value}`,
);

scan(
  executableSurfaces,
  /dangerously-skip-permissions|enableAllProjectMcpServers|ANTHROPIC_BASE_URL\s*=|OPENAI_BASE_URL\s*=|curl\s+.*\|\s*(?:bash|sh)|wget\s+.*\|\s*(?:bash|sh)/giu,
  'risky-agent-surface',
  (value) => `risky agent instruction or shell pattern: ${value}`,
);

scan(
  textFiles,
  /BEGIN (?:RSA|OPENSSH|PRIVATE) KEY|github_pat_[A-Za-z0-9_]{20,}|ghp_[A-Za-z0-9]{20,}|sk-[A-Za-z0-9_-]{20,}|(?:ANTHROPIC|OPENAI)_API_KEY\s*=\s*['"]?[^'"\s]+/gu,
  'secret-pattern',
  () => 'raw secret-looking value in tracked text',
);

const settings = JSON.parse(readText('.claude/settings.json'));
const mcpNames = Object.keys(settings.mcpServers || {});
if (mcpNames.length > 10) {
  addFinding('mcp-budget', '.claude/settings.json', 1, `${mcpNames.length} MCP servers configured; keep active MCPs under 10`);
}

const requiredDenies = [
  'Read(~/.ssh/**)',
  'Read(~/.aws/**)',
  'Read(**/.env*)',
  'Write(~/.ssh/**)',
  'Write(~/.aws/**)',
  'Write(**/.env*)',
  'Bash(curl * | bash)',
  'Bash(ssh *)',
  'Bash(scp *)',
  'Bash(nc *)',
];
const denies = new Set(settings.permissions?.deny || []);
for (const deny of requiredDenies) {
  if (!denies.has(deny)) {
    addFinding('missing-permission-deny', '.claude/settings.json', 1, `missing baseline deny rule: ${deny}`);
  }
}

const allowPatterns = [
  /^Read\(~\/\.(?:ssh|aws)\/.*\)$/,
  /^Write\(~\/\.(?:ssh|aws)\/.*\)$/,
  /^Bash\((?:ssh|scp|nc) .*\)$/,
  /^Bash\((?:curl|wget) .*\| *(?:bash|sh)\)$/,
];
for (const allowed of settings.permissions?.allow || []) {
  if (allowPatterns.some((pattern) => pattern.test(allowed))) {
    addFinding('risky-permission-allow', '.claude/settings.json', 1, `risky allow rule should not be enabled: ${allowed}`);
  }
}

const memoryPath = settings.mcpServers?.memory?.env?.MEMORY_FILE_PATH;
if (memoryPath !== '${CLAUDE_PROJECT_DIR}/.claude/.mcp-memory.json') {
  addFinding('memory-path', '.claude/settings.json', 1, 'memory MCP must persist only to ignored project-local storage');
}

if (findings.length > 0) {
  for (const finding of findings) {
    console.error(`${finding.rule}: ${finding.file}:${finding.line} ${finding.detail}`);
  }
  process.exit(1);
}

console.log(`[agent-surface-audit] OK: scanned ${scannedSurfaces.length} agent-surface files, ${mcpNames.length} MCP servers configured`);
