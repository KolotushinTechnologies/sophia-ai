import 'reflect-metadata';
import { TYPES, type KnowledgeService, type CatalogService, type ParkService } from '@sophia/domain';
import type { IEmbeddingService, IResourceRepository } from '@sophia/domain';
import { createContainer } from '../di/container.js';
import { AuthService } from '../services/AuthService.js';
import { seedNakhodka } from './seedData.js';

async function main() {
  process.env.EMBEDDINGS_MODE = process.env.EMBEDDINGS_MODE ?? 'hash';
  const { container, client } = await createContainer();

  const auth = container.get<AuthService>(TYPES.AuthService);
  await auth.ensureAdminSeeded();

  const embeddings = container.get<IEmbeddingService>(TYPES.EmbeddingService);
  await embeddings.warmUp();

  await seedNakhodka({
    parks: container.get<ParkService>(TYPES.ParkService),
    knowledge: container.get<KnowledgeService>(TYPES.KnowledgeService),
    catalog: container.get<CatalogService>(TYPES.CatalogService),
    resources: container.get<IResourceRepository>(TYPES.ResourceRepository),
  });

  console.log('Seed complete: Находка park, catalog, knowledge docs, admin user.');
  console.log('Knowledge indexing runs in background — wait a few seconds for ready status.');

  // Wait for indexing of docs (hash embeddings are fast)
  await new Promise((r) => setTimeout(r, 3000));
  await client.close();
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
