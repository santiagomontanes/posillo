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
};

export const Topbar = ({ user, onLogout }: { user: User | null; onLogout: () => void }) => {
  const { pathname } = useLocation();
  const title = titles[pathname] ?? 'Sistetecni POS';

  return (
    <header className="topbar">
      <div className="topbar__left">
        <div className="topbar__title">{title}</div>
        <div className="topbar__subtitle">
          {user?.name ? `Operador: ${user.name}` : 'Operador'}
        </div>
      </div>

      <div className="topbar__right">
        <button className="btn btn--ghost" onClick={onLogout}>
          Cerrar sesión
        </button>
      </div>
    </header>
  );
};