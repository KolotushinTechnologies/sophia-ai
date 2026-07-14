import type {
  AdminUser,
  Booking,
  CatalogItem,
  KnowledgeChunk,
  KnowledgeDocument,
  Park,
  Resource,
} from '@sophia/shared';
import type {
  ChatSession,
  ChatSessionMessage,
  IAdminUserRepository,
  IBookingRepository,
  ICatalogRepository,
  IKnowledgeRepository,
  IParkRepository,
  IResourceRepository,
  ISessionRepository,
} from '@sophia/domain';
import type { Db } from 'mongodb';

function stripId<T extends { id: string }>(doc: T): Omit<T, 'id'> & { _id: string } {
  const { id, ...rest } = doc;
  return { ...rest, _id: id };
}

function withId<T>(doc: (T & { _id: string }) | null): (T & { id: string }) | null {
  if (!doc) return null;
  const { _id, ...rest } = doc;
  return { ...(rest as T), id: _id };
}

export class MongoParkRepository implements IParkRepository {
  constructor(private readonly db: Db) {}
  private col() {
    return this.db.collection<Park & { _id: string }>('parks');
  }
  async findAll(): Promise<Park[]> {
    const rows = await this.col().find({}).toArray();
    return rows.map((r) => withId(r)!) as Park[];
  }
  async findActive(): Promise<Park[]> {
    const rows = await this.col().find({ isActive: true }).toArray();
    return rows.map((r) => withId(r)!) as Park[];
  }
  async findById(id: string): Promise<Park | null> {
    return withId(await this.col().findOne({ _id: id })) as Park | null;
  }
  async findBySlug(slug: string): Promise<Park | null> {
    return withId(await this.col().findOne({ slug })) as Park | null;
  }
  async findDefault(): Promise<Park | null> {
    const d = await this.col().findOne({ isDefault: true, isActive: true });
    if (d) return withId(d) as Park;
    const any = await this.col().findOne({ isActive: true });
    return withId(any) as Park | null;
  }
  async upsert(park: Park): Promise<Park> {
    await this.col().updateOne({ _id: park.id }, { $set: stripId(park) }, { upsert: true });
    return park;
  }
  async delete(id: string): Promise<void> {
    await this.col().deleteOne({ _id: id });
  }
}

export class MongoKnowledgeRepository implements IKnowledgeRepository {
  constructor(private readonly db: Db) {}
  private docs() {
    return this.db.collection<KnowledgeDocument & { _id: string }>('knowledge_documents');
  }
  private chunks() {
    return this.db.collection<KnowledgeChunk & { _id: string }>('knowledge_chunks');
  }
  async findDocumentsByPark(parkId: string): Promise<KnowledgeDocument[]> {
    const rows = await this.docs().find({ parkId }).sort({ updatedAt: -1 }).toArray();
    return rows.map((r) => withId(r)!) as KnowledgeDocument[];
  }
  async findDocumentById(id: string): Promise<KnowledgeDocument | null> {
    return withId(await this.docs().findOne({ _id: id })) as KnowledgeDocument | null;
  }
  async upsertDocument(doc: KnowledgeDocument): Promise<KnowledgeDocument> {
    await this.docs().updateOne({ _id: doc.id }, { $set: stripId(doc) }, { upsert: true });
    return doc;
  }
  async deleteDocument(id: string): Promise<void> {
    await this.docs().deleteOne({ _id: id });
  }
  async replaceChunks(docId: string, chunks: KnowledgeChunk[]): Promise<void> {
    await this.chunks().deleteMany({ docId });
    if (chunks.length) {
      await this.chunks().insertMany(
        chunks.map((c) => stripId(c)) as unknown as Array<KnowledgeChunk & { _id: string }>,
      );
    }
  }
  async findChunksByPark(parkId: string): Promise<KnowledgeChunk[]> {
    const rows = await this.chunks().find({ parkId }).toArray();
    return rows.map((r) => withId(r)!) as KnowledgeChunk[];
  }
  async deleteChunksByDoc(docId: string): Promise<void> {
    await this.chunks().deleteMany({ docId });
  }
}

export class MongoCatalogRepository implements ICatalogRepository {
  constructor(private readonly db: Db) {}
  private col() {
    return this.db.collection<CatalogItem & { _id: string }>('catalog_items');
  }
  async findByPark(parkId: string): Promise<CatalogItem[]> {
    const rows = await this.col().find({ parkId, isActive: true }).toArray();
    return rows.map((r) => withId(r)!) as CatalogItem[];
  }
  async findById(id: string): Promise<CatalogItem | null> {
    return withId(await this.col().findOne({ _id: id })) as CatalogItem | null;
  }
  async upsert(item: CatalogItem): Promise<CatalogItem> {
    await this.col().updateOne({ _id: item.id }, { $set: stripId(item) }, { upsert: true });
    return item;
  }
  async delete(id: string): Promise<void> {
    await this.col().deleteOne({ _id: id });
  }
}

export class MongoResourceRepository implements IResourceRepository {
  constructor(private readonly db: Db) {}
  private col() {
    return this.db.collection<Resource & { _id: string }>('resources');
  }
  async findByPark(parkId: string): Promise<Resource[]> {
    const rows = await this.col().find({ parkId }).toArray();
    return rows.map((r) => withId(r)!) as Resource[];
  }
  async findById(id: string): Promise<Resource | null> {
    return withId(await this.col().findOne({ _id: id })) as Resource | null;
  }
  async upsert(resource: Resource): Promise<Resource> {
    await this.col().updateOne({ _id: resource.id }, { $set: stripId(resource) }, { upsert: true });
    return resource;
  }
}

export class MongoBookingRepository implements IBookingRepository {
  constructor(private readonly db: Db) {}
  private col() {
    return this.db.collection<Booking & { _id: string }>('bookings');
  }
  async create(booking: Booking): Promise<Booking> {
    await this.col().insertOne(stripId(booking) as Booking & { _id: string });
    return booking;
  }
  async update(booking: Booking): Promise<Booking> {
    await this.col().updateOne({ _id: booking.id }, { $set: stripId(booking) });
    return booking;
  }
  async findById(id: string): Promise<Booking | null> {
    return withId(await this.col().findOne({ _id: id })) as Booking | null;
  }
  async findByCode(code: string): Promise<Booking | null> {
    return withId(await this.col().findOne({ code })) as Booking | null;
  }
  async findByPark(parkId: string, from?: string, to?: string): Promise<Booking[]> {
    const q: Record<string, unknown> = { parkId };
    if (from || to) {
      q.startsAt = {};
      if (from) (q.startsAt as Record<string, string>).$gte = from;
      if (to) (q.startsAt as Record<string, string>).$lte = to;
    }
    const rows = await this.col().find(q).sort({ startsAt: 1 }).toArray();
    return rows.map((r) => withId(r)!) as Booking[];
  }
  async findOverlapping(
    parkId: string,
    resourceIds: string[],
    startsAt: string,
    endsAt: string,
    excludeId?: string,
  ): Promise<Booking[]> {
    const q: Record<string, unknown> = {
      parkId,
      status: { $in: ['confirmed', 'awaiting_payment'] },
      startsAt: { $lt: endsAt },
      endsAt: { $gt: startsAt },
    };
    if (resourceIds.length) {
      q.resourceIds = { $in: resourceIds };
    }
    if (excludeId) q._id = { $ne: excludeId };
    const rows = await this.col().find(q).toArray();
    return rows.map((r) => withId(r)!) as Booking[];
  }
}

export class MongoAdminUserRepository implements IAdminUserRepository {
  constructor(private readonly db: Db) {}
  private col() {
    return this.db.collection<AdminUser & { _id: string }>('admin_users');
  }
  async findByEmail(email: string): Promise<AdminUser | null> {
    return withId(await this.col().findOne({ email: email.toLowerCase() })) as AdminUser | null;
  }
  async upsert(user: AdminUser): Promise<AdminUser> {
    await this.col().updateOne({ _id: user.id }, { $set: stripId(user) }, { upsert: true });
    return user;
  }
}

export class MongoSessionRepository implements ISessionRepository {
  constructor(private readonly db: Db) {}
  private col() {
    return this.db.collection<ChatSession & { _id: string }>('chat_sessions');
  }
  async get(id: string): Promise<ChatSession | null> {
    const row = withId(await this.col().findOne({ _id: id })) as ChatSession | null;
    if (!row) return null;
    return { ...row, messages: row.messages ?? [] };
  }
  async upsert(session: ChatSession): Promise<ChatSession> {
    const payload = {
      ...stripId({
        ...session,
        messages: session.messages ?? [],
      }),
    };
    await this.col().updateOne({ _id: session.id }, { $set: payload }, { upsert: true });
    return { ...session, messages: session.messages ?? [] };
  }
  async appendMessages(id: string, messages: ChatSessionMessage[], parkId?: string): Promise<ChatSession> {
    const existing = await this.get(id);
    const now = new Date().toISOString();
    const next: ChatSession = {
      id,
      parkId: parkId ?? existing?.parkId,
      messages: [...(existing?.messages ?? []), ...messages].slice(-80),
      createdAt: existing?.createdAt ?? now,
      updatedAt: now,
    };
    return this.upsert(next);
  }
  async clearMessages(id: string): Promise<ChatSession | null> {
    const existing = await this.get(id);
    if (!existing) return null;
    return this.upsert({ ...existing, messages: [], updatedAt: new Date().toISOString() });
  }
}
