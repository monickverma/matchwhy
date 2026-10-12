// Hybrid evidence matching: for every (candidate, requirement) pair pick the candidate sentence
// with the highest  alpha * cosine(embedding) + (1 - alpha) * BM25-normalised  score.

import { buildBM25, bm25Normalized } from './bm25.ts';
import { tokenize, hash, type Candidate } from './text.ts';
import { computeConfidence, MET_THRESHOLD, type ConfidenceParts } from './confidence.ts';

export type Vec = ArrayLike<number>;

export function cosine(a: Vec, b: Vec): number {
  let dot = 0;
  let na = 0;
  let nb = 0;
  const n = Math.min(a.length, b.length);
  for (let i = 0; i < n; i++) {
    dot += a[i] * b[i];
    na += a[i] * a[i];
    nb += b[i] * b[i];
  }
  if (na === 0 || nb === 0) return 0;
  return dot / Math.sqrt(na * nb);
}

/** Hybrid score. Cosine is clamped to [0, 1] so both terms live on the same scale. */
export function hybridScore(cos: number, lex: number, alpha: number): number {
  const a = Math.min(1, Math.max(0, alpha));
  return a * Math.min(1, Math.max(0, cos)) + (1 - a) * lex;
}

/** Weighted mean; falls back to plain mean when all weights are zero. */
export function weightedMean(values: number[], weights: number[]): number {
  if (values.length === 0) return 0;
  let s = 0;
  let w = 0;
  values.forEach((v, i) => {
    const wi = weights[i] ?? 1;
    s += wi * v;
    w += wi;
  });
  return w > 0 ? s / w : values.reduce((x, y) => x + y, 0) / values.length;
}

/** Stable key for a requirement, used to persist weights across sessions. */
export function requirementKey(req: string): string {
  return hash(tokenize(req).join(' '));
}

export function evidenceKey(candidateId: string, reqKey: string, sentenceIndex: number): string {
  return `${candidateId}|${reqKey}|${sentenceIndex}`;
}

export interface Embeddings {
  requirements: Vec[];
  /** candidate id -> one vector per sentence */
  sentences: Map<string, Vec[]>;
}

export interface MatchOptions {
  alpha: number;
  weights?: number[];
  embeddings?: Embeddings | null;
  /** evidence keys (see evidenceKey) a reviewer marked as wrong; never used as evidence again */
  excluded?: Set<string>;
}

export interface RequirementMatch {
  reqIndex: number;
  reqKey: string;
  requirement: string;
  sentenceIndex: number; // -1 when no usable sentence
  evidence: string;
  cosine: number;
  lexical: number;
  score: number;
  met: boolean;
}

export interface CandidateResult {
  candidate: Candidate;
  matches: RequirementMatch[];
  score: number;
  /** score the candidate would get with alpha = 0 / alpha = 1 (used by the alpha feedback rule) */
  lexicalOnlyScore: number;
  embeddingOnlyScore: number;
  rank: number;
  confidence: ConfidenceParts;
}

export function matchCandidates(
  requirements: string[],
  candidates: Candidate[],
  opts: MatchOptions,
): CandidateResult[] {
  const useEmb = !!opts.embeddings;
  const alpha = useEmb ? opts.alpha : 0;
  const weights = requirements.map((_, i) => opts.weights?.[i] ?? 1);
  const excluded = opts.excluded ?? new Set<string>();

  // One BM25 corpus over every candidate sentence (IDF reflects the whole pool).
  const docs: string[][] = [];
  const offset = new Map<string, number>();
  for (const c of candidates) {
    offset.set(c.id, docs.length);
    for (const s of c.sentences) docs.push(tokenize(s));
  }
  const index = buildBM25(docs);
  const reqTokens = requirements.map(tokenize);
  const reqKeys = requirements.map(requirementKey);

  const results: CandidateResult[] = candidates.map((c) => {
    const base = offset.get(c.id)!;
    const sentVecs = useEmb ? opts.embeddings!.sentences.get(c.id) : undefined;
    const lexBest: number[] = [];
    const embBest: number[] = [];
    const matches = requirements.map((req, r): RequirementMatch => {
      let best: RequirementMatch = {
        reqIndex: r,
        reqKey: reqKeys[r],
        requirement: req,
        sentenceIndex: -1,
        evidence: '',
        cosine: 0,
        lexical: 0,
        score: 0,
        met: false,
      };
      let bestLex = 0;
      let bestEmb = 0;
      c.sentences.forEach((s, j) => {
        if (excluded.has(evidenceKey(c.id, reqKeys[r], j))) return;
        const lex = bm25Normalized(index, reqTokens[r], base + j);
        const cos = sentVecs ? Math.max(0, cosine(opts.embeddings!.requirements[r], sentVecs[j])) : 0;
        const score = useEmb ? hybridScore(cos, lex, alpha) : lex;
        bestLex = Math.max(bestLex, lex);
        bestEmb = Math.max(bestEmb, cos);
        if (score > best.score || best.sentenceIndex === -1) {
          best = { ...best, sentenceIndex: j, evidence: s, cosine: cos, lexical: lex, score };
        }
      });
      lexBest.push(bestLex);
      embBest.push(bestEmb);
      return { ...best, met: best.score >= MET_THRESHOLD };
    });
    return {
      candidate: c,
      matches,
      score: weightedMean(
        matches.map((m) => m.score),
        weights,
      ),
      lexicalOnlyScore: weightedMean(lexBest, weights),
      embeddingOnlyScore: useEmb ? weightedMean(embBest, weights) : 0,
      rank: 0,
      confidence: { confidence: 0, coverage: 0, margin: 0, needsReview: false },
    };
  });

  results.sort((a, b) => b.score - a.score);
  const conf = computeConfidence(
    results.map((r) => ({ score: r.score, matchScores: r.matches.map((m) => m.score) })),
    weights,
  );
  results.forEach((r, i) => {
    r.rank = i + 1;
    r.confidence = conf[i];
  });
  return results;
}
