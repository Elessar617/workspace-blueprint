import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { detectTaskType, detectLanguages, detectOutputSkills, route } from '../../scripts/route.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = join(__dirname, '..', '..');

function branchAlwaysLoadItems(branch, label) {
  const content = readFileSync(join(REPO_ROOT, '.claude', 'routing', `${branch}.md`), 'utf8');
  const line = content.split('\n').find((l) => l.startsWith(`- ${label}:`)) || '';
  if (line.includes('none')) return [];
  return [...line.matchAll(/`([^`]+)`/g)].map((m) => m[1]);
}

function fallbackSkills() {
  const content = readFileSync(join(REPO_ROOT, 'ROUTING.md'), 'utf8');
  const line = content.split('\n').find((l) => l.startsWith('- Native skills:')) || '';
  return [...line.matchAll(/`([^`]+)`/g)].map((m) => m[1]);
}

test('detectTaskType matches "add" -> build', () => {
  assert.equal(detectTaskType('add a rate limiter to the gateway'), 'build');
});

test('detectTaskType matches "fix" -> bug', () => {
  assert.equal(detectTaskType('fix the broken login redirect'), 'bug');
});

test('detectTaskType matches "refactor" -> refactor', () => {
  assert.equal(detectTaskType('refactor the auth module'), 'refactor');
});

test('detectTaskType matches "investigate" -> spike', () => {
  assert.equal(detectTaskType('investigate why GraphQL is slow'), 'spike');
});

test('detectTaskType matches "RFC" -> spec-author', () => {
  assert.equal(detectTaskType('write an RFC for the new auth flow'), 'spec-author');
});

test('detectTaskType matches "release" -> ship', () => {
  assert.equal(detectTaskType('cut a v0.3.0 release'), 'ship');
});

test('detectTaskType returns null when no signal', () => {
  assert.equal(detectTaskType('thanks!'), null);
});

test('detectLanguages from go files', () => {
  assert.deepEqual(detectLanguages(['gateway/handler.go']), ['go']);
});

test('detectLanguages from mixed files', () => {
  const langs = detectLanguages(['a.py', 'b.ts']);
  assert.ok(langs.includes('python'));
  assert.ok(langs.includes('typescript'));
});

test('detectOutputSkills does not reference unbundled document skills', () => {
  const skills = detectOutputSkills(['ship/docs/report.pdf', 'ship/docs/report.docx']);
  assert.deepEqual(skills, []);
});

test('route returns native-only fallback on no match', () => {
  const r = route({
    prompt: 'thanks!',
    files_in_scope: [],
    registry: { agents: [], skills: [], commands: [], mcps: [] },
  });
  assert.equal(r.branch, 'fallback');
  assert.ok(r.agents.includes('planner'));
  assert.ok(r.agents.includes('implementer'));
  assert.equal(r.hook_profile, 'standard');
});

test('route recommends minimal profile for spike', () => {
  const r = route({
    prompt: 'investigate the GraphQL latency regression',
    files_in_scope: [],
    registry: { agents: [], skills: [], commands: [], mcps: [] },
  });
  assert.equal(r.branch, 'spike');
  assert.equal(r.hook_profile, 'minimal');
});

test('route recommends strict profile for ship', () => {
  const r = route({
    prompt: 'cut the v0.3.0 release and write changelog',
    files_in_scope: [],
    registry: { agents: [], skills: [], commands: [], mcps: [] },
  });
  assert.equal(r.branch, 'ship');
  assert.equal(r.hook_profile, 'strict');
});

test('route omits unbundled output skills for ship files but keeps caveman + ship mandatories', () => {
  const r = route({
    prompt: 'release the report',
    files_in_scope: ['ship/docs/report.pdf'],
    registry: { agents: [], skills: [], commands: [], mcps: [] },
  });
  assert.equal(r.branch, 'ship');
  assert.ok(r.skills.includes('caveman'));
  assert.ok(r.skills.includes('superpowers:verification-before-completion'));
});

test('route surfaces Go language items as hints for go-feature task', () => {
  const r = route({
    prompt: 'add a rate limiter to the gateway service',
    files_in_scope: ['gateway/handler.go'],
    registry: { agents: [], skills: [], commands: [], mcps: [] },
  });
  assert.equal(r.branch, 'build');
  const hintNames = r.hints.map((h) => h.name);
  assert.ok(hintNames.includes('go-reviewer'));
  assert.ok(hintNames.includes('golang-patterns'));
});

test('route includes every branch always-load agent and skill listed in routing docs', () => {
  const prompts = {
    build: 'add a rate limiter to the gateway service',
    bug: 'fix the broken JSON parser',
    refactor: 'refactor the auth middleware',
    spike: 'investigate the GraphQL latency regression',
    'spec-author': 'write an RFC for the new auth flow',
    ship: 'ship the release notes',
  };

  for (const [branch, prompt] of Object.entries(prompts)) {
    const r = route({
      prompt,
      files_in_scope: [],
      registry: { agents: [], skills: [], commands: [], mcps: [] },
    });

    for (const agent of branchAlwaysLoadItems(branch, 'Agents')) {
      assert.ok(r.agents.includes(agent), `${branch} route missing ${agent}`);
    }
    for (const skill of branchAlwaysLoadItems(branch, 'Skills')) {
      assert.ok(r.skills.includes(skill), `${branch} route missing ${skill}`);
    }
  }

  const fallback = route({
    prompt: 'hello',
    files_in_scope: [],
    registry: { agents: [], skills: [], commands: [], mcps: [] },
  });
  for (const skill of fallbackSkills()) {
    assert.ok(fallback.skills.includes(skill), `fallback route missing ${skill}`);
  }
});

test('code-changing routes carry NASA-style comment discipline', () => {
  for (const prompt of [
    'add a rate limiter to the gateway service',
    'fix the broken JSON parser',
    'refactor the auth middleware',
    'ship the release notes',
  ]) {
    const r = route({
      prompt,
      files_in_scope: [],
      registry: { agents: [], skills: [], commands: [], mcps: [] },
    });
    assert.ok(r.rules.includes('all'), `${r.branch} should load all native rules`);
    assert.ok(
      r.rule_notes.some((note) => note.includes('NASA-style comments') && note.includes('failure modes')),
      `${r.branch} should inject NASA-style comment discipline`,
    );
  }
});

// ──────────────────────────────────────────────────────────────────────
// New-shape assertions: mandatories / signals / hints / instinct cap.
// ──────────────────────────────────────────────────────────────────────

test('detectTaskType matches "review" -> review', () => {
  assert.equal(detectTaskType('act as reviewer and adversary on this diff'), 'review');
});

test('detectTaskType matches "audit" -> review', () => {
  assert.equal(detectTaskType('audit the routing system'), 'review');
});

test('route returns mandatories for build branch', () => {
  const r = route({ prompt: 'add a rate limiter', files_in_scope: [], registry: {} });
  assert.ok(r.mandatories.includes('tdd-loop'));
  assert.ok(r.mandatories.includes('karpathy-guidelines'));
  assert.ok(r.mandatories.includes('superpowers:verification-before-completion'));
});

test('route returns mandatories for bug branch', () => {
  const r = route({ prompt: 'fix the broken login', files_in_scope: [], registry: {} });
  assert.ok(r.mandatories.includes('bug-investigation'));
  assert.ok(r.mandatories.includes('systematic-debugging'));
});

test('route returns mandatories for review branch', () => {
  const r = route({ prompt: 'act as reviewer', files_in_scope: [], registry: {} });
  assert.ok(r.mandatories.includes('karpathy-guidelines'));
  assert.ok(r.mandatories.includes('superpowers:requesting-code-review'));
});

test('route fallback mandatories only contains always-loaded caveman', () => {
  const r = route({ prompt: 'hello world', files_in_scope: [], registry: {} });
  assert.equal(r.branch, 'fallback');
  assert.deepEqual(r.mandatories, ['caveman']);
});

test('route derives hints from go language signal', () => {
  const r = route({
    prompt: 'add rate limiter',
    files_in_scope: ['src/gateway/x.go'],
    registry: {},
  });
  const hintNames = r.hints.map((h) => h.name);
  assert.ok(hintNames.includes('golang-patterns'));
});

test('route derives hints from python language signal', () => {
  const r = route({
    prompt: 'add validator',
    files_in_scope: ['src/foo.py'],
    registry: {},
  });
  const hintNames = r.hints.map((h) => h.name);
  assert.ok(hintNames.includes('python-patterns'));
});

test('route returns mcps_project and mcps_plugin split for build', () => {
  const r = route({ prompt: 'add feature', files_in_scope: [], registry: {} });
  assert.deepEqual(r.mcps_project.sort(), ['filesystem', 'git']);
  assert.ok(r.mcps_plugin.includes('serena'));
});

test('route applies instinct cap (build = 10)', () => {
  const fakeInstincts = Array.from({ length: 12 }, (_, i) => ({
    id: `i${i}`, confidence: 0.7 + i * 0.01, _scope: 'global', action: `Action ${i}`,
  }));
  const r = route({
    prompt: 'add feature', files_in_scope: [], registry: {},
    instincts: fakeInstincts,
  });
  assert.equal(r.instincts.length, 10);
});

test('route applies instinct cap (spike = 3)', () => {
  const fakeInstincts = Array.from({ length: 10 }, (_, i) => ({
    id: `i${i}`, confidence: 0.7 + i * 0.01, _scope: 'global', action: `Action ${i}`,
  }));
  const r = route({
    prompt: 'investigate the latency regression', files_in_scope: [], registry: {},
    instincts: fakeInstincts,
  });
  assert.equal(r.branch, 'spike');
  assert.equal(r.instincts.length, 3);
});

test('route applies instinct cap (bug = 6)', () => {
  const fakeInstincts = Array.from({ length: 10 }, (_, i) => ({
    id: `i${i}`, confidence: 0.7 + i * 0.01, _scope: 'global', action: `Action ${i}`,
  }));
  const r = route({
    prompt: 'fix the crash', files_in_scope: [], registry: {},
    instincts: fakeInstincts,
  });
  assert.equal(r.instincts.length, 6);
});

test('route returns signals object', () => {
  const r = route({
    prompt: 'add feature', files_in_scope: ['src/x.go'], registry: {},
  });
  assert.ok(r.signals);
  assert.deepEqual(r.signals.files, ['src/x.go']);
  assert.deepEqual(r.signals.languages, ['go']);
});

test('ROUTING.md Step 1 table includes review branch row', () => {
  const content = readFileSync(join(REPO_ROOT, 'ROUTING.md'), 'utf8');
  assert.ok(content.includes('"review", "audit"'));
  assert.ok(content.includes('.claude/routing/review.md'));
});
