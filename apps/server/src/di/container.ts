import 'reflect-metadata';
import { Container } from 'inversify';
import { MongoClient, type Db } from 'mongodb';
import {
  BookingService,
  CatalogService,
  ConversationService,
  HandoffService,
  KnowledgeService,
  ParkService,
  TYPES,
} from '@sophia/domain';
import { McpToolRegistry } from '@sophia/mcp-tools';
import { loadConfig, type AppConfig } from '../config.js';
import {
  HashEmbeddingService,
  LocalTransformersEmbeddingService,
} from '../infrastructure/LocalTransformersEmbeddingService.js';
import {
  MongoAdminUserRepository,
  MongoBookingRepository,
  MongoCatalogRepository,
  MongoKnowledgeRepository,
  MongoParkRepository,
  MongoResourceRepository,
  MongoSessionRepository,
} from '../infrastructure/mongoRepositories.js';
import { YooKassaPaymentService } from '../infrastructure/YooKassaPaymentService.js';
import { AuthService } from '../services/AuthService.js';
import { AgentOrchestrator } from '../agent/AgentOrchestrator.js';

export async function createContainer(): Promise<{ container: Container; client: MongoClient; config: AppConfig }> {
  const config = loadConfig();
  const client = new MongoClient(config.mongodbUri);
  await client.connect();
  const db = client.db();

  const container = new Container({ defaultScope: 'Singleton' });

  container.bind<AppConfig>(TYPES.Config).toConstantValue(config);
  container.bind<MongoClient>(TYPES.MongoClient).toConstantValue(client);
  container.bind<Db>(TYPES.Db).toConstantValue(db);

  container.bind(TYPES.ParkRepository).toConstantValue(new MongoParkRepository(db));
  container.bind(TYPES.KnowledgeRepository).toConstantValue(new MongoKnowledgeRepository(db));
  container.bind(TYPES.CatalogRepository).toConstantValue(new MongoCatalogRepository(db));
  container.bind(TYPES.ResourceRepository).toConstantValue(new MongoResourceRepository(db));
  container.bind(TYPES.BookingRepository).toConstantValue(new MongoBookingRepository(db));
  container.bind(TYPES.AdminUserRepository).toConstantValue(new MongoAdminUserRepository(db));
  container.bind(TYPES.SessionRepository).toConstantValue(new MongoSessionRepository(db));

  // Default: fast hash embeddings. Set EMBEDDINGS_MODE=local for Xenova multilingual-e5.
  const useLocal = process.env.EMBEDDINGS_MODE === 'local';
  if (useLocal) {
    const emb = new LocalTransformersEmbeddingService(config.embeddingModel);
    container.bind(TYPES.EmbeddingService).toConstantValue(emb);
  } else {
    container.bind(TYPES.EmbeddingService).to(HashEmbeddingService);
  }

  const payments = new YooKassaPaymentService(config);
  container.bind(TYPES.PaymentService).toConstantValue(payments);

  container.bind(TYPES.ParkService).to(ParkService);
  container.bind(TYPES.KnowledgeService).to(KnowledgeService);
  container.bind(TYPES.CatalogService).to(CatalogService);
  container.bind(TYPES.BookingService).to(BookingService);
  container.bind(TYPES.HandoffService).to(HandoffService);
  container.bind(TYPES.ConversationService).to(ConversationService);
  container.bind(TYPES.AuthService).to(AuthService);
  container.bind(TYPES.McpToolRegistry).to(McpToolRegistry);
  container.bind(TYPES.AgentOrchestrator).to(AgentOrchestrator);

  return { container, client, config };
}
