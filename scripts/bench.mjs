#!/usr/bin/env node
// One-shot benchmark runner. n=10 samples per metric; writes JSON.
// Each metric records {p50, p95, p99} across samples.
// Uses spawnSync with array args (no shell interpolation) for safety.

import { spawnSync } from 'node:child_process';
import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = join(__dirname, '..');
const N = 10;

function percentile(sorted, p) {
  const idx = Math.ceil((p / 100) * sorted.length) - 1;
  return sorted[Math.max(0, Math.min(idx, sorted.length - 1))];
}

function stats(samples) {
  const sorted = [...samples].sort((a, b) => a - b);
  return { p50: percentile(sorted, 50), p95: percentile(sorted, 95), p99: percentile(sorted, 99) };
}

function timeMs(fn) {
  const start = process.hrtime.bigint();
  fn();
  return Number(process.hrtime.bigint() - start) / 1e6;
}

function runQuiet(command, args, options = {}) {
  const r = spawnSync(command, args, { stdio: ['pipe', 'pipe', 'pipe'], ...options });
  if (r.error) {
    throw new Error(`${command} ${args.join(' ')} failed to launch: ${r.error.message}`);
  }
  if (r.status !== 0) {
    const stderr = (r.stderr ? r.stderr.toString('utf8').trim() : '').slice(0, 500);
    throw new Error(`${command} ${args.join(' ')} exited ${r.status}${stderr ? `; stderr: ${stderr}` : ''}`);
  }
  return r;
}

function benchHookRouteInject() {
  const samples = [];
  const hookPath = join(REPO_ROOT, '.claude', 'hooks', 'route-inject.sh');
  for (let i = 0; i < N; i++) {
    samples.push(timeMs(() => {
      runQuiet('bash', [hookPath], { input: '{"prompt":"add a feature"}' });
    }));
  }
  return stats(samples);
}

function benchNpmTest() {
  const samples = [];
  for (let i = 0; i < N; i++) {
    samples.push(timeMs(() => {
      runQuiet('npm', ['test'], { cwd: REPO_ROOT });
    }));
  }
  return stats(samples);
}

function benchRebuildRegistry() {
  const samples = [];
  for (let i = 0; i < N; i++) {
    samples.push(timeMs(() => {
      runQuiet('npm', ['run', 'rebuild-registry'], { cwd: REPO_ROOT });
    }));
  }
  return stats(samples);
}

const shaResult = spawnSync('git', ['rev-parse', '--short', 'HEAD'], { cwd: REPO_ROOT });
if (shaResult.error) throw new Error(`failed to invoke git: ${shaResult.error.message}`);
if (shaResult.status !== 0) throw new Error(`git rev-parse exited ${shaResult.status}`);
const sha = shaResult.stdout.toString().trim();
if (!sha) throw new Error('git rev-parse returned empty SHA');
const env = process.env.CI === 'true' ? 'ci' : 'local';

const baseline = {
  captured_at: new Date().toISOString(),
  captured_against_sha: sha,
  captured_in_env: env,
  samples: N,
  metrics: {
    hook_route_inject: benchHookRouteInject(),
    npm_test_duration: benchNpmTest(),
    rebuild_registry: benchRebuildRegistry(),
  },
  notes: env === 'local'
    ? 'Captured locally; CI re-run recommended for the canonical reference.'
    : 'Canonical CI capture.',
};

const outDir = join(REPO_ROOT, 'docs', 'baselines');
mkdirSync(outDir, { recursive: true });
const outFile = join(outDir, '2026-05-15-perf.json');
writeFileSync(outFile, JSON.stringify(baseline, null, 2) + '\n');
console.log(`wrote ${outFile}`);
