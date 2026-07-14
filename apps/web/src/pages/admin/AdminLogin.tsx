import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api, setToken } from '../../lib/api';

export function AdminLogin() {
  const [email, setEmail] = useState('admin@sofipark.ru');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const navigate = useNavigate();

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    try {
      const res = await api<{ token: string }>('/api/admin/login', {
        method: 'POST',
        body: JSON.stringify({ email, password }),
      });
      setToken(res.token);
      navigate('/admin/knowledge');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Ошибка входа');
    }
  }

  return (
    <div className="admin-shell login-wrap">
      <form className="admin-card" onSubmit={(e) => void submit(e)}>
        <img src="/logo.png" alt="Софи Парк" className="admin-login-logo" />
        <h2 style={{ fontFamily: 'var(--font-display)', marginTop: 0, textAlign: 'center' }}>Вход в админку</h2>
        <div className="field">
          <label>Email</label>
          <input value={email} onChange={(e) => setEmail(e.target.value)} />
        </div>
        <div className="field">
          <label>Пароль</label>
          <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} />
        </div>
        {error && <p style={{ color: '#c6284c' }}>{error}</p>}
        <button className="btn" type="submit">
          Войти
        </button>
      </form>
    </div>
  );
}
