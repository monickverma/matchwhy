import type { ReactNode } from 'react';
import { AMBIGUITY_BAND, MARGIN_SCALE, MET_THRESHOLD, REVIEW_THRESHOLD } from '../lib/confidence.ts';
import { ETA_A, ETA_W } from '../lib/feedback.ts';
import { Card } from './ui.tsx';

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <Card className="p-5">
      <h2 className="font-semibold">{title}</h2>
      <div className="mt-2 space-y-2 text-sm text-muted-fg">{children}</div>
    </Card>
  );
}

const Code = ({ children }: { children: ReactNode }) => (
  <pre className="overflow-x-auto rounded-md bg-muted p-3 font-mono text-xs text-fg">{children}</pre>
);

export function MethodView() {
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Section title="1. Evidence retrieval">
        <p>The job description is split into requirement lines; each profile into sentences. For every requirement we search the candidate's sentences for the best supporting quote:</p>
        <Code>{`hybrid(req, s) = α · max(0, cos(e_req, e_s)) + (1 − α) · bm25(req, s) / bm25_self(req)
evidence(req)  = argmax_s hybrid(req, s)
met            = hybrid ≥ ${MET_THRESHOLD}`}</Code>
        <p>Embeddings come from all-MiniLM-L6-v2 running in a Web Worker. BM25 (k1 = 1.2, b = 0.75) is divided by the score an ideal sentence containing exactly the requirement's terms would get, so it lands in [0, 1] regardless of the candidate pool.</p>
      </Section>
      <Section title="2. Candidate score">
        <Code>{`score(c) = Σ_r w_r · hybrid_r(c) / Σ_r w_r       (w_r = 1 initially)`}</Code>
        <p>Every number in the ranking can be traced back to one quoted sentence per requirement. Unmet requirements are shown in red rather than hidden.</p>
      </Section>
      <Section title="3. Confidence and routing">
        <Code>{`coverage   = share of requirements with a decisive verdict
             (|hybrid − ${MET_THRESHOLD}| ≥ ${AMBIGUITY_BAND})
margin     = gap to the nearest neighbour in the ranking
confidence = 0.5 · coverage + 0.5 · min(1, margin / ${MARGIN_SCALE})
confidence < ${REVIEW_THRESHOLD}  →  "Needs human review"`}</Code>
        <p>Coin-flip evidence or near-ties in the ranking mean the machine should not decide alone.</p>
      </Section>
      <Section title="4. Learning from feedback">
        <Code>{`Approve (y=+1) / Reject (y=−1):
  d_r = clip((hybrid_r − ${MET_THRESHOLD}) / 0.3, −1, 1)
  w_r ← clip(w_r · exp(${ETA_W} · y · d_r), 0.25, 4), renormalised to mean 1
  α   ← clip(α + ${ETA_A} · y · (pct_emb − pct_lex), 0.1, 0.9)

"Wrong evidence" on a quote:
  quote excluded for that (candidate, requirement)
  α   ← clip(α − ${ETA_A} · (cos − bm25), 0.1, 0.9)`}</Code>
        <p>pct_emb / pct_lex are the candidate's percentiles under embedding-only and lexical-only ranking: whichever signal agreed with you gains trust. Feedback is stored in localStorage only.</p>
      </Section>
      <Section title="5. Outreach is gated">
        <p>Approved candidates get a template draft built from their top two verbatim quotes. There is no text generation, so the draft cannot claim anything the profile does not say, and the copy button only exists after a human approves.</p>
      </Section>
      <Section title="Limitations">
        <ul className="list-disc space-y-1 pl-5">
          <li>Sentence-level evidence misses facts spread across sentences, and negation (“no Spark experience”) still scores as a match.</li>
          <li>The confidence score is a heuristic, not a calibrated probability.</li>
          <li>The evaluation set is 12 synthetic profiles; it shows behaviour, not generalisation.</li>
          <li>The feedback rule is per-browser and has no guard against a single inconsistent reviewer.</li>
          <li>A MiniLM model can encode biases from its training data; a human must make the final call.</li>
        </ul>
      </Section>
    </div>
  );
}
