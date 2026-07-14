import { useEffect, useState } from 'react';
import { Navigate, NavLink, Outlet, Link, useLocation, useNavigate } from 'react-router-dom';
import { clearToken, getToken } from '../../lib/api';

const NAV = [
  { to: '/admin/knowledge', label: 'База знаний' },
  { to: '/admin/catalog', label: 'Каталог' },
  { to: '/admin/bookings', label: 'Брони' },
  { to: '/admin/cities', label: 'Города' },
] as const;

export function AdminLayout() {
  const token = getToken();
  const navigate = useNavigate();
  const location = useLocation();
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    setMenuOpen(false);
  }, [location.pathname]);

  useEffect(() => {
    document.body.classList.toggle('admin-menu-open', menuOpen);
    return () => document.body.classList.remove('admin-menu-open');
  }, [menuOpen]);

  if (!token) return <Navigate to="/admin/login" replace />;

  const title =
    NAV.find((n) => location.pathname.startsWith(n.to))?.label ?? 'Админка';

  return (
    <div className="admin-app">
      <aside className={`admin-sidebar ${menuOpen ? 'is-open' : ''}`}>
        <div className="admin-sidebar-brand">
          <img src="/logo.png" alt="Софи Парк" className="admin-sidebar-logo" />
          <div>
            <strong>Sophia Admin</strong>
            <span>панель управления</span>
          </div>
        </div>

        <nav className="admin-sidebar-nav">
          {NAV.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) => `admin-nav-link${isActive ? ' active' : ''}`}
            >
              {item.label}
            </NavLink>
          ))}
        </nav>

        <div className="admin-sidebar-foot">
          <Link to="/" className="admin-nav-link">
            ← К чату
          </Link>
          <button
            type="button"
            className="admin-nav-link admin-nav-logout"
            onClick={() => {
              clearToken();
              navigate('/admin/login');
            }}
          >
            Выйти
          </button>
        </div>
      </aside>

      {menuOpen && (
        <button
          type="button"
          className="admin-backdrop"
          aria-label="Закрыть меню"
          onClick={() => setMenuOpen(false)}
        />
      )}

      <div className="admin-main">
        <header className="admin-topbar">
          <button
            type="button"
            className="admin-menu-btn"
            aria-label="Меню"
            aria-expanded={menuOpen}
            onClick={() => setMenuOpen((v) => !v)}
          >
            <span />
            <span />
            <span />
          </button>
          <h1 className="admin-topbar-title">{title}</h1>
          <Link to="/" className="admin-topbar-chat">
            Чат
          </Link>
        </header>

        <div className="admin-content">
          <Outlet />
        </div>
      </div>
    </div>
  );
}
