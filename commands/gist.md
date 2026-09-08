---
description: Sharpen a rough prompt into clarifying questions or a structured instruction before Claude acts on it.
argument-hint: <rough idea>
---

Apply the `phraser-expand` skill's procedure (restate → gather context →
decide → cap at 3 questions → one clarify round) to the rough prompt below.
Output only the skill's result — either the clarifying questions or the
structured expansion (goal / constraints / files in scope / done-when /
assumptions stated) — and then stop. Do not begin implementing anything;
that happens only after this command returns.

If no rough prompt was given below, ask the user in one line what they'd
like sharpened — don't guess at a prior message, since none may exist in
this session.

Rough prompt: $ARGUMENTS
