import { useEffect, useState } from 'react';
import { api, getParkId } from '../../lib/api';

type Park = { id: string; city: string; name: string };
type Booking = {
  id: string;
  code: string;
  type: string;
  status: string;
  guestName: string;
  guestPhone: string;
  startsAt: string;
  endsAt: string;
  prepaidAmount?: number;
};

const TYPE_LABELS: Record<string, string> = {
  visit: 'Визит',
  birthday: 'День рождения',
  graduation: 'Выпускной',
  banquet: 'Банкет',
  party_room: 'PartyRoom',
  babysitting: 'Присмотр',
};

const STATUS_LABELS: Record<string, string> = {
  draft: 'Черновик',
  awaiting_payment: 'Ждёт оплату',
  confirmed: 'Подтверждена',
  cancelled: 'Отменена',
};

function formatWhen(startsAt: string, endsAt: string): string {
  const start = new Date(startsAt);
  const end = new Date(endsAt);
  const day = start.toLocaleDateString('ru-RU', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
  const from = start.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });
  const to = end.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });
  return `${day}, ${from} – ${to}`;
}

export function AdminBookings() {
  const [parks, setParks] = useState<Park[]>([]);
  const [parkId, setParkId] = useState(getParkId() ?? '');
  const [bookings, setBookings] = useState<Booking[]>([]);

  useEffect(() => {
    void api<Park[]>('/api/parks/all').then((list) => {
      setParks(list);
      if (!parkId && list[0]) setParkId(list[0].id);
    });
  }, []);

  async function reload(id: string) {
    setBookings(await api(`/api/admin/bookings?parkId=${encodeURIComponent(id)}`));
  }

  useEffect(() => {
    if (parkId) void reload(parkId);
  }, [parkId]);

  async function setStatus(id: string, status: 'confirmed' | 'cancelled') {
    await api(`/api/admin/bookings/${id}`, {
      method: 'PATCH',
      body: JSON.stringify({ status }),
    });
    await reload(parkId);
  }

  return (
    <div className="admin-card bookings-page">
      <div className="bookings-toolbar">
        <h2>Календарь броней</h2>
        <div className="field bookings-park-field">
          <label>Город</label>
          <select value={parkId} onChange={(e) => setParkId(e.target.value)}>
            {parks.map((p) => (
              <option key={p.id} value={p.id}>
                {p.city}
              </option>
            ))}
          </select>
        </div>
      </div>

      {bookings.length === 0 ? (
        <p className="muted">Пока нет броней для этого парка.</p>
      ) : (
        <div className="booking-cards">
          {bookings.map((b) => (
            <article key={b.id} className="booking-card">
              <div className="booking-card-top">
                <div>
                  <strong className="booking-code">{b.code}</strong>
                  <div className="booking-type">{TYPE_LABELS[b.type] ?? b.type}</div>
                </div>
                <span className={`badge ${b.status}`}>{STATUS_LABELS[b.status] ?? b.status}</span>
              </div>

              <div className="booking-card-row">
                <span className="booking-label">Когда</span>
                <span>{formatWhen(b.startsAt, b.endsAt)}</span>
              </div>
              <div className="booking-card-row">
                <span className="booking-label">Гость</span>
                <span>
                  {b.guestName}
                  <span className="muted"> · {b.guestPhone}</span>
                </span>
              </div>
              {b.prepaidAmount != null && b.prepaidAmount > 0 ? (
                <div className="booking-card-row">
                  <span className="booking-label">Сумма</span>
                  <span>{b.prepaidAmount.toLocaleString('ru-RU')} ₽</span>
                </div>
              ) : null}

              <div className="booking-card-actions">
                <button
                  type="button"
                  className="btn"
                  disabled={b.status === 'confirmed'}
                  onClick={() => void setStatus(b.id, 'confirmed')}
                >
                  Подтвердить
                </button>
                <button
                  type="button"
                  className="btn secondary"
                  disabled={b.status === 'cancelled'}
                  onClick={() => void setStatus(b.id, 'cancelled')}
                >
                  Отменить
                </button>
              </div>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}
