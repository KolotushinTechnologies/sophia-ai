import { inject, injectable } from 'inversify';
import type { Park } from '@sophia/shared';
import type { IParkRepository, ISessionRepository } from '../ports.js';
import { TYPES } from '../types.js';

@injectable()
export class ParkService {
  constructor(
    @inject(TYPES.ParkRepository) private readonly parks: IParkRepository,
    @inject(TYPES.SessionRepository) private readonly sessions: ISessionRepository,
  ) {}

  listActive(): Promise<Park[]> {
    return this.parks.findActive();
  }

  listAll(): Promise<Park[]> {
    return this.parks.findAll();
  }

  getById(id: string): Promise<Park | null> {
    return this.parks.findById(id);
  }

  async resolveParkForSession(sessionId: string, explicitParkId?: string): Promise<{
    park: Park | null;
    needsSelection: boolean;
    parks: Park[];
  }> {
    const active = await this.parks.findActive();
    if (active.length === 0) {
      return { park: null, needsSelection: false, parks: [] };
    }

    if (explicitParkId) {
      const park = active.find((p) => p.id === explicitParkId) ?? null;
      if (park) {
        await this.setSessionPark(sessionId, park.id);
        return { park, needsSelection: false, parks: active };
      }
    }

    const session = await this.sessions.get(sessionId);
    if (session?.parkId) {
      const park = active.find((p) => p.id === session.parkId) ?? null;
      if (park) {
        return { park, needsSelection: false, parks: active };
      }
    }

    if (active.length === 1) {
      const park = active[0]!;
      await this.setSessionPark(sessionId, park.id);
      return { park, needsSelection: false, parks: active };
    }

    const defaultPark = active.find((p) => p.isDefault) ?? null;
    return { park: defaultPark, needsSelection: true, parks: active };
  }

  async setSessionPark(sessionId: string, parkId: string): Promise<Park | null> {
    const park = await this.parks.findById(parkId);
    if (!park || !park.isActive) return null;
    const now = new Date().toISOString();
    const existing = await this.sessions.get(sessionId);
    await this.sessions.upsert({
      id: sessionId,
      parkId: park.id,
      messages: existing?.messages ?? [],
      createdAt: existing?.createdAt ?? now,
      updatedAt: now,
    });
    return park;
  }

  upsert(park: Park): Promise<Park> {
    return this.parks.upsert(park);
  }
}
