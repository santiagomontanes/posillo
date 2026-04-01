import { useLocation } from 'react-router-dom';
import { User } from '../types';

const titles: Record<string, string> = {
  '/dashboard': 'Inicio',
  '/pos': 'Punto de venta',
  '/inventory': 'Inventario',
  '/expenses': 'Gastos',
  '/cash': 'Caja',
  '/reports': 'Reportes',
  '/settings': 'Configuración',
  '/users': 'Usuarios',
  '/audit': 'Auditoría',
  '/daily-close': 'Cierre diario',
};

export const Topbar = ({ user, onLogout }: { user: User | null; onLogout: () => void }) => {
  const { pathname } = useLocation();
  const title = titles[pathname] ?? 'Sistetecni POS';

  return (
    <header className="topbar pos-header">
      {/* IZQUIERDA */}
      <div className="topbar__left">
        <div className="pos-header__title">
          <i className="ri-store-2-line"></i>
          <span>{title}</span>
        </div>

        <div className="pos-header__subtitle">
          {user?.name ? `Operador: ${user.name}` : 'Operador'}
        </div>
      </div>

      {/* DERECHA */}
      <div className="topbar__right">
        <div className="topbar__badge">
          <span className="dot"></span>
          Sistema activo
        </div>

        <button className="btn btn--ghost" onClick={onLogout}>
          <i className="ri-logout-box-r-line"></i>
          Cerrar sesión
        </button>
      </div>
    </header>
  );
};