// Online learning from reviewer feedback. Deliberately simple and inspectable.
//
// 1) Requirement weights (multiplicative update, like Hedge / multiplicative weights):
//      y   = +1 for Approve, -1 for Reject
//      d_r = clip((s_r - MET_THRESHOLD) / 0.3, -1, 1)   how strongly the candidate met requirement r
//      w_r <- clip(w_r * exp(ETA_W * y * d_r), 0.25, 4), then re-normalised to mean 1
//    Approving someone boosts the requirements they meet and down-weights the ones they miss;
//    rejecting does the opposite ("whatever this person had is apparently not what matters").
//
// 2) Alpha (trust in embeddings vs. lexical):
//    Decision:        alpha <- clip(alpha + ETA_A * y * (pct_emb - pct_lex), 0.1, 0.9)
//                     where pct_* is the candidate's percentile under embedding-only / lexical-only scoring.
//                     The signal that agreed with the human gains trust.
//    Wrong evidence:  alpha <- clip(alpha - ETA_A * (cos - lex), 0.1, 0.9)
//                     The signal that was more excited about a quote the human called wrong loses trust.
//                     The quote is also excluded as evidence for that (candidate, requirement) pair.

import { MET_THRESHOLD } from './confidence.ts';
import { evidenceKey, type CandidateResult, type RequirementMatch } from './scoring.ts';

export const ETA_W = 0.25;
export const ETA_A = 0.3;
export const W_MIN = 0.25;
export const W_MAX = 4;
export const ALPHA_MIN = 0.1;
export const ALPHA_MAX = 0.9;
export const DEFAULT_ALPHA = 0.5;

export type Decision = 'approved' | 'rejected';

export interface FeedbackEvent {
  at: number;
  kind: 'approve' | 'reject' | 'wrong-evidence';
  candidate: string;
  detail: string;
}

export interface FeedbackState {
  version: 1;
  alpha: number;
  weights: Record<string, number>;
  decisions: Record<string, Decision>;
  wrongEvidence: string[];
  log: FeedbackEvent[];
}

export function defaultFeedback(): FeedbackState {
  return { version: 1, alpha: DEFAULT_ALPHA, weights: {}, decisions: {}, wrongEvidence: [], log: [] };
}

const clip = (x: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, x));

export function weightsFor(state: FeedbackState, reqKeys: string[]): number[] {
  return reqKeys.map((k) => state.weights[k] ?? 1);
}

/** Multiplicative weight update for one decision. Returns weights re-normalised to mean 1. */
export function updateWeights(weights: number[], matchScores: number[], y: 1 | -1, eta = ETA_W): number[] {
  const next = weights.map((w, r) => {
    const d = clip((matchScores[r] - MET_THRESHOLD) / 0.3, -1, 1);
    return clip(w * Math.exp(eta * y * d), W_MIN, W_MAX);
  });
  const mean = next.reduce((a, b) => a + b, 0) / (next.length || 1);
  return mean > 0 ? next.map((w) => clip(w / mean, W_MIN, W_MAX)) : next;
}

/** Fraction of other candidates scoring strictly below `value`. */
export function percentile(values: number[], value: number): number {
  if (values.length <= 1) return 0.5;
  const below = values.filter((v) => v < value).length;
  return below / (values.length - 1);
}

export function updateAlphaFromDecision(
  alpha: number,
  y: 1 | -1,
  pctEmb: number,
  pctLex: number,
  eta = ETA_A,
): number {
  return clip(alpha + eta * y * (pctEmb - pctLex), ALPHA_MIN, ALPHA_MAX);
}

export function updateAlphaFromWrongEvidence(alpha: number, cos: number, lex: number, eta = ETA_A): number {
  return clip(alpha - eta * (cos - lex), ALPHA_MIN, ALPHA_MAX);
}

export function applyDecision(
  state: FeedbackState,
  target: CandidateResult,
  all: CandidateResult[],
  decision: Decision,
  embeddingsAvailable: boolean,
): FeedbackState {
  const y: 1 | -1 = decision === 'approved' ? 1 : -1;
  const keys = target.matches.map((m) => m.reqKey);
  const newW = updateWeights(
    weightsFor(state, keys),
    target.matches.map((m) => m.score),
    y,
  );
  const weights = { ...state.weights };
  keys.forEach((k, i) => (weights[k] = newW[i]));

  let alpha = state.alpha;
  if (embeddingsAvailable) {
    const pe = percentile(all.map((r) => r.embeddingOnlyScore), target.embeddingOnlyScore);
    const pl = percentile(all.map((r) => r.lexicalOnlyScore), target.lexicalOnlyScore);
    alpha = updateAlphaFromDecision(alpha, y, pe, pl);
  }
  return {
    ...state,
    alpha,
    weights,
    decisions: { ...state.decisions, [target.candidate.id]: decision },
    log: [
      { at: Date.now(), kind: decision === 'approved' ? 'approve' : 'reject', candidate: target.candidate.name, detail: '' } as FeedbackEvent,
      ...state.log,
    ].slice(0, 50),
  };
}

export function applyWrongEvidence(
  state: FeedbackState,
  candidateId: string,
  candidateName: string,
  match: RequirementMatch,
  embeddingsAvailable: boolean,
): FeedbackState {
  if (match.sentenceIndex < 0) return state;
  const key = evidenceKey(candidateId, match.reqKey, match.sentenceIndex);
  if (state.wrongEvidence.includes(key)) return state;
  const alpha = embeddingsAvailable ? updateAlphaFromWrongEvidence(state.alpha, match.cosine, match.lexical) : state.alpha;
  return {
    ...state,
    alpha,
    wrongEvidence: [...state.wrongEvidence, key],
    log: [
      { at: Date.now(), kind: 'wrong-evidence' as const, candidate: candidateName, detail: match.evidence },
      ...state.log,
    ].slice(0, 50),
  };
}

export interface ChangeSummary {
  alpha: { before: number; after: number } | null;
  weights: { requirement: string; before: number; after: number }[];
  moves: { name: string; before: number; after: number }[];
}

/** Human-readable diff between two scoring states (used for the "what changed" note). */
export function summarizeChange(
  before: { alpha: number; results: CandidateResult[]; weights: number[] },
  after: { alpha: number; results: CandidateResult[]; weights: number[] },
  requirements: string[],
): ChangeSummary {
  const alpha = Math.abs(before.alpha - after.alpha) > 1e-4 ? { before: before.alpha, after: after.alpha } : null;
  const weights = requirements
    .map((requirement, i) => ({ requirement, before: before.weights[i] ?? 1, after: after.weights[i] ?? 1 }))
    .filter((w) => Math.abs(w.after - w.before) > 0.005)
    .sort((a, b) => Math.abs(b.after - b.before) - Math.abs(a.after - a.before))
    .slice(0, 3);
  const prevRank = new Map(before.results.map((r) => [r.candidate.id, r.rank]));
  const moves = after.results
    .filter((r) => prevRank.has(r.candidate.id) && prevRank.get(r.candidate.id) !== r.rank)
    .map((r) => ({ name: r.candidate.name, before: prevRank.get(r.candidate.id)!, after: r.rank }))
    .slice(0, 4);
  return { alpha, weights, moves };
}

const STORAGE_KEY = 'matchwhy:feedback:v1';

export function loadFeedback(): FeedbackState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return defaultFeedback();
    const parsed = JSON.parse(raw) as FeedbackState;
    if (parsed?.version !== 1) return defaultFeedback();
    return { ...defaultFeedback(), ...parsed };
  } catch {
    return defaultFeedback();
  }
}

export function saveFeedback(state: FeedbackState): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    /* storage unavailable (private mode, quota) - feedback just won't persist */
  }
}
