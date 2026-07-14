import { inject, injectable } from 'inversify';
import type { IParkRepository } from '../ports.js';
import { TYPES } from '../types.js';

@injectable()
export class HandoffService {
  constructor(@inject(TYPES.ParkRepository) private readonly parks: IParkRepository) {}

  async toManager(parkId: string | undefined, reason: string): Promise<{
    message: string;
    phone: string;
    channels: string[];
  }> {
    const park = parkId ? await this.parks.findById(parkId) : await this.parks.findDefault();
    const phone = park?.phones[0] ?? '+7 (914) 792-80-61';
    const channels = [
      phone,
      park?.socials?.telegram,
      park?.socials?.max,
      park?.website,
    ].filter(Boolean) as string[];

    return {
      phone,
      channels,
      message:
        `Я передаю ваш вопрос живому менеджеру Sofi Park. Причина: ${reason}. ` +
        `Свяжитесь удобным способом: ${phone}. Мы на связи в мессенджерах на этом номере.`,
    };
  }
}
