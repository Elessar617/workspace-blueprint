import { readdirSync, statSync, existsSync } from 'node:fs';
import { join, extname, relative } from 'node:path';
import { spawnSync } from 'node:child_process';
import { parseMarkdown, normalizeRecord, filenameStem } from './frontmatter.mjs';

const DIR_KIND_MAP = {
  agents: 'agent',
  skills: 'skill',
  commands: 'command',
  rules: 'rule',
};

function* walkMarkdown(dir) {
  if (!existsSync(dir)) return;
  for (const entry of readdirSync(dir)) {
    const p = join(dir, entry);
    const s = statSync(p);
    if (s.isDirectory()) yield* walkMarkdown(p);
    else if (extname(p) === '.md') yield p;
  }
}

export function getEccSha(eccPath) {
  const result = spawnSync('git', ['-C', eccPath, 'rev-parse', 'HEAD'], {
    encoding: 'utf8',
  });
  if (result.status !== 0) return null;
  return result.stdout.trim();
}

// Unified scraper contract: ({ root, options }) → { records, sha, skipped }
//   root: the ECC working tree (typically the submodule path).
//   options: reserved for future per-call configuration (currently unused).
// `sha` is the git revision of `root` (or null if `root` is not a git tree); it
// is the only field a sibling scraper does not expose, because the ECC source
// is the only one we treat as versioned content. `skipped` is the list of
// markdown files whose frontmatter failed to parse — surfaced so callers can
// report a non-zero count without losing visibility into which files were
// rejected.
// Missing root returns { records: [], sha: null, skipped: [] } rather than
// throwing — same failure-mode contract as scrapeNative/scrapeHarness.
export function scrapeEcc({ root, options = {} } = {}) {
  void options;
  if (!root || !existsSync(root)) return { records: [], sha: null, skipped: [] };

  const sha = getEccSha(root);
  const skipped = [];
  const records = [];

  for (const [subdir, kind] of Object.entries(DIR_KIND_MAP)) {
    const dirPath = join(root, subdir);
    for (const file of walkMarkdown(dirPath)) {
      const parsed = parseMarkdown(file);
      if (parsed.parseError) {
        skipped.push({ file, reason: parsed.parseError });
        continue;
      }
      const record = normalizeRecord(parsed, {
        filenameStem: filenameStem(file),
        kind,
        source: 'ecc',
      });
      record.path = relative(root, file);
      record.ecc_sha = sha;
      records.push(record);
    }
  }

  const mcpDir = join(root, 'mcp-configs');
  if (existsSync(mcpDir)) {
    for (const entry of readdirSync(mcpDir)) {
      const p = join(mcpDir, entry);
      if (extname(p) === '.json') {
        records.push({
          name: filenameStem(p),
          kind: 'mcp',
          source: 'ecc',
          path: relative(root, p),
          description: '',
          ecc_sha: sha,
        });
      }
    }
  }

  return { records, sha, skipped };
}
