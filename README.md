# Phraser

[![CI](https://github.com/satyamchourey/phraser/workflows/CI/badge.svg)](https://github.com/satyamchourey/phraser/actions)

A Claude Code plugin that catches vague prompts, asks 1–3 sharp clarifying
questions when genuinely needed, and rewrites the prompt into a precise,
context-aware instruction before Claude acts on it.

## The problem

Developers — including experienced ones — often type under-specified prompts
into Claude Code: "fix this," "make it better," "add auth." Claude fills the
gaps with assumptions instead of asking, and the plausible-but-wrong work
that follows costs more time than the question would have.

Phraser puts a short, opinionated check in front of that: restate what you
think is being asked, gather context that's already available (`CLAUDE.md`,
recently touched files, the current git diff), and either ask the smallest
number of questions that actually unblock the work, or expand the prompt
into something precise on its own. Never a form to fill out — at most 3
questions, one round, then proceed.

## Before / after

![Phraser sharpening a vague prompt: a multi-step AskUserQuestion picker (form factor, feature scope, styling), then a delimited SHARPENED PROMPT block, then approval and implementation.](assets/demo.gif)

An interactive session, live: three choice-shaped questions asked via
`AskUserQuestion` (form → functionality → styling), a `SHARPENED PROMPT`
block built from the answers, and approval ("go ahead") before anything
gets built.

```
$ /phraser:gist make auth better
```

(Plugin commands are namespaced `<plugin>:<command>` — the plugin is
`phraser`, the command is `gist`, hence `/phraser:gist`.)

> The user wants to improve authentication somehow — but I can't restate it
> with any confidence. This repo (`phraser`, a prompt-sharpening plugin) has
> **no** authentication code, no `CLAUDE.md` conventions, and nothing
> auth-related in the current diff or recent commits. Scope and "done" are
> both open, so this needs a question rather than an expansion.
>
> ```
> ─── PHRASER — CLARIFYING QUESTIONS ───
>
> 1. Where is the auth code? Nothing in this repo implements authentication —
>    point me at the codebase, module, or file you actually mean.
>
> 2. What does "better" mean here — security hardening (token handling,
>    session expiry, password storage), the login/signup flow and UX,
>    a code cleanup/refactor, or more test coverage?
>
> 3. What should be true when it's done — a specific weakness closed, a new
>    flow working end to end, tests passing, or some other observable signal?
>
> ──────────────────────────────────────
> Reply with your answers and I'll turn them into a sharpened prompt.
> ```

That's a real, reproducible transcript (`phraser`'s own repo has no auth
code, so the model correctly can't guess which of those you meant) — with
the fallback question form shown here since headless sessions have no
`AskUserQuestion` tool; interactively, choice-shaped questions like these
render as a picker instead (see the demo GIF above). Compare a well-formed
prompt run the same way:

```
$ /phraser:gist Bump the version in package.json to 0.2.0.
```

> This prompt is already precise — it names the file and the exact target
> value — so no clarifying questions. Here is the structured version.
>
> ```
> ═══ SHARPENED PROMPT ═══════════════════
>
> **Goal:** Set the `version` field in `package.json` from `0.1.0` to `0.2.0`.
>
> **Files in scope:** `package.json` only.
>
> **Constraints:** Single-field edit — leave formatting, key order,
> indentation, and every other field untouched. No `npm version 0.2.0`
> (that command also writes a commit and a git tag).
>
> **Done when:** `package.json` reads `"version": "0.2.0"` and `npm test`
> still exits 0.
>
> **Assumptions stated (correct me if wrong):**
> - Plain-text edit to the JSON, not the `npm version` command.
> - Out of scope, though they carry the same `0.1.0` string:
>   `package-lock.json` and `.claude-plugin/plugin.json`. Say the word if
>   you want those bumped too.
> - No commit or tag — just the working-tree edit.
>
> ════════════════════════════════════════
> Approved? Reply yes to go ahead, or tell me what to change.
> ```

No questions, and no work begins until you reply — Phraser stops at the
block either way.

## Install

```
claude plugin marketplace add satyamchourey/phraser
claude plugin install phraser@phraser
```

`/phraser:gist <rough idea>` is then available in any session (installs
user-scoped by default; pass `-s project` or `-s local` to scope it
differently — see `claude plugin install --help`).

For local development instead — editing the plugin itself, or trying a
change before it's pushed:

```
git clone https://github.com/satyamchourey/phraser.git
cd phraser
claude --plugin-dir . plugin validate .   # sanity check
claude --plugin-dir .                     # load it for this session only
```

## What v0.1 does — and doesn't

**Does:**
- `/phraser:gist <rough idea>` — sharpen a prompt on demand. Zero
  automatic overhead; you opt in per message.
- Either asks up to 3 targeted clarifying questions, or hands back a
  delimited `SHARPENED PROMPT` block — goal, done-when, and assumptions
  always present, the middle sections shaped to the task (an edit gets
  constraints and files in scope; a from-scratch build gets deliverable,
  functionality, out-of-scope) — and waits for explicit approval before
  anything is built.
- Pulls context (`CLAUDE.md`, recently touched files, `git diff`) before
  asking anything, so it never re-asks something already answered.

**Doesn't (yet):**
- **No automatic triggering.** There's no `UserPromptSubmit` hook wired up —
  every under-specified prompt you type without running `/phraser:gist` goes
  straight through to Claude, as if Phraser weren't installed. The
  heuristic gate that would power that (`scripts/gate.js`) is built and
  tested, just not wired to anything yet.
- **No config file.** `phraser.config.json` doesn't exist yet; the gate's
  defaults (vague-verb list, thresholds) are hardcoded.
- **No project-specific checklists.**

Both are planned for v0.2 and v0.3 respectively — see `phraser-project-spec.md`
for the full roadmap. v0.1 is deliberately the smallest surface that
validates the idea: does asking 1–3 sharp questions, or silently
structuring a vague prompt, actually produce better outcomes than letting
Claude guess?

## Contributing

```
npm install
npm test          # fast: gate heuristic + unit tests, no network/auth needed
npm run test:skill  # slower: drives a real `claude --print` session; needs
                     # an authenticated `claude` CLI, skips cleanly without one
claude plugin validate . --strict
```

- `scripts/gate.js` is a pure function (`gate(prompt, opts)` → `{ verdict,
  reasons }`) — no I/O, never throws. Its golden-prompt fixtures live in
  `tests/golden-prompts/fixtures.json`; if you add a fixture, tune the gate
  to match it rather than relabeling a hard case to make it pass.
- `skills/phraser-expand/SKILL.md` is the actual decision logic — keep it
  short and opinionated per its own stated non-goals: one clarify round
  max, never a form to fill out.
- `PLAN.md` tracks the v0.1 build task-by-task, in dependency order, if
  you want to see how this was put together.

Issues and PRs welcome.
