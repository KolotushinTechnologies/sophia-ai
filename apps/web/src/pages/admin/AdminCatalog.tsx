import { useEffect, useState } from 'react';
import { api, getParkId } from '../../lib/api';

type Park = { id: string; city: string; name: string };
type Item = {
  id: string;
  parkId: string;
  category: string;
  name: string;
  description?: string;
  price?: number;
  priceWeekday?: number;
  priceWeekend?: number;
  isActive: boolean;
};

export function AdminCatalog() {
  const [parks, setParks] = useState<Park[]>([]);
  const [parkId, setParkId] = useState(getParkId() ?? '');
  const [items, setItems] = useState<Item[]>([]);
  const [form, setForm] = useState({
    name: '',
    category: 'extra',
    price: '',
    priceWeekday: '',
    priceWeekend: '',
    description: '',
  });

  useEffect(() => {
    void api<Park[]>('/api/parks/all').then((list) => {
      setParks(list);
      if (!parkId && list[0]) setParkId(list[0].id);
    });
  }, []);

  useEffect(() => {
    if (!parkId) return;
    void api<Item[]>(`/api/admin/catalog?parkId=${encodeURIComponent(parkId)}`).then(setItems);
  }, [parkId]);

  async function save() {
    await api('/api/admin/catalog', {
      method: 'POST',
      body: JSON.stringify({
        parkId,
        category: form.category,
        name: form.name,
        description: form.description || undefined,
        price: form.price ? Number(form.price) : undefined,
        priceWeekday: form.priceWeekday ? Number(form.priceWeekday) : undefined,
        priceWeekend: form.priceWeekend ? Number(form.priceWeekend) : undefined,
        features: [],
        isActive: true,
      }),
    });
    setForm({ name: '', category: 'extra', price: '', priceWeekday: '', priceWeekend: '', description: '' });
    setItems(await api(`/api/admin/catalog?parkId=${encodeURIComponent(parkId)}`));
  }

  return (
    <div className="admin-grid two">
      <div className="admin-card">
        <h2 style={{ marginTop: 0 }}>Позиция каталога</h2>
        <div className="field">
          <label>Парк</label>
          <select value={parkId} onChange={(e) => setParkId(e.target.value)}>
            {parks.map((p) => (
              <option key={p.id} value={p.id}>
                {p.city}
              </option>
            ))}
          </select>
        </div>
        <div className="field">
          <label>Название</label>
          <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
        </div>
        <div className="field">
          <label>Категория</label>
          <select value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })}>
            {['ticket', 'package', 'graduation', 'show', 'quest', 'workshop', 'extra', 'rental', 'babysitting'].map(
              (c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ),
            )}
          </select>
        </div>
        <div className="field">
          <label>Цена фикс</label>
          <input value={form.price} onChange={(e) => setForm({ ...form, price: e.target.value })} />
        </div>
        <div className="field">
          <label>Будни / Выходные</label>
          <div className="admin-actions" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
            <input
              placeholder="будни"
              value={form.priceWeekday}
              onChange={(e) => setForm({ ...form, priceWeekday: e.target.value })}
            />
            <input
              placeholder="выходные"
              value={form.priceWeekend}
              onChange={(e) => setForm({ ...form, priceWeekend: e.target.value })}
            />
          </div>
        </div>
        <div className="field">
          <label>Описание</label>
          <textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
        </div>
        <button className="btn" type="button" onClick={() => void save()} disabled={!form.name}>
          Добавить
        </button>
      </div>
      <div className="admin-card">
        <h2 style={{ marginTop: 0 }}>Каталог ({items.length})</h2>
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>Название</th>
                <th>Кат.</th>
                <th>Цены</th>
              </tr>
            </thead>
            <tbody>
              {items.map((i) => (
                <tr key={i.id}>
                  <td>{i.name}</td>
                  <td>{i.category}</td>
                  <td>
                    {i.price != null && `${i.price}₽`}
                    {i.priceWeekday != null && ` будни ${i.priceWeekday}`}
                    {i.priceWeekend != null && ` / вых ${i.priceWeekend}`}
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
