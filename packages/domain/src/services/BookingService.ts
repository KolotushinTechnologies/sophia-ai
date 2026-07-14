import { inject, injectable } from 'inversify';
import { randomBytes, randomUUID } from 'node:crypto';
import {
  BANQUET_EXTEND_HOURLY,
  PACKAGE_CLEANUP_MINUTES,
  PACKAGE_ROOM_MINUTES,
  WEEKDAY_TABLE_PREPAY,
  type Booking,
  type CreateBookingInput,
} from '@sophia/shared';
import type {
  IBookingRepository,
  ICatalogRepository,
  IPaymentService,
  IResourceRepository,
} from '../ports.js';
import { TYPES } from '../types.js';

function isWeekend(date: Date): boolean {
  const day = date.getDay();
  return day === 0 || day === 6;
}

function bookingCode(): string {
  return `SF-${randomBytes(3).toString('hex').toUpperCase()}`;
}

@injectable()
export class BookingService {
  constructor(
    @inject(TYPES.BookingRepository) private readonly bookings: IBookingRepository,
    @inject(TYPES.ResourceRepository) private readonly resources: IResourceRepository,
    @inject(TYPES.CatalogRepository) private readonly catalog: ICatalogRepository,
    @inject(TYPES.PaymentService) private readonly payments: IPaymentService,
  ) {}

  async checkAvailability(params: {
    parkId: string;
    startsAt: string;
    durationMinutes?: number;
    resourceIds?: string[];
    type?: string;
  }): Promise<{
    available: boolean;
    startsAt: string;
    endsAt: string;
    bufferEndsAt: string;
    conflicts: number;
    notes: string[];
  }> {
    const duration = params.durationMinutes ?? PACKAGE_ROOM_MINUTES;
    const starts = new Date(params.startsAt);
    const ends = new Date(starts.getTime() + duration * 60_000);
    const bufferEnds = new Date(ends.getTime() + PACKAGE_CLEANUP_MINUTES * 60_000);
    const notes: string[] = [];

    const hoursOk = starts.getHours() >= 10 && ends.getHours() <= 22;
    if (!hoursOk) {
      notes.push('Парк работает ежедневно с 10:00 до 22:00.');
    }

    let resourceIds = params.resourceIds ?? [];
    if (resourceIds.length === 0) {
      const all = await this.resources.findByPark(params.parkId);
      const banquet = all.find((r) => r.type === 'banquet_room' && r.isActive);
      if (banquet) resourceIds = [banquet.id];
    }

    const conflicts = await this.bookings.findOverlapping(
      params.parkId,
      resourceIds,
      starts.toISOString(),
      bufferEnds.toISOString(),
    );

    const activeConflicts = conflicts.filter((b) => b.status === 'confirmed' || b.status === 'awaiting_payment');

    if (isWeekend(starts) && (params.type === 'visit' || params.type === 'banquet')) {
      notes.push(
        'В выходные и праздники бронь стола/банкетной комнаты — при покупке пакетного предложения или почасовой оплате банкетной комнаты.',
      );
    }
    if (!isWeekend(starts) && (params.type === 'banquet' || params.type === 'visit')) {
      notes.push(`В будни бронь стола возможна при предоплате ${WEEKDAY_TABLE_PREPAY}₽.`);
    }

    return {
      available: hoursOk && activeConflicts.length === 0,
      startsAt: starts.toISOString(),
      endsAt: ends.toISOString(),
      bufferEndsAt: bufferEnds.toISOString(),
      conflicts: activeConflicts.length,
      notes,
    };
  }

  async create(input: CreateBookingInput): Promise<Booking> {
    const duration =
      input.endsAt != null
        ? Math.max(30, Math.round((new Date(input.endsAt).getTime() - new Date(input.startsAt).getTime()) / 60_000))
        : PACKAGE_ROOM_MINUTES;

    const availability = await this.checkAvailability({
      parkId: input.parkId,
      startsAt: input.startsAt,
      durationMinutes: duration,
      resourceIds: input.resourceIds,
      type: input.type,
    });

    if (!availability.available) {
      throw new Error(
        `Слот недоступен. Конфликтов: ${availability.conflicts}. ${availability.notes.join(' ')}`,
      );
    }

    let totalAmount = 0;
    let prepaidAmount = 0;
    const starts = new Date(input.startsAt);

    if (input.packageId) {
      const pkg = await this.catalog.findById(input.packageId);
      if (pkg) {
        totalAmount =
          pkg.price ??
          (isWeekend(starts) ? pkg.priceWeekend ?? pkg.priceWeekday : pkg.priceWeekday ?? pkg.priceWeekend) ??
          0;
        prepaidAmount = totalAmount;
      }
    } else if (!isWeekend(starts) && (input.type === 'banquet' || input.type === 'birthday' || input.type === 'visit')) {
      prepaidAmount = WEEKDAY_TABLE_PREPAY;
      totalAmount = WEEKDAY_TABLE_PREPAY;
    } else if (input.type === 'party_room') {
      totalAmount = 4000;
      prepaidAmount = totalAmount;
    } else if (input.type === 'babysitting') {
      totalAmount = 500;
      prepaidAmount = totalAmount;
    }

    const now = new Date().toISOString();
    const needsPayment = prepaidAmount > 0;
    let booking: Booking = {
      id: randomUUID(),
      code: bookingCode(),
      parkId: input.parkId,
      type: input.type,
      status: needsPayment ? 'awaiting_payment' : 'confirmed',
      guestName: input.guestName,
      guestPhone: input.guestPhone,
      guestEmail: input.guestEmail,
      childName: input.childName,
      childAge: input.childAge,
      guestsCount: input.guestsCount,
      packageId: input.packageId,
      resourceIds: input.resourceIds ?? [],
      startsAt: availability.startsAt,
      endsAt: availability.endsAt,
      notes: input.notes,
      favoriteHeroes: input.favoriteHeroes,
      prepaidAmount,
      totalAmount,
      createdAt: now,
      updatedAt: now,
    };

    booking = await this.bookings.create(booking);

    if (needsPayment) {
      const payment = await this.payments.createPayment({
        amount: prepaidAmount,
        description: `Sofi Park бронь ${booking.code}`,
        bookingId: booking.id,
      });
      booking = {
        ...booking,
        paymentId: payment.paymentId,
        paymentUrl: payment.confirmationUrl,
        updatedAt: new Date().toISOString(),
      };
      booking = await this.bookings.update(booking);
    }

    return booking;
  }

  getById(id: string): Promise<Booking | null> {
    return this.bookings.findById(id);
  }

  getByCode(code: string): Promise<Booking | null> {
    return this.bookings.findByCode(code);
  }

  async cancel(code: string, phone: string): Promise<Booking> {
    const booking = await this.bookings.findByCode(code);
    if (!booking) throw new Error('Бронь не найдена');
    const normalize = (p: string) => p.replace(/\D/g, '');
    if (normalize(booking.guestPhone) !== normalize(phone)) {
      throw new Error('Телефон не совпадает с бронью');
    }
    if (booking.status === 'cancelled') return booking;
    const updated: Booking = {
      ...booking,
      status: 'cancelled',
      updatedAt: new Date().toISOString(),
    };
    return this.bookings.update(updated);
  }

  listByPark(parkId: string, from?: string, to?: string): Promise<Booking[]> {
    return this.bookings.findByPark(parkId, from, to);
  }

  async confirmPaid(bookingId: string, paymentId?: string): Promise<Booking | null> {
    const booking = await this.bookings.findById(bookingId);
    if (!booking) return null;
    const updated: Booking = {
      ...booking,
      status: 'confirmed',
      paymentId: paymentId ?? booking.paymentId,
      updatedAt: new Date().toISOString(),
    };
    return this.bookings.update(updated);
  }

  async adminUpdateStatus(id: string, status: Booking['status']): Promise<Booking | null> {
    const booking = await this.bookings.findById(id);
    if (!booking) return null;
    return this.bookings.update({ ...booking, status, updatedAt: new Date().toISOString() });
  }

  getExtendHourlyRate(): number {
    return BANQUET_EXTEND_HOURLY;
  }
}
