import { useCallback, useEffect, useRef, useState } from 'react';

export type ModelStatus = 'loading' | 'ready' | 'error';

export interface EmbedderState {
  status: ModelStatus;
  progress: number; // 0..1
  error: string | null;
  embed: (texts: string[]) => Promise<number[][]>;
}

const LOAD_TIMEOUT_MS = 120_000;

/** Loads all-MiniLM-L6-v2 in a Web Worker; caches vectors per text. Falls back to 'error' on failure/timeout. */
export function useEmbedder(): EmbedderState {
  const [status, setStatus] = useState<ModelStatus>('loading');
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const workerRef = useRef<Worker | null>(null);
  const pending = useRef(new Map<number, { resolve: (v: number[][]) => void; reject: (e: Error) => void }>());
  const cache = useRef(new Map<string, number[]>());
  const nextId = useRef(1);

  useEffect(() => {
    let worker: Worker;
    try {
      worker = new Worker(new URL('../worker/embed.worker.ts', import.meta.url), { type: 'module' });
    } catch (e) {
      setStatus('error');
      setError(String(e));
      return;
    }
    workerRef.current = worker;
    const timer = setTimeout(() => {
      setStatus((s) => {
        if (s === 'loading') setError('Model download timed out.');
        return s === 'loading' ? 'error' : s;
      });
    }, LOAD_TIMEOUT_MS);
    worker.onmessage = (ev) => {
      const m = ev.data;
      if (m.type === 'progress') setProgress(m.total ? m.loaded / m.total : 0);
      else if (m.type === 'ready') {
        clearTimeout(timer);
        setProgress(1);
        setStatus('ready');
      } else if (m.type === 'embeddings') {
        pending.current.get(m.id)?.resolve(m.vectors);
        pending.current.delete(m.id);
      } else if (m.type === 'error') {
        if (m.id !== undefined) {
          pending.current.get(m.id)?.reject(new Error(m.message));
          pending.current.delete(m.id);
        } else {
          clearTimeout(timer);
          setStatus('error');
          setError(m.message);
        }
      }
    };
    worker.onerror = (ev) => {
      clearTimeout(timer);
      setStatus('error');
      setError(ev.message || 'Worker failed to start.');
    };
    worker.postMessage({ type: 'load' });
    return () => {
      clearTimeout(timer);
      worker.terminate();
    };
  }, []);

  const embed = useCallback(async (texts: string[]) => {
    const missing = [...new Set(texts.filter((t) => !cache.current.has(t)))];
    if (missing.length) {
      const worker = workerRef.current;
      if (!worker) throw new Error('Embedding worker not available');
      const id = nextId.current++;
      const vectors = await new Promise<number[][]>((resolve, reject) => {
        pending.current.set(id, { resolve, reject });
        worker.postMessage({ type: 'embed', id, texts: missing });
      });
      missing.forEach((t, i) => cache.current.set(t, vectors[i]));
    }
    return texts.map((t) => cache.current.get(t)!);
  }, []);

  return { status, progress, error, embed };
}
