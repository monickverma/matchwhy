import { useEffect, useMemo, useState } from 'react';
import { SAMPLE_JD, SAMPLE_PROFILES } from '../data/sample.ts';
import {
  applyDecision,
  applyWrongEvidence,
  defaultFeedback,
  loadFeedback,
  saveFeedback,
  summarizeChange,
  weightsFor,
  type ChangeSummary,
  type Decision,
  type FeedbackState,
} from '../lib/feedback.ts';
import { matchCandidates, requirementKey, type CandidateResult, type Embeddings, type RequirementMatch } from '../lib/scoring.ts';
import { jobTitle, parseCandidates, splitRequirements } from '../lib/text.ts';
import type { EmbedderState } from '../lib/useEmbedder.ts';
import { CandidateCard } from './CandidateCard.tsx';
import { Badge, Bar, Button, Card, fmt } from './ui.tsx';

interface Note {
  title: string;
  change: ChangeSummary;
}

export function MatchView({ embedder }: { embedder: EmbedderState }) {
  const [jdText, setJdText] = useState(SAMPLE_JD);
  const [profilesText, setProfilesText] = useState(SAMPLE_PROFILES);
  const [input, setInput] = useState({ jd: SAMPLE_JD, profiles: SAMPLE_PROFILES });
  const [showInputs, setShowInputs] = useState(false);
  const [fb, setFb] = useState<FeedbackState>(() => loadFeedback());
  const [embeddings, setEmbeddings] = useState<Embeddings | null>(null);
  const [embedding, setEmbedding] = useState(false);
  const [note, setNote] = useState<Note | null>(null);

  const requirements = useMemo(() => splitRequirements(input.jd), [input.jd]);
  const candidates = useMemo(() => parseCandidates(input.profiles), [input.profiles]);
  const roleTitle = useMemo(() => jobTitle(input.jd), [input.jd]);
  const reqKeys = useMemo(() => requirements.map(requirementKey), [requirements]);

  useEffect(() => saveFeedback(fb), [fb]);

  // Embed requirements + every candidate sentence once the model is ready.
  useEffect(() => {
    const { embed } = embedder;
    if (embedder.status !== 'ready' || requirements.length === 0) return;
    let cancelled = false;
    setEmbedding(true);
    (async () => {
      try {
        const sentenceTexts = candidates.flatMap((c) => c.sentences);
        const [reqVecs, sentVecs] = await Promise.all([embed(requirements), embed(sentenceTexts)]);
        if (cancelled) return;
        const sentences = new Map<string, number[][]>();
        let k = 0;
        for (const c of candidates) {
          sentences.set(c.id, sentVecs.slice(k, k + c.sentences.length));
          k += c.sentences.length;
        }
        setEmbeddings({ requirements: reqVecs, sentences });
      } catch {
        if (!cancelled) setEmbeddings(null);
      } finally {
        if (!cancelled) setEmbedding(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [embedder.status, embedder.embed, requirements, candidates]);

  const embeddingsOn = !!embeddings && embedder.status === 'ready';
  const score = (state: FeedbackState) =>
    matchCandidates(requirements, candidates, {
      alpha: state.alpha,
      weights: weightsFor(state, reqKeys),
      embeddings: embeddingsOn ? embeddings : null,
      excluded: new Set(state.wrongEvidence),
    });
  const results = useMemo(() => score(fb), [fb, requirements, candidates, embeddings, embeddingsOn, reqKeys]);
  const weights = weightsFor(fb, reqKeys);

  const commit = (next: FeedbackState, title: string) => {
    const after = score(next);
    setNote({
      title,
      change: summarizeChange(
        { alpha: fb.alpha, results, weights },
        { alpha: next.alpha, results: after, weights: weightsFor(next, reqKeys) },
        requirements,
      ),
    });
    setFb(next);
  };

  const decide = (r: CandidateResult, d: Decision) =>
    commit(applyDecision(fb, r, results, d, embeddingsOn), `${d === 'approved' ? 'Approved' : 'Rejected'} ${r.candidate.name}`);
  const wrong = (r: CandidateResult, m: RequirementMatch) =>
    commit(applyWrongEvidence(fb, r.candidate.id, r.candidate.name, m, embeddingsOn), `Marked a quote from ${r.candidate.name} as wrong evidence`);

  const queue = results.filter((r) => r.confidence.needsReview && !fb.decisions[r.candidate.id]);
  const decidedCount = results.filter((r) => fb.decisions[r.candidate.id]).length;

  const card = (r: CandidateResult, open = false) => (
    <CandidateCard
      key={r.candidate.id}
      result={r}
      weights={weights}
      decision={fb.decisions[r.candidate.id]}
      embeddingsOn={embeddingsOn}
      roleTitle={roleTitle}
      defaultOpen={open}
      onDecide={(d) => decide(r, d)}
      onWrongEvidence={(m) => wrong(r, m)}
    />
  );

  return (
    <div className="space-y-6">
      <Card className="p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="font-semibold">{roleTitle ?? 'Job description'}</h2>
            <p className="text-sm text-muted-fg">
              {requirements.length} requirements · {candidates.length} candidates
              {input.jd === SAMPLE_JD && input.profiles === SAMPLE_PROFILES && ' · synthetic sample data'}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button onClick={() => setShowInputs((s) => !s)}>{showInputs ? 'Close editor' : 'Paste your own JD & profiles'}</Button>
            <Button
              variant="ghost"
              onClick={() => {
                setFb(defaultFeedback());
                setNote(null);
              }}
              title="Clear decisions, learned weights, alpha and wrong-evidence marks"
            >
              Reset feedback
            </Button>
          </div>
        </div>
        {showInputs && (
          <div className="mt-4 grid gap-4 lg:grid-cols-2">
            <label className="block text-sm">
              <span className="font-medium">Job description</span>
              <span className="block text-xs text-muted-fg">First short line = title. Bullets / sentences become requirements.</span>
              <textarea value={jdText} onChange={(e) => setJdText(e.target.value)} rows={12} className="mt-1.5 w-full rounded-md border border-border bg-bg p-2.5 font-mono text-xs" />
            </label>
            <label className="block text-sm">
              <span className="font-medium">Candidate profiles</span>
              <span className="block text-xs text-muted-fg">One profile per block, separated by a line with <code>---</code> (or blank lines). First short line = name.</span>
              <textarea value={profilesText} onChange={(e) => setProfilesText(e.target.value)} rows={12} className="mt-1.5 w-full rounded-md border border-border bg-bg p-2.5 font-mono text-xs" />
            </label>
            <div className="flex flex-wrap gap-2 lg:col-span-2">
              <Button
                variant="primary"
                onClick={() => {
                  setInput({ jd: jdText, profiles: profilesText });
                  setNote(null);
                }}
              >
                Run matching
              </Button>
              <Button
                onClick={() => {
                  setJdText(SAMPLE_JD);
                  setProfilesText(SAMPLE_PROFILES);
                  setInput({ jd: SAMPLE_JD, profiles: SAMPLE_PROFILES });
                }}
              >
                Load sample data
              </Button>
              <span className="self-center text-xs text-muted-fg">Everything runs locally in your browser; nothing is uploaded.</span>
            </div>
          </div>
        )}
      </Card>

      <div className="grid gap-4 md:grid-cols-3">
        <Card className="p-4">
          <div className="text-xs text-muted-fg">Signal mix</div>
          <div className="mt-1 text-lg font-semibold tabular-nums">
            {embeddingsOn ? <>α = {fmt(fb.alpha)}</> : 'Lexical only'}
          </div>
          <div className="mt-2">
            <Bar value={embeddingsOn ? fb.alpha : 0} />
          </div>
          <p className="mt-2 text-xs text-muted-fg">
            {embeddingsOn
              ? `${Math.round(fb.alpha * 100)}% embedding cosine + ${Math.round((1 - fb.alpha) * 100)}% BM25. Learned from your feedback.`
              : embedding || embedder.status === 'loading'
                ? 'Embeddings loading; BM25 scores shown meanwhile.'
                : 'Embedding model unavailable.'}
          </p>
        </Card>
        <Card className="p-4">
          <div className="text-xs text-muted-fg">Human review</div>
          <div className="mt-1 text-lg font-semibold tabular-nums">
            {queue.length} waiting · {decidedCount} decided
          </div>
          <p className="mt-2 text-xs text-muted-fg">Low-confidence candidates are routed to you instead of being auto-ranked.</p>
        </Card>
        <Card className="p-4">
          <div className="text-xs text-muted-fg">Requirement weights</div>
          <ul className="mt-1.5 space-y-1">
            {requirements.map((r, i) => (
              <li key={reqKeys[i]} className="flex items-center gap-2 text-xs" title={r}>
                <span className="w-9 shrink-0 tabular-nums text-muted-fg">{fmt(weights[i])}</span>
                <div className="w-16 shrink-0">
                  <Bar value={weights[i] / 2} />
                </div>
                <span className="truncate">{r}</span>
              </li>
            ))}
          </ul>
        </Card>
      </div>

      {note && (
        <div role="status" className="fixed inset-x-4 bottom-4 z-20 max-h-[50vh] overflow-y-auto rounded-xl border border-primary/50 bg-card p-4 text-sm shadow-xl sm:left-auto sm:max-w-md">
          <div className="flex items-start justify-between gap-3">
            <div>
              <div className="font-semibold">What changed after your feedback: {note.title}</div>
              <ul className="mt-1.5 list-disc space-y-0.5 pl-5 text-xs">
                {note.change.alpha && (
                  <li>
                    α {fmt(note.change.alpha.before)} → {fmt(note.change.alpha.after)} (
                    {note.change.alpha.after > note.change.alpha.before ? 'trusting embeddings more' : 'trusting keyword overlap more'})
                  </li>
                )}
                {note.change.weights.map((w) => (
                  <li key={w.requirement}>
                    weight {w.after > w.before ? '↑' : '↓'} {fmt(w.before)} → {fmt(w.after)}: “{w.requirement}”
                  </li>
                ))}
                {note.change.moves.map((m) => (
                  <li key={m.name}>
                    {m.name}: #{m.before} → #{m.after}
                  </li>
                ))}
                {!note.change.alpha && note.change.weights.length === 0 && note.change.moves.length === 0 && (
                  <li>Recorded. Scores moved too little to change the ranking.</li>
                )}
                {note.title.startsWith('Marked') && <li>That quote is no longer used as evidence; the next-best sentence replaces it.</li>}
              </ul>
            </div>
            <Button size="sm" variant="ghost" onClick={() => setNote(null)} aria-label="Dismiss">
              ✕
            </Button>
          </div>
        </div>
      )}

      {candidates.length === 0 || requirements.length === 0 ? (
        <Card className="p-6 text-sm text-muted-fg">Add a job description with at least one requirement and one candidate profile.</Card>
      ) : (
        <>
          <section>
            <div className="mb-3 flex items-center gap-2">
              <h2 className="text-lg font-semibold">Needs human review</h2>
              <Badge tone="warn">{queue.length}</Badge>
            </div>
            {queue.length === 0 ? (
              <Card className="p-4 text-sm text-muted-fg">Queue empty: every remaining candidate is above the confidence threshold.</Card>
            ) : (
              <div className="space-y-3">{queue.map((r, i) => card(r, i === 0))}</div>
            )}
          </section>
          <section>
            <div className="mb-3 flex items-center gap-2">
              <h2 className="text-lg font-semibold">Full ranking</h2>
              <Badge>{results.length}</Badge>
            </div>
            <div className="space-y-3">{results.map((r) => card(r))}</div>
          </section>
        </>
      )}
    </div>
  );
}
