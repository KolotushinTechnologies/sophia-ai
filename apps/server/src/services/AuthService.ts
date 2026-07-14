import { inject, injectable } from 'inversify';
import bcrypt from 'bcryptjs';
import { randomUUID } from 'node:crypto';
import type { IAdminUserRepository } from '@sophia/domain';
import { TYPES } from '@sophia/domain';
import type { AppConfig } from '../config.js';

@injectable()
export class AuthService {
  constructor(
    @inject(TYPES.AdminUserRepository) private readonly users: IAdminUserRepository,
    @inject(TYPES.Config) private readonly config: AppConfig,
  ) {}

  async ensureAdminSeeded(): Promise<void> {
    const existing = await this.users.findByEmail(this.config.adminEmail);
    if (existing) return;
    const passwordHash = await bcrypt.hash(this.config.adminPassword, 10);
    await this.users.upsert({
      id: randomUUID(),
      email: this.config.adminEmail.toLowerCase(),
      passwordHash,
      role: 'admin',
    });
  }

  async validate(email: string, password: string): Promise<{ id: string; email: string; role: string } | null> {
    const user = await this.users.findByEmail(email.toLowerCase());
    if (!user) return null;
    const ok = await bcrypt.compare(password, user.passwordHash);
    if (!ok) return null;
    return { id: user.id, email: user.email, role: user.role };
  }
}
