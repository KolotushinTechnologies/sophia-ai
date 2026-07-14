const TOKEN_KEY = 'sophia_admin_token';
const SESSION_KEY = 'sophia_session_id';
const PARK_KEY = 'sophia_park_id';

export function getToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}

export function setToken(token: string) {
  localStorage.setItem(TOKEN_KEY, token);
}

export function clearToken() {
  localStorage.removeItem(TOKEN_KEY);
}

export function getSessionId(): string {
  let id = localStorage.getItem(SESSION_KEY);
  if (!id) {
    id = crypto.randomUUID();
    localStorage.setItem(SESSION_KEY, id);
  }
  return id;
}

export function getParkId(): string | null {
  return localStorage.getItem(PARK_KEY);
}

export function setParkId(id: string | null) {
  if (!id) localStorage.removeItem(PARK_KEY);
  else localStorage.setItem(PARK_KEY, id);
}

export async function api<T>(path: string, init: RequestInit = {}): Promise<T> {
  const headers = new Headers(init.headers);
  if (!headers.has('Content-Type') && init.body) headers.set('Content-Type', 'application/json');
  const token = getToken();
  if (token) headers.set('Authorization', `Bearer ${token}`);

  const res = await fetch(path, { ...init, headers });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(text || res.statusText);
  }
  return res.json() as Promise<T>;
}

export type ChatEvent =
  | { type: 'session'; data: { sessionId: string } }
  | { type: 'meta'; data: { parkId: string | null; parkCity: string | null; needsCitySelection: boolean; parks: Array<{ id: string; city: string; name: string }> } }
  | { type: 'token'; data: string }
  | { type: 'tool'; data: { name: string; input: unknown } }
  | { type: 'done'; data: unknown }
  | { type: 'error'; data: string };

export async function streamChat(
  body: { messages: Array<{ role: 'user' | 'assistant'; content: string }>; sessionId: string; parkId?: string },
  onEvent: (ev: ChatEvent) => void,
): Promise<void> {
  const res = await fetch('/api/chat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok || !res.body) throw new Error('Chat request failed');

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const chunks = buffer.split('\n\n');
    buffer = chunks.pop() ?? '';
    for (const chunk of chunks) {
      const lines = chunk.split('\n');
      let event = 'message';
      let data = '';
      for (const line of lines) {
        if (line.startsWith('event:')) event = line.slice(6).trim();
        if (line.startsWith('data:')) data += line.slice(5).trim();
      }
      if (!data) continue;
      try {
        onEvent({ type: event, data: JSON.parse(data) } as ChatEvent);
      } catch {
        onEvent({ type: event, data } as ChatEvent);
      }
    }
  }
}
