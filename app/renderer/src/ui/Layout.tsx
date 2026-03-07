import { Outlet } from 'react-router-dom';
import { Sidebar } from './Sidebar';
import { Topbar } from './Topbar';
import { LicenseAlert } from './LicenseAlert';
import { User } from '../types';

export const Layout = ({ user, onLogout }: { user: User | null; onLogout: () => void }) => (
  <div className="layout">
    <Sidebar role={user?.role ?? 'SELLER'} />
    <div>
      <Topbar user={user} onLogout={onLogout} />
      <main className="main">
        <LicenseAlert />
        <Outlet />
      </main>
    </div>
  </div>
);