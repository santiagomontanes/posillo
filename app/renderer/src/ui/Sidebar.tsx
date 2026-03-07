import { Link, useLocation } from 'react-router-dom';
import { can, type Permission } from '../../../../shared/permissions';
import type { Role } from '../types';
import logo from '../assets/logo.png';

const navItems: Array<{ path: string; label: string; permission: Permission }> = [
  { path: '/dashboard', label: 'Inicio', permission: 'reports:read' },
  { path: '/pos', label: 'Punto de venta', permission: 'pos:sell' },
  { path: '/inventory', label: 'Inventario', permission: 'inventory:read' },
  { path: '/cash', label: 'Caja', permission: 'cash:read' },
  { path: '/expenses', label: 'Gastos', permission: 'expenses:read' },
  { path: '/reports', label: 'Reportes', permission: 'reports:read' },
  { path: '/daily-close', label: 'Cierre diario', permission: 'reports:read' },
  { path: '/users', label: 'Usuarios', permission: 'users:read' },
  { path: '/audit', label: 'Auditoría', permission: 'audit:read' },
  { path: '/settings', label: 'Configuración', permission: 'config:write' },
];

export const Sidebar = ({ role }: { role: Role }) => {
  const { pathname } = useLocation();

  return (
    <aside className="sidebar">
      <div className="sidebar__brand">
        <img src={logo} alt="Logo Sistetecni" className="logo-img" />

        <div className="sidebar__brand-text">
          <div className="logo-title">Sistetecni</div>
          <div className="logo-subtitle">POS táctil</div>
        </div>
      </div>

      <nav className="sidebar__nav">
        {navItems
          .filter((item) => can(role, item.permission))
          .map((item) => {
            const active = pathname === item.path;

            return (
              <Link
                key={item.path}
                to={item.path}
                className={`nav-item ${active ? 'nav-item--active' : ''}`}
              >
                <span className="nav-item__label">{item.label}</span>
              </Link>
            );
          })}
      </nav>

      <div className="sidebar__footer">
        <div className="sidebar__footer-title">Sistetecni POS</div>
        <div className="sidebar__footer-text">
          Software hecho por colombianos 🇨🇴
        </div>
      </div>
    </aside>
  );
};