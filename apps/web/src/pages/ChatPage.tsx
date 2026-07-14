import { useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { MarkdownContent } from '../components/MarkdownContent';
import {
  api,
  getParkId,
  getSessionId,
  setParkId,
  streamChat,
} from '../lib/api';

type Msg = { role: 'user' | 'assistant' | 'tool'; content: string };

type ParkLite = { id: string; city: string; name: string };

const WELCOME =
  'Привет! Я София — помощница Софи Парка. Могу подсказать по праздникам, ценам, правилам и забронировать визит или день рождения. О чём поговорим?';

export function ChatPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [messages, setMessages] = useState<Msg[]>([]);
  const [historyReady, setHistoryReady] = useState(false);
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const [parks, setParks] = useState<ParkLite[]>([]);
  const [parkId, setParkIdState] = useState<string | null>(getParkId());
  const [needsCity, setNeedsCity] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const messagesRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    const sessionId = getSessionId();
    api<{
      messages: Array<{ role: 'user' | 'assistant'; content: string }>;
      parkId: string | null;
    }>(`/api/chat/history?sessionId=${encodeURIComponent(sessionId)}`)
      .then((res) => {
        if (res.parkId) {
          setParkId(res.parkId);
          setParkIdState(res.parkId);
        }
        if (res.messages?.length) {
          setMessages(res.messages);
        } else {
          setMessages([{ role: 'assistant', content: WELCOME }]);
        }
      })
      .catch(() => {
        setMessages([{ role: 'assistant', content: WELCOME }]);
      })
      .finally(() => setHistoryReady(true));
  }, []);

  useEffect(() => {
    api<ParkLite[]>('/api/parks')
      .then((list) => {
        setParks(list);
        if (list.length === 1 && !getParkId()) {
          setParkId(list[0]!.id);
          setParkIdState(list[0]!.id);
        }
        setNeedsCity(list.length > 1 && !getParkId());
      })
      .catch(() => undefined);
  }, []);

  useEffect(() => {
    const mockPay = searchParams.get('mockPay');
    const bookingId = searchParams.get('bookingId');
    if (mockPay) {
      api('/api/payments/mock-confirm', {
        method: 'POST',
        body: JSON.stringify({ paymentId: mockPay }),
      })
        .then(() => {
          setMessages((m) => [
            ...m,
            {
              role: 'assistant',
              content: `Оплата прошла успешно${bookingId ? ` (бронь ${bookingId})` : ''}! Ждём вас в Софи Парке.`,
            },
          ]);
          setSearchParams({});
        })
        .catch(() => undefined);
    }
  }, [searchParams, setSearchParams]);

  useEffect(() => {
    const el = messagesRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages, busy]);

  useEffect(() => {
    const ta = textareaRef.current;
    if (!ta) return;
    ta.style.height = 'auto';
    ta.style.height = `${Math.min(Math.max(ta.scrollHeight, 52), 180)}px`;
  }, [input]);

  const parkLabel = useMemo(() => {
    const p = parks.find((x) => x.id === parkId);
    return p ? `${p.city}` : needsCity ? 'Выберите город' : 'Находка';
  }, [parks, parkId, needsCity]);

  const visibleMessages = useMemo(
    () => messages.filter((m) => m.role !== 'tool' && !(m.role === 'assistant' && !m.content)),
    [messages],
  );

  const isTyping = useMemo(() => {
    if (!busy) return false;
    const last = [...messages].reverse().find((m) => m.role === 'assistant');
    return !last || last.content.length === 0;
  }, [busy, messages]);

  async function send() {
    const text = input.trim();
    if (!text || busy || !historyReady) return;
    setInput('');
    if (textareaRef.current) {
      textareaRef.current.style.height = '52px';
    }
    setMessages((m) => [...m, { role: 'user', content: text }]);
    setBusy(true);

    let assistant = '';
    setMessages((m) => [...m, { role: 'assistant', content: '' }]);

    try {
      await streamChat(
        {
          // Server loads prior turns from DB; send only the new user message
          messages: [{ role: 'user', content: text }],
          sessionId: getSessionId(),
          parkId: parkId ?? undefined,
        },
        (ev) => {
          if (ev.type === 'meta') {
            const data = ev.data as {
              needsCitySelection: boolean;
              parks: ParkLite[];
              parkId: string | null;
            };
            if (data.parks?.length) setParks(data.parks);
            setNeedsCity(Boolean(data.needsCitySelection));
            if (data.parkId) {
              setParkId(data.parkId);
              setParkIdState(data.parkId);
            }
          }
          if (ev.type === 'token') {
            assistant += String(ev.data);
            setMessages((m) => {
              const copy = [...m];
              const lastAssistantIdx = [...copy].map((x) => x.role).lastIndexOf('assistant');
              if (lastAssistantIdx >= 0) {
                copy[lastAssistantIdx] = { role: 'assistant', content: assistant };
              }
              return copy;
            });
          }
          if (ev.type === 'error') {
            setMessages((m) => {
              const copy = [...m];
              const lastAssistantIdx = [...copy].map((x) => x.role).lastIndexOf('assistant');
              const errText = `Не удалось ответить: ${String(ev.data)}`;
              if (lastAssistantIdx >= 0 && !copy[lastAssistantIdx]!.content) {
                copy[lastAssistantIdx] = { role: 'assistant', content: errText };
                return copy;
              }
              return [...copy, { role: 'assistant', content: errText }];
            });
          }
        },
      );
    } catch (e) {
      setMessages((m) => {
        const copy = [...m];
        const lastAssistantIdx = [...copy].map((x) => x.role).lastIndexOf('assistant');
        const errText = `Ошибка связи: ${e instanceof Error ? e.message : String(e)}`;
        if (lastAssistantIdx >= 0 && !copy[lastAssistantIdx]!.content) {
          copy[lastAssistantIdx] = { role: 'assistant', content: errText };
          return copy;
        }
        return [...copy, { role: 'assistant', content: errText }];
      });
    } finally {
      setBusy(false);
    }
  }

  function selectPark(id: string) {
    setParkId(id);
    setParkIdState(id);
    setNeedsCity(false);
  }

  return (
    <div className="chat-page">
      <header className="brand-hero">
        <img
          className="brand-logo"
          src="/logo.png"
          alt="Софи Парк"
          width={280}
          height={120}
          decoding="async"
          fetchPriority="high"
        />
      </header>

      <section className="chat-panel">
        <div className="city-bar">
          <div className="city-bar-left">
            <img
              className="chat-avatar"
              src="/sophia1.png"
              alt="София"
              width={40}
              height={40}
              decoding="async"
            />
            <div className="muted city-bar-status">
              {needsCity ? 'Выберите город' : 'София готова отвечать'}
            </div>
          </div>
          <div className="city-bar-right">
            {parks.length > 1 ? (
              <div className="city-pills">
                {parks.map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    className={`pill ${parkId === p.id ? 'active' : ''}`}
                    onClick={() => selectPark(p.id)}
                  >
                    {p.city}
                  </button>
                ))}
              </div>
            ) : (
              <strong className="city-label">{parkLabel}</strong>
            )}
          </div>
        </div>

        <div className="messages" ref={messagesRef}>
          {visibleMessages.map((m, i) => (
            <div key={i} className={`bubble ${m.role}`}>
              {m.role === 'assistant' ? (
                <MarkdownContent text={m.content} />
              ) : (
                m.content
              )}
              {busy && i === visibleMessages.length - 1 && m.role === 'assistant' ? (
                <span className="stream-caret" aria-hidden />
              ) : null}
            </div>
          ))}
          {isTyping && (
            <div className="bubble assistant typing" aria-live="polite">
              <span className="typing-label">София печатает</span>
              <span className="typing-dots" aria-hidden>
                <i />
                <i />
                <i />
              </span>
            </div>
          )}
          <div ref={bottomRef} />
        </div>

        <div className="composer">
          <div className="composer-shell">
            <textarea
              ref={textareaRef}
              value={input}
              placeholder="Напишите Софии…"
              rows={1}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  void send();
                }
              }}
            />
            <button
              className="btn composer-send"
              type="button"
              disabled={busy || !input.trim()}
              onClick={() => void send()}
            >
              Отправить
            </button>
          </div>
          <p className="composer-hint">
            София поможет с идеями, ценами и бронированием — без очереди к менеджеру.
          </p>
        </div>
      </section>
    </div>
  );
}
