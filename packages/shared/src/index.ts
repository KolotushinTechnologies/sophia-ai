import { z } from 'zod';

export const ParkSchema = z.object({
  id: z.string(),
  slug: z.string(),
  name: z.string(),
  city: z.string(),
  timezone: z.string().default('Asia/Vladivostok'),
  address: z.string(),
  phones: z.array(z.string()),
  hours: z.string(),
  isActive: z.boolean().default(true),
  isDefault: z.boolean().default(false),
  website: z.string().optional(),
  socials: z
    .object({
      vk: z.string().optional(),
      instagram: z.string().optional(),
      telegram: z.string().optional(),
      max: z.string().optional(),
    })
    .optional(),
  createdAt: z.string().optional(),
  updatedAt: z.string().optional(),
});
export type Park = z.infer<typeof ParkSchema>;

export const KnowledgeDocumentSchema = z.object({
  id: z.string(),
  parkId: z.string(),
  title: z.string(),
  body: z.string(),
  tags: z.array(z.string()).default([]),
  source: z.string().optional(),
  version: z.number().default(1),
  indexStatus: z.enum(['pending', 'indexing', 'ready', 'error']).default('pending'),
  createdAt: z.string().optional(),
  updatedAt: z.string().optional(),
});
export type KnowledgeDocument = z.infer<typeof KnowledgeDocumentSchema>;

export const KnowledgeChunkSchema = z.object({
  id: z.string(),
  parkId: z.string(),
  docId: z.string(),
  text: z.string(),
  embedding: z.array(z.number()),
  metadata: z.record(z.unknown()).optional(),
});
export type KnowledgeChunk = z.infer<typeof KnowledgeChunkSchema>;

export const CatalogCategorySchema = z.enum([
  'ticket',
  'package',
  'graduation',
  'show',
  'quest',
  'workshop',
  'extra',
  'rental',
  'babysitting',
]);
export type CatalogCategory = z.infer<typeof CatalogCategorySchema>;

export const CatalogItemSchema = z.object({
  id: z.string(),
  parkId: z.string(),
  category: CatalogCategorySchema,
  name: z.string(),
  description: z.string().optional(),
  priceWeekday: z.number().optional(),
  priceWeekend: z.number().optional(),
  price: z.number().optional(),
  durationMinutes: z.number().optional(),
  guestsIncluded: z.number().optional(),
  features: z.array(z.string()).default([]),
  ageMin: z.number().optional(),
  ageMax: z.number().optional(),
  isActive: z.boolean().default(true),
});
export type CatalogItem = z.infer<typeof CatalogItemSchema>;

export const ResourceTypeSchema = z.enum(['banquet_room', 'party_room', 'table']);
export type ResourceType = z.infer<typeof ResourceTypeSchema>;

export const ResourceSchema = z.object({
  id: z.string(),
  parkId: z.string(),
  type: ResourceTypeSchema,
  name: z.string(),
  capacity: z.number().optional(),
  hourlyRate: z.number().optional(),
  isActive: z.boolean().default(true),
});
export type Resource = z.infer<typeof ResourceSchema>;

export const BookingTypeSchema = z.enum([
  'visit',
  'birthday',
  'graduation',
  'banquet',
  'party_room',
  'babysitting',
]);
export type BookingType = z.infer<typeof BookingTypeSchema>;

export const BookingStatusSchema = z.enum([
  'draft',
  'awaiting_payment',
  'confirmed',
  'cancelled',
]);
export type BookingStatus = z.infer<typeof BookingStatusSchema>;

export const BookingSchema = z.object({
  id: z.string(),
  code: z.string(),
  parkId: z.string(),
  type: BookingTypeSchema,
  status: BookingStatusSchema,
  guestName: z.string(),
  guestPhone: z.string(),
  guestEmail: z.string().optional(),
  childName: z.string().optional(),
  childAge: z.number().optional(),
  guestsCount: z.number().optional(),
  packageId: z.string().optional(),
  resourceIds: z.array(z.string()).default([]),
  startsAt: z.string(),
  endsAt: z.string(),
  notes: z.string().optional(),
  prepaidAmount: z.number().optional(),
  totalAmount: z.number().optional(),
  paymentId: z.string().optional(),
  paymentUrl: z.string().optional(),
  favoriteHeroes: z.string().optional(),
  createdAt: z.string().optional(),
  updatedAt: z.string().optional(),
});
export type Booking = z.infer<typeof BookingSchema>;

export const CreateBookingInputSchema = z.object({
  parkId: z.string(),
  type: BookingTypeSchema,
  guestName: z.string().min(1),
  guestPhone: z.string().min(5),
  guestEmail: z.string().email().optional(),
  childName: z.string().optional(),
  childAge: z.number().optional(),
  guestsCount: z.number().optional(),
  packageId: z.string().optional(),
  resourceIds: z.array(z.string()).optional(),
  startsAt: z.string(),
  endsAt: z.string().optional(),
  notes: z.string().optional(),
  favoriteHeroes: z.string().optional(),
});
export type CreateBookingInput = z.infer<typeof CreateBookingInputSchema>;

export const ChatMessageSchema = z.object({
  role: z.enum(['user', 'assistant']),
  content: z.string(),
});
export type ChatMessage = z.infer<typeof ChatMessageSchema>;

export const ChatRequestSchema = z.object({
  messages: z.array(ChatMessageSchema),
  sessionId: z.string().optional(),
  parkId: z.string().optional(),
});
export type ChatRequest = z.infer<typeof ChatRequestSchema>;

export const AdminUserSchema = z.object({
  id: z.string(),
  email: z.string().email(),
  passwordHash: z.string(),
  role: z.enum(['admin', 'manager']).default('admin'),
});
export type AdminUser = z.infer<typeof AdminUserSchema>;

export const WEEKDAY_TABLE_PREPAY = 5000;
export const PACKAGE_ROOM_MINUTES = 150;
export const PACKAGE_CLEANUP_MINUTES = 30;
export const BANQUET_EXTEND_HOURLY = 1000;
