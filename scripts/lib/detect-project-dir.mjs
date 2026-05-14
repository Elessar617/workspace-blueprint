import { existsSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { homedir } from 'node:os';

const DEFAULT_CACHE_ROOT = join(homedir(), '.claude', 'plugins', 'cache', 'ecc');

export function findDetectScript({ pluginCacheRoot = DEFAULT_CACHE_ROOT } = {}) {
  if (!existsSync(pluginCacheRoot)) return null;
  const eccDir = join(pluginCacheRoot, 'ecc');
  if (!existsSync(eccDir)) return null;

  let versions;
  try {
    versions = readdirSync(eccDir, { withFileTypes: true })
      .filter(e => e.isDirectory())
      .map(e => e.name)
      .sort()
      .reverse();
  } catch {
    return null;
  }

  for (const version of versions) {
    const candidate = join(
      eccDir, version,
      'skills', 'continuous-learning-v2', 'scripts', 'detect-project.sh',
    );
    if (existsSync(candidate)) return candidate;
  }
  return null;
}

export function detectProjectDir({
  pluginCacheRoot = DEFAULT_CACHE_ROOT,
  cwd = process.cwd(),
} = {}) {
  const script = findDetectScript({ pluginCacheRoot });
  if (!script) return { projectHash: null, projectDir: null };

  const result = spawnSync('bash', [
    '-c',
    `cd "${cwd}" && source "${script}" 2>/dev/null && printf '%s\\n%s\\n' "$PROJECT_ID" "$PROJECT_DIR"`,
  ], { encoding: 'utf8', timeout: 5000 });

  if (result.status !== 0) return { projectHash: null, projectDir: null };

  const [projectHash, projectDir] = result.stdout.split('\n');
  return {
    projectHash: projectHash || null,
    projectDir: projectDir || null,
  };
}
