# Phraser

[![CI](https://github.com/satyamchourey/phraser/actions/workflows/ci.yml/badge.svg)](https://github.com/satyamchourey/phraser/actions/workflows/ci.yml)

**Sharpen vague Claude Code prompts before Claude acts on them.**

Phraser is a Claude Code plugin. Run `/phraser:gist <rough idea>` on an
under-specified request and it either asks you up to three focused
questions or hands back a structured spec — goal, constraints, files in
scope, and done-when criteria — then waits for your approval before any
code is written.

## Status

- **Open source**, MIT-licensed.
- **Current version: v0.1.1.**
- **Installable** from this repository's GitHub-hosted plugin marketplace —
  see [Install](#install).
- This release focuses on the on-demand `/phraser:gist` workflow. You opt
  in per message; there is zero automatic overhead.
- Automatic prompt interception (a `UserPromptSubmit` hook) is **not** part
  of this release. See [Roadmap](#roadmap).
- Not affiliated with, reviewed by, or endorsed by Anthropic.

## Why it exists

Developers — including experienced ones — often type under-specified
prompts into Claude Code: "fix this," "make it better," "add auth." Claude
fills the gaps with assumptions instead of asking, and the
plausible-but-wrong work that follows costs more time than the question
would have.

Phraser puts a short, opinionated step in front of that moment.

## What happens when you run it

1. **Restate the request** in one line, to surface what is actually being
   asked.
2. **Read the context already available** — `CLAUDE.md`, recently touched
   files, the current `git diff` — so it never asks about something
   already visible in the session.
3. **Either** ask up to **three** focused clarifying questions (about scope,
   or about what "done" means) **or** produce a structured spec directly.
4. The spec captures **goal, constraints, files in scope, and done-when
   criteria**.
5. **Stop and wait for approval.** Phraser does not start implementing on
   its own — you approve the sharpened prompt, and the work begins in your
   next message.

At most one round of questions. Never a form to fill out.

## Before / after

![Phraser sharpening a vague prompt: a multi-step AskUserQuestion picker (form factor, feature scope, styling), then a delimited SHARPENED PROMPT block, then approval and implementation.](assets/demo.gif)

An interactive session, live: three choice-shaped questions (form →
functionality → styling), a `SHARPENED PROMPT` block built from the
answers, and approval ("go ahead") before anything gets built.

Plugin commands are namespaced `<plugin>:<command>`, so the command is
`/phraser:gist` — the plugin is `phraser`, the command is `gist`.

### A vague prompt

```
$ /phraser:gist make auth better
```

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

That is a real, reproducible transcript — `phraser`'s own repo has no auth
code, so the model correctly can't guess which of those you meant. In an
interactive session, choice-shaped questions like these are presented as a
selectable picker (as in the demo GIF above); the plain-text block shown
here is how they appear in a non-interactive (`--print`) session. Either
way, your next reply is read as the answer.

### A well-formed prompt

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

`/phraser:gist <rough idea>` is then available in any session. It installs
user-scoped by default; pass `-s project` or `-s local` to scope it
differently (see `claude plugin install --help`).

## Usage

```
/phraser:gist add rate limiting to the API
/phraser:gist the login page looks off on mobile
/phraser:gist Bump the version in package.json to 0.2.0.
```

Run `/phraser:gist` with no argument and it asks what you'd like sharpened.
Answer any questions it returns; approve the sharpened prompt by replying
"yes" (or say what to change), and Claude proceeds from there.

## Why Phraser, rather than just asking Claude to ask more questions

Phraser is a repeatable, opinionated interaction contract for
under-specified requests, rather than a phrase you retype and that drifts
from one session to the next:

- **A hard cap of three questions**, one round, then it proceeds with
  stated assumptions — it can't turn into an interrogation.
- **Focused questions.** Each one closes a specific gap (which files? what
  does "done" mean?), not a generic "please provide more detail."
- **Repository-aware.** It checks `CLAUDE.md`, recently touched files, and
  the `git diff` first, so it doesn't re-ask what the repo already answers.
- **Structured output** in a consistent shape — goal / constraints / files
  in scope / done-when — set apart in its own block and copy-pasteable on
  its own.
- **An approval boundary.** It stops at the sharpened prompt and waits; it
  does not begin editing, even when the change looks small and obvious.

## Security & privacy

- **Zero runtime dependencies.** `npm install` pulls nothing; the plugin is
  plain Markdown and one small JavaScript file.
- **No external service, no API key, no MCP server.** Phraser adds none of
  its own. The sharpening itself is performed by the same Claude model
  already running your session.
- **No network access of its own.** The heuristic in `scripts/gate.js` is a
  pure local function — no filesystem or network I/O, no `process` access.
- **Repository context it may read while sharpening a prompt:** your
  `CLAUDE.md` file(s), files touched recently in the session, and the
  current `git diff` / recent commits — the same context Claude Code
  already has available in that session. That context is handled by your
  Claude Code session exactly as any other prompt content; Phraser itself
  transmits nothing anywhere.

## What this release does — and doesn't

**Does:**

- `/phraser:gist <rough idea>` — sharpen a prompt on demand, opt-in per
  message, with zero automatic overhead.
- Either asks up to 3 targeted clarifying questions, or returns a delimited
  `SHARPENED PROMPT` block — goal, done-when, and assumptions always
  present; the middle sections shaped to the task (an edit gets constraints
  and files in scope; a from-scratch build gets deliverable, functionality,
  out-of-scope) — then waits for explicit approval before anything is built.
- Pulls context (`CLAUDE.md`, recently touched files, `git diff`) before
  asking anything, so it never re-asks something already answered.

**Doesn't yet:**

- **No automatic triggering.** There is no `UserPromptSubmit` hook wired
  up. Any under-specified prompt you type without running `/phraser:gist`
  goes straight through to Claude, as if Phraser weren't installed. The
  heuristic gate that would power auto-triggering (`scripts/gate.js`) is
  built and tested, just not connected to anything yet.
- **No config file.** `phraser.config.json` does not exist yet; the gate's
  defaults (vague-verb list, thresholds) are hardcoded.
- **No project-specific checklists.**

## Roadmap

- **v0.2** — an optional `UserPromptSubmit` auto-gate and a
  `phraser.config.json` for tuning the gate.
- **v0.3** — project-specific checklist support.

`scripts/gate.js` already implements and tests the heuristic that
auto-triggering will use; it just isn't wired to a hook. See
`phraser-project-spec.md` for the full plan.

## Developing

```
npm install
npm test            # fast: gate heuristic + unit tests, no network/auth needed
npm run test:skill  # slower: drives a real `claude --print` session; needs an
                    # authenticated `claude` CLI, skips cleanly without one
claude plugin validate . --strict
```

To iterate on the plugin locally without installing it from the
marketplace:

```
git clone https://github.com/satyamchourey/phraser.git
cd phraser
claude --plugin-dir . plugin validate .   # sanity check
claude --plugin-dir .                     # load it for this session only
```

- `scripts/gate.js` is a pure function (`gate(prompt, opts)` → `{ verdict,
  reasons }`) — no I/O, never throws. Its golden-prompt fixtures live in
  `tests/golden-prompts/fixtures.json`; if you add a fixture, tune the gate
  to match it rather than relabeling a hard case to make it pass.
- `skills/phraser-expand/SKILL.md` is the actual decision logic — keep it
  short and opinionated per its own stated non-goals: one clarify round
  max, never a form to fill out.
- `PLAN.md` tracks the v0.1 build task-by-task, in dependency order.

Issues and PRs welcome.
