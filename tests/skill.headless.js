// Headless skill-level smoke test (spec section 6): drives the real
// `claude --print` CLI with the plugin loaded via `--plugin-dir`, against a
// handful of fixture prompts, and asserts the output is either a clarifying
// question or a structured expansion — never raw passthrough.
//
// This is a separate npm script (`npm run test:skill`), not part of the
// default `npm test`, because it needs a live, authenticated `claude`
// binary and makes real API calls. It must still *run* under plain
// `npm test` without failing when that binary/auth isn't available —
// so every case here skips cleanly instead (see hasClaudeCli below).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { execFileSync } from 'node:child_process';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const pluginDir = path.join(__dirname, '..');
const fixturesPath = path.join(__dirname, 'golden-prompts', 'fixtures.json');
const allFixtures = JSON.parse(readFileSync(fixturesPath, 'utf8'));

// A small, deliberately mixed subset: vague ones that should provoke
// questions, fine ones that should provoke a clean expansion.
const SAMPLE_IDS = ['vague-01', 'vague-06', 'fine-02', 'fine-05', 'fine-15'];
const sample = SAMPLE_IDS.map((id) => {
  const fixture = allFixtures.find((f) => f.id === id);
  if (!fixture) throw new Error(`fixture ${id} not found in fixtures.json`);
  return fixture;
});

function hasClaudeCli() {
  try {
    execFileSync('claude', ['--version'], { stdio: 'pipe', timeout: 10_000 });
  } catch {
    return false;
  }
  try {
    const status = execFileSync('claude', ['auth', 'status'], {
      stdio: 'pipe',
      timeout: 10_000,
    }).toString();
    return JSON.parse(status).loggedIn === true;
  } catch {
    return false;
  }
}

const skip = hasClaudeCli()
  ? false
  : 'claude CLI not found or not authenticated — skipping live skill tests';

// Live model calls vary a lot: observed 18s-60s+ for the same fixtures across
// runs. A tight budget here fails the suite for being slow rather than for
// being wrong, so this is deliberately generous — this harness is opt-in
// (`npm run test:skill`), never on the fast path.
const CALL_TIMEOUT_MS = 180_000;

function runPhraser(prompt) {
  try {
    return execFileSync(
      'claude',
      ['--plugin-dir', pluginDir, '--print', `/phraser:gist ${prompt}`],
      { stdio: ['ignore', 'pipe', 'pipe'], timeout: CALL_TIMEOUT_MS, encoding: 'utf8' },
    );
  } catch (err) {
    if (err.code === 'ETIMEDOUT') {
      throw new Error(
        `claude --print exceeded ${CALL_TIMEOUT_MS / 1000}s for prompt: ${prompt}\n` +
          'This is a latency failure, not an assertion failure — the skill may still be correct.',
      );
    }
    throw err;
  }
}

// These patterns anchor on the block *delimiters*, not the bare phrases.
// Running this suite inside phraser's own repo means the skill gathers
// context by reading these very files, and will happily quote "SHARPENED
// PROMPT" or "AskUserQuestion" back while describing what it found. Matching
// the phrase alone therefore mistakes prose *about* the contract for the
// contract itself — which is exactly what happened the first time this ran.

// Shape B: the delimited SHARPENED PROMPT block, its sections, and the
// approval line that must follow it.
const SHARPENED_HEADER = /═+\s*SHARPENED PROMPT/;
const SECTION_PATTERN = /\bGoal:|\bConstraints:|\bFiles in scope:|\bDone when:/i;
const APPROVAL_PATTERN = /approved\?/i;

// Shape A: the fallback question block. (Headless sessions have no
// AskUserQuestion tool, so the fallback is always the path exercised here.)
const QUESTION_BLOCK_PATTERN = /─+\s*PHRASER — CLARIFYING QUESTIONS/;
const QUESTION_PATTERN = /\?/;

// The skill must never narrate which asking mechanism it used. Targets that
// narration specifically rather than any mention of the tool, since a
// context summary may legitimately name it when reading this repo.
const MECHANISM_LEAK_PATTERN =
  /AskUserQuestion\s+(is|isn't|is not|was|wasn't|was not)\s+(un)?available/i;

for (const fixture of sample) {
  test(`skill: ${fixture.id} produces a question block or a sharpened prompt, not passthrough`, { skip }, () => {
    const output = runPhraser(fixture.prompt);

    assert.notEqual(
      output.trim(),
      fixture.prompt.trim(),
      `expected the skill to transform the prompt, not echo it verbatim:\n${output}`,
    );

    const isSharpened = SHARPENED_HEADER.test(output);
    const isQuestionBlock = QUESTION_BLOCK_PATTERN.test(output);

    assert.ok(
      isSharpened || isQuestionBlock,
      `expected either a SHARPENED PROMPT block or a PHRASER — CLARIFYING QUESTIONS block, got:\n${output}`,
    );

    // Whichever shape it chose, it must be complete.
    if (isSharpened) {
      assert.ok(
        SECTION_PATTERN.test(output),
        `sharpened block is missing its sections (Goal/Constraints/Files in scope/Done when):\n${output}`,
      );
      assert.ok(
        APPROVAL_PATTERN.test(output),
        `sharpened block must be followed by an approval ask ("Approved? ..."):\n${output}`,
      );
    } else {
      assert.ok(
        QUESTION_PATTERN.test(output),
        `question block contains no actual question:\n${output}`,
      );
    }

    assert.ok(
      !MECHANISM_LEAK_PATTERN.test(output),
      `output should never narrate its asking mechanism, but mentions AskUserQuestion:\n${output}`,
    );
  });
}
