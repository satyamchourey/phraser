# Phraser — Project Spec v0.1

A Claude Code plugin that catches vague prompts, asks 1–3 sharp clarifying
questions when genuinely needed, and rewrites the prompt into a precise,
context-aware instruction before Claude acts on it.

---

## 1. Problem & Goals

**Problem:** Developers (including experienced ones) often type under-specified
prompts into Claude Code — "fix this," "make it better," "add auth" — and get
back plausible-but-wrong work because Claude filled the gaps with assumptions
instead of asking.

**Goals**
- Detect genuine ambiguity before Claude commits to an interpretation.
- Ask the *minimum* number of clarifying questions — never a form to fill out.
- When no clarification is needed, silently expand the prompt with structure
  (goal / constraints / files in scope / acceptance criteria) pulled from
  context already available (CLAUDE.md, recently touched files, git diff).
- Cost near-zero tokens on well-formed prompts. Never block a prompt from
  going through if something errors.

**Non-goals (v0.1)**
- Not a general chat assistant or code reviewer.
- Not trying to replace Plan Mode — Phraser runs *before* planning, on the
  prompt itself.
- Not multi-turn prompt coaching — one clarify round max, then proceed.

---

## 2. How It Works (flow)

```
User types prompt
      │
      ▼
[Heuristic gate — local, no LLM call]
  - length, vague-verb list, missing scope signals,
    no file/path mentioned, no acceptance criteria
      │
      ├── looks fine ──────────────► pass through unchanged
      │
      └── looks vague
              │
              ▼
      [Skill: phraser-expand]
        - reads CLAUDE.md + recent context already in session
        - decides: ask questions OR expand directly
              │
        ┌─────┴─────┐
        ▼           ▼
  Ask ≤3 short   Expand into structured
  targeted       prompt (goal, constraints,
  questions      files in scope, done-when)
        │           │
        └─────┬─────┘
              ▼
     Final sharpened prompt
     handed to Claude Code
```

---

## 3. Architecture (plugin layout)

```
phraser/
├── .claude-plugin/
│   └── plugin.json
├── skills/
│   └── phraser-expand/
│       └── SKILL.md          # the expansion/clarify logic + checklist
├── commands/
│   └── phraser.md            # manual /phraser invocation
├── hooks/
│   └── hooks.json            # optional UserPromptSubmit auto-trigger
├── scripts/
│   └── gate.js               # local heuristic, no LLM call
├── phraser.config.json       # user-tunable thresholds & toggles
├── tests/
│   ├── gate.test.js          # unit tests for the heuristic
│   └── golden-prompts/       # fixture prompts (vague vs. fine) + expected verdict
├── .github/workflows/ci.yml  # validate + test on every push
├── README.md
└── CHANGELOG.md
```

**Two invocation modes, both included:**
1. **Manual** — `/phraser <rough idea>` — zero automatic overhead, user opts in per-message.
2. **Automatic (optional, off by default)** — a `UserPromptSubmit` hook runs
   `gate.js` locally (regex/heuristics only) and only invokes the
   `phraser-expand` skill when the gate flags a message as vague. Toggle in
   `phraser.config.json`.

`plugin.json` (sketch):
```json
{
  "name": "phraser",
  "version": "0.1.0",
  "description": "Catches vague prompts and sharpens them before Claude acts.",
  "author": { "name": "Satyam Chourey" },
  "skills": ["skills/phraser-expand"],
  "commands": ["commands/phraser.md"],
  "hooks": "hooks/hooks.json"
}
```

`phraser.config.json` (sketch):
```json
{
  "autoTrigger": false,
  "maxClarifyingQuestions": 3,
  "vagueVerbs": ["fix", "improve", "handle", "make better", "clean up"],
  "requireAcceptanceCriteria": false,
  "customChecklist": []
}
```

---

## 4. The clarifying-question logic (in SKILL.md)

Keep this short and opinionated — it's the actual product. Rough shape:

1. Restate what you think the user wants, in one line.
2. If scope is unclear (which files/module), ask.
3. If "done" is undefined (no acceptance criteria, no test expectation), ask.
4. If it's a stylistic/subjective call (naming, structure) Claude can
   reasonably default on, **don't ask** — just state the assumption and proceed.
5. Never ask more than `maxClarifyingQuestions`. If still unclear after that,
   proceed with stated assumptions rather than stall the user.

---

## 5. Which model to use, for what

- **Architecting / writing the spec, SKILL.md logic, and edge-case design**:
  use the top-tier model available in your Claude Code session (Opus-tier) —
  this is reasoning-heavy, low-frequency work, worth the cost.
- **Day-to-day coding, test writing, doc generation**: default mid-tier model
  (Sonnet-tier) — cheaper, fast, plenty for scaffolding and iteration.
- **The plugin's own runtime skill** (what fires when a user hits a vague
  prompt) should NOT hardcode a specific model — let it inherit whatever
  model the user's session is already running, so Phraser doesn't add a
  second model's latency/cost on top of the session's own.

---

## 6. Testing strategy ("Claude-owned")

- **Golden-prompt tests**: a fixture folder of ~30–50 example prompts,
  each hand-labeled "vague" or "fine." `gate.test.js` runs the heuristic
  against all of them and asserts the verdict matches. Have Claude Code
  generate the fixture set and the assertions; you review/edit the labels.
- **Skill-level tests**: run `claude --print "<fixture prompt>"` headlessly
  with the plugin loaded via `--plugin-dir`, capture output, assert it
  either contains a clarifying question or a structured expansion (not raw
  passthrough). Claude Code can write and run this harness itself.
- **CI**: GitHub Actions workflow runs `claude plugin validate .` and the
  test suite on every push/PR — have Claude Code draft the workflow file.
- **Cross-surface smoke test**: manually run the same 5 prompts once each in
  CLI, VS Code extension, and Desktop Code tab before every release, since
  those are the surfaces most likely to diverge in practice.

**Workflow for "fully Claude-owned" building**: work in Plan Mode for each
feature (heuristic gate, skill logic, config, tests, docs) — let Claude Code
draft a plan, review it yourself, then let it implement + write its own tests
+ update README in the same session. You stay the reviewer/approver, not the
typist.

---

## 7. Docs & writing

- README: problem → before/after example (with a GIF) → install command →
  config options → contributing.
- CHANGELOG: keep from v0.1.0, even if just you for now.
- Have Claude Code draft all of these; you edit for voice/accuracy before
  each release.

---

## 8. Versioning / roadmap

- **v0.1**: manual `/phraser` command only, no auto-hook, no config beyond
  defaults. Ship this first — smallest surface to validate the idea.
- **v0.2**: optional `UserPromptSubmit` auto-gate, config file.
- **v0.3**: project-specific checklist support (teams can extend the vague-verb
  list / required fields via their own CLAUDE.md or config).
- **v0.4+**: based on real usage feedback, not before.

---

## 9. Success signals (yours to define, not vanity metrics)

- Plugin installs and runs cleanly on first try for a stranger following only the README.
- You personally keep it enabled after two weeks of real use.
- At least a few GitHub issues/PRs from people who aren't you.
