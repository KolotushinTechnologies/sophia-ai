import { inject, injectable } from 'inversify';
import {
  BookingService,
  CatalogService,
  HandoffService,
  KnowledgeService,
  ParkService,
  TYPES,
  type IPaymentService,
} from '@sophia/domain';
import { CreateBookingInputSchema } from '@sophia/shared';

export interface McpToolDefinition {
  name: string;
  description: string;
  inputSchema: Record<string, unknown>;
  handler: (args: Record<string, unknown>, ctx: ToolContext) => Promise<unknown>;
}

export interface ToolContext {
  sessionId: string;
  parkId?: string;
}

@injectable()
export class McpToolRegistry {
  constructor(
    @inject(TYPES.ParkService) private readonly parks: ParkService,
    @inject(TYPES.KnowledgeService) private readonly knowledge: KnowledgeService,
    @inject(TYPES.CatalogService) private readonly catalog: CatalogService,
    @inject(TYPES.BookingService) private readonly bookings: BookingService,
    @inject(TYPES.HandoffService) private readonly handoff: HandoffService,
    @inject(TYPES.PaymentService) private readonly payments: IPaymentService,
  ) {}

  listTools(): McpToolDefinition[] {
    return [
      {
        name: 'city_list',
        description: 'Список активных городов/парков Sofi Park',
        inputSchema: { type: 'object', properties: {}, required: [] },
        handler: async () => {
          const parks = await this.parks.listActive();
          return parks.map((p) => ({
            id: p.id,
            city: p.city,
            name: p.name,
            slug: p.slug,
            isDefault: p.isDefault,
            address: p.address,
            hours: p.hours,
            phones: p.phones,
            website: p.website,
            socials: p.socials,
          }));
        },
      },
      {
        name: 'city_get',
        description: 'Детали парка по id',
        inputSchema: {
          type: 'object',
          properties: { parkId: { type: 'string' } },
          required: ['parkId'],
        },
        handler: async (args) => {
          const park = await this.parks.getById(String(args.parkId));
          if (!park) return { error: 'Park not found' };
          return park;
        },
      },
      {
        name: 'city_set_session',
        description: 'Выбрать город для текущей сессии клиента',
        inputSchema: {
          type: 'object',
          properties: {
            parkId: { type: 'string', description: 'ID парка' },
          },
          required: ['parkId'],
        },
        handler: async (args, ctx) => {
          const park = await this.parks.setSessionPark(ctx.sessionId, String(args.parkId));
          if (!park) return { error: 'Не удалось выбрать город' };
          return { ok: true, park: { id: park.id, city: park.city, name: park.name } };
        },
      },
      {
        name: 'knowledge_search',
        description:
          'Семантический поиск по базе знаний выбранного парка (правила, FAQ, описания, атмосфера). Для цен используй catalog_*',
        inputSchema: {
          type: 'object',
          properties: {
            query: { type: 'string' },
            parkId: { type: 'string' },
          },
          required: ['query'],
        },
        handler: async (args, ctx) => {
          const parkId = String(args.parkId ?? ctx.parkId ?? '');
          if (!parkId) return { error: 'Сначала выберите город (city_set_session)' };
          const hits = await this.knowledge.search(parkId, String(args.query));
          return { parkId, hits };
        },
      },
      {
        name: 'knowledge_get_rules',
        description: 'Правила парка и что парк НЕ делает',
        inputSchema: {
          type: 'object',
          properties: { parkId: { type: 'string' } },
          required: [],
        },
        handler: async (args, ctx) => {
          const parkId = String(args.parkId ?? ctx.parkId ?? '');
          if (!parkId) return { error: 'Сначала выберите город' };
          const rules = await this.knowledge.getRules(parkId);
          return { parkId, rules };
        },
      },
      {
        name: 'catalog_list',
        description: 'Каталог услуг и пакетов парка (цены, шоу, МК, аренда, билеты)',
        inputSchema: {
          type: 'object',
          properties: {
            parkId: { type: 'string' },
            category: { type: 'string' },
          },
          required: [],
        },
        handler: async (args, ctx) => {
          const parkId = String(args.parkId ?? ctx.parkId ?? '');
          if (!parkId) return { error: 'Сначала выберите город' };
          let items = await this.catalog.list(parkId);
          if (args.category) {
            items = items.filter((i) => i.category === args.category);
          }
          return {
            parkId,
            items: items.map((i) => ({
              id: i.id,
              category: i.category,
              name: i.name,
              description: i.description,
              price: i.price,
              priceWeekday: i.priceWeekday,
              priceWeekend: i.priceWeekend,
              guestsIncluded: i.guestsIncluded,
              features: i.features,
              ageMin: i.ageMin,
              ageMax: i.ageMax,
            })),
          };
        },
      },
      {
        name: 'catalog_get',
        description: 'Детали позиции каталога по id',
        inputSchema: {
          type: 'object',
          properties: { itemId: { type: 'string' } },
          required: ['itemId'],
        },
        handler: async (args) => {
          const item = await this.catalog.get(String(args.itemId));
          return item ?? { error: 'Not found' };
        },
      },
      {
        name: 'catalog_estimate',
        description: 'Оценить стоимость пакета/услуг на дату (учитывает будни/выходные)',
        inputSchema: {
          type: 'object',
          properties: {
            parkId: { type: 'string' },
            packageId: { type: 'string' },
            itemIds: { type: 'array', items: { type: 'string' } },
            dateIso: { type: 'string' },
          },
          required: ['dateIso'],
        },
        handler: async (args, ctx) => {
          const parkId = String(args.parkId ?? ctx.parkId ?? '');
          if (!parkId) return { error: 'Сначала выберите город' };
          return this.catalog.estimate({
            parkId,
            packageId: args.packageId ? String(args.packageId) : undefined,
            itemIds: Array.isArray(args.itemIds) ? args.itemIds.map(String) : undefined,
            dateIso: String(args.dateIso),
          });
        },
      },
      {
        name: 'booking_check_availability',
        description: 'Проверить доступность слота для бронирования',
        inputSchema: {
          type: 'object',
          properties: {
            parkId: { type: 'string' },
            startsAt: { type: 'string', description: 'ISO datetime' },
            durationMinutes: { type: 'number' },
            type: { type: 'string' },
          },
          required: ['startsAt'],
        },
        handler: async (args, ctx) => {
          const parkId = String(args.parkId ?? ctx.parkId ?? '');
          if (!parkId) return { error: 'Сначала выберите город' };
          return this.bookings.checkAvailability({
            parkId,
            startsAt: String(args.startsAt),
            durationMinutes: args.durationMinutes ? Number(args.durationMinutes) : undefined,
            type: args.type ? String(args.type) : undefined,
          });
        },
      },
      {
        name: 'booking_create',
        description:
          'Создать бронь (self-service). Вернёт код брони и ссылку на оплату если нужна предоплата.',
        inputSchema: {
          type: 'object',
          properties: {
            parkId: { type: 'string' },
            type: { type: 'string' },
            guestName: { type: 'string' },
            guestPhone: { type: 'string' },
            guestEmail: { type: 'string' },
            childName: { type: 'string' },
            childAge: { type: 'number' },
            guestsCount: { type: 'number' },
            packageId: { type: 'string' },
            startsAt: { type: 'string' },
            endsAt: { type: 'string' },
            notes: { type: 'string' },
            favoriteHeroes: { type: 'string' },
          },
          required: ['type', 'guestName', 'guestPhone', 'startsAt'],
        },
        handler: async (args, ctx) => {
          const parkId = String(args.parkId ?? ctx.parkId ?? '');
          if (!parkId) return { error: 'Сначала выберите город' };
          const parsed = CreateBookingInputSchema.safeParse({ ...args, parkId });
          if (!parsed.success) {
            return { error: parsed.error.message };
          }
          try {
            const booking = await this.bookings.create(parsed.data);
            return {
              id: booking.id,
              code: booking.code,
              status: booking.status,
              startsAt: booking.startsAt,
              endsAt: booking.endsAt,
              prepaidAmount: booking.prepaidAmount,
              totalAmount: booking.totalAmount,
              paymentUrl: booking.paymentUrl,
            };
          } catch (e) {
            return { error: e instanceof Error ? e.message : String(e) };
          }
        },
      },
      {
        name: 'booking_get',
        description: 'Получить бронь по коду',
        inputSchema: {
          type: 'object',
          properties: { code: { type: 'string' } },
          required: ['code'],
        },
        handler: async (args) => {
          const booking = await this.bookings.getByCode(String(args.code));
          if (!booking) return { error: 'Не найдено' };
          return booking;
        },
      },
      {
        name: 'booking_cancel',
        description: 'Отменить бронь по коду и телефону гостя',
        inputSchema: {
          type: 'object',
          properties: {
            code: { type: 'string' },
            phone: { type: 'string' },
          },
          required: ['code', 'phone'],
        },
        handler: async (args) => {
          try {
            return await this.bookings.cancel(String(args.code), String(args.phone));
          } catch (e) {
            return { error: e instanceof Error ? e.message : String(e) };
          }
        },
      },
      {
        name: 'payment_status',
        description: 'Статус оплаты по paymentId',
        inputSchema: {
          type: 'object',
          properties: { paymentId: { type: 'string' } },
          required: ['paymentId'],
        },
        handler: async (args) => {
          const status = await this.payments.getStatus(String(args.paymentId));
          return { paymentId: args.paymentId, status };
        },
      },
      {
        name: 'handoff_to_manager',
        description:
          'Эскалация к живому менеджеру (сложные кейсы: спорт, медицина, выезд аниматора, конфликт)',
        inputSchema: {
          type: 'object',
          properties: {
            reason: { type: 'string' },
            parkId: { type: 'string' },
          },
          required: ['reason'],
        },
        handler: async (args, ctx) => {
          return this.handoff.toManager(
            args.parkId ? String(args.parkId) : ctx.parkId,
            String(args.reason),
          );
        },
      },
    ];
  }

  async call(name: string, args: Record<string, unknown>, ctx: ToolContext): Promise<unknown> {
    const tool = this.listTools().find((t) => t.name === name);
    if (!tool) throw new Error(`Unknown tool: ${name}`);
    return tool.handler(args, ctx);
  }

  asAnthropicTools(): Array<{
    name: string;
    description: string;
    input_schema: Record<string, unknown>;
  }> {
    return this.listTools().map((t) => ({
      name: t.name,
      description: t.description,
      input_schema: t.inputSchema,
    }));
  }
}
