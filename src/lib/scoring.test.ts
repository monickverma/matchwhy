import { describe, expect, it } from 'vitest';
import { cosine, evidenceKey, hybridScore, matchCandidates, requirementKey, weightedMean } from './scoring.ts';
import { parseCandidates, splitRequirements } from './text.ts';

describe('hybridScore', () => {
  it('interpolates between cosine and lexical', () => {
    expect(hybridScore(0.8, 0.2, 1)).toBeCloseTo(0.8);
    expect(hybridScore(0.8, 0.2, 0)).toBeCloseTo(0.2);
    expect(hybridScore(0.8, 0.2, 0.5)).toBeCloseTo(0.5);
  });
  it('clamps negative cosine and out-of-range alpha', () => {
    expect(hybridScore(-0.5, 0.4, 0.5)).toBeCloseTo(0.2);
    expect(hybridScore(0.6, 0.2, 2)).toBeCloseTo(0.6);
  });
});

describe('cosine / weightedMean', () => {
  it('cosine of parallel, orthogonal and zero vectors', () => {
    expect(cosine([1, 2], [2, 4])).toBeCloseTo(1);
    expect(cosine([1, 0], [0, 1])).toBeCloseTo(0);
    expect(cosine([0, 0], [1, 1])).toBe(0);
  });
  it('weighted mean respects weights', () => {
    expect(weightedMean([1, 0], [3, 1])).toBeCloseTo(0.75);
    expect(weightedMean([1, 0], [0, 0])).toBeCloseTo(0.5);
    expect(weightedMean([], [])).toBe(0);
  });
});

const JD = `Backend Engineer
Requirements:
- Python services in production
- Kubernetes deployments`;
const PROFILES = `Ana Silva
Wrote Python services that run in production.
Enjoys hiking.
---
Bo Chen
Operates Kubernetes deployments for many teams.
Likes cooking.`;

describe('matchCandidates', () => {
  const reqs = splitRequirements(JD);
  const cands = parseCandidates(PROFILES);

  it('parses inputs', () => {
    expect(reqs).toEqual(['Python services in production', 'Kubernetes deployments']);
    expect(cands.map((c) => c.name)).toEqual(['Ana Silva', 'Bo Chen']);
  });

  it('picks the right evidence sentence per requirement (lexical)', () => {
    const res = matchCandidates(reqs, cands, { alpha: 0.5 });
    const ana = res.find((r) => r.candidate.name === 'Ana Silva')!;
    expect(ana.matches[0].evidence).toMatch(/Python services/);
    expect(ana.matches[0].met).toBe(true);
    expect(ana.matches[1].met).toBe(false);
  });

  it('requirement weights change the ranking', () => {
    const favourPython = matchCandidates(reqs, cands, { alpha: 0, weights: [3, 1] });
    const favourK8s = matchCandidates(reqs, cands, { alpha: 0, weights: [1, 3] });
    expect(favourPython[0].candidate.name).toBe('Ana Silva');
    expect(favourK8s[0].candidate.name).toBe('Bo Chen');
  });

  it('uses embeddings when provided (alpha = 1 ignores lexical)', () => {
    const embeddings = {
      requirements: [
        [1, 0],
        [0, 1],
      ],
      sentences: new Map([
        // toy space: the "hiking" sentence is aligned with requirement 0
        [cands[0].id, [[0, 1], [1, 0]]],
        [cands[1].id, [[0, 1], [1, 0]]],
      ]),
    };
    const res = matchCandidates(reqs, cands, { alpha: 1, embeddings });
    const ana = res.find((r) => r.candidate.name === 'Ana Silva')!;
    expect(ana.matches[0].evidence).toBe('Enjoys hiking.');
    expect(ana.matches[0].cosine).toBeCloseTo(1);
  });

  it('excluded (wrong) evidence is never selected', () => {
    const ana = cands[0];
    const excluded = new Set([evidenceKey(ana.id, requirementKey(reqs[0]), 0)]);
    const res = matchCandidates(reqs, cands, { alpha: 0, excluded });
    const m = res.find((r) => r.candidate.id === ana.id)!.matches[0];
    expect(m.sentenceIndex).toBe(1);
  });

  it('assigns ranks in score order', () => {
    const res = matchCandidates(reqs, cands, { alpha: 0 });
    expect(res.map((r) => r.rank)).toEqual([1, 2]);
    expect(res[0].score).toBeGreaterThanOrEqual(res[1].score);
  });
});
