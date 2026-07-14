import { Navigate, Route, Routes } from 'react-router-dom';
import { ChatPage } from './pages/ChatPage';
import { AdminLayout } from './pages/admin/AdminLayout';
import { AdminLogin } from './pages/admin/AdminLogin';
import { AdminKnowledge } from './pages/admin/AdminKnowledge';
import { AdminCatalog } from './pages/admin/AdminCatalog';
import { AdminBookings } from './pages/admin/AdminBookings';
import { AdminCities } from './pages/admin/AdminCities';
import { SkyDecor } from './components/SkyDecor';

export function App() {
  return (
    <div className="app-shell">
      <SkyDecor />
      <Routes>
        <Route path="/" element={<ChatPage />} />
        <Route path="/admin/login" element={<AdminLogin />} />
        <Route path="/admin" element={<AdminLayout />}>
          <Route index element={<Navigate to="knowledge" replace />} />
          <Route path="knowledge" element={<AdminKnowledge />} />
          <Route path="catalog" element={<AdminCatalog />} />
          <Route path="bookings" element={<AdminBookings />} />
          <Route path="cities" element={<AdminCities />} />
        </Route>
      </Routes>
    </div>
  );
}
