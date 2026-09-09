# Phraser v0.1 — Build Plan

Ordered, dependency-sorted task list for shipping v0.1. Every task is small
enough to finish in one sitting, verifiable on its own, and safe to commit
alone. Work top to bottom; within a milestone, tasks assume the ones above
them are done.

## Scope decisions (read first)

The spec has one internal conflict: §3 says "two invocation modes, both
included," while §8 scopes v0.1 to "manual `/phraser:gist` command only, no
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
      (Superseded during M7: neither a bare directory path nor a `**` glob
      works identically across Node 20 and Node 24 — see M7's CI-failure
      note. `test` now lists test files explicitly, which is portable across
      both.)
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
- [x] Add a placeholder `commands/gist.md` (frontmatter + one-line body) so
      the plugin loads with a real command registered.
      *Verify:* `claude --plugin-dir . --print "/phraser:gist hello"` returns
      without an unknown-command error. (Note: headless `--print` invocation of
      a plugin command requires the `<plugin>:<command>` qualified form — the
      bare command name is not resolved outside an interactive session.
      Confirmed against Claude Code CLI 2.1.263.)

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

## M5 — The `/phraser:gist` command

- [x] Replace the M1 placeholder `commands/gist.md` with the real command:
      takes the rough idea as arguments, invokes the `phraser-expand` skill,
      returns questions or the sharpened prompt.
      *Verify:* `claude --plugin-dir . --print "/phraser:gist make auth better"`
      returns clarifying questions.
- [x] Handle the no-argument case (`/phraser:gist` alone) — operate on the previous
      user message, or ask for the idea. Pick one and document it.
      *Verify:* the bare invocation does something useful rather than erroring.
      (Chose "ask for the idea" — documented inline in commands/gist.md.
      A fresh --print session has no reliable prior message to fall back to;
      asking is the safer default. Verified live: bare /phraser:gist
      returns "What rough prompt would you like me to sharpen?" rather than
      erroring or guessing.)
- [x] Ensure a well-formed prompt passed to `/phraser:gist` produces the structured
      expansion and **no** questions — manual invocation must not manufacture
      ambiguity to justify itself.
      *Verify:* `/phraser:gist` on three `expected: "fine"` fixtures asks zero
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

- [x] Add `.github/workflows/ci.yml`: on push and PR, Node 20, checkout,
      `claude plugin validate .`, `npm test`.
      *Verify:* green run on a pushed branch.
      (First pushed run FAILED at the "npm test" step: node --test's glob
      support for `tests/**/*.test.js` — verified locally on Node 24 — does
      not exist on Node 20 ("Could not find ..."), while Node 20's bare-
      directory discovery in turn throws on Node 24. Reproduced locally via
      nvm before touching CI. Fixed by listing test files explicitly in
      package.json's `test` script, which is identical on both. Re-pushed;
      run went green — see run history.)
- [x] Decide and document how CI treats the skill-level tests — expected to be
      skipped (no credentials on a public runner). Leave a comment in the
      workflow saying so, so a contributor isn't confused by the skip.
      *Verify:* the CI log shows skips, not failures, and the run is green.
      (Decision: run npm run test:skill in CI rather than omit it, so the
      skip is asserted, not just assumed — comment explaining why is inline
      in ci.yml. Confirmed on the green run: "Run skill-level tests" step
      succeeded (5/5 skipped, no claude auth on the runner), full run
      conclusion "success". https://github.com/satyamchourey/phraser/actions/runs/34218229108)

## M8 — Docs

- [x] Write `README.md` in the spec §7 order: problem → before/after example →
      install command → what v0.1 does and does not do (state plainly that
      auto-trigger is v0.2) → contributing.
      *Verify:* a reader who has never seen the repo can install and run
      `/phraser:gist` from the README alone, with no other file open.
      (Uses the verified `/phraser:gist` qualified form throughout, not
      the bare command name — see M1's finding. Verified end-to-end: fresh `git
      clone` of the real pushed repo into a scratch dir, README's exact
      commands run unmodified — `claude --plugin-dir . plugin validate .`,
      then `claude --plugin-dir . --print "/phraser:gist Bump the
      version..."` — produced a correct structured expansion.)
- [x] Use a real before/after transcript in the README, captured from an actual
      run — not an invented one.
      *Verify:* the transcript reproduces when re-run.
      (Both transcripts (vague "make auth better" -> 3 questions; fine
      "Bump the version..." -> structured expansion) are copy-pasted from
      real `claude --plugin-dir . --print` runs, re-run once to confirm the
      same shape/behavior reproduces — not byte-identical, since it's
      model-generated text, but consistently correct.)
- [x] Add `CHANGELOG.md` with a `0.1.0` entry (Keep a Changelog format).
      *Verify:* version matches `plugin.json` and `package.json`.
      (All three: 0.1.0. Confirmed via grep.)
- [x] Record the GIF for the README (§7) and embed it. **Requires the author —
      not automatable.**
      *Verify:* the GIF renders on GitHub, not just locally.
      (`assets/demo.gif`, 6.7MB — a live interactive session showing the
      real `AskUserQuestion` picker flow (form → functionality → styling
      questions), the `SHARPENED PROMPT` block, and approval before
      implementation. Embedded at the top of "Before / after". Re-captured
      both before/after transcripts live against the post-M10 skill while
      doing this — the ones written in M8 predated M10's delimited-block/
      approval contract entirely and no longer matched actual output.
      Also loosened SKILL.md's "always the same five sections" rule to
      "task-shaped sections, goal/done-when/assumptions always present" —
      the demo itself showed the model reasonably using different section
      names for a from-scratch build (Deliverable/Functionality/UI/Out of
      scope) than the fixed list assumed, and that adapted output reads
      better, not worse.
      Confirmed rendering on GitHub after push (c26eaec): raw.githubusercontent.com
      serves the asset 200 image/gif, and the README's content on GitHub
      references it at the correct relative path. CI green on the push.)

## M9 — Release

- [ ] Cross-surface smoke test (§6): the same 5 prompts once each in CLI,
      VS Code extension, and Desktop Code tab. **Manual, author-run.** Note
      any divergence in an issue rather than silently patching.
      *Verify:* all three surfaces produce comparable output; results recorded.
      **Explicitly skipped for v0.1 — author's call (2026-09-09).** Left
      unchecked rather than marked done: this did not happen, and the plan
      should say so plainly rather than imply it was run. Worth doing
      before the next release if VS Code/Desktop divergence turns out to
      matter in practice.
- [x] Confirm version consistency across `plugin.json`, `package.json`, and
      `CHANGELOG.md`, then tag `v0.1.0`.
      *Verify:* `git tag` shows the tag; CI is green on the tagged commit.
      (0.1.0 consistent across all three (CHANGELOG restructured — see the
      commit above — so it's no longer contradicted by a dangling
      Unreleased section). Annotated tag `v0.1.0` created on `6fee700` and
      pushed. `git tag` lists it. The tag push triggered its own CI run
      (event: push, ref v0.1.0, sha 6fee700) — conclusion: success.
      https://github.com/satyamchourey/phraser/releases/tag/v0.1.0)

---

## M10 — Command rename + clarify/approve UX

Added after live testing of the v0.1 skill surfaced three problems: no clear
boundary between "answering Phraser" and "talking to Claude"; the final
sharpened prompt not visually set apart or explicitly approved; and the
awkward `/phraser:phraser` stutter.

**Naming note:** this milestone renames the command `phraser` → `gist`, so
invocation becomes `/phraser:gist`. Every reference in this file has been
updated to the new name, but all M1–M9 verifications recorded above were
originally run under the old `/phraser:phraser` name. (The *skill* is still
`phraser-expand`, i.e. `phraser:phraser-expand` — only the command was
renamed.)

**Answer-routing decision (task 4):** Claude Code has no structured
multi-turn form input for slash commands. It does have `AskUserQuestion`,
which returns the answer *inside the same turn* — but that tool exists only
in interactive sessions, not in `--print`/headless (verified: a headless
plugin-loaded session lists 25 tools and `AskUserQuestion` is not among
them). So the skill prefers the tool when questions are choice-shaped and
falls back to a delimited prose block otherwise. Rejected alternatives:
re-invoking the command with the answer (works everywhere but loses the
question context and adds friction), and prose framing alone (zero friction
but leaves routing a convention rather than a mechanism — the original
complaint).

- [x] Rename `commands/phraser.md` → `commands/gist.md`; update
      `.claude-plugin/plugin.json`.
      *Verify:* `claude plugin validate . --strict` passes; `/phraser:gist
      hello` resolves; `/phraser:phraser` no longer does.
      (All three confirmed; old name returns "Unknown command".)
- [x] Update `tests/skill.headless.js` to invoke `/phraser:gist`.
      *Verify:* `npm run test:skill` passes 5/5 live; `npm test` unaffected
      (60/60).
      (First run: 4/5, with fine-15 failing ETIMEDOUT at exactly 60s — a
      latent bug in M6's harness, not the rename: that fixture took 52.9s
      back in M6, so the 60s budget never had headroom. Raised the per-call
      budget to 180s and made a timeout report itself as a latency failure
      rather than a bare stack trace. Re-run: 5/5, with fine-15 taking 83.5s
      — beyond the old cap, confirming the fix was necessary.)
- [x] Update every remaining reference to the old command name: `README.md`,
      `CHANGELOG.md`, `skills/phraser-expand/SKILL.md`, this file, and
      `phraser-project-spec.md`.
      *Verify:* grep for `phraser:phraser` and bare `/phraser ` finds no
      stale command references outside this milestone's naming note.
      (Confirmed: the only remaining `phraser:phraser` hits are the four in
      M10 that intentionally document the rename. `phraser:phraser-expand`
      is deliberately untouched — the skill was not renamed. Two PLAN.md
      notes about *bare-name* resolution were reworded to be name-agnostic,
      since the bare form is now `/gist`, and the README's namespacing
      aside was rewritten — it claimed plugin and command were "both named
      phraser", which the rename made false.)
- [ ] Add an answer-routing section to SKILL.md: prefer `AskUserQuestion`
      when questions are choice-shaped (≤3 questions, 2–4 options each,
      "Other" carries free text); fall back to a delimited
      `PHRASER — CLARIFYING QUESTIONS` block when any question is genuinely
      open-ended **or** the tool is unavailable. Phrase it conditionally so
      the headless path never references a tool that isn't there.
      *Verify:* a headless run on a vague fixture still returns a question
      block (exercises the fallback, since the tool is absent there). The
      interactive `AskUserQuestion` path cannot be verified headlessly —
      it folds into M9's cross-surface smoke test.
      (Verified on vague-13 "the deploy is broken": emitted the delimited
      PHRASER — CLARIFYING QUESTIONS block with the closing "reply with
      your answers" line. It picked the fallback for the right reason too —
      one of its three questions was "paste the error", which has no honest
      multiple-choice form.)
- [ ] Rework output shape B in SKILL.md: a delimited `SHARPENED PROMPT`
      block (goal / constraints / files in scope / done when / assumptions
      stated), then an explicit prose approval ask ("Approved? Reply yes, or
      tell me what to change"), then stop. Approval is deliberately prose,
      not `AskUserQuestion` — a tool answer would leave the model mid-turn
      holding an "approved", whose likely next move is to start
      implementing, which this skill's non-goals forbid.
      *Verify:* a headless run on a `fine` fixture emits the delimiter and
      the approval line, and attempts no edits.
      (Verified on fine-05: full delimited block with all five sections and
      the approval line; `git status` unchanged afterwards, so nothing was
      edited. Also added an explicit non-goal — the skill never carries out
      the sharpened prompt, even when the work is small and obvious.)
- [x] Update `commands/gist.md`'s body to match the new two-shape contract
      (stop at the block; never implement).
      *Verify:* `/phraser:gist` on a fine fixture ends at the block with the
      approval ask; no implementation begins.
      (Caught a regression from task 4 while verifying: fine-02 and fine-15,
      both previously clean expansions, had started *asking* instead — task
      4's "how to ask" section made asking read as the default path, against
      spec §4's "state the assumption, don't ask". fine-02 was even asking
      "which files?" when the prompt named `package.json` explicitly. Fixed
      by scoping that section to *how* to ask once step 3 has already
      decided one is needed, adding that a named file/value settles scope
      and that visible consequences belong in Constraints or Assumptions,
      and forbidding mechanism narration ("AskUserQuestion isn't available,
      so..."). Both fixtures now expand correctly, with the multi-file
      version drift and the test-rebaselining blast radius demoted to
      flagged assumptions/constraints. No run touched a file.)
- [x] Extend `tests/skill.headless.js` with assertions for the new contract:
      expansions contain the `SHARPENED PROMPT` delimiter and an approval
      line; question outputs remain recognizable.
      *Verify:* `npm run test:skill` passes 5/5 live.
      (First run: 1/5 failed — a test bug, not a skill bug. The patterns
      matched the bare phrases "SHARPENED PROMPT" / "AskUserQuestion"
      anywhere in the output, and running inside phraser's own repo means
      the skill's own context-gathering quotes these files' prose back
      (e.g. summarizing this very test file's docstring). vague-01 asked a
      real, correct question but got flagged because its context summary
      happened to mention "SHARPENED PROMPT block" in passing. Fixed by
      anchoring on the actual block delimiters (═══/───) and narrowing the
      leak check to the specific narration phrasing rather than any mention
      of the tool name. Re-run: 5/5 live; npm test unaffected (60/60).)
- [x] Add an `Unreleased` section to `CHANGELOG.md` covering the rename and
      both behavior changes.
      *Verify:* version stays `0.1.0` and consistent across the three files;
      the section describes all three changes.
      (Confirmed: 0.1.0 unchanged in package.json and plugin.json;
      Unreleased sits above the 0.1.0 entry, covering the rename,
      answer-routing, and sharpened-block/approval changes under one
      Changed heading.
      Superseded at M9 tagging time: since v0.1.0 had never actually
      shipped yet, tagging it with an "Unreleased" section still sitting
      above it would contradict the tag itself. Folded into the [0.1.0]
      entry as "Iterated during development" instead, dated to the actual
      tag date rather than the M8 drafting date.)

---

## M11 — Marketplace readiness

Prompted by "is this ready for marketplace?" A full audit found one real
blocker and several genuine gaps, none of which needed a design decision
except two, both confirmed by the author before starting: MIT LICENSE
(matches package.json's already-declared license), and keeping
`phraser-project-spec.md`/`PLAN.md` in the repo (zero runtime cost — never
loaded by `plugin.json` — and both already intentionally referenced from
README/CHANGELOG).

**The actual blocker, verified empirically, not assumed:** no
`.claude-plugin/marketplace.json` exists. `claude plugin marketplace add`
requires one — confirmed by actually adding a scratch copy of this repo as
a real marketplace, installing `phraser@phraser` from it, and running
`/phraser:gist` with **no `--plugin-dir` flag at all** (the true
marketplace-consumer path). It doesn't work today without this file.

- [x] Add `.claude-plugin/marketplace.json` (name, owner, description, one
      plugin entry with `source: "./"`).
      *Verify:* `claude plugin validate . --strict` passes on the
      marketplace manifest. Full round-trip in a scratch copy: `marketplace
      add` → `plugin install phraser@phraser` → `/phraser:gist <prompt>`
      with no `--plugin-dir` flag → real output, not an error. Clean up the
      test install/marketplace registration afterward.
      (Round-trip run against the real repo itself, not just a scratch
      copy: `claude plugin marketplace add ./ -s local`, `claude plugin
      install phraser@phraser -s local -y`, then `claude --print
      "/phraser:gist ..."` with zero `--plugin-dir` flag — correct
      SHARPENED PROMPT output. [Note: running from an unrelated cwd
      (`/tmp`) failed with "Unknown command" — expected, `--scope local`
      is project-scoped by design, not a bug; re-ran from the project dir.]
      Cleaned up: disabled the plugin, removed the marketplace
      registration, deleted the resulting `.claude/settings.local.json`.)
- [x] Remove `.claude/settings.json` from git tracking; add `.claude/` to
      `.gitignore`. It's local session permission config (`Bash(git
      add:*)`, `Bash(git commit:*)`), not project content — a clone
      shouldn't inherit permission grants from this session.
      *Verify:* `git ls-files` no longer lists it; `git status` clean after
      recreating the file locally (gitignore actually catches it).
      (`git rm --cached` (file kept locally, untracked). `git ls-files`
      confirms zero `.claude/` entries. `git check-ignore -v
      .claude/settings.json` confirms `.gitignore:15 .claude/` catches it.)
- [x] Add `LICENSE` (MIT), matching `package.json`'s already-declared
      license.
      *Verify:* file present, standard MIT text, copyright line matches the
      author name already in `plugin.json`.
      (Standard MIT text, copyright "Satyam Chourey" matching plugin.json's
      author.name, year 2026.)
- [x] Enrich `.claude-plugin/plugin.json` with `repository`, `homepage`,
      `keywords`, `author.email` — validated as real accepted schema
      fields (empirically, against `--strict`), currently missing. Improves
      marketplace-listing trust/discoverability; `claude plugin validate`
      doesn't require them, but a listing without them looks unfinished.
      *Verify:* `claude plugin validate . --strict` still passes; values
      match the real repo (`github.com/satyamchourey/phraser`) and author.
      (Also enriched marketplace.json's plugin entry the same way for
      consistency. Both manifests validated independently — a repo with
      both in one .claude-plugin/ dir only shows the marketplace one when
      validating `.`, so plugin.json was checked in isolation in a scratch
      copy. Re-ran the full round-trip install with the enriched manifests:
      marketplace add → install → /phraser:gist with no --plugin-dir →
      correct output. Cleaned up afterward.)
- [x] Update README's "Install" section: replace "isn't published to a
      marketplace yet" with the real `marketplace add` + `install` flow,
      keeping `--plugin-dir` as a secondary note for local development.
      *Verify:* the new instructions are the literal commands verified in
      task 1's round-trip, not invented ones.
      (Uses `claude plugin marketplace add satyamchourey/phraser` — the
      `owner/repo` GitHub shorthand, not the local `./` form task 1 tested
      — so this specific invocation can only be verified against the live
      pushed repo. Deferred to this milestone's final full re-verification
      pass, after push.)
- [ ] Full re-verification pass: `npm test`, `npm run test:skill` (live),
      `claude plugin validate . --strict` (both manifests), CI green on the
      push.
      *Verify:* all green; no regression from the M11 changes.
- [ ] Add a `CHANGELOG.md` entry, bump `package.json` + `plugin.json` to
      `0.1.1` (marketplace-readiness fixes, no behavior change — patch
      per semver), tag `v0.1.1`.
      *Verify:* version consistent across all three files; `git tag` shows
      `v0.1.1`; CI green on the tagged commit.

---

## Explicitly deferred (not v0.1)

- `hooks/hooks.json` and `UserPromptSubmit` auto-triggering → v0.2
- `phraser.config.json` as a user-editable file → v0.2 (the `opts` seam in
  `gate.js` is where it lands)
- Project-specific checklists / extensible vague-verb lists → v0.3
