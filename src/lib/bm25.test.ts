import { describe, expect, it } from 'vitest';
import { bm25Normalized, bm25Score, bm25SelfScore, buildBM25, idf } from './bm25.ts';
import { tokenize } from './text.ts';

const docs = ['python pytorch ranking', 'react typescript frontend', 'python spark airflow pipelines', 'ranking ranking ranking search'].map(tokenize);
const index = buildBM25(docs);

describe('BM25', () => {
  it('computes document frequencies and average length', () => {
    expect(index.df.get('python')).toBe(2);
    expect(index.df.get('react')).toBe(1);
    expect(index.avgdl).toBeCloseTo((3 + 3 + 4 + 4) / 4);
  });

  it('rarer terms get higher idf', () => {
    expect(idf(index, 'react')).toBeGreaterThan(idf(index, 'python'));
    expect(idf(index, 'unseen')).toBeGreaterThan(idf(index, 'react'));
  });

  it('scores zero when no term overlaps', () => {
    expect(bm25Score(index, tokenize('kubernetes golang'), 0)).toBe(0);
  });

  it('ranks the matching document first', () => {
    const q = tokenize('pytorch ranking');
    const scores = docs.map((_, i) => bm25Score(index, q, i));
    expect(scores.indexOf(Math.max(...scores))).toBe(0);
  });

  it('saturates term frequency (k1) instead of growing linearly', () => {
    const q = ['rank'];
    const once = bm25Score(buildBM25([['rank', 'x', 'y', 'z'], ['a', 'b', 'c', 'd']]), q, 0);
    const thrice = bm25Score(buildBM25([['rank', 'rank', 'rank', 'z'], ['a', 'b', 'c', 'd']]), q, 0);
    expect(thrice).toBeGreaterThan(once);
    expect(thrice).toBeLessThan(3 * once);
  });

  it('normalised score is in [0,1] and 0 for no overlap', () => {
    for (let i = 0; i < docs.length; i++) {
      const s = bm25Normalized(index, tokenize('python ranking search'), i);
      expect(s).toBeGreaterThanOrEqual(0);
      expect(s).toBeLessThanOrEqual(1);
    }
    expect(bm25Normalized(index, tokenize('kubernetes'), 0)).toBe(0);
    expect(bm25SelfScore(index, [])).toBe(0);
  });
});

describe('tokenize', () => {
  it('drops stopwords, keeps tech tokens, stems lightly', () => {
    expect(tokenize('Building the pipelines with Node.js and C++')).toEqual(['build', 'pipeline', 'node.js', 'c++']);
    expect(tokenize('A/B tests')).toEqual(['ab', 'test']);
  });
});
