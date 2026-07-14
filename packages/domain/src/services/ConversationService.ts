import { inject, injectable } from 'inversify';
import type { ChatMessage } from '@sophia/shared';
import type { ChatSession, ChatSessionMessage, ISessionRepository } from '../ports.js';
import { TYPES } from '../types.js';

const MAX_STORED_MESSAGES = 80;
const MAX_CONTEXT_MESSAGES = 40;

@injectable()
export class ConversationService {
  constructor(@inject(TYPES.SessionRepository) private readonly sessions: ISessionRepository) {}

  async getOrCreate(sessionId: string): Promise<ChatSession> {
    const existing = await this.sessions.get(sessionId);
    if (existing) {
      return {
        ...existing,
        messages: existing.messages ?? [],
      };
    }
    const now = new Date().toISOString();
    return this.sessions.upsert({
      id: sessionId,
      messages: [],
      createdAt: now,
      updatedAt: now,
    });
  }

  async getHistory(sessionId: string): Promise<ChatSessionMessage[]> {
    const session = await this.getOrCreate(sessionId);
    return session.messages ?? [];
  }

  /** Context for Claude: last N user/assistant turns from DB. */
  async getContextMessages(sessionId: string): Promise<ChatMessage[]> {
    const history = await this.getHistory(sessionId);
    return history.slice(-MAX_CONTEXT_MESSAGES).map((m) => ({
      role: m.role,
      content: m.content,
    }));
  }

  async appendTurn(
    sessionId: string,
    userContent: string,
    assistantContent: string,
    parkId?: string,
  ): Promise<ChatSession> {
    const now = new Date().toISOString();
    const session = await this.getOrCreate(sessionId);
    const next: ChatSessionMessage[] = [
      ...(session.messages ?? []),
      { role: 'user' as const, content: userContent, at: now },
      { role: 'assistant' as const, content: assistantContent, at: now },
    ].slice(-MAX_STORED_MESSAGES);

    return this.sessions.upsert({
      ...session,
      parkId: parkId ?? session.parkId,
      messages: next,
      updatedAt: now,
    });
  }

  async clear(sessionId: string): Promise<void> {
    await this.sessions.clearMessages(sessionId);
  }
}
