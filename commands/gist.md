---
description: Sharpen a rough prompt into clarifying questions or a structured instruction before Claude acts on it.
argument-hint: <rough idea>
---

Apply the `phraser-expand` skill's procedure (restate → gather context →
decide → cap at 3 questions → one clarify round) to the rough prompt below,
and produce exactly one of its two output shapes:

- **Clarifying questions**, when scope or "done" is genuinely unclear —
  asked via `AskUserQuestion` if the open points are choice-shaped, or as
  the delimited `PHRASER — CLARIFYING QUESTIONS` block otherwise.
- **The sharpened prompt**, in the delimited `SHARPENED PROMPT` block,
  followed by the approval question.

Then stop. Do not begin implementing the sharpened prompt — not the edits,
not the commands, not a head start on the "obvious" part. This command's
job ends at the block; the work happens only after the user approves in
their next message.

If no rough prompt was given below, ask the user in one line what they'd
like sharpened — don't guess at a prior message, since none may exist in
this session.

Rough prompt: $ARGUMENTS
