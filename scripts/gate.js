/**
 * Local heuristic "is this prompt vague?" gate.
 *
 * Pure, synchronous, and side-effect free: no filesystem or network I/O, no
 * `process` access, no LLM call. Given the same prompt and options it always
 * returns the same verdict. This is the fast, free pre-filter described in
 * spec section 2 — it runs before the `phraser-expand` skill is ever loaded,
 * and it must never throw, since a thrown error here would block a prompt
 * from reaching Claude at all (spec section 1: "Never block a prompt from
 * going through if something errors").
 *
 * Not wired to any caller yet in v0.1 — see PLAN.md M0 scope decision. The
 * `opts` parameter is the seam `phraser.config.json` plugs into in v0.2.
 */

/** Signals below this score are "fine"; at or above, "vague". */
const DEFAULT_THRESHOLD = 3;

/** Prompts shorter than this many words trip the tooShort signal. */
const DEFAULT_MIN_WORDS = 4;

/** Prompts longer than this are truncated before analysis (ReDoS/perf guard). */
const MAX_ANALYZED_LENGTH = 5000;

const DEFAULT_CONFIG = Object.freeze({
  maxClarifyingQuestions: 3,
  // Beyond the spec's illustrative 5, this also covers the comparative
  // "make X <adjective>" family and a couple of other common generic asks
  // ("speed up", "support") — added during M3 fixture tuning (see PLAN.md).
  vagueVerbs: [
    'fix',
    'improve',
    'handle',
    'make better',
    'clean up',
    'speed up',
    'support',
    'make bigger',
    'make faster',
    'make smaller',
    'make nicer',
    'make cleaner',
    'make simpler',
    'make easier',
  ],
  requireAcceptanceCriteria: false,
  minWords: DEFAULT_MIN_WORDS,
  threshold: DEFAULT_THRESHOLD,
  weights: Object.freeze({
    vagueVerb: 2,
    barePronoun: 2,
    noScope: 1,
    noAcceptance: 1,
    tooShort: 1,
    problemReport: 2,
  }),
});

// A file path, a backticked code span, a quoted literal, a dotted filename,
// or an identifier that looks like code (camelCase, PascalCase, snake_case)
// — any of these counts as the prompt naming something concrete to act on.
const SCOPE_PATTERN =
  /`[^`]+`|[\w.-]+\/[\w./-]+|\b[\w-]+\.\w{1,5}\b|\b[a-z]+[A-Z]\w*\b|\b[A-Z][a-z]+[A-Z]\w*\b|\b\w+_\w+\b|'[^']{2,}'|"[^"]{2,}"/;

// Language that defines what "done" looks like: a condition, an expected
// result, a test, an explicit acceptance/requirement word.
const ACCEPTANCE_PATTERN =
  /\b(should|must|when|until|so that|so it|tests?|testing|tested|expects?|expected|expectation|passes?|passing|passed|returns?|returned|acceptance|accepts?|done when|successfully|success|fails?|failure|failing|asserts?|assertion|requires?|required|requirement|criteria)\b/i;

// "this"/"it"/"that" used as the object of the sentence rather than as part
// of a longer, already-scoped description.
const PRONOUN_PATTERN = /\b(this|it|that)\b/i;

// A symptom statement ("the deploy is broken", "there's a bug in checkout")
// rather than an instruction: reports a state with no ask attached.
const PROBLEM_REPORT_PATTERN =
  /\b(is|are|was|were)\s+(broken|down|failing|not\s+working)\b|\bthere'?s\s+a\s+(bug|problem|issue|error)\b/i;

/** Longest run of pronoun-object prompts we still treat as "bare" (spec §1's
 * own examples — "fix this", "make it better" — top out at 3 words). */
const BARE_PRONOUN_MAX_WORDS = 6;

function escapeRegExp(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Turns a vague-verb phrase like "make better" into a regex that matches it
 * even with a filler word or two in between ("make it better"), so the
 * config's phrase list doesn't have to enumerate every inflection.
 */
function phraseToRegex(phrase) {
  const words = phrase.trim().toLowerCase().split(/\s+/).map(escapeRegExp);
  if (words.length === 1) {
    return new RegExp(`\\b${words[0]}\\b`, 'i');
  }
  const joiner = '\\b(?:\\s+\\S+){0,2}\\s+\\b';
  return new RegExp(`\\b${words.join(joiner)}\\b`, 'i');
}

/** Returns the first matching vague-verb phrase, or null. */
function checkVagueVerb(prompt, vagueVerbs) {
  for (const phrase of vagueVerbs) {
    if (typeof phrase !== 'string' || phrase.trim() === '') continue;
    try {
      if (phraseToRegex(phrase).test(prompt)) return phrase;
    } catch {
      // A malformed entry in a user-supplied vagueVerbs list should never
      // break the gate — skip it and keep checking the rest.
      continue;
    }
  }
  return null;
}

function checkHasScope(prompt) {
  return SCOPE_PATTERN.test(prompt);
}

function checkHasAcceptance(prompt) {
  return ACCEPTANCE_PATTERN.test(prompt);
}

function checkBarePronoun(prompt, wordCount, hasScope) {
  return (
    wordCount <= BARE_PRONOUN_MAX_WORDS && !hasScope && PRONOUN_PATTERN.test(prompt)
  );
}

/**
 * @param {unknown} prompt - the raw user prompt.
 * @param {object} [opts] - shallow overrides of DEFAULT_CONFIG (and, for
 *   `weights`, a shallow override of DEFAULT_CONFIG.weights).
 * @returns {{ verdict: 'vague' | 'fine', reasons: string[] }}
 */
export function gate(prompt, opts = {}) {
  try {
    const config = {
      ...DEFAULT_CONFIG,
      ...(opts && typeof opts === 'object' ? opts : {}),
      weights: {
        ...DEFAULT_CONFIG.weights,
        ...(opts && typeof opts === 'object' && opts.weights ? opts.weights : {}),
      },
    };

    if (typeof prompt !== 'string') {
      return { verdict: 'fine', reasons: [] };
    }

    const trimmed = prompt.trim();
    if (trimmed.length === 0) {
      return { verdict: 'fine', reasons: [] };
    }

    const analyzed =
      trimmed.length > MAX_ANALYZED_LENGTH
        ? trimmed.slice(0, MAX_ANALYZED_LENGTH)
        : trimmed;

    const wordCount = analyzed.split(/\s+/).filter(Boolean).length;
    const vagueVerbHit = checkVagueVerb(analyzed, config.vagueVerbs);
    const hasScope = checkHasScope(analyzed);
    const hasAcceptance = checkHasAcceptance(analyzed);
    const isBarePronoun = checkBarePronoun(analyzed, wordCount, hasScope);
    const isTooShort = wordCount < config.minWords;
    const isProblemReport = PROBLEM_REPORT_PATTERN.test(analyzed);

    const reasons = [];
    let score = 0;

    if (vagueVerbHit) {
      reasons.push(`vague-verb: "${vagueVerbHit}"`);
      score += config.weights.vagueVerb;
    }
    if (isBarePronoun) {
      reasons.push('bare-pronoun-no-antecedent');
      score += config.weights.barePronoun;
    }
    if (!hasScope) {
      reasons.push('no-scope-signal');
      score += config.weights.noScope;
    }
    if (!hasAcceptance) {
      reasons.push('no-acceptance-criteria');
      score += config.weights.noAcceptance;
    }
    if (isTooShort) {
      reasons.push('very-short');
      score += config.weights.tooShort;
    }
    if (isProblemReport) {
      reasons.push('problem-report-no-ask');
      score += config.weights.problemReport;
    }

    if (config.requireAcceptanceCriteria && !hasAcceptance) {
      return {
        verdict: 'vague',
        reasons: [...reasons, 'acceptance-criteria-required'],
      };
    }

    return {
      verdict: score >= config.threshold ? 'vague' : 'fine',
      reasons,
    };
  } catch {
    // Any unexpected failure must never block the prompt.
    return { verdict: 'fine', reasons: [] };
  }
}

export { DEFAULT_CONFIG };
