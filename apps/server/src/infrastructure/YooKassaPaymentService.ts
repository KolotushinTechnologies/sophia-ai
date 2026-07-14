import { randomUUID } from 'node:crypto';
import { injectable } from 'inversify';
import type { IPaymentService, PaymentCreateResult } from '@sophia/domain';
import type { AppConfig } from '../config.js';

@injectable()
export class YooKassaPaymentService implements IPaymentService {
  private readonly mockPayments = new Map<string, { bookingId: string; status: 'pending' | 'succeeded' | 'canceled'; amount: number }>();

  constructor(private readonly config: AppConfig) {}

  private get enabled(): boolean {
    return Boolean(this.config.yookassaShopId && this.config.yookassaSecretKey);
  }

  async createPayment(params: {
    amount: number;
    description: string;
    bookingId: string;
    returnUrl?: string;
  }): Promise<PaymentCreateResult> {
    if (!this.enabled) {
      const paymentId = `mock_${randomUUID()}`;
      this.mockPayments.set(paymentId, {
        bookingId: params.bookingId,
        status: 'pending',
        amount: params.amount,
      });
      const confirmationUrl = `${this.config.webOrigin}/?mockPay=${paymentId}&bookingId=${params.bookingId}`;
      return { paymentId, confirmationUrl, mock: true };
    }

    const auth = Buffer.from(`${this.config.yookassaShopId}:${this.config.yookassaSecretKey}`).toString('base64');
    const idempotenceKey = randomUUID();
    const res = await fetch('https://api.yookassa.ru/v3/payments', {
      method: 'POST',
      headers: {
        Authorization: `Basic ${auth}`,
        'Content-Type': 'application/json',
        'Idempotence-Key': idempotenceKey,
      },
      body: JSON.stringify({
        amount: { value: params.amount.toFixed(2), currency: 'RUB' },
        capture: true,
        confirmation: {
          type: 'redirect',
          return_url: params.returnUrl ?? this.config.yookassaReturnUrl,
        },
        description: params.description,
        metadata: { bookingId: params.bookingId },
      }),
    });

    if (!res.ok) {
      const text = await res.text();
      throw new Error(`YooKassa error: ${res.status} ${text}`);
    }

    const data = (await res.json()) as {
      id: string;
      confirmation?: { confirmation_url?: string };
    };

    return {
      paymentId: data.id,
      confirmationUrl: data.confirmation?.confirmation_url ?? this.config.yookassaReturnUrl,
      mock: false,
    };
  }

  async getStatus(paymentId: string): Promise<'pending' | 'succeeded' | 'canceled'> {
    if (paymentId.startsWith('mock_')) {
      return this.mockPayments.get(paymentId)?.status ?? 'pending';
    }
    if (!this.enabled) return 'pending';

    const auth = Buffer.from(`${this.config.yookassaShopId}:${this.config.yookassaSecretKey}`).toString('base64');
    const res = await fetch(`https://api.yookassa.ru/v3/payments/${paymentId}`, {
      headers: { Authorization: `Basic ${auth}` },
    });
    if (!res.ok) return 'pending';
    const data = (await res.json()) as { status: string };
    if (data.status === 'succeeded') return 'succeeded';
    if (data.status === 'canceled') return 'canceled';
    return 'pending';
  }

  async handleWebhook(body: unknown): Promise<{ bookingId?: string; status: string } | null> {
    const event = body as {
      event?: string;
      object?: { id?: string; status?: string; metadata?: { bookingId?: string } };
    };

    if (event.object?.id?.startsWith('mock_')) {
      const mock = this.mockPayments.get(event.object.id);
      if (mock && event.object.status === 'succeeded') {
        mock.status = 'succeeded';
        return { bookingId: mock.bookingId, status: 'succeeded' };
      }
    }

    if (event.event === 'payment.succeeded' && event.object?.metadata?.bookingId) {
      return { bookingId: event.object.metadata.bookingId, status: 'succeeded' };
    }
    return null;
  }

  /** Dev helper: confirm mock payment */
  confirmMock(paymentId: string): string | null {
    const mock = this.mockPayments.get(paymentId);
    if (!mock) return null;
    mock.status = 'succeeded';
    return mock.bookingId;
  }
}
