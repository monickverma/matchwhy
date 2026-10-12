// Runs the sentence-embedding model off the main thread.
import { pipeline, env, type FeatureExtractionPipeline } from '@huggingface/transformers';

env.allowLocalModels = false;

const MODEL = 'Xenova/all-MiniLM-L6-v2';
let extractor: FeatureExtractionPipeline | null = null;
let loading: Promise<FeatureExtractionPipeline> | null = null;

type InMsg = { type: 'load' } | { type: 'embed'; id: number; texts: string[] };

function load() {
  if (!loading) {
    const files = new Map<string, { loaded: number; total: number }>();
    loading = (pipeline('feature-extraction', MODEL, {
      dtype: 'q8',
      progress_callback: (p: { status: string; file?: string; loaded?: number; total?: number }) => {
        if (p.status === 'progress' && p.file && p.total) {
          files.set(p.file, { loaded: p.loaded ?? 0, total: p.total });
          let loaded = 0;
          let total = 0;
          for (const f of files.values()) {
            loaded += f.loaded;
            total += f.total;
          }
          self.postMessage({ type: 'progress', loaded, total, file: p.file });
        }
      },
    }) as Promise<FeatureExtractionPipeline>).then((e) => {
      extractor = e;
      return e;
    });
  }
  return loading;
}

self.onmessage = async (ev: MessageEvent<InMsg>) => {
  const msg = ev.data;
  try {
    if (msg.type === 'load') {
      await load();
      self.postMessage({ type: 'ready', model: MODEL });
    } else if (msg.type === 'embed') {
      const e = extractor ?? (await load());
      const vectors: number[][] = [];
      for (let i = 0; i < msg.texts.length; i += 32) {
        const out = await e(msg.texts.slice(i, i + 32), { pooling: 'mean', normalize: true });
        vectors.push(...(out.tolist() as number[][]));
      }
      self.postMessage({ type: 'embeddings', id: msg.id, vectors });
    }
  } catch (err) {
    self.postMessage({ type: 'error', id: msg.type === 'embed' ? msg.id : undefined, message: String((err as Error)?.message ?? err) });
  }
};
