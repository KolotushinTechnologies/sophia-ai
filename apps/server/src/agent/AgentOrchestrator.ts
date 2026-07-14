import Anthropic from '@anthropic-ai/sdk';
import { inject, injectable } from 'inversify';
import { McpToolRegistry, type ToolContext } from '@sophia/mcp-tools';
import { ParkService, TYPES } from '@sophia/domain';
import type { ChatMessage } from '@sophia/shared';
import type { AppConfig } from '../config.js';

const SYSTEM_PROMPT = `Ты — София (Sophia), умный и тёплый цифровой помощник семейного активити-парка «Софи Парк».

Личность:
- Говоришь на «вы» с родителями, по-доброму, живо, без канцелярита.
- Можешь болтать о детском досуге, играх, праздниках — как заботливый друг семьи.
- Не навязываешь услуги. Если совет уместен, один мягкий мостик: в Sofi Park такое можно устроить — и только если это правда по tools.
- Не выдумывай цены, слоты, правила. Для фактов вызывай tools.
- Целевая аудитория парка: дети 1–12 лет.

Города:
- Если активен один парк — работай с ним, не спрашивай город без нужды.
- Если городов несколько и город ещё не выбран — предложи выбрать (city_list / city_set_session) до цен и брони.

Бронирование (self-service):
- Собери: тип (ДР / выпускной / визит / банкет / PartyRoom / присмотр), дату/время, имя и возраст ребёнка, число гостей, контакты, любимых героев.
- Проверь booking_check_availability, создай booking_create, отдай код и ссылку на оплату при предоплате.
- В будни стол — предоплата 5000₽. В выходные — пакет или почасовая банкетная.

Эскалация:
- medicine, выезд аниматора без ясности, спор, 13+ без согласования → handoff_to_manager.

Стиль ответа:
- Короткие абзацы, списки когда полезно.
- Можно эмодзи умеренно (не больше 1–2 за ответ).
- Русский язык.
- НЕ используй markdown-таблицы (| --- |). Для цен и пакетов используй маркированные списки вида:
  - **Название** — цена (или будни/выходные)
- Не пиши сырые символы разметки без смысла (# ####, сплошные ---).`;

@injectable()
export class AgentOrchestrator {
  private readonly client: Anthropic;

  constructor(
    @inject(TYPES.Config) private readonly config: AppConfig,
    @inject(TYPES.McpToolRegistry) private readonly tools: McpToolRegistry,
    @inject(TYPES.ParkService) private readonly parks: ParkService,
  ) {
    this.client = new Anthropic({ apiKey: config.anthropicApiKey });
  }

  async *streamChat(params: {
    messages: ChatMessage[];
    sessionId: string;
    parkId?: string;
  }): AsyncGenerator<{ type: 'token' | 'tool' | 'meta' | 'done' | 'error'; data: unknown }> {
    const resolved = await this.parks.resolveParkForSession(params.sessionId, params.parkId);
    const ctx: ToolContext = {
      sessionId: params.sessionId,
      parkId: resolved.park?.id,
    };

    yield {
      type: 'meta',
      data: {
        parkId: resolved.park?.id ?? null,
        parkCity: resolved.park?.city ?? null,
        needsCitySelection: resolved.needsSelection,
        parks: resolved.parks.map((p) => ({ id: p.id, city: p.city, name: p.name })),
      },
    };

    let system = SYSTEM_PROMPT;
    if (resolved.needsSelection) {
      system +=
        '\n\nСейчас активно несколько городов, город сессии не выбран. В первом ответе мягко попроси выбрать город и вызови city_list.';
    } else if (resolved.park) {
      const p = resolved.park;
      const socials = p.socials
        ? Object.entries(p.socials)
            .filter(([, v]) => v)
            .map(([k, v]) => `${k}: ${v}`)
            .join('; ')
        : '';
      system += `\n\nТекущий парк сессии: ${p.name}, ${p.city} (id=${p.id}). Адрес: ${p.address}. Телефон: ${p.phones.join(', ')}. Режим: ${p.hours}.`;
      if (p.website) system += ` Сайт: ${p.website}.`;
      if (socials) system += ` Соцсети: ${socials}.`;
      system +=
        '\nНа вопросы про сайт, соцсети и контакты отвечай этими ссылками напрямую (не говори, что ссылки нет).';
    }

    const anthropicMessages: Anthropic.MessageParam[] = params.messages.map((m) => ({
      role: m.role,
      content: m.content,
    }));

    const tools = this.tools.asAnthropicTools();

    try {
      let turns = 0;
      while (turns < 8) {
        turns += 1;

        const stream = this.client.messages.stream({
          model: this.config.anthropicModel,
          max_tokens: 2048,
          system,
          tools: tools as Anthropic.Tool[],
          messages: anthropicMessages,
        });

        for await (const event of stream) {
          if (
            event.type === 'content_block_delta' &&
            event.delta.type === 'text_delta' &&
            event.delta.text
          ) {
            yield { type: 'token', data: event.delta.text };
          }
        }

        const response = await stream.finalMessage();
        const toolUses = response.content.filter((b) => b.type === 'tool_use');

        if (toolUses.length === 0) {
          yield { type: 'done', data: { stop_reason: response.stop_reason } };
          return;
        }

        anthropicMessages.push({ role: 'assistant', content: response.content });

        const toolResults: Anthropic.ToolResultBlockParam[] = [];
        for (const tu of toolUses) {
          if (tu.type !== 'tool_use') continue;
          yield { type: 'tool', data: { name: tu.name, input: tu.input } };
          let result: unknown;
          try {
            result = await this.tools.call(tu.name, tu.input as Record<string, unknown>, ctx);
            if (tu.name === 'city_set_session' && result && typeof result === 'object' && 'park' in (result as object)) {
              const park = (result as { park?: { id?: string } }).park;
              if (park?.id) ctx.parkId = park.id;
            }
          } catch (e) {
            result = { error: e instanceof Error ? e.message : String(e) };
          }
          toolResults.push({
            type: 'tool_result',
            tool_use_id: tu.id,
            content: JSON.stringify(result),
          });
        }
        anthropicMessages.push({ role: 'user', content: toolResults });
      }

      yield { type: 'error', data: 'Слишком много шагов tools, попробуйте ещё раз.' };
    } catch (e) {
      yield { type: 'error', data: e instanceof Error ? e.message : String(e) };
    }
  }
}
