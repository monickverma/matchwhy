import { useState } from 'react';
import { REVIEW_THRESHOLD } from '../lib/confidence.ts';
import type { Decision } from '../lib/feedback.ts';
import { outreachDraft } from '../lib/outreach.ts';
import type { CandidateResult, RequirementMatch } from '../lib/scoring.ts';
import { Badge, Bar, Button, Card, cx, fmt } from './ui.tsx';

interface Props {
  result: CandidateResult;
  weights: number[];
  decision?: Decision;
  embeddingsOn: boolean;
  roleTitle: string | null;
  defaultOpen?: boolean;
  onDecide: (d: Decision) => void;
  onWrongEvidence: (m: RequirementMatch) => void;
}

export function CandidateCard({ result, weights, decision, embeddingsOn, roleTitle, defaultOpen, onDecide, onWrongEvidence }: Props) {
  const [open, setOpen] = useState(!!defaultOpen);
  const [copied, setCopied] = useState(false);
  const { candidate, matches, confidence } = result;
  const met = matches.filter((m) => m.met).length;
  const unmet = matches.length - met;
  const draft = decision === 'approved' ? outreachDraft(result, roleTitle) : '';

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(draft);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* clipboard blocked; the text is selectable */
    }
  };

  return (
    <Card className={cx('overflow-hidden', decision === 'rejected' && 'opacity-60')}>
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 p-4">
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-muted text-sm font-semibold tabular-nums">
          {result.rank}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="truncate font-semibold">{candidate.name}</h3>
            {decision === 'approved' && <Badge tone="good">Approved</Badge>}
            {decision === 'rejected' && <Badge tone="bad">Rejected</Badge>}
            {!decision && confidence.needsReview && <Badge tone="warn">Needs review</Badge>}
          </div>
          <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-fg">
            <span>
              {met}/{matches.length} requirements met
              {unmet > 0 && <span className="text-bad"> · {unmet} unmet</span>}
            </span>
            <span
              title={`confidence = 0.5 × coverage (${fmt(confidence.coverage)}) + 0.5 × min(1, margin ${fmt(confidence.margin, 3)} / scale). Review below ${REVIEW_THRESHOLD}.`}
            >
              confidence {fmt(confidence.confidence)}
            </span>
          </div>
        </div>
        <div className="w-32">
          <div className="mb-1 flex justify-between text-xs">
            <span className="text-muted-fg">score</span>
            <span className="font-semibold tabular-nums">{fmt(result.score, 3)}</span>
          </div>
          <Bar value={result.score / 0.7} />
        </div>
        <div className="flex gap-1.5">
          <Button size="sm" variant={decision === 'approved' ? 'good' : 'outline'} onClick={() => onDecide('approved')} disabled={!!decision} aria-label={`Approve ${candidate.name}`}>
            ✓ Approve
          </Button>
          <Button size="sm" variant={decision === 'rejected' ? 'bad' : 'outline'} onClick={() => onDecide('rejected')} disabled={!!decision} aria-label={`Reject ${candidate.name}`}>
            ✕ Reject
          </Button>
          <Button size="sm" variant="ghost" onClick={() => setOpen((o) => !o)} aria-expanded={open}>
            {open ? 'Hide evidence' : 'Why?'}
          </Button>
        </div>
      </div>

      {open && (
        <div className="border-t border-border">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-muted/60 text-left text-xs text-muted-fg">
                  <th className="px-4 py-2 font-medium">Requirement</th>
                  <th className="px-4 py-2 font-medium">Best evidence (verbatim quote)</th>
                  <th className="px-4 py-2 text-right font-medium" title="hybrid = α·cosine + (1-α)·BM25">
                    Score
                  </th>
                  <th className="px-2 py-2" />
                </tr>
              </thead>
              <tbody>
                {matches.map((m) => (
                  <tr key={m.reqKey} className={cx('border-t border-border align-top', !m.met && 'bg-bad-bg/40')}>
                    <td className="w-[34%] px-4 py-2.5">
                      <div className="flex items-start gap-2">
                        <span className={cx('mt-0.5 text-xs font-bold', m.met ? 'text-good' : 'text-bad')}>{m.met ? '✓' : '✕'}</span>
                        <div>
                          <div>{m.requirement}</div>
                          <div className="mt-0.5 text-xs text-muted-fg">weight {fmt(weights[m.reqIndex] ?? 1)}</div>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-2.5">
                      {m.sentenceIndex >= 0 ? (
                        <blockquote className={cx('border-l-2 pl-3 italic', m.met ? 'border-good' : 'border-bad')}>“{m.evidence}”</blockquote>
                      ) : (
                        <span className="text-muted-fg">No usable sentence</span>
                      )}
                      {!m.met && <div className="mt-1 text-xs font-medium text-bad">Unmet: no sentence scored ≥ threshold</div>}
                    </td>
                    <td className="px-4 py-2.5 text-right tabular-nums whitespace-nowrap">
                      <div className="font-semibold">{fmt(m.score)}</div>
                      <div className="text-xs text-muted-fg">
                        {embeddingsOn ? `cos ${fmt(m.cosine)} · ` : ''}bm25 {fmt(m.lexical)}
                      </div>
                    </td>
                    <td className="px-2 py-2.5">
                      {m.sentenceIndex >= 0 && (
                        <Button size="sm" variant="ghost" title="This quote does not support the requirement" onClick={() => onWrongEvidence(m)}>
                          Wrong?
                        </Button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <div className="border-t border-border bg-muted/40 px-4 py-3">
        {decision === 'approved' ? (
          <div>
            <div className="mb-2 flex items-center justify-between">
              <span className="text-xs font-medium text-muted-fg">Outreach draft (template + top-2 verbatim quotes)</span>
              <Button size="sm" variant="primary" onClick={copy}>
                {copied ? 'Copied' : 'Copy'}
              </Button>
            </div>
            <pre className="whitespace-pre-wrap rounded-md border border-border bg-card p-3 text-xs leading-relaxed">{draft}</pre>
          </div>
        ) : (
          <div className="text-xs text-muted-fg">
            {decision === 'rejected' ? 'Rejected: no outreach will be drafted.' : 'Locked: the outreach draft unlocks only after a human clicks Approve.'}
          </div>
        )}
      </div>
    </Card>
  );
}
