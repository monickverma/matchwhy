// Offline reproduction of the in-browser evaluation (same code, same model) for the README.
// Usage: node scripts/eval.ts
import { pipeline } from '@huggingface/transformers';
import { alphaSweep, evalDataset, runEvaluation } from '../src/lib/evaluate.ts';
import { matchCandidates, type Embeddings } from '../src/lib/scoring.ts';

const { requirements, candidates, labels } = evalDataset();
const extractor = await pipeline('feature-extraction', 'Xenova/all-MiniLM-L6-v2', { dtype: 'q8' });
const embed = async (texts: string[]) => {
  const out = await extractor(texts, { pooling: 'mean', normalize: true });
  return out.tolist() as number[][];
};
const embeddings: Embeddings = { requirements: await embed(requirements), sentences: new Map() };
for (const c of candidates) embeddings.sentences.set(c.id, await embed(c.sentences));

console.log('requirements:', requirements.length, 'candidates:', candidates.length);
console.table(runEvaluation(requirements, candidates, labels, embeddings).map((r) => ({ ...r, top5: r.top5.join(', ') })));
console.table(alphaSweep(requirements, candidates, labels, embeddings));
if (process.argv.includes('--detail')) {
  for (const alpha of [0.5]) {
    const res = matchCandidates(requirements, candidates, { alpha, embeddings });
    console.log(`\nalpha=${alpha}`);
    for (const r of res)
      console.log(
        r.rank, r.candidate.name.padEnd(40), 'label', labels[r.candidate.id], 'score', r.score.toFixed(3),
        'conf', r.confidence.confidence.toFixed(2), r.confidence.needsReview ? 'REVIEW' : '',
        'met', r.matches.filter((m) => m.met).length, '| ', r.matches.map((m) => m.score.toFixed(2)).join(' '),
      );
  }
}
