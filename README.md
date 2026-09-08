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

```
$ /phraser:gist make auth better
```

(Plugin commands are namespaced `<plugin>:<command>` — the plugin is
`phraser`, the command is `gist`, hence `/phraser:gist`.)

> **Prompt:** `make auth better`
>
> The user wants to improve authentication somehow — but I can't restate it
> with confidence: this repo (`phraser`, a prompt-sharpening plugin) has no
> authentication code, no `CLAUDE.md` conventions, and nothing auth-related
> in the current diff or recent commits. Scope and "done" are both open.
>
> Three things decide how this gets built:
>
> 1. **Where is the auth code?** Nothing in this repo implements
>    authentication — point me at the codebase, module, or file you mean.
> 2. **What does "better" mean here** — security hardening (e.g. token
>    handling, session expiry), the login/signup UX and flow, code
>    cleanup/refactor, or test coverage?
> 3. **What should be true when it's done** — a specific vulnerability
>    closed, a new flow working, tests passing, or something else
>    observable?

That's a real, reproducible transcript (`phraser`'s own repo has no auth
code, so the model correctly can't guess which of those you meant). Compare
a well-formed prompt run the same way:

```
$ /phraser:gist Bump the version in package.json to 0.2.0.
```

> - **Goal:** Set the `version` field in `package.json` from `0.1.0` to `0.2.0`.
> - **Constraints:** Single-field edit — leave formatting, key order, and
>   every other field untouched.
> - **Files in scope:** `package.json` only.
> - **Done when:** `package.json` reads `"version": "0.2.0"` and `npm test`
>   still exits 0.
> - **Assumptions stated:** Plain text edit to the JSON, not `npm version
>   0.2.0`, to avoid the automatic commit and tag that command creates.

No questions — the prompt was already precise, so Phraser just structures it
and gets out of the way.

## Install

Phraser isn't published to a Claude Code plugin marketplace yet (v0.1 is
manual-invocation only — see below). For now:

```
git clone https://github.com/satyamchourey/phraser.git
cd phraser
claude --plugin-dir . plugin validate .   # sanity check
```

Then load it for a session with `--plugin-dir`:

```
claude --plugin-dir /path/to/phraser
```

Inside that session, `/phraser:gist <rough idea>` is available. (To keep
it loaded across sessions without `--plugin-dir` every time, add it to your
Claude Code settings' plugin directories — see `claude plugin --help`.)

## What v0.1 does — and doesn't

**Does:**
- `/phraser:gist <rough idea>` — sharpen a prompt on demand. Zero
  automatic overhead; you opt in per message.
- Either asks up to 3 targeted clarifying questions, or expands the prompt
  into a structured instruction (goal / constraints / files in scope / done
  when / assumptions stated) — never both.
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
