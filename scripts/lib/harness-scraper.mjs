import { readdirSync, statSync, existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { homedir } from 'node:os';

export function scrapeHarness({
  pluginsDir = join(homedir(), '.claude', 'plugins', 'cache'),
  settingsPath = join(homedir(), '.claude', 'settings.json'),
} = {}) {
  const indexedAt = new Date().toISOString();
  const skills = [];
  const mcps = [];
  const builtins = [];

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
                skills.push({
                  name: skillEntry,
                  namespace: pluginName,
                  kind: 'skill',
                  source: 'harness',
                  plugin_path: skillPath,
                  description: '',
                  indexed_at: indexedAt,
                });
              }
            }
          }
        }
      }
    }
  }

  if (existsSync(settingsPath)) {
    try {
      const settings = JSON.parse(readFileSync(settingsPath, 'utf8'));
      if (settings.mcpServers) {
        for (const [name, config] of Object.entries(settings.mcpServers)) {
          mcps.push({
            name,
            kind: 'mcp',
            source: 'harness',
            command: config.command || '',
            description: '',
            indexed_at: indexedAt,
          });
        }
      }
    } catch (e) {
      console.warn(`[harness-scraper] could not parse ${settingsPath}: ${e.message}`);
    }
  }

  return { skills, mcps, builtins, indexedAt };
}
