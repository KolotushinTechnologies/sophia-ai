import { inject, injectable } from 'inversify';
import { randomUUID } from 'node:crypto';
import type { KnowledgeChunk, KnowledgeDocument } from '@sophia/shared';
import type { IEmbeddingService, IKnowledgeRepository } from '../ports.js';
import { TYPES } from '../types.js';

function cosineSimilarity(a: number[], b: number[]): number {
  let dot = 0;
  let na = 0;
  let nb = 0;
  const len = Math.min(a.length, b.length);
  for (let i = 0; i < len; i++) {
    dot += a[i]! * b[i]!;
    na += a[i]! * a[i]!;
    nb += b[i]! * b[i]!;
  }
  if (na === 0 || nb === 0) return 0;
  return dot / (Math.sqrt(na) * Math.sqrt(nb));
}

function chunkText(text: string, maxChars = 700, overlap = 80): string[] {
  const cleaned = text.replace(/\r\n/g, '\n').trim();
  if (!cleaned) return [];
  if (cleaned.length <= maxChars) return [cleaned];

  const chunks: string[] = [];
  let start = 0;
  while (start < cleaned.length) {
    let end = Math.min(start + maxChars, cleaned.length);
    if (end < cleaned.length) {
      const slice = cleaned.slice(start, end);
      const lastBreak = Math.max(slice.lastIndexOf('\n\n'), slice.lastIndexOf('\n'), slice.lastIndexOf('. '));
      if (lastBreak > maxChars * 0.4) {
        end = start + lastBreak + 1;
      }
    }
    const piece = cleaned.slice(start, end).trim();
    if (piece) chunks.push(piece);
    if (end >= cleaned.length) break;
    start = Math.max(0, end - overlap);
  }
  return chunks;
}

@injectable()
export class KnowledgeService {
  constructor(
    @inject(TYPES.KnowledgeRepository) private readonly knowledge: IKnowledgeRepository,
    @inject(TYPES.EmbeddingService) private readonly embeddings: IEmbeddingService,
  ) {}

  listDocuments(parkId: string): Promise<KnowledgeDocument[]> {
    return this.knowledge.findDocumentsByPark(parkId);
  }

  getDocument(id: string): Promise<KnowledgeDocument | null> {
    return this.knowledge.findDocumentById(id);
  }

  async saveDocument(
    input: Omit<KnowledgeDocument, 'id' | 'version' | 'indexStatus'> & {
      id?: string;
      version?: number;
    },
  ): Promise<KnowledgeDocument> {
    const existing = input.id ? await this.knowledge.findDocumentById(input.id) : null;
    const now = new Date().toISOString();
    const doc: KnowledgeDocument = {
      id: input.id ?? randomUUID(),
      parkId: input.parkId,
      title: input.title,
      body: input.body,
      tags: input.tags ?? [],
      source: input.source,
      version: (existing?.version ?? 0) + 1,
      indexStatus: 'pending',
      createdAt: existing?.createdAt ?? now,
      updatedAt: now,
    };
    const saved = await this.knowledge.upsertDocument(doc);
    void this.reindexDocument(saved.id);
    return saved;
  }

  async deleteDocument(id: string): Promise<void> {
    await this.knowledge.deleteChunksByDoc(id);
    await this.knowledge.deleteDocument(id);
  }

  async reindexDocument(docId: string): Promise<KnowledgeDocument | null> {
    const doc = await this.knowledge.findDocumentById(docId);
    if (!doc) return null;

    const indexing: KnowledgeDocument = { ...doc, indexStatus: 'indexing', updatedAt: new Date().toISOString() };
    await this.knowledge.upsertDocument(indexing);

    try {
      const pieces = chunkText(`${doc.title}\n\n${doc.body}`);
      const vectors = await this.embeddings.embedBatch(pieces.map((t) => `passage: ${t}`));
      const chunks: KnowledgeChunk[] = pieces.map((text, i) => ({
        id: randomUUID(),
        parkId: doc.parkId,
        docId: doc.id,
        text,
        embedding: vectors[i]!,
        metadata: { title: doc.title, tags: doc.tags },
      }));
      await this.knowledge.replaceChunks(doc.id, chunks);
      const ready: KnowledgeDocument = {
        ...doc,
        indexStatus: 'ready',
        updatedAt: new Date().toISOString(),
      };
      return this.knowledge.upsertDocument(ready);
    } catch (err) {
      const failed: KnowledgeDocument = {
        ...doc,
        indexStatus: 'error',
        updatedAt: new Date().toISOString(),
      };
      await this.knowledge.upsertDocument(failed);
      throw err;
    }
  }

  async search(parkId: string, query: string, topK = 6): Promise<Array<{ text: string; score: number; title?: string }>> {
    const chunks = await this.knowledge.findChunksByPark(parkId);
    if (chunks.length === 0) return [];

    const queryVec = await this.embeddings.embed(`query: ${query}`);
    const scored = chunks
      .map((c) => ({
        text: c.text,
        score: cosineSimilarity(queryVec, c.embedding),
        title: typeof c.metadata?.title === 'string' ? c.metadata.title : undefined,
      }))
      .sort((a, b) => b.score - a.score)
      .slice(0, topK)
      .filter((c) => c.score > 0.25);

    return scored;
  }

  async getRules(parkId: string): Promise<string> {
    const docs = await this.knowledge.findDocumentsByPark(parkId);
    const rules = docs.filter((d) =>
      d.tags.some((t) => ['rules', 'запреты', 'правила'].includes(t.toLowerCase())) ||
      /правил|не делаем|запрет/i.test(d.title),
    );
    if (rules.length === 0) {
      const hits = await this.search(parkId, 'правила парка что нельзя', 4);
      return hits.map((h) => h.text).join('\n\n');
    }
    return rules.map((d) => `## ${d.title}\n${d.body}`).join('\n\n');
  }
}
