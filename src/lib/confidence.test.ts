import { describe, expect, it } from 'vitest';
import {
  AMBIGUITY_BAND,
  computeConfidence,
  confidenceScore,
  evidenceCoverage,
  MARGIN_SCALE,
  MET_THRESHOLD,
  neighbourMargin,
  REVIEW_THRESHOLD,
} from './confidence.ts';

describe('evidenceCoverage', () => {
  it('counts decisive scores, not ambiguous ones', () => {
    const clearYes = MET_THRESHOLD + AMBIGUITY_BAND + 0.1;
    const clearNo = MET_THRESHOLD - AMBIGUITY_BAND - 0.1;
    const coin = MET_THRESHOLD + 0.01;
    expect(evidenceCoverage([clearYes, clearNo], [1, 1])).toBe(1);
    expect(evidenceCoverage([clearYes, coin], [1, 1])).toBe(0.5);
    expect(evidenceCoverage([clearYes, coin], [3, 1])).toBe(0.75);
    expect(evidenceCoverage([], [])).toBe(0);
  });
});

describe('neighbourMargin', () => {
  it('uses the closest neighbour', () => {
    expect(neighbourMargin([0.9, 0.5, 0.45], 1)).toBeCloseTo(0.05);
    expect(neighbourMargin([0.9, 0.5, 0.45], 0)).toBeCloseTo(0.4);
    expect(neighbourMargin([0.7], 0)).toBe(1);
  });
});

describe('confidenceScore', () => {
  it('is bounded and monotone in coverage and margin', () => {
    expect(confidenceScore(1, 1)).toBe(1);
    expect(confidenceScore(0, 0)).toBe(0);
    expect(confidenceScore(1, MARGIN_SCALE / 2)).toBeCloseTo(0.75);
    expect(confidenceScore(0.8, 0.005)).toBeLessThan(confidenceScore(0.8, 0.01));
    expect(confidenceScore(2, -1)).toBe(0.5);
  });
});

describe('computeConfidence', () => {
  it('routes near-ties with ambiguous evidence to review', () => {
    const t = MET_THRESHOLD;
    const ranked = [
      { score: 0.8, matchScores: [0.9, 0.8] },
      { score: 0.41, matchScores: [t + 0.01, t - 0.01] },
      { score: 0.405, matchScores: [t, t] },
    ];
    const conf = computeConfidence(ranked, [1, 1]);
    expect(conf[0].needsReview).toBe(false);
    expect(conf[1].needsReview).toBe(true);
    expect(conf[2].needsReview).toBe(true);
    expect(conf[1].confidence).toBeLessThan(REVIEW_THRESHOLD);
  });
});
