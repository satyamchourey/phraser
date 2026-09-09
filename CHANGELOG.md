# Changelog

All notable changes to this project are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.1.0] - 2026-09-09

Initial release. Manual invocation only — see `phraser-project-spec.md`
section 8 for the full roadmap.

The command went through one round of live-tested iteration before this
release: it started out as `phraser` → `phraser:phraser`, and the questions
it asked and the final output it produced were both plainer prose. What's
listed below is the shipped result, not that starting point.

### Iterated during development

- **Renamed the command** `phraser` → `gist` (`/phraser:gist`), dropping the
  `/phraser:phraser` stutter. The skill itself is still `phraser-expand`
  (`phraser:phraser-expand`) — only the command changed.
- **Clarifying-question answers route back into the sharpening flow
  unambiguously**, rather than looking like an unrelated new message.
  `phraser-expand` prefers the `AskUserQuestion` tool when the open points
  are choice-shaped (the answer returns inside the same turn); it falls
  back to a delimited `PHRASER — CLARIFYING QUESTIONS` block, with an
  explicit "reply with your answers" line, when a question is genuinely
  open-ended or the tool is unavailable (it doesn't exist in headless
  sessions).
- **The sharpened prompt is visually set apart and requires approval.**
  Output shape B is a delimited `SHARPENED PROMPT` block, followed by a
  plain-prose "Approved? Reply yes, or tell me what to change." The skill
  stops there — it does not begin implementing, even when the work looks
  small and obvious. (The approval ask is deliberately prose rather than a
  tool call, so the model's turn actually ends there instead of leaving it
  holding an "approved" it could act on immediately.)

### Added

- `scripts/gate.js` — a pure, local heuristic (`gate(prompt, opts)` →
  `{ verdict, reasons }`) that scores a prompt as "vague" or "fine" against
  five weighted signals (vague-verb phrase match, bare pronoun with no
  antecedent, no file/path/identifier scope, no acceptance-criteria
  language, very short, plus a problem-report/symptom-statement signal).
  No I/O, never throws. Not wired to any automatic trigger yet in v0.1.
- `tests/golden-prompts/fixtures.json` — 44 hand-labeled example prompts
  (22 vague / 22 fine), including deliberate hard cases (short-but-precise,
  long-but-no-acceptance-criteria) that the gate is tuned against.
- `tests/gate.test.js`, `tests/gate.unit.test.js` — fixture-driven and
  targeted unit tests for the gate (degenerate input, `opts` overrides).
- `tests/skill.headless.js` (`npm run test:skill`) — a headless harness
  that drives real `claude --print --plugin-dir .` calls against a sample
  of fixtures, asserting a clarifying question or structured expansion is
  returned, never raw passthrough. Skips cleanly without an authenticated
  `claude` CLI.
- `skills/phraser-expand/SKILL.md` — the actual decision logic: restate the
  goal → gather context (`CLAUDE.md`, recently touched files, `git diff`)
  → ask only if scope or "done" is genuinely unclear → cap at 3 questions
  → one clarify round, then proceed with stated assumptions.
- `commands/gist.md` (`/phraser:gist`) — manual invocation. Takes a rough
  prompt as arguments (or asks for one, if none given) and returns the
  skill's output.
- `.claude-plugin/plugin.json` — the plugin manifest.
- `.github/workflows/ci.yml` — validates the manifest and runs the fast
  test suite on every push and pull request; the skill-level harness runs
  too, expected to skip cleanly (no credentials on a public runner).
- `README.md` — problem statement, a real before/after transcript, install
  instructions, what v0.1 does and doesn't do, and contributing notes.

### Known limitations

- No automatic triggering (`UserPromptSubmit` hook) — every prompt not run
  through `/phraser:gist` explicitly goes straight to Claude unchanged. Planned
  for v0.2.
- No `phraser.config.json` — the gate's defaults are hardcoded. Planned
  for v0.2.
- No project-specific checklist support. Planned for v0.3.
