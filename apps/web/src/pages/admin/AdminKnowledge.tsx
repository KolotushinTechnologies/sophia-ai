import { useEffect, useState } from 'react';
import { api, getParkId } from '../../lib/api';

type Park = { id: string; city: string; name: string };
type Doc = {
  id: string;
  parkId: string;
  title: string;
  body: string;
  tags: string[];
  indexStatus: string;
};

export function AdminKnowledge() {
  const [parks, setParks] = useState<Park[]>([]);
  const [parkId, setParkId] = useState(getParkId() ?? '');
  const [docs, setDocs] = useState<Doc[]>([]);
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [tags, setTags] = useState('faq');
  const [editingId, setEditingId] = useState<string | undefined>();
  const [status, setStatus] = useState('');

  async function loadParks() {
    const list = await api<Park[]>('/api/parks/all');
    setParks(list);
    if (!parkId && list[0]) setParkId(list[0].id);
  }

  async function loadDocs(id: string) {
    const list = await api<Doc[]>(`/api/admin/knowledge?parkId=${encodeURIComponent(id)}`);
    setDocs(list);
  }

  useEffect(() => {
    void loadParks().catch((e) => setStatus(String(e)));
  }, []);

  useEffect(() => {
    if (parkId) void loadDocs(parkId).catch((e) => setStatus(String(e)));
  }, [parkId]);

  async function save() {
    await api('/api/admin/knowledge', {
      method: 'POST',
      body: JSON.stringify({
        id: editingId,
        parkId,
        title,
        body,
        tags: tags.split(',').map((t) => t.trim()).filter(Boolean),
      }),
    });
    setTitle('');
    setBody('');
    setTags('faq');
    setEditingId(undefined);
    setStatus('Сохранено, индексация запущена');
    await loadDocs(parkId);
  }

  return (
    <div className="admin-grid two">
      <div className="admin-card">
        <h2 style={{ marginTop: 0 }}>Документ базы знаний</h2>
        <div className="field">
          <label>Город / парк</label>
          <select value={parkId} onChange={(e) => setParkId(e.target.value)}>
            {parks.map((p) => (
              <option key={p.id} value={p.id}>
                {p.city} — {p.name}
              </option>
            ))}
          </select>
        </div>
        <div className="field">
          <label>Заголовок</label>
          <input value={title} onChange={(e) => setTitle(e.target.value)} />
        </div>
        <div className="field">
          <label>Текст (markdown)</label>
          <textarea rows={12} value={body} onChange={(e) => setBody(e.target.value)} />
        </div>
        <div className="field">
          <label>Теги (через запятую)</label>
          <input value={tags} onChange={(e) => setTags(e.target.value)} />
        </div>
        <button className="btn" type="button" onClick={() => void save()} disabled={!title || !body || !parkId}>
          {editingId ? 'Обновить' : 'Создать'}
        </button>
        {status && <p className="muted">{status}</p>}
      </div>

      <div className="admin-card">
        <h2 style={{ marginTop: 0 }}>Документы</h2>
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>Название</th>
                <th>Статус</th>
                <th>Действия</th>
              </tr>
            </thead>
            <tbody>
              {docs.map((d) => (
                <tr key={d.id}>
                  <td>
                    <strong>{d.title}</strong>
                    <div className="muted">{d.tags?.join(', ')}</div>
                  </td>
                  <td>
                    <span className={`badge ${d.indexStatus}`}>{d.indexStatus}</span>
                  </td>
                  <td>
                    <div className="admin-actions">
                      <button
                        type="button"
                        className="btn secondary"
                        onClick={() => {
                          setEditingId(d.id);
                          setTitle(d.title);
                          setBody(d.body);
                          setTags(d.tags?.join(', ') ?? '');
                        }}
                      >
                        Править
                      </button>
                      <button
                        type="button"
                        className="btn secondary"
                        onClick={() =>
                          void api(`/api/admin/knowledge/${d.id}/reindex`, { method: 'POST' }).then(() =>
                            loadDocs(parkId),
                          )
                        }
                      >
                        Reindex
                      </button>
                      <button
                        type="button"
                        className="btn secondary"
                        onClick={() =>
                          void api(`/api/admin/knowledge/${d.id}`, { method: 'DELETE' }).then(() => loadDocs(parkId))
                        }
                      >
                        Удалить
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
