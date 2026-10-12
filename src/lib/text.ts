// Text utilities: tokenisation, requirement/sentence splitting and candidate parsing.

const STOPWORDS = new Set(
  (
    'a an and are as at be been being but by can could did do does doing for from had has have having he her his ' +
    'i if in into is it its itself me my of on or our ours she so such than that the their them then there these ' +
    'they this those to too very was we were what when where which while who whom why will with would you your ' +
    'about above after again all also am any because before below between both during each few further here how ' +
    'just more most no nor not now off once only other out over own same should some through under until up ' +
    'e g eg etc ie plus years year experience strong ability'
  ).split(/\s+/),
);

/** Very light suffix stripping so "pipelines"/"pipeline" and "deployed"/"deploying"/"deploy" collide. */
export function stem(word: string): string {
  if (/[^a-z]/.test(word)) return word; // leave "node.js", "c++", "k8s"-like tokens alone
  if (word.length > 4 && word.endsWith('ies')) return word.slice(0, -3) + 'y';
  if (word.length > 5 && word.endsWith('ing')) return word.slice(0, -3);
  if (word.length > 4 && word.endsWith('ed')) return word.slice(0, -2);
  if (word.length > 3 && word.endsWith('s') && !word.endsWith('ss')) return word.slice(0, -1);
  return word;
}

/** Lowercase, keep tech-ish tokens like "c++", "node.js", "a/b" pieces, drop stopwords, light stemming. */
export function tokenize(text: string): string[] {
  const raw = text
    .toLowerCase()
    .replace(/\b([a-z])\/([a-z])\b/g, '$1$2') // "A/B" -> "ab"
    .match(/[a-z0-9]+(?:[+#]+|\.[a-z0-9]+)*/g) ?? [];
  const out: string[] = [];
  for (const t of raw) {
    if (STOPWORDS.has(t)) continue;
    if (t.length === 1 && !/[0-9]/.test(t)) continue;
    out.push(stem(t));
  }
  return out;
}

const BULLET = /^\s*(?:[-*•–·▪◦]|\d+[.)])\s+/;

/** Split free text into sentences (newlines and sentence punctuation). Bullets are stripped. */
export function splitSentences(text: string): string[] {
  const out: string[] = [];
  for (const line of text.split(/\r?\n/)) {
    const clean = line.replace(BULLET, '').trim();
    if (!clean) continue;
    for (const s of clean.split(/(?<=[.!?;])\s+(?=[A-Z0-9("'])/)) {
      const t = s.trim();
      if (tokenize(t).length >= 2) out.push(t);
    }
  }
  return out;
}

/**
 * Split a job description into requirement lines. Bullet lines become requirements as-is;
 * prose paragraphs are split into sentences. Headings ("Requirements:") and very short lines are dropped.
 */
export function splitRequirements(jd: string): string[] {
  const lines = jd.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  const out: string[] = [];
  lines.forEach((line, i) => {
    if (i === 0 && lines.length > 1 && isTitleLine(line)) return; // job title
    if (/:\s*$/.test(line)) return; // section heading
    const clean = line.replace(BULLET, '').trim();
    if (BULLET.test(line)) {
      if (tokenize(clean).length >= 2) out.push(clean);
      return;
    }
    for (const s of splitSentences(clean)) if (tokenize(s).length >= 3) out.push(s);
  });
  return dedupe(out);
}

/** Heuristic: a short line that does not end with sentence punctuation is a title/name line. */
export function isTitleLine(line: string): boolean {
  return line.length <= 70 && !/[.!?;:]$/.test(line) && !BULLET.test(line);
}

export function jobTitle(jd: string): string | null {
  const first = jd.split(/\r?\n/).map((l) => l.trim()).find(Boolean);
  return first && isTitleLine(first) ? first : null;
}

function dedupe(xs: string[]): string[] {
  const seen = new Set<string>();
  return xs.filter((x) => {
    const k = x.toLowerCase();
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
}

export interface Candidate {
  id: string;
  name: string;
  text: string;
  sentences: string[];
}

/** Stable short hash (djb2) for ids and storage keys. */
export function hash(s: string): string {
  let h = 5381;
  for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) | 0;
  return (h >>> 0).toString(36);
}

/**
 * Parse pasted candidate profiles. Blocks are separated by a line containing only `---`;
 * if no such separator exists, blank lines separate blocks. The first line of a block is
 * used as the name when it looks like a title line.
 */
export function parseCandidates(input: string): Candidate[] {
  const text = input.replace(/\r\n/g, '\n').trim();
  if (!text) return [];
  const blocks = /^\s*---+\s*$/m.test(text) ? text.split(/^\s*---+\s*$/m) : text.split(/\n\s*\n/);
  const out: Candidate[] = [];
  blocks.forEach((block) => {
    const lines = block.trim().split('\n');
    if (!lines[0]) return;
    let name = `Candidate ${out.length + 1}`;
    let body = block.trim();
    if (lines.length > 1 && isTitleLine(lines[0].trim())) {
      name = lines[0].trim();
      body = lines.slice(1).join('\n').trim();
    }
    const sentences = splitSentences(body);
    if (sentences.length === 0) return;
    out.push({ id: hash(name + '\n' + body), name, text: body, sentences });
  });
  return out;
}
