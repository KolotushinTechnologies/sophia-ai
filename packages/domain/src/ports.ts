import type {
  AdminUser,
  Booking,
  CatalogItem,
  CreateBookingInput,
  KnowledgeChunk,
  KnowledgeDocument,
  Park,
  Resource,
} from '@sophia/shared';

export interface IParkRepository {
  findAll(): Promise<Park[]>;
  findActive(): Promise<Park[]>;
  findById(id: string): Promise<Park | null>;
  findBySlug(slug: string): Promise<Park | null>;
  findDefault(): Promise<Park | null>;
  upsert(park: Park): Promise<Park>;
  delete(id: string): Promise<void>;
}

export interface IKnowledgeRepository {
  findDocumentsByPark(parkId: string): Promise<KnowledgeDocument[]>;
  findDocumentById(id: string): Promise<KnowledgeDocument | null>;
  upsertDocument(doc: KnowledgeDocument): Promise<KnowledgeDocument>;
  deleteDocument(id: string): Promise<void>;
  replaceChunks(docId: string, chunks: KnowledgeChunk[]): Promise<void>;
  findChunksByPark(parkId: string): Promise<KnowledgeChunk[]>;
  deleteChunksByDoc(docId: string): Promise<void>;
}

export interface ICatalogRepository {
  findByPark(parkId: string): Promise<CatalogItem[]>;
  findById(id: string): Promise<CatalogItem | null>;
  upsert(item: CatalogItem): Promise<CatalogItem>;
  delete(id: string): Promise<void>;
}

export interface IResourceRepository {
  findByPark(parkId: string): Promise<Resource[]>;
  findById(id: string): Promise<Resource | null>;
  upsert(resource: Resource): Promise<Resource>;
}

export interface IBookingRepository {
  create(booking: Booking): Promise<Booking>;
  update(booking: Booking): Promise<Booking>;
  findById(id: string): Promise<Booking | null>;
  findByCode(code: string): Promise<Booking | null>;
  findByPark(parkId: string, from?: string, to?: string): Promise<Booking[]>;
  findOverlapping(
    parkId: string,
    resourceIds: string[],
    startsAt: string,
    endsAt: string,
    excludeId?: string,
  ): Promise<Booking[]>;
}

export interface IAdminUserRepository {
  findByEmail(email: string): Promise<AdminUser | null>;
  upsert(user: AdminUser): Promise<AdminUser>;
}

export interface ChatSessionMessage {
  role: 'user' | 'assistant';
  content: string;
  at: string;
}

export interface ChatSession {
  id: string;
  parkId?: string;
  messages: ChatSessionMessage[];
  createdAt: string;
  updatedAt: string;
}

export interface ISessionRepository {
  get(id: string): Promise<ChatSession | null>;
  upsert(session: ChatSession): Promise<ChatSession>;
  appendMessages(id: string, messages: ChatSessionMessage[], parkId?: string): Promise<ChatSession>;
  clearMessages(id: string): Promise<ChatSession | null>;
}

export interface IEmbeddingService {
  warmUp(): Promise<void>;
  embed(text: string): Promise<number[]>;
  embedBatch(texts: string[]): Promise<number[][]>;
  readonly dimensions: number;
}

export interface PaymentCreateResult {
  paymentId: string;
  confirmationUrl: string;
  mock: boolean;
}

export interface IPaymentService {
  createPayment(params: {
    amount: number;
    description: string;
    bookingId: string;
    returnUrl?: string;
  }): Promise<PaymentCreateResult>;
  getStatus(paymentId: string): Promise<'pending' | 'succeeded' | 'canceled'>;
  handleWebhook(body: unknown): Promise<{ bookingId?: string; status: string } | null>;
}
