// Confidence = how sure the system is about a candidate's verdict and rank position.
//
//   coverage   = weighted share of requirements whose evidence is DECISIVE, i.e. the best evidence
//                score is clearly above or clearly below the "met" threshold (outside threshold ± band).
//                Scores inside the band are coin flips that a human should look at.
//   marginTerm = min(1, margin / MARGIN_SCALE), where margin is the gap between this candidate's score
//                and its closest neighbour in the ranking. Near-ties mean the order is not trustworthy.
//   confidence = 0.5 * coverage + 0.5 * marginTerm
//
// Candidates below REVIEW_THRESHOLD go to the "Needs human review" queue.

export const MET_THRESHOLD = 0.4;
export const AMBIGUITY_BAND = 0.06;
export const MARGIN_SCALE = 0.03;
export const REVIEW_THRESHOLD = 0.55;

export interface ConfidenceParts {
  confidence: number;
  coverage: number;
  margin: number;
  needsReview: boolean;
}

export function evidenceCoverage(
  matchScores: number[],
  weights: number[],
  threshold = MET_THRESHOLD,
  band = AMBIGUITY_BAND,
): number {
  if (matchScores.length === 0) return 0;
  let decisive = 0;
  let total = 0;
  matchScores.forEach((s, i) => {
    const w = weights[i] ?? 1;
    total += w;
    if (Math.abs(s - threshold) >= band) decisive += w;
  });
  return total > 0 ? decisive / total : 0;
}

/** Gap to the closest neighbour in a list of scores sorted descending. */
export function neighbourMargin(sortedScores: number[], i: number): number {
  const gaps: number[] = [];
  if (i > 0) gaps.push(sortedScores[i - 1] - sortedScores[i]);
  if (i < sortedScores.length - 1) gaps.push(sortedScores[i] - sortedScores[i + 1]);
  return gaps.length ? Math.min(...gaps.map(Math.abs)) : 1; // a lone candidate has no competitor
}

export function confidenceScore(coverage: number, margin: number, marginScale = MARGIN_SCALE): number {
  const marginTerm = Math.min(1, Math.max(0, margin) / marginScale);
  return 0.5 * Math.min(1, Math.max(0, coverage)) + 0.5 * marginTerm;
}

/** `ranked` must be sorted by score, descending. */
export function computeConfidence(
  ranked: { score: number; matchScores: number[] }[],
  weights: number[],
): ConfidenceParts[] {
  const scores = ranked.map((r) => r.score);
  return ranked.map((r, i) => {
    const coverage = evidenceCoverage(r.matchScores, weights);
    const margin = neighbourMargin(scores, i);
    const confidence = confidenceScore(coverage, margin);
    return { confidence, coverage, margin, needsReview: confidence < REVIEW_THRESHOLD };
  });
}
