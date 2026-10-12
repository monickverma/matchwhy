// Ranking metrics with graded relevance labels (0 = not relevant ... 3 = excellent fit).

export function dcg(gains: number[], k: number): number {
  let s = 0;
  for (let i = 0; i < Math.min(k, gains.length); i++) s += (Math.pow(2, gains[i]) - 1) / Math.log2(i + 2);
  return s;
}

/** nDCG@k of a ranking (list of ids) given graded labels. */
export function ndcgAtK(ranking: string[], labels: Record<string, number>, k: number): number {
  const gains = ranking.map((id) => labels[id] ?? 0);
  const ideal = Object.values(labels).sort((a, b) => b - a);
  const idcg = dcg(ideal, k);
  return idcg > 0 ? dcg(gains, k) / idcg : 0;
}

/** Precision@k where a label >= minRelevant counts as relevant. */
export function precisionAtK(ranking: string[], labels: Record<string, number>, k: number, minRelevant = 2): number {
  const top = ranking.slice(0, k);
  if (top.length === 0) return 0;
  return top.filter((id) => (labels[id] ?? 0) >= minRelevant).length / k;
}
