import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const FRONTMATTER_RE = /^---\n([\s\S]*?)\n---/;
const INSTINCT_FILE_RE = /\.(ya?ml|md)$/i;

export function parseInstinctFile(content) {
  const match = content.match(FRONTMATTER_RE);
  if (!match) return [];

  const fm = {};
  for (const line of match[1].split('\n')) {
    const sep = line.indexOf(':');
    if (sep === -1) continue;
    const key = line.slice(0, sep).trim();
    let value = line.slice(sep + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    if (key === 'confidence') {
      const parsed = Number.parseFloat(value);
      fm[key] = Number.isFinite(parsed) ? parsed : 0.5;
    } else {
      fm[key] = value;
    }
  }

  if (!fm.id) return [];

  const body = content.slice(match[0].length).trim();
  return [{ ...fm, body }];
}

export function extractAction(body) {
  const match = body.match(/^##\s+Action\s*\n+([\s\S]+?)(?:\n##\s+|$)/m);
  if (!match) return '';
  const firstLine = match[1].split('\n').map(l => l.trim()).find(Boolean);
  return firstLine || '';
}

function readDir(dir, scope) {
  if (!existsSync(dir)) return [];
  const out = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (!entry.isFile() || !INSTINCT_FILE_RE.test(entry.name)) continue;
    try {
      const content = readFileSync(join(dir, entry.name), 'utf8');
      for (const parsed of parseInstinctFile(content)) {
        out.push({ ...parsed, _scope: scope, action: extractAction(parsed.body) });
      }
    } catch {
      // Skip unreadable / unparseable; non-fatal at hook layer.
    }
  }
  return out;
}

export function readInstincts({ xdgDataHome, projectHash, maxCount = 6, minConfidence = 0.7 }) {
  if (!xdgDataHome || !existsSync(xdgDataHome)) return [];

  const projectDirs = projectHash ? [
    { dir: join(xdgDataHome, 'projects', projectHash, 'instincts', 'personal'), scope: 'project' },
    { dir: join(xdgDataHome, 'projects', projectHash, 'instincts', 'inherited'), scope: 'project' },
  ] : [];

  const globalDirs = [
    { dir: join(xdgDataHome, 'instincts', 'personal'), scope: 'global' },
    { dir: join(xdgDataHome, 'instincts', 'inherited'), scope: 'global' },
  ];

  const all = [
    ...projectDirs.flatMap(({ dir, scope }) => readDir(dir, scope)),
    ...globalDirs.flatMap(({ dir, scope }) => readDir(dir, scope)),
  ];

  const deduped = new Map();
  for (const inst of all) {
    if (inst.confidence < minConfidence) continue;
    if (!inst.action) continue;
    const existing = deduped.get(inst.id);
    if (!existing || (existing._scope !== 'project' && inst._scope === 'project')) {
      deduped.set(inst.id, inst);
    }
  }

  return [...deduped.values()]
    .sort((a, b) => {
      if (b.confidence !== a.confidence) return b.confidence - a.confidence;
      if (a._scope !== b._scope) return a._scope === 'project' ? -1 : 1;
      return String(a.id).localeCompare(String(b.id));
    })
    .slice(0, maxCount);
}
