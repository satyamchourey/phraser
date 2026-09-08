// Targeted unit tests for scripts/gate.js — degenerate input handling and
// opts overriding DEFAULT_CONFIG. Kept separate from gate.test.js (which
// only asserts fixture verdicts) so these behavioral contracts have their
// own readable, specific failure messages.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { gate } from '../scripts/gate.js';

test('degenerate input never throws and returns a well-formed verdict', async (t) => {
  const cases = [
    ['empty string', ''],
    ['whitespace only', '   \n\t  '],
    ['very long prompt', 'fix this ' + 'word '.repeat(20000)],
    ['non-string: number', 42],
    ['non-string: null', null],
    ['non-string: undefined', undefined],
    ['non-string: plain object', { foo: 'bar' }],
    ['non-string: array', ['fix', 'this']],
  ];

  for (const [label, input] of cases) {
    await t.test(label, () => {
      const result = gate(input);
      assert.ok(
        result && (result.verdict === 'vague' || result.verdict === 'fine'),
        `expected a well-formed verdict for ${label}, got ${JSON.stringify(result)}`,
      );
      assert.ok(
        Array.isArray(result.reasons),
        `expected reasons to be an array for ${label}, got ${JSON.stringify(result.reasons)}`,
      );
    });
  }
});

test('non-string and empty input never blocks — verdict is always "fine"', () => {
  for (const input of ['', '   ', null, undefined, 42, {}, []]) {
    assert.equal(
      gate(input).verdict,
      'fine',
      `expected "fine" (never block) for input ${JSON.stringify(input)}`,
    );
  }
});

test('opts.vagueVerbs overrides the default list', () => {
  const prompt = 'Fix the login bug in src/auth/login.js';
  assert.equal(gate(prompt).verdict, 'vague', 'sanity check: vague by default');
  assert.equal(
    gate(prompt, { vagueVerbs: [] }).verdict,
    'fine',
    'clearing vagueVerbs should drop the vague-verb signal and flip the verdict',
  );
});

test('opts.vagueVerbs can also add a phrase not in the default list', () => {
  const prompt = 'Please modernize the payment flow.';
  assert.equal(gate(prompt).verdict, 'fine', 'sanity check: "modernize" is not a default vague verb');
  assert.equal(
    gate(prompt, { vagueVerbs: ['modernize'] }).verdict,
    'vague',
    'adding "modernize" to vagueVerbs should trip the vague-verb signal',
  );
});

test('opts.threshold shifts the vague/fine boundary', () => {
  // Scores exactly 2 by default (no-scope-signal + no-acceptance-criteria).
  const prompt = 'we discussed the caching layer today';
  assert.equal(gate(prompt).verdict, 'fine', 'sanity check: below the default threshold of 3');
  assert.equal(
    gate(prompt, { threshold: 2 }).verdict,
    'vague',
    'lowering the threshold to 2 should flip a score-2 prompt to vague',
  );
});

test('opts.weights shallow-overrides individual signal weights', () => {
  const prompt = 'we discussed the caching layer today'; // score 2 by default
  assert.equal(
    gate(prompt, { weights: { noScope: 5 } }).verdict,
    'vague',
    'boosting noScope weight alone should be enough to cross the default threshold',
  );
});

test('opts.requireAcceptanceCriteria forces "vague" whenever done-ness is undefined', () => {
  const prompt = 'Rename src/api/user.js exports to use named exports instead of default.';
  assert.equal(
    gate(prompt).verdict,
    'fine',
    'sanity check: fine by default (well-scoped, no acceptance-criteria language needed)',
  );
  const strict = gate(prompt, { requireAcceptanceCriteria: true });
  assert.equal(strict.verdict, 'vague', 'requireAcceptanceCriteria should force vague when done-ness is unstated');
  assert.ok(
    strict.reasons.includes('acceptance-criteria-required'),
    'forced verdict should name the reason explicitly',
  );
});
