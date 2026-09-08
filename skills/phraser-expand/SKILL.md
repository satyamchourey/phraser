---
name: phraser-expand
description: Use when a user's prompt is vague or under-specified — a generic verb with no clear target (fix, improve, handle, clean up, make better), no file/module/scope named, or no definition of what "done" looks like. Sharpens the prompt into either a short round of clarifying questions or a structured instruction (goal, constraints, files in scope, done-when) before any work begins. Triggered by the local heuristic gate (scripts/gate.js) flagging a prompt "vague", or by the user invoking /phraser:gist directly.
---

# phraser-expand

Turn a vague prompt into either a short, targeted question or a precise
instruction — never both, never a form to fill out. This skill inherits
whatever model is already running the session; it does not pin its own.

## Procedure

Do these in order. Do not skip step 1.

1. **Restate the goal in one line.** Before deciding anything else, write
   one sentence for yourself: "The user wants to ___." If you can't fill
   that in with any confidence, the prompt needs a question, not an
   expansion — say so in the restatement and move to step 3 knowing scope
   is the open question.

2. **Gather context already available before judging anything unclear.**
   Check, in this order, and use whatever you find:
   - `CLAUDE.md` (or nested `CLAUDE.md` files) — project conventions,
     architecture, and stated preferences.
   - Recently touched files in the session — a bare pronoun ("this",
     "it") often resolves to whatever was just open or just edited.
   - The current `git diff` / recent commits — signals what's actively
     in flight and what the prompt likely refers to.

   Never ask about something this context already answers. If context
   resolves the *entire* ambiguity, skip straight to the expansion (step 5)
   and cite what you used instead of asking.

3. **Decide what's actually unclear, after context-gathering:**
   - **Scope is unclear** — no file, module, or area named or resolvable
     from context → candidate for a question.
   - **"Done" is undefined** — no acceptance criteria, no test
     expectation, no observable success condition, and none is inferable
     from context → candidate for a question.
   - **It's a stylistic or structural call** (naming, formatting,
     internal code structure, which of several reasonable approaches) that
     you can reasonably default on → **do not ask.** State the assumption
     in the expansion instead and proceed.

4. **Cap questions at 3.** If more than 3 things are genuinely unclear
   after steps 2–3, ask only the 3 most blocking ones (the ones where a
   wrong guess would waste the most work) and state assumptions for the
   rest in the expansion that follows the user's answer.

5. **One clarify round, then proceed.** This is not multi-turn
   coaching. After the user answers (or if you've already asked once this
   task), move to the expansion — filling remaining gaps with stated
   assumptions rather than asking again.

## Output shape A — clarifying questions

Used when scope or done-ness is genuinely unclear even after gathering
context. At most 3 questions, each one closing a real gap — not a
checklist.

### How to ask: route the answer back into this flow

**This section is only about *how* to ask once step 3 has already
established that a question is genuinely needed. It is not a reason to
ask.** The default is still shape B. In particular:

- If the user named a file, a value, or a target, that settles scope.
  Anything about *neighbouring* files or wider blast radius is an
  assumption to state in shape B — not a question. "Bump the version in
  `package.json` to 0.2.0" is finished as written; that other files
  carry the same string is a line in **Assumptions stated**, not a
  question about which files to touch.
- Consequences you can see and the user hasn't ruled on (a test that will
  need re-baselining, a lockfile that drifts) go in **Constraints** or
  **Assumptions stated**, flagged for correction. Only ask when getting
  it wrong would waste real work *and* you cannot pick a defensible
  default.

Never narrate the mechanism — no "AskUserQuestion isn't available, so
here it is in prose". Just ask.

Two ways to ask, in order of preference:

1. **Use the `AskUserQuestion` tool** when the open points are
   choice-shaped — that is, when you can offer genuinely distinct, plausible
   options rather than inventing filler. The user's selection returns inside
   this same turn, so you continue straight to shape B without the answer
   ever looking like a fresh message. Fits this skill's limits naturally:
   at most 3 questions, 2–4 options each, and the automatic "Other" choice
   carries free-text when none of the options fit.

2. **Fall back to a delimited prose block** when either the tool is
   unavailable (it does not exist in headless / `--print` sessions) **or**
   at least one question is genuinely open-ended, where options would be
   invented filler — "paste the error you're seeing" has no good multiple
   choice. Prefer one coherent interaction: if any question needs prose,
   ask them all in prose rather than splitting across both mechanisms.

   Frame the block so it's unmistakably a question *from this skill*, and
   say plainly that the next reply is read as the answer:

   ```
   ─── PHRASER — CLARIFYING QUESTIONS ───
   <the questions>
   ──────────────────────────────────────
   Reply with your answers and I'll turn them into a sharpened prompt.
   ```

Either way, ask once. Do not chain a second round (procedure step 5).

> **Prompt:** `add auth`
>
> You want to add authentication to the project. Three things change how
> this gets built:
>
> 1. Session-based, JWT, or an existing provider (Auth0, Clerk, etc.)?
> 2. Which routes or pages need to be protected — all of them, or specific
>    ones?
> 3. Is there an existing user model/database to hook into, or does this
>    start from scratch?

All three are choice-shaped, so this one is a good `AskUserQuestion` call
— options like "session-based / JWT / existing provider" are real
alternatives, not filler.

If a `CLAUDE.md` in that same repo already stated "session-based auth via
Passport.js; user model at `src/db/models/user.js`," questions 1 and 3
are already answered — don't ask them. Only question 2 would remain,
so this becomes a single targeted question, not three.

## Output shape B — the sharpened prompt

The end product, reached either directly (nothing needed asking) or after
one round of shape A. Always the same five sections.

Set it apart from ordinary conversation with the delimiters below — this
block is the deliverable, and it should be obvious at a glance where it
starts and ends, and copy-pasteable on its own. Then ask for approval and
**stop**.

```
═══ SHARPENED PROMPT ═══════════════════

**Goal:** …
**Constraints:** …
**Files in scope:** …
**Done when:** …
**Assumptions stated:** …

════════════════════════════════════════
Approved? Reply yes to go ahead, or tell me what to change.
```

The approval line is deliberately plain prose, not `AskUserQuestion`:
answering through a tool would leave you mid-turn holding an "approved",
and the natural next move from there is to start building — which is
exactly what this skill must not do. A prose question ends the turn, so
the work only begins when the user actually sends the next message.

> **Prompt:** `clean up the styling in this component`
> **Context used:** git diff shows `src/components/Card.jsx` as the only
> file with uncommitted changes this session — resolves "this component".
>
> ═══ SHARPENED PROMPT ═══════════════════
>
> **Goal:** Clean up the styling in `src/components/Card.jsx`.
> **Constraints:** Styling-only pass — preserve the existing props API
> and visual behavior; not a redesign.
> **Files in scope:** `src/components/Card.jsx` and its co-located
> stylesheet, if one exists.
> **Done when:** No functional or visual regressions; class names and
> structure match the convention used by sibling components in
> `src/components/`.
> **Assumptions stated:** "Clean up" read as consolidating duplicated
> class names and removing dead styles, not a visual redesign — a
> structural call within reasonable discretion (step 3), not something
> worth a question.
>
> ════════════════════════════════════════
> Approved? Reply yes to go ahead, or tell me what to change.

## What this skill does not do

- It does not re-run the heuristic gate — by the time this skill is
  loaded, something has already decided the prompt is worth a closer
  look (the gate, or a direct `/phraser:gist` invocation).
- It does not chain further clarify rounds. One round, then proceed.
- It does not invent scope the user didn't imply. An assumption stated
  in the expansion should be the smallest reasonable reading of the
  prompt, not the most ambitious one.
- **It does not carry out the sharpened prompt.** The job ends at the
  SHARPENED PROMPT block and the approval question — no edits, no
  commands, no "and I've gone ahead and started". Even when the work is
  obvious and small, stop there and let the user approve first.
