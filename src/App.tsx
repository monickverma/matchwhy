import { useEffect, useState } from 'react';
import { EvalView } from './components/EvalView.tsx';
import { MatchView } from './components/MatchView.tsx';
import { MethodView } from './components/MethodView.tsx';
import { Button, cx } from './components/ui.tsx';
import { useEmbedder } from './lib/useEmbedder.ts';

type Tab = 'match' | 'eval' | 'method';
const TABS: { id: Tab; label: string }[] = [
  { id: 'match', label: 'Match & review' },
  { id: 'eval', label: 'Evaluation' },
  { id: 'method', label: 'How it works' },
];

function initialTab(): Tab {
  const h = window.location.hash.replace('#', '');
  return h === 'eval' || h === 'method' ? h : 'match';
}

export default function App() {
  const embedder = useEmbedder();
  const [tab, setTab] = useState<Tab>(initialTab);
  const [dark, setDark] = useState(() => document.documentElement.classList.contains('dark'));

  useEffect(() => {
    document.documentElement.classList.toggle('dark', dark);
    try {
      localStorage.setItem('matchwhy:theme', dark ? 'dark' : 'light');
    } catch {
      /* ignore */
    }
  }, [dark]);

  useEffect(() => {
    const onHash = () => setTab(initialTab());
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
  }, []);

  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-10 border-b border-border bg-bg/85 backdrop-blur">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-x-6 gap-y-2 px-4 py-3">
          <a href="#match" className="flex items-center gap-2 font-semibold" onClick={() => setTab('match')}>
            <img src="/favicon.svg" alt="" className="h-6 w-6" />
            MatchWhy
          </a>
          <nav className="flex gap-1 text-sm">
            {TABS.map((t) => (
              <a
                key={t.id}
                href={`#${t.id}`}
                onClick={() => setTab(t.id)}
                className={cx('rounded-md px-3 py-1.5 transition', tab === t.id ? 'bg-muted font-medium' : 'text-muted-fg hover:text-fg')}
              >
                {t.label}
              </a>
            ))}
          </nav>
          <div className="ml-auto flex items-center gap-2">
            <ModelPill embedder={embedder} />
            <Button size="sm" variant="ghost" onClick={() => setDark((d) => !d)} aria-label="Toggle dark mode">
              {dark ? '☀' : '☾'}
            </Button>
          </div>
        </div>
      </header>

      {embedder.status === 'error' && (
        <div className="border-b border-border bg-warn-bg text-warn">
          <div className="mx-auto max-w-6xl px-4 py-2 text-sm">
            <strong>Embedding model failed to load, running lexical-only (BM25).</strong> Rankings still work, but paraphrases will be missed.
            {embedder.error && <span className="opacity-80"> ({embedder.error})</span>}
          </div>
        </div>
      )}

      <main className="mx-auto max-w-6xl px-4 py-6">
        {tab === 'match' && (
          <div className="mb-6">
            <h1 className="text-2xl font-semibold tracking-tight">AI proposes, a human approves.</h1>
            <p className="mt-1 max-w-3xl text-sm text-muted-fg">
              Every score is backed by a verbatim quote from the profile. Uncertain calls are routed to you, and your Approve / Reject / “wrong
              evidence” clicks retune the matcher. Runs entirely in your browser: no server, no API keys.
            </p>
          </div>
        )}
        {tab === 'match' && <MatchView embedder={embedder} />}
        {tab === 'eval' && <EvalView embedder={embedder} />}
        {tab === 'method' && <MethodView />}
      </main>

      <footer className="mx-auto max-w-6xl px-4 pb-10 text-xs text-muted-fg">
        Sample profiles are synthetic. Embeddings: all-MiniLM-L6-v2 via transformers.js in a Web Worker. MIT licensed ·{' '}
        <a className="underline" href="https://github.com/monickverma/matchwhy">source</a>
      </footer>
    </div>
  );
}

function ModelPill({ embedder }: { embedder: ReturnType<typeof useEmbedder> }) {
  if (embedder.status === 'ready')
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full bg-good-bg px-2.5 py-1 text-xs font-medium text-good">
        <span className="h-1.5 w-1.5 rounded-full bg-good" /> MiniLM ready
      </span>
    );
  if (embedder.status === 'error')
    return <span className="rounded-full bg-warn-bg px-2.5 py-1 text-xs font-medium text-warn">Lexical-only mode</span>;
  return (
    <span className="inline-flex items-center gap-2 rounded-full bg-muted px-2.5 py-1 text-xs text-muted-fg" role="status" aria-live="polite">
      <span className="h-3 w-3 animate-spin rounded-full border-2 border-muted-fg border-t-transparent" />
      Loading model {Math.round(embedder.progress * 100)}%
      <span className="hidden h-1 w-16 overflow-hidden rounded-full bg-border sm:inline-block">
        <span className="block h-full bg-primary transition-all" style={{ width: `${embedder.progress * 100}%` }} />
      </span>
    </span>
  );
}
