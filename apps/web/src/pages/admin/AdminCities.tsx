import { useEffect, useState } from 'react';
import { api } from '../../lib/api';

type Park = {
  id: string;
  slug: string;
  name: string;
  city: string;
  timezone: string;
  address: string;
  phones: string[];
  hours: string;
  isActive: boolean;
  isDefault: boolean;
  website?: string;
};

const empty: Omit<Park, 'id'> = {
  slug: '',
  name: '',
  city: '',
  timezone: 'Asia/Vladivostok',
  address: '',
  phones: [''],
  hours: 'Ежедневно с 10:00 до 22:00',
  isActive: true,
  isDefault: false,
  website: '',
};

export function AdminCities() {
  const [parks, setParks] = useState<Park[]>([]);
  const [form, setForm] = useState(empty);
  const [status, setStatus] = useState('');

  async function reload() {
    setParks(await api('/api/parks/all'));
  }

  useEffect(() => {
    void reload();
  }, []);

  async function save() {
    await api('/api/admin/parks', {
      method: 'POST',
      body: JSON.stringify({
        ...form,
        phones: form.phones.filter(Boolean),
      }),
    });
    setForm(empty);
    setStatus('Город сохранён. Добавьте для него знания и каталог.');
    await reload();
  }

  return (
    <div className="admin-grid two">
      <div className="admin-card">
        <h2 style={{ marginTop: 0 }}>Конфигуратор городов</h2>
        <p className="muted">
          Один активный город — София работает с ним по умолчанию. Два и больше — гость выбирает город до цен и брони.
        </p>
        <div className="field">
          <label>Город</label>
          <input value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value })} />
        </div>
        <div className="field">
          <label>Название парка</label>
          <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
        </div>
        <div className="field">
          <label>Slug</label>
          <input value={form.slug} onChange={(e) => setForm({ ...form, slug: e.target.value })} />
        </div>
        <div className="field">
          <label>Адрес</label>
          <input value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} />
        </div>
        <div className="field">
          <label>Телефон</label>
          <input
            value={form.phones[0] ?? ''}
            onChange={(e) => setForm({ ...form, phones: [e.target.value] })}
          />
        </div>
        <div className="field">
          <label>Часы работы</label>
          <input value={form.hours} onChange={(e) => setForm({ ...form, hours: e.target.value })} />
        </div>
        <div className="field">
          <label>Timezone</label>
          <input value={form.timezone} onChange={(e) => setForm({ ...form, timezone: e.target.value })} />
        </div>
        <label style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 12 }}>
          <input
            type="checkbox"
            checked={form.isActive}
            onChange={(e) => setForm({ ...form, isActive: e.target.checked })}
          />
          Активен
        </label>
        <label style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 12 }}>
          <input
            type="checkbox"
            checked={form.isDefault}
            onChange={(e) => setForm({ ...form, isDefault: e.target.checked })}
          />
          По умолчанию
        </label>
        <button className="btn" type="button" onClick={() => void save()} disabled={!form.city || !form.name || !form.slug}>
          Добавить город
        </button>
        {status && <p className="muted">{status}</p>}
      </div>

      <div className="admin-card">
        <h2 style={{ marginTop: 0 }}>Парки</h2>
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>Город</th>
                <th>Статус</th>
                <th>Контакты</th>
              </tr>
            </thead>
            <tbody>
              {parks.map((p) => (
                <tr key={p.id}>
                  <td>
                    <strong>{p.city}</strong>
                    <div className="muted">{p.name}</div>
                  </td>
                  <td>
                    {p.isActive ? <span className="badge ready">active</span> : <span className="badge">off</span>}
                    {p.isDefault && <span className="badge">default</span>}
                  </td>
                  <td>
                    {p.phones?.join(', ')}
                    <div className="muted">{p.hours}</div>
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
