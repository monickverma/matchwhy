import type { CandidateResult } from './scoring.ts';

/** Top-k evidence quotes, strongest first, one per requirement, no duplicate sentences. */
export function topEvidence(result: CandidateResult, k = 2) {
  const seen = new Set<number>();
  return [...result.matches]
    .filter((m) => m.sentenceIndex >= 0 && m.met)
    .sort((a, b) => b.score - a.score)
    .filter((m) => (seen.has(m.sentenceIndex) ? false : (seen.add(m.sentenceIndex), true)))
    .slice(0, k);
}

function firstName(name: string): string {
  const clean = name.split(/\s+[—–|-]\s+|,/)[0].trim();
  return clean.split(/\s+/)[0] || 'there';
}

const lowerFirst = (s: string) => s.charAt(0).toLowerCase() + s.slice(1);

function shorten(s: string, max = 140): string {
  const t = s.replace(/\s+/g, ' ').trim().replace(/[.;]+$/, '');
  return t.length > max ? t.slice(0, max - 1).trimEnd() + '…' : t;
}

/** Template-based draft. No generation model: every claim is a verbatim quote from the profile. */
export function outreachDraft(result: CandidateResult, roleTitle: string | null): string {
  const quotes = topEvidence(result, 2);
  const role = roleTitle ? `the ${roleTitle} role` : 'an open role on our team';
  const lines = [`Hi ${firstName(result.candidate.name)},`, '', `I'm reaching out about ${role}. A couple of things in your background stood out:`];
  for (const q of quotes) lines.push(`  • "${shorten(q.evidence)}" (relevant to: ${lowerFirst(shorten(q.requirement, 80))})`);
  if (quotes.length === 0) lines.push('  • your overall experience');
  lines.push('', 'Would you be open to a 20-minute conversation next week?', '', 'Best,', '[Your name]');
  return lines.join('\n');
}
