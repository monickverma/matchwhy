import { useEffect, useMemo, useState } from 'react';
import { SAMPLE_CANDIDATES, SAMPLE_JD } from '../data/sample.ts';
import { alphaSweep, evalDataset, runEvaluation } from '../lib/evaluate.ts';
import type { Embeddings } from '../lib/scoring.ts';
import type { EmbedderState } from '../lib/useEmbedder.ts';
import { Badge, Bar, Card, cx, fmt } from './ui.tsx';

export function EvalView({ embedder }: { embedder: EmbedderState }) {
  const { requirements, candidates, labels } = useMemo(() => evalDataset(), []);
  const [embeddings, setEmbeddings] = useState<Embeddings | null>(null);

  useEffect(() => {
    if (embedder.status !== 'ready') return;
    let cancelled = false;
    const { embed } = embedder;
    (async () => {
      try {
        const reqVecs = await embed(requirements);
        const sentences = new Map<string, number[][]>();
        for (const c of candidates) sentences.set(c.id, await embed(c.sentences));
        if (!cancelled) setEmbeddings({ requirements: reqVecs, sentences });
      } catch {
        /* stays lexical-only */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [embedder.status, embedder.embed, requirements, candidates]);

  const rows = useMemo(() => runEvaluation(requirements, candidates, labels, embeddings), [requirements, candidates, labels, embeddings]);
  const sweep = useMemo(() => (embeddings ? alphaSweep(requirements, candidates, labels, embeddings) : null), [requirements, candidates, labels, embeddings]);
  const best = Math.max(...rows.map((r) => r.ndcg5 ?? -1));

  return (
    <div className="space-y-6">
      <Card className="p-5">
        <div className="flex flex-wrap items-center gap-2">
          <h2 className="text-lg font-semibold">Offline evaluation</h2>
          <Badge tone="warn">synthetic sample data</Badge>
        </div>
        <p className="mt-2 max-w-3xl text-sm text-muted-fg">
          One job description, {candidates.length} hand-written fictional profiles and hand-assigned relevance labels (0 = not a fit … 3 = excellent).
          Labels were written before running any scorer. Two profiles are deliberate traps (keyword-dense non-fits) and one strong fit is written
          almost entirely in paraphrase. Metrics are computed live in your browser with the same code that powers the matcher, using equal
          requirement weights and no feedback. With 12 profiles these numbers are illustrative, not statistically meaningful.
        </p>
      </Card>

      <Card className="overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-muted/60 text-left text-xs text-muted-fg">
              <th className="px-4 py-2.5 font-medium">Method</th>
              <th className="px-4 py-2.5 text-right font-medium">nDCG@5</th>
              <th className="px-4 py-2.5 text-right font-medium">Precision@3</th>
              <th className="hidden px-4 py-2.5 font-medium md:table-cell">Top 5</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.method} className="border-t border-border">
                <td className="px-4 py-3 font-medium">{r.method}</td>
                <td className={cx('px-4 py-3 text-right tabular-nums', r.ndcg5 === best && 'font-bold text-good')}>
                  {r.ndcg5 === null ? <span className="text-muted-fg">{embedder.status === 'error' ? 'model unavailable' : 'loading…'}</span> : fmt(r.ndcg5, 3)}
                </td>
                <td className="px-4 py-3 text-right tabular-nums">{r.p3 === null ? '–' : fmt(r.p3, 3)}</td>
                <td className="hidden px-4 py-3 text-xs text-muted-fg md:table-cell">{r.top5.join(', ')}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <p className="border-t border-border px-4 py-2.5 text-xs text-muted-fg">
          Precision@3 counts labels ≥ 2 as relevant. nDCG uses gain 2<sup>label</sup> − 1. Hybrid uses the untuned prior α = 0.5.
        </p>
      </Card>

      {sweep && (
        <Card className="p-5">
          <h3 className="font-semibold">Diagnostic: nDCG@5 as α varies</h3>
          <p className="mt-1 text-xs text-muted-fg">
            Shown for transparency only. Picking α from this chart would be tuning on the test set, so the app starts from 0.5 and lets reviewer
            feedback move it.
          </p>
          <div className="mt-4 space-y-1.5">
            {sweep.map((s) => (
              <div key={s.alpha} className="flex items-center gap-3 text-xs">
                <span className="w-12 tabular-nums text-muted-fg">α {fmt(s.alpha, 1)}</span>
                <div className="flex-1">
                  <Bar value={s.ndcg5} />
                </div>
                <span className="w-12 text-right tabular-nums">{fmt(s.ndcg5, 3)}</span>
              </div>
            ))}
          </div>
        </Card>
      )}

      <Card className="overflow-hidden">
        <div className="p-4">
          <h3 className="font-semibold">Labelled dataset</h3>
          <details className="mt-1 text-xs text-muted-fg">
            <summary className="cursor-pointer">Job description</summary>
            <pre className="mt-2 whitespace-pre-wrap rounded-md bg-muted p-3">{SAMPLE_JD}</pre>
          </details>
        </div>
        <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-muted/60 text-left text-xs text-muted-fg">
              <th className="px-4 py-2 font-medium">Fictional candidate</th>
              <th className="px-4 py-2 font-medium">Label</th>
              <th className="px-4 py-2 font-medium">Why this label</th>
            </tr>
          </thead>
          <tbody>
            {SAMPLE_CANDIDATES.map((c) => (
              <tr key={c.key} className="border-t border-border align-top">
                <td className="px-4 py-2.5 whitespace-nowrap">{c.block.split('\n')[0]}</td>
                <td className="px-4 py-2.5">
                  <Badge tone={c.label >= 2 ? 'good' : c.label === 1 ? 'warn' : 'bad'}>{c.label}</Badge>
                </td>
                <td className="px-4 py-2.5 text-xs text-muted-fg">{c.why}</td>
              </tr>
            ))}
          </tbody>
        </table>
        </div>
      </Card>
    </div>
  );
}
