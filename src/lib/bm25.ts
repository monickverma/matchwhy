// Okapi BM25 over pre-tokenised documents, plus a self-normalised score in [0, 1].

export interface BM25Index {
  docs: string[][];
  tf: Map<string, number>[];
  df: Map<string, number>;
  avgdl: number;
  k1: number;
  b: number;
}

export function buildBM25(docs: string[][], k1 = 1.2, b = 0.75): BM25Index {
  const df = new Map<string, number>();
  const tf = docs.map((d) => {
    const m = new Map<string, number>();
    for (const t of d) m.set(t, (m.get(t) ?? 0) + 1);
    for (const t of m.keys()) df.set(t, (df.get(t) ?? 0) + 1);
    return m;
  });
  const total = docs.reduce((s, d) => s + d.length, 0);
  return { docs, tf, df, avgdl: docs.length ? total / docs.length : 0, k1, b };
}

/** Lucene-style non-negative IDF. */
export function idf(index: BM25Index, term: string): number {
  const N = index.docs.length;
  const n = index.df.get(term) ?? 0;
  return Math.log(1 + (N - n + 0.5) / (n + 0.5));
}

function termScore(index: BM25Index, term: string, freq: number, dl: number): number {
  if (freq === 0) return 0;
  const { k1, b, avgdl } = index;
  const norm = avgdl > 0 ? dl / avgdl : 1;
  return idf(index, term) * ((freq * (k1 + 1)) / (freq + k1 * (1 - b + b * norm)));
}

/** Raw BM25 score of a query against document `i`. Query terms are de-duplicated. */
export function bm25Score(index: BM25Index, query: string[], i: number): number {
  const tf = index.tf[i];
  const dl = index.docs[i].length;
  let s = 0;
  for (const q of new Set(query)) s += termScore(index, q, tf.get(q) ?? 0, dl);
  return s;
}

/**
 * Upper reference for a query: the score a document consisting of exactly the query terms
 * (length = average doc length, each term once) would get. Used to map BM25 into [0, 1]
 * independently of which other candidates are in the pool.
 */
export function bm25SelfScore(index: BM25Index, query: string[]): number {
  let s = 0;
  for (const q of new Set(query)) s += termScore(index, q, 1, index.avgdl);
  return s;
}

/** BM25 normalised to [0, 1] by the query's self score. */
export function bm25Normalized(index: BM25Index, query: string[], i: number): number {
  const self = bm25SelfScore(index, query);
  if (self <= 0) return 0;
  return Math.min(1, bm25Score(index, query, i) / self);
}
