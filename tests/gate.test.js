import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { gate } from '../scripts/gate.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const fixturesPath = path.join(__dirname, 'golden-prompts', 'fixtures.json');
const fixtures = JSON.parse(readFileSync(fixturesPath, 'utf8'));

test('golden-prompts fixtures', async (t) => {
  for (const fixture of fixtures) {
    await t.test(`${fixture.id}: "${fixture.prompt}"`, () => {
      const result = gate(fixture.prompt);
      assert.equal(
        result.verdict,
        fixture.expected,
        `expected ${fixture.expected}, got ${result.verdict}\n` +
          `  prompt: ${fixture.prompt}\n` +
          `  note:   ${fixture.note}\n` +
          `  reasons: ${JSON.stringify(result.reasons)}`,
      );
    });
  }
});
