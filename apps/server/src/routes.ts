import type { FastifyInstance } from 'fastify';
import type { Container } from 'inversify';
import { randomUUID } from 'node:crypto';
import {
  BookingService,
  CatalogService,
  ConversationService,
  KnowledgeService,
  ParkService,
  TYPES,
} from '@sophia/domain';
import type { IResourceRepository } from '@sophia/domain';
import { ChatRequestSchema, type CatalogItem, type Park } from '@sophia/shared';
import { AgentOrchestrator } from './agent/AgentOrchestrator.js';
import { AuthService } from './services/AuthService.js';
import { YooKassaPaymentService } from './infrastructure/YooKassaPaymentService.js';
import type { AppConfig } from './config.js';

function sseWrite(reply: { raw: NodeJS.WritableStream }, event: string, data: unknown) {
  reply.raw.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
}

export async function registerRoutes(app: FastifyInstance, container: Container): Promise<void> {
  const config = container.get<AppConfig>(TYPES.Config);

  app.get('/api/health', async () => ({ ok: true, service: 'sophia-ai' }));

  app.get('/api/parks', async () => {
    const parks = container.get<ParkService>(TYPES.ParkService);
    return parks.listActive();
  });

  app.get('/api/parks/all', { preHandler: [app.authenticate] }, async () => {
    return container.get<ParkService>(TYPES.ParkService).listAll();
  });

  app.post<{ Body: Park }>('/api/admin/parks', { preHandler: [app.authenticate] }, async (req) => {
    const body = req.body;
    const park: Park = {
      ...body,
      id: body.id || randomUUID(),
      updatedAt: new Date().toISOString(),
      createdAt: body.createdAt ?? new Date().toISOString(),
    };
    return container.get<ParkService>(TYPES.ParkService).upsert(park);
  });

  app.get<{ Querystring: { sessionId: string } }>('/api/chat/history', async (req, reply) => {
    const sessionId = req.query.sessionId;
    if (!sessionId) return reply.status(400).send({ error: 'sessionId required' });
    const conversation = container.get<ConversationService>(TYPES.ConversationService);
    const session = await conversation.getOrCreate(sessionId);
    return {
      sessionId: session.id,
      parkId: session.parkId ?? null,
      messages: (session.messages ?? []).map((m) => ({
        role: m.role,
        content: m.content,
      })),
    };
  });

  app.delete<{ Querystring: { sessionId: string } }>('/api/chat/history', async (req, reply) => {
    const sessionId = req.query.sessionId;
    if (!sessionId) return reply.status(400).send({ error: 'sessionId required' });
    await container.get<ConversationService>(TYPES.ConversationService).clear(sessionId);
    return { ok: true };
  });

  app.post('/api/chat', async (req, reply) => {
    const parsed = ChatRequestSchema.safeParse(req.body);
    if (!parsed.success) {
      return reply.status(400).send({ error: parsed.error.message });
    }

    const sessionId = parsed.data.sessionId ?? randomUUID();
    const orchestrator = container.get<AgentOrchestrator>(TYPES.AgentOrchestrator);
    const conversation = container.get<ConversationService>(TYPES.ConversationService);

    const lastUser = [...parsed.data.messages].reverse().find((m) => m.role === 'user');
    if (!lastUser?.content?.trim()) {
      return reply.status(400).send({ error: 'Нужно сообщение пользователя' });
    }

    const prior = await conversation.getContextMessages(sessionId);
    const messagesForModel = [...prior, { role: 'user' as const, content: lastUser.content }];

    reply.hijack();
    reply.raw.writeHead(200, {
      'Content-Type': 'text/event-stream; charset=utf-8',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
      'Access-Control-Allow-Origin': config.webOrigin,
    });

    sseWrite(reply, 'session', { sessionId });

    let assistantText = '';
    let metaParkId: string | undefined = parsed.data.parkId;

    try {
      for await (const event of orchestrator.streamChat({
        messages: messagesForModel,
        sessionId,
        parkId: parsed.data.parkId,
      })) {
        if (event.type === 'token') {
          assistantText += String(event.data);
        }
        if (event.type === 'meta') {
          const parkId = (event.data as { parkId?: string | null }).parkId;
          if (parkId) metaParkId = parkId;
        }
        sseWrite(reply, event.type, event.data);
      }

      if (assistantText.trim()) {
        await conversation.appendTurn(sessionId, lastUser.content, assistantText.trim(), metaParkId);
      }
    } catch (e) {
      sseWrite(reply, 'error', e instanceof Error ? e.message : String(e));
    }

    reply.raw.end();
  });

  app.post<{ Body: { email: string; password: string } }>('/api/admin/login', async (req, reply) => {
    const auth = container.get<AuthService>(TYPES.AuthService);
    const user = await auth.validate(req.body.email, req.body.password);
    if (!user) return reply.status(401).send({ error: 'Неверный логин или пароль' });
    const token = await reply.jwtSign({ sub: user.id, email: user.email, role: user.role });
    return { token, user: { email: user.email, role: user.role } };
  });

  app.get<{ Querystring: { parkId: string } }>(
    '/api/admin/knowledge',
    { preHandler: [app.authenticate] },
    async (req) => {
      return container.get<KnowledgeService>(TYPES.KnowledgeService).listDocuments(req.query.parkId);
    },
  );

  app.post<{
    Body: {
      id?: string;
      parkId: string;
      title: string;
      body: string;
      tags?: string[];
      source?: string;
    };
  }>('/api/admin/knowledge', { preHandler: [app.authenticate] }, async (req) => {
    return container.get<KnowledgeService>(TYPES.KnowledgeService).saveDocument({
      ...req.body,
      tags: req.body.tags ?? [],
    });
  });

  app.delete<{ Params: { id: string } }>(
    '/api/admin/knowledge/:id',
    { preHandler: [app.authenticate] },
    async (req) => {
      await container.get<KnowledgeService>(TYPES.KnowledgeService).deleteDocument(req.params.id);
      return { ok: true };
    },
  );

  app.post<{ Params: { id: string } }>(
    '/api/admin/knowledge/:id/reindex',
    { preHandler: [app.authenticate] },
    async (req) => {
      return container.get<KnowledgeService>(TYPES.KnowledgeService).reindexDocument(req.params.id);
    },
  );

  app.get<{ Querystring: { parkId: string } }>(
    '/api/admin/catalog',
    { preHandler: [app.authenticate] },
    async (req) => {
      return container.get<CatalogService>(TYPES.CatalogService).list(req.query.parkId);
    },
  );

  app.post<{ Body: CatalogItem }>(
    '/api/admin/catalog',
    { preHandler: [app.authenticate] },
    async (req) => {
      const item = { ...req.body, id: req.body.id || randomUUID() };
      return container.get<CatalogService>(TYPES.CatalogService).upsert(item);
    },
  );

  app.get<{ Querystring: { parkId: string; from?: string; to?: string } }>(
    '/api/admin/bookings',
    { preHandler: [app.authenticate] },
    async (req) => {
      return container
        .get<BookingService>(TYPES.BookingService)
        .listByPark(req.query.parkId, req.query.from, req.query.to);
    },
  );

  app.patch<{ Params: { id: string }; Body: { status: 'draft' | 'awaiting_payment' | 'confirmed' | 'cancelled' } }>(
    '/api/admin/bookings/:id',
    { preHandler: [app.authenticate] },
    async (req) => {
      return container.get<BookingService>(TYPES.BookingService).adminUpdateStatus(req.params.id, req.body.status);
    },
  );

  app.get<{ Querystring: { parkId: string } }>(
    '/api/admin/resources',
    { preHandler: [app.authenticate] },
    async (req) => {
      return container.get<IResourceRepository>(TYPES.ResourceRepository).findByPark(req.query.parkId);
    },
  );

  app.post('/api/webhooks/yookassa', async (req) => {
    const payments = container.get<YooKassaPaymentService>(TYPES.PaymentService);
    const result = await payments.handleWebhook(req.body);
    if (result?.bookingId && result.status === 'succeeded') {
      await container.get<BookingService>(TYPES.BookingService).confirmPaid(result.bookingId);
    }
    return { ok: true };
  });

  app.post<{ Body: { paymentId: string } }>('/api/payments/mock-confirm', async (req, reply) => {
    const payments = container.get<YooKassaPaymentService>(TYPES.PaymentService);
    const bookingId = payments.confirmMock(req.body.paymentId);
    if (!bookingId) return reply.status(404).send({ error: 'Mock payment not found' });
    const booking = await container.get<BookingService>(TYPES.BookingService).confirmPaid(bookingId, req.body.paymentId);
    return { ok: true, booking };
  });
}

declare module 'fastify' {
  interface FastifyInstance {
    authenticate: (req: FastifyRequest, reply: FastifyReply) => Promise<void>;
  }
}

import type { FastifyReply, FastifyRequest } from 'fastify';
