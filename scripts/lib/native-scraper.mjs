import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative, extname } from 'node:path';
import { parseMarkdown, normalizeRecord, filenameStem } from './frontmatter.mjs';

// Source-available document bundles may exist locally, but must not flow into
// the public native registry unless their redistribution license is cleared.
const LOCAL_ONLY_SKILLS = new Set(['docx', 'pptx', 'xlsx', 'pdf']);

function readMarkdownRecord(file, repoRoot, { kind, name }) {
  const parsed = parseMarkdown(file);
  const record = normalizeRecord(parsed, {
    filenameStem: name || filenameStem(file),
    kind,
    source: 'native',
  });
  record.path = relative(repoRoot, file).replaceAll('\\', '/');
  return record;
}

function pushIfMarkdown(out, file, repoRoot, opts) {
  if (existsSync(file) && extname(file) === '.md') out.push(readMarkdownRecord(file, repoRoot, opts));
}

// Unified scraper contract: ({ root, options }) → { records: [...] }
//   root: the repository root containing .claude/{agents,skills,rules,settings.json}.
//   options: reserved for future per-call configuration (currently unused).
// When root does not exist, returns { records: [] } rather than throwing — the
// failure mode of a missing path is "no records discovered," which is the same
// contract surfaced by sibling scrapers (ecc, harness).
export function scrapeNative({ root, options = {} } = {}) {
  void options;
  const records = [];
  if (!root || !existsSync(root)) return { records };

  const agentsDir = join(root, '.claude', 'agents');
  if (existsSync(agentsDir)) {
    for (const entry of readdirSync(agentsDir)) {
      const file = join(agentsDir, entry);
      if (!statSync(file).isFile() || extname(file) !== '.md') continue;
      const stem = filenameStem(file).replace(/-agent$/, '');
      pushIfMarkdown(records, file, root, { kind: 'agent', name: stem });
    }
  }

  const skillsDir = join(root, '.claude', 'skills');
  if (existsSync(skillsDir)) {
    for (const entry of readdirSync(skillsDir)) {
      if (LOCAL_ONLY_SKILLS.has(entry)) continue;
      const file = join(skillsDir, entry, 'SKILL.md');
      pushIfMarkdown(records, file, root, { kind: 'skill', name: entry });
    }
  }

  const rulesDir = join(root, '.claude', 'rules');
  if (existsSync(rulesDir)) {
    for (const entry of readdirSync(rulesDir)) {
      const file = join(rulesDir, entry);
      if (!statSync(file).isFile()) continue;
      pushIfMarkdown(records, file, root, { kind: 'rule' });
    }
  }

  const settingsPath = join(root, '.claude', 'settings.json');
  if (existsSync(settingsPath)) {
    try {
      const settings = JSON.parse(readFileSync(settingsPath, 'utf8'));
      for (const [name, config] of Object.entries(settings.mcpServers || {})) {
        records.push({
          name,
          kind: 'mcp',
          source: 'native',
          command: config.command || '',
          description: '',
        });
      }
    } catch (e) {
      console.warn(`[native-scraper] could not parse ${settingsPath}: ${e.message}`);
    }
  }

  return { records };
}
