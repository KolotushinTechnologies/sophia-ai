import { injectable } from 'inversify';
import type { IEmbeddingService } from '@sophia/domain';

type Pipeline = (
  text: string,
  options?: { pooling?: string; normalize?: boolean },
) => Promise<{ data: Float32Array }>;

@injectable()
export class LocalTransformersEmbeddingService implements IEmbeddingService {
  private pipeline: Pipeline | null = null;
  private loading: Promise<void> | null = null;
  private dims = 384;
  private readonly modelId: string;

  constructor(modelId = 'Xenova/multilingual-e5-small') {
    this.modelId = modelId;
  }

  get dimensions(): number {
    return this.dims;
  }

  async warmUp(): Promise<void> {
    await this.ensurePipeline();
  }

  async embed(text: string): Promise<number[]> {
    const pipe = await this.ensurePipeline();
    const out = await pipe(text, { pooling: 'mean', normalize: true });
    const arr = Array.from(out.data);
    this.dims = arr.length;
    return arr;
  }

  async embedBatch(texts: string[]): Promise<number[][]> {
    const result: number[][] = [];
    for (const t of texts) {
      result.push(await this.embed(t));
    }
    return result;
  }

  private async ensurePipeline(): Promise<Pipeline> {
    if (this.pipeline) return this.pipeline;
    if (!this.loading) {
      this.loading = (async () => {
        const mod = await import('@xenova/transformers');
        this.pipeline = (await mod.pipeline('feature-extraction', this.modelId)) as unknown as Pipeline;
      })();
    }
    await this.loading;
    return this.pipeline!;
  }
}

/** Fast deterministic embeddings for tests / when transformers unavailable */
@injectable()
export class HashEmbeddingService implements IEmbeddingService {
  readonly dimensions = 256;

  async warmUp(): Promise<void> {}

  async embed(text: string): Promise<number[]> {
    const vec = new Array(this.dimensions).fill(0);
    const tokens = text.toLowerCase().split(/\s+/).filter(Boolean);
    for (const token of tokens) {
      let h = 2166136261;
      for (let i = 0; i < token.length; i++) {
        h ^= token.charCodeAt(i);
        h = Math.imul(h, 16777619);
      }
      const idx = Math.abs(h) % this.dimensions;
      vec[idx] += 1;
      vec[(idx + 1) % this.dimensions] += 0.5;
    }
    const norm = Math.sqrt(vec.reduce((s, v) => s + v * v, 0)) || 1;
    return vec.map((v) => v / norm);
  }

  async embedBatch(texts: string[]): Promise<number[][]> {
    return Promise.all(texts.map((t) => this.embed(t)));
  }
}
