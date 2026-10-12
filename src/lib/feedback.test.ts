import { describe, expect, it } from 'vitest';
import {
  ALPHA_MAX,
  ALPHA_MIN,
  applyDecision,
  applyWrongEvidence,
  defaultFeedback,
  loadFeedback,
  percentile,
  saveFeedback,
  summarizeChange,
  updateAlphaFromDecision,
  updateAlphaFromWrongEvidence,
  updateWeights,
  W_MAX,
  type FeedbackState,
} from './feedback.ts';
import { matchCandidates } from './scoring.ts';
import { parseCandidates, splitRequirements } from './text.ts';

describe('updateWeights', () => {
  it('approve boosts met requirements and lowers unmet ones', () => {
    const w = updateWeights([1, 1], [0.9, 0.1], 1);
    expect(w[0]).toBeGreaterThan(1);
    expect(w[1]).toBeLessThan(1);
    expect((w[0] + w[1]) / 2).toBeCloseTo(1);
  });
  it('reject does the opposite', () => {
    const w = updateWeights([1, 1], [0.9, 0.1], -1);
    expect(w[0]).toBeLessThan(1);
    expect(w[1]).toBeGreaterThan(1);
  });
  it('stays bounded after many updates', () => {
    let w = [1, 1, 1];
    for (let i = 0; i < 200; i++) w = updateWeights(w, [1, 0, 0], 1);
    expect(Math.max(...w)).toBeLessThanOrEqual(W_MAX);
  });
});

describe('alpha updates', () => {
  it('moves toward the signal that agreed with the human', () => {
    expect(updateAlphaFromDecision(0.5, 1, 0.9, 0.2)).toBeGreaterThan(0.5); // approved; embeddings ranked them higher
    expect(updateAlphaFromDecision(0.5, -1, 0.9, 0.2)).toBeLessThan(0.5); // rejected; embeddings were fooled
    expect(updateAlphaFromDecision(0.5, 1, 0.5, 0.5)).toBe(0.5);
  });
  it('wrong evidence penalises the more excited signal, clipped', () => {
    expect(updateAlphaFromWrongEvidence(0.5, 0.8, 0.1)).toBeLessThan(0.5);
    expect(updateAlphaFromWrongEvidence(0.5, 0.1, 0.8)).toBeGreaterThan(0.5);
    expect(updateAlphaFromWrongEvidence(ALPHA_MIN, 1, 0)).toBe(ALPHA_MIN);
    expect(updateAlphaFromWrongEvidence(ALPHA_MAX, 0, 1)).toBe(ALPHA_MAX);
  });
  it('percentile', () => {
    expect(percentile([1, 2, 3], 3)).toBe(1);
    expect(percentile([1, 2, 3], 1)).toBe(0);
    expect(percentile([1], 1)).toBe(0.5);
  });
});

const reqs = splitRequirements('Role\n- Python services in production\n- Kubernetes deployments');
const cands = parseCandidates(
  'Ana Silva\nWrote Python services that run in production.\n---\nBo Chen\nOperates Kubernetes deployments for many teams.',
);

describe('applyDecision / applyWrongEvidence', () => {
  it('records the decision and updates weights immutably', () => {
    const s0 = defaultFeedback();
    const results = matchCandidates(reqs, cands, { alpha: 0.5 });
    const ana = results.find((r) => r.candidate.name === 'Ana Silva')!;
    const s1 = applyDecision(s0, ana, results, 'approved', false);
    expect(s1.decisions[ana.candidate.id]).toBe('approved');
    expect(s1.weights[ana.matches[0].reqKey]).toBeGreaterThan(1);
    expect(s1.alpha).toBe(s0.alpha); // no embeddings -> alpha untouched
    expect(s0.decisions).toEqual({});
    expect(s1.log[0].kind).toBe('approve');
  });

  it('approving the runner-up re-ranks, and the change summary reports it', () => {
    const s0 = defaultFeedback();
    const before = matchCandidates(reqs, cands, { alpha: 0 });
    const second = before[1];
    let s: FeedbackState = s0;
    for (let i = 0; i < 3; i++) s = applyDecision(s, second, before, 'approved', false);
    const w = (st: FeedbackState) => before[0].matches.map((m) => st.weights[m.reqKey] ?? 1);
    const after = matchCandidates(reqs, cands, { alpha: 0, weights: w(s) });
    expect(after[0].candidate.id).toBe(second.candidate.id);
    const summary = summarizeChange(
      { alpha: 0.5, results: before, weights: w(s0) },
      { alpha: 0.5, results: after, weights: w(s) },
      reqs,
    );
    expect(summary.moves.length).toBe(2);
    expect(summary.weights.length).toBeGreaterThan(0);
    expect(summary.alpha).toBeNull();
  });

  it('wrong evidence excludes the quote once and adjusts alpha', () => {
    const results = matchCandidates(reqs, cands, { alpha: 0.5 });
    const m = { ...results[0].matches[0], cosine: 0.9, lexical: 0.1 };
    const s1 = applyWrongEvidence(defaultFeedback(), results[0].candidate.id, 'x', m, true);
    expect(s1.wrongEvidence).toHaveLength(1);
    expect(s1.alpha).toBeLessThan(0.5);
    expect(applyWrongEvidence(s1, results[0].candidate.id, 'x', m, true)).toBe(s1);
  });
});

describe('persistence', () => {
  it('falls back to defaults when localStorage is unavailable', () => {
    expect(loadFeedback()).toEqual(defaultFeedback());
    expect(() => saveFeedback(defaultFeedback())).not.toThrow();
  });
});
