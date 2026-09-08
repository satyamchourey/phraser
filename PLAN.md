# Phraser v0.1 — Build Plan

Ordered, dependency-sorted task list for shipping v0.1. Every task is small
enough to finish in one sitting, verifiable on its own, and safe to commit
alone. Work top to bottom; within a milestone, tasks assume the ones above
them are done.

## Scope decisions (read first)

The spec has one internal conflict: §3 says "two invocation modes, both
included," while §8 scopes v0.1 to "manual `/phraser` command only, no
auto-hook, no config beyond defaults." **This plan follows §8.**

Consequences:
- `hooks/hooks.json` and `UserPromptSubmit` auto-triggering are **deferred to v0.2**.
- `phraser.config.json` as a user-editable file is **deferred to v0.2**; v0.1
  uses hardcoded defaults (max 3 questions, built-in vague-verb list).
- `scripts/gate.js` **is** built in v0.1, but as a pure, standalone module with
  no caller wired to it. Reason: §6 makes the golden-prompt suite the primary
  test asset, and the gate is the thing it tests. Building it now also means
  v0.2 is a wiring job, not a design job.

Runtime baseline: Node 20+, `node:test` + `node:assert` as the test runner
(zero dependencies — nothing to install for a stranger following the README).

---

## M0 — Repo scaffolding

- [x] Add `.gitignore` (node_modules, `.DS_Store`, editor dirs, test tmp output).
      *Verify:* `git status` is clean after creating a throwaway `node_modules/`.
- [x] Add `package.json`: name `phraser`, version `0.1.0`, `"type": "module"`,
      `engines.node >= 20`, no dependencies, `"test": "node --test tests/"`.
      *Verify:* `npm test` runs and exits 0 with "no tests found" (or equivalent).
- [x] Create the empty directory skeleton from spec §3 with `.gitkeep` files:
      `.claude-plugin/`, `skills/phraser-expand/`, `commands/`, `scripts/`,
      `tests/golden-prompts/`.
      *Verify:* `find . -type d -not -path './.git/*'` matches spec §3 minus the
      deferred `hooks/`.

## M1 — Plugin skeleton (installable, does nothing yet)

- [x] Write `.claude-plugin/plugin.json` per the spec §3 sketch — name,
      version `0.1.0`, description, author, and only the keys v0.1 actually
      ships (`skills`, `commands`; **no** `hooks` key).
      *Verify:* `claude plugin validate .` passes.
- [x] Add a placeholder `commands/phraser.md` (frontmatter + one-line body) so
      the plugin loads with a real command registered.
      *Verify:* `claude --plugin-dir . --print "/phraser:phraser hello"` returns
      without an unknown-command error. (Note: headless `--print` invocation of
      a plugin command requires the `<plugin>:<command>` qualified form — bare
      `/phraser` is not resolved outside an interactive session. Confirmed
      against Claude Code CLI 2.1.263.)

## M2 — Heuristic gate (`scripts/gate.js`)

- [x] Write `scripts/gate.js` exporting a single pure function
      `gate(prompt, opts)` returning `{ verdict: "vague" | "fine", reasons: [] }`.
      No I/O, no LLM call, no `process` access — pure string in, object out.
      *Verify:* `node -e` one-liner against two obvious prompts returns the
      expected verdicts.
- [x] Implement the individual signals as separately-named internal checks so
      each is testable and each can name itself in `reasons`: prompt length,
      vague-verb match, no file/path/module mention, no acceptance criteria,
      bare-pronoun scope ("this", "it") with no antecedent.
      *Verify:* a prompt tripping exactly one signal reports exactly one reason.
      (Note: bare-pronoun's precondition is `!hasScope`, so it always
      co-occurs with the `no-scope-signal` reason by construction — the other
      four signals each isolate cleanly.)
- [x] Define the default config object inline in `gate.js` (max questions,
      vague verbs, thresholds) and let `opts` shallow-override it. This is the
      seam `phraser.config.json` plugs into in v0.2 — no file reading yet.
      *Verify:* passing `{ vagueVerbs: [] }` flips a verb-only-vague prompt to `fine`.
- [x] Handle degenerate input without throwing: empty string, whitespace only,
      very long prompt, non-string. Never throw — spec §1 requires the gate
      never block a prompt.
      *Verify:* each degenerate input returns a well-formed verdict object.

## M3 — Golden-prompt fixtures & gate tests

- [x] Create `tests/golden-prompts/fixtures.json`: 30–50 prompts, each
      `{ id, prompt, expected: "vague" | "fine", note }`. Draft realistic
      Claude Code prompts, not toy sentences. **Author review of the labels is
      a required step before this is committed.**
      *Verify:* file parses; counts are roughly balanced between the two labels.
      (44 fixtures, 22/22 split. Author-reviewed and approved 2026-09-08.)
- [x] Write `tests/gate.test.js`: one `node:test` case per fixture, asserting
      `gate(prompt).verdict === expected`, with the failure message printing
      the prompt, expected, actual, and `reasons`.
      *Verify:* `npm test` runs all fixtures; every one passes.
      (First run: 6 failures, all vague-labeled prompts scoring "fine" — see
      commit for the gate.js tuning that fixed them without touching labels.)
- [x] Add targeted unit tests (separate from fixtures) for degenerate input and
      for `opts` overriding defaults.
      *Verify:* `npm test` passes; deliberately breaking one signal in `gate.js`
      makes a specific, readable test fail.
      (Confirmed: forcing checkHasScope() to always return true broke both a
      fixture case and the opts.weights unit test with a clear assertion
      message. Reverted after confirming.)
- [x] Add the hard cases: prompts that *look* vague but are fine (short but
      precise, e.g. "bump the version in package.json to 0.2.0") and prompts
      that look fine but are vague (long, file-mentioning, but with no
      definition of done).
      *Verify:* these are labeled in fixtures and passing — tune the gate, not
      the labels, to make them pass.
      (Already covered by the original fixture set: fine-02 (short-but-precise),
      vague-21/vague-22 (long, file-mentioning, no acceptance criteria). All
      three pass under the current gate.js.)

## M4 — The skill (`skills/phraser-expand/SKILL.md`)

- [x] Write the SKILL.md frontmatter: name, and a `description` written as a
      trigger condition (when Claude should load it), not a summary.
      Do **not** pin a model — spec §5 requires inheriting the session's model.
      *Verify:* `claude plugin validate .` passes; the skill appears in the
      available-skills list with `--plugin-dir .`.
      (Confirmed as phraser:phraser-expand in the model's own skill listing;
      component inventory shows Skills (1).)
- [x] Write the core decision procedure from spec §4: restate in one line →
      ask only if scope or done-ness is genuinely unclear → never ask about
      subjective defaults, state the assumption instead → hard cap of 3
      questions → after one round, proceed with stated assumptions.
      *Verify:* read it cold against three fixture prompts and check the
      procedure gives an unambiguous answer for each.
      (Live-tested against vague-06 "add auth", vague-13 "the deploy is
      broken", vague-09 "run the linter and fix issues" via
      `claude --plugin-dir .` — three distinct, well-reasoned outcomes, each
      grounded in this repo's actual CLAUDE.md/git-diff/config state.)
- [x] Define the two output shapes explicitly, with a worked example of each:
      (a) ≤3 clarifying questions, (b) the structured expansion — goal /
      constraints / files in scope / done-when.
      *Verify:* both examples are concrete, from a real fixture prompt, not
      placeholder text.
      (Shape A uses vague-06 "add auth" verbatim; shape B uses vague-15
      "clean up the styling in this component" verbatim.)
- [x] Document the context the skill should pull from before asking anything:
      CLAUDE.md, recently touched files, current git diff — so it never asks
      about something already visible in session.
      *Verify:* run against a vague prompt in a repo with a CLAUDE.md and
      confirm the questions do not re-ask anything CLAUDE.md answers.
      (Live-tested: scratch dir with a CLAUDE.md stating auth approach + user
      model; "add auth" through the skill correctly skipped both and asked
      only the one remaining genuine gap, route scope.)

## M5 — The `/phraser` command

- [x] Replace the M1 placeholder `commands/phraser.md` with the real command:
      takes the rough idea as arguments, invokes the `phraser-expand` skill,
      returns questions or the sharpened prompt.
      *Verify:* `claude --plugin-dir . --print "/phraser:phraser make auth better"`
      returns clarifying questions.
- [x] Handle the no-argument case (`/phraser` alone) — operate on the previous
      user message, or ask for the idea. Pick one and document it.
      *Verify:* the bare invocation does something useful rather than erroring.
      (Chose "ask for the idea" — documented inline in commands/phraser.md.
      A fresh --print session has no reliable prior message to fall back to;
      asking is the safer default. Verified live: bare /phraser:phraser
      returns "What rough prompt would you like me to sharpen?" rather than
      erroring or guessing.)
- [x] Ensure a well-formed prompt passed to `/phraser` produces the structured
      expansion and **no** questions — manual invocation must not manufacture
      ambiguity to justify itself.
      *Verify:* `/phraser:phraser` on three `expected: "fine"` fixtures asks zero
      questions.
      (fine-02, fine-05, fine-15 — chosen because they reference real files in
      this repo — all produced full structured expansions with zero
      questions. Note: fine-06 "Delete the unused scripts/old-gate.js" was
      tried first and correctly asked a question, because that file doesn't
      actually exist in this repo — the fixture's premise is fictional, not
      a gate/skill defect. Swapped in fine-15 instead.)

## M6 — Headless skill-level test harness

- [x] Write `tests/skill.test.js` driving `claude --print` with `--plugin-dir .`
      against a small subset (~5) of fixture prompts, asserting the output
      contains either a clarifying question or a structured expansion — never
      raw passthrough.
      *Verify:* passes locally against a live `claude` binary.
      (Named tests/skill.headless.js instead — see M6 task 3's split-scripts
      note for why. All 5/5 pass live: vague-01, vague-06, fine-02, fine-05,
      fine-15.)
- [x] Make these tests skip cleanly (not fail) when the `claude` binary is
      absent or unauthenticated, so `npm test` stays green for contributors
      without a session.
      *Verify:* `PATH=/usr/bin npm test` skips them and still exits 0.
      (hasClaudeCli() checks `claude --version` then `claude auth status`;
      each test case gets `{ skip }`. Verified with PATH restricted to
      node's own bin dir + /usr/bin:/bin — 5/5 skipped, 0 failed, exit 0.)
- [x] Split the scripts: `npm test` = fast unit/gate tests only;
      `npm run test:skill` = the headless harness.
      *Verify:* both scripts run and do what their names say.
      (`test` globs `tests/**/*.test.js`, which does not match
      `skill.headless.js` — confirmed: 60/60 fast tests, ~50ms, no live
      calls. `test:skill` runs skill.headless.js explicitly — the identical
      command already verified live 5/5 pass in the task-1 check above.)

## M7 — CI

- [ ] Add `.github/workflows/ci.yml`: on push and PR, Node 20, checkout,
      `claude plugin validate .`, `npm test`.
      *Verify:* green run on a pushed branch.
- [ ] Decide and document how CI treats the skill-level tests — expected to be
      skipped (no credentials on a public runner). Leave a comment in the
      workflow saying so, so a contributor isn't confused by the skip.
      *Verify:* the CI log shows skips, not failures, and the run is green.

## M8 — Docs

- [ ] Write `README.md` in the spec §7 order: problem → before/after example →
      install command → what v0.1 does and does not do (state plainly that
      auto-trigger is v0.2) → contributing.
      *Verify:* a reader who has never seen the repo can install and run
      `/phraser` from the README alone, with no other file open.
- [ ] Use a real before/after transcript in the README, captured from an actual
      run — not an invented one.
      *Verify:* the transcript reproduces when re-run.
- [ ] Add `CHANGELOG.md` with a `0.1.0` entry (Keep a Changelog format).
      *Verify:* version matches `plugin.json` and `package.json`.
- [ ] Record the GIF for the README (§7) and embed it. **Requires the author —
      not automatable.**
      *Verify:* the GIF renders on GitHub, not just locally.

## M9 — Release

- [ ] Cross-surface smoke test (§6): the same 5 prompts once each in CLI,
      VS Code extension, and Desktop Code tab. **Manual, author-run.** Note
      any divergence in an issue rather than silently patching.
      *Verify:* all three surfaces produce comparable output; results recorded.
- [ ] Confirm version consistency across `plugin.json`, `package.json`, and
      `CHANGELOG.md`, then tag `v0.1.0`.
      *Verify:* `git tag` shows the tag; CI is green on the tagged commit.

---

## Explicitly deferred (not v0.1)

- `hooks/hooks.json` and `UserPromptSubmit` auto-triggering → v0.2
- `phraser.config.json` as a user-editable file → v0.2 (the `opts` seam in
  `gate.js` is where it lands)
- Project-specific checklists / extensible vague-verb lists → v0.3
