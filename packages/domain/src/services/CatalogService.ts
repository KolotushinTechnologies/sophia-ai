import { inject, injectable } from 'inversify';
import type { CatalogItem } from '@sophia/shared';
import type { ICatalogRepository } from '../ports.js';
import { TYPES } from '../types.js';

@injectable()
export class CatalogService {
  constructor(@inject(TYPES.CatalogRepository) private readonly catalog: ICatalogRepository) {}

  list(parkId: string): Promise<CatalogItem[]> {
    return this.catalog.findByPark(parkId);
  }

  get(id: string): Promise<CatalogItem | null> {
    return this.catalog.findById(id);
  }

  upsert(item: CatalogItem): Promise<CatalogItem> {
    return this.catalog.upsert(item);
  }

  delete(id: string): Promise<void> {
    return this.catalog.delete(id);
  }

  async estimate(params: {
    parkId: string;
    packageId?: string;
    itemIds?: string[];
    dateIso: string;
  }): Promise<{
    items: Array<{ id: string; name: string; price: number }>;
    total: number;
    isWeekend: boolean;
  }> {
    const date = new Date(params.dateIso);
    const day = date.getUTCDay();
    // Approximate local weekend; parks use Asia/Vladivostok — for estimate we treat Sat/Sun as weekend
    const isWeekend = day === 0 || day === 6;
    const all = await this.catalog.findByPark(params.parkId);
    const selected: CatalogItem[] = [];

    if (params.packageId) {
      const pkg = all.find((i) => i.id === params.packageId);
      if (pkg) selected.push(pkg);
    }
    for (const id of params.itemIds ?? []) {
      const item = all.find((i) => i.id === id);
      if (item) selected.push(item);
    }

    const items = selected.map((item) => {
      const price =
        item.price ??
        (isWeekend ? item.priceWeekend ?? item.priceWeekday : item.priceWeekday ?? item.priceWeekend) ??
        0;
      return { id: item.id, name: item.name, price };
    });

    return {
      items,
      total: items.reduce((s, i) => s + i.price, 0),
      isWeekend,
    };
  }
}
