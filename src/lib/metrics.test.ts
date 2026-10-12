import { describe, expect, it } from 'vitest';
import { ndcgAtK, precisionAtK } from './metrics.ts';

const labels = { a: 3, b: 2, c: 0, d: 1 };

describe('metrics', () => {
  it('ideal ranking has nDCG 1', () => {
    expect(ndcgAtK(['a', 'b', 'd', 'c'], labels, 5)).toBeCloseTo(1);
  });
  it('worse ranking has lower nDCG', () => {
    expect(ndcgAtK(['c', 'd', 'b', 'a'], labels, 5)).toBeLessThan(ndcgAtK(['a', 'c', 'b', 'd'], labels, 5));
  });
  it('precision@k counts label >= 2', () => {
    expect(precisionAtK(['a', 'c', 'b'], labels, 3)).toBeCloseTo(2 / 3);
    expect(precisionAtK([], labels, 3)).toBe(0);
  });
});
