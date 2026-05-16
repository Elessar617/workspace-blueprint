import { readdirSync, statSync, existsSync, readFileSync } from 'node:fs';
import { join, relative } from 'node:path';
import { homedir } from 'node:os';

const BUILTINS = [
  { name: 'general-purpose', kind: 'agent', source: 'harness-builtin', description: 'Generic Claude Code subagent type.' },
  { name: 'Explore', kind: 'agent', source: 'harness-builtin', description: 'Claude Code exploration subagent.' },
  { name: 'Plan', kind: 'agent', source: 'harness-builtin', description: 'Claude Code planning subagent.' },
];

const compareVersion = (a, b) => a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' });

// Unified scraper contract: ({ root, options }) → { records, builtins }
//   root: the harness plugin cache directory (default ~/.claude/plugins/cache).
//   options:
//     - settingsPath:  single settings.json to scan for mcpServers (default ~/.claude/settings.json)
//     - settingsPaths: array of settings.json files; if provided overrides settingsPath
// `builtins` is a stable array of Claude Code built-in subagents that have no
// on-disk file and therefore cannot be discovered by walking the plugin cache —
// returned as a separate field so callers can address them without filtering.
// Missing root returns { records: [], builtins } (settings parsing still runs
// because settings files live outside the plugin cache).
export function scrapeHarness({ root, options = {} } = {}) {
  const pluginsDir = root || join(homedir(), '.claude', 'plugins', 'cache');
  const settingsPath = options.settingsPath || join(homedir(), '.claude', 'settings.json');
  const settingsPaths = options.settingsPaths;

  const skillsByKey = new Map();
  const records = [];
  const builtins = BUILTINS.map((item) => ({ ...item }));

  if (existsSync(pluginsDir)) {
    for (const marketplace of readdirSync(pluginsDir)) {
      const mpPath = join(pluginsDir, marketplace);
      if (!statSync(mpPath).isDirectory()) continue;
      for (const pluginName of readdirSync(mpPath)) {
        const pluginPath = join(mpPath, pluginName);
        if (!statSync(pluginPath).isDirectory()) continue;
        for (const versionDir of readdirSync(pluginPath)) {
          const versionPath = join(pluginPath, versionDir);
          if (!statSync(versionPath).isDirectory()) continue;
          const skillsDir = join(versionPath, 'skills');
          if (existsSync(skillsDir)) {
            for (const skillEntry of readdirSync(skillsDir)) {
              const skillPath = join(skillsDir, skillEntry);
              if (statSync(skillPath).isDirectory()) {
                const key = `${marketplace}/${pluginName}/${skillEntry}`;
                const existing = skillsByKey.get(key);
                if (existing && compareVersion(existing.version, versionDir) >= 0) continue;
                skillsByKey.set(key, {
                  name: skillEntry,
                  namespace: pluginName,
                  marketplace,
                  version: versionDir,
                  kind: 'skill',
                  source: 'harness',
                  plugin_path: relative(pluginsDir, skillPath).replaceAll('\\', '/'),
                  description: '',
                });
              }
            }
          }
        }
      }
    }
  }
  for (const skill of skillsByKey.values()) records.push(skill);

  const paths = settingsPaths || [settingsPath];
  const seenMcps = new Set();
  for (const path of paths) {
    if (!existsSync(path)) continue;
    try {
      const settings = JSON.parse(readFileSync(path, 'utf8'));
      if (settings.mcpServers) {
        for (const [name, config] of Object.entries(settings.mcpServers)) {
          if (seenMcps.has(name)) continue;
          seenMcps.add(name);
          records.push({
            name,
            kind: 'mcp',
            source: 'harness',
            command: config.command || '',
            description: '',
          });
        }
      }
    } catch (e) {
      console.warn(`[harness-scraper] could not parse ${path}: ${e.message}`);
    }
  }

  return { records, builtins };
}
