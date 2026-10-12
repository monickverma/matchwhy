import { SAMPLE_CANDIDATES, SAMPLE_JD, SAMPLE_PROFILES } from '../data/sample.ts';
import { ndcgAtK, precisionAtK } from './metrics.ts';
import { matchCandidates, type Embeddings } from './scoring.ts';
import { parseCandidates, splitRequirements, type Candidate } from './text.ts';

export interface EvalRow {
  method: string;
  alpha: number;
  ndcg5: number | null;
  p3: number | null;
  top5: string[];
}

export function evalDataset() {
  const requirements = splitRequirements(SAMPLE_JD);
  const candidates = parseCandidates(SAMPLE_PROFILES);
  const labels: Record<string, number> = {};
  candidates.forEach((c, i) => (labels[c.id] = SAMPLE_CANDIDATES[i].label));
  return { requirements, candidates, labels };
}

export function runEvaluation(
  requirements: string[],
  candidates: Candidate[],
  labels: Record<string, number>,
  embeddings: Embeddings | null,
  hybridAlpha = 0.5,
): EvalRow[] {
  const configs = [
    { method: 'Lexical only (BM25)', alpha: 0, needsEmb: false },
    { method: 'Embedding only (MiniLM cosine)', alpha: 1, needsEmb: true },
    { method: `Hybrid (α = ${hybridAlpha})`, alpha: hybridAlpha, needsEmb: true },
  ];
  return configs.map(({ method, alpha, needsEmb }) => {
    if (needsEmb && !embeddings) return { method, alpha, ndcg5: null, p3: null, top5: [] };
    const res = matchCandidates(requirements, candidates, { alpha, embeddings: needsEmb ? embeddings : null });
    const ranking = res.map((r) => r.candidate.id);
    return {
      method,
      alpha,
      ndcg5: ndcgAtK(ranking, labels, 5),
      p3: precisionAtK(ranking, labels, 3),
      top5: res.slice(0, 5).map((r) => r.candidate.name.split(',')[0]),
    };
  });
}

/** nDCG@5 / P@3 across a grid of alpha values (diagnostic; the default alpha is NOT tuned on this). */
export function alphaSweep(
  requirements: string[],
  candidates: Candidate[],
  labels: Record<string, number>,
  embeddings: Embeddings,
  grid = [0, 0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9, 1],
) {
  return grid.map((alpha) => {
    const ranking = matchCandidates(requirements, candidates, { alpha, embeddings }).map((r) => r.candidate.id);
    return { alpha, ndcg5: ndcgAtK(ranking, labels, 5), p3: precisionAtK(ranking, labels, 3) };
  });
}
