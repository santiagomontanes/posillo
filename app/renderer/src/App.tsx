import { useEffect, useState } from 'react';
import { HashRouter } from 'react-router-dom';
import { Login } from './pages/Login';
import { AppRoutes } from './routes';
import { getSessionUser, setSessionUser } from './services/session';
import { ChangePassword } from './pages/ChangePassword';
import { BusinessSetup } from './pages/BusinessSetup';
import { getConfig } from './services/config';

function App() {
  const [user, setUser] = useState<any>(null);
  const [forceChangePassword, setForceChangePassword] = useState(false);

  const [cfgChecked, setCfgChecked] = useState(false);
  const [needsBusinessSetup, setNeedsBusinessSetup] = useState(false);

  useEffect(() => {
    (async () => {
      const cfg = await getConfig();
      const hasName = !!String(cfg?.business?.name ?? '').trim();
      setNeedsBusinessSetup(!hasName);
      setCfgChecked(true);

      const u = getSessionUser?.();
      if (u) setUser(u);
    })();
  }, []);

  const handleLogout = (): void => {
    setSessionUser(null);
    setUser(null);
    setForceChangePassword(false);
    localStorage.clear();
    sessionStorage.clear();
  };

  const handleLogin = (u: any): void => {
    if (u._forceChangePassword || u.mustChangePassword) {
      setUser(u);
      setForceChangePassword(true);
      return;
    }
    setSessionUser(u);
    setUser(u);
  };

  if (!cfgChecked) return null;

  return (
    <HashRouter>
      {/* ✅ Obligatorio antes de usar la app */}
      {needsBusinessSetup ? (
        <BusinessSetup
          onDone={() => {
            // en dev, no reinicia; entonces marcamos como listo
            setNeedsBusinessSetup(false);
          }}
        />
      ) : !user ? (
        <Login onLogin={handleLogin} />
      ) : forceChangePassword ? (
        <ChangePassword
          user={user}
          onChanged={() => {
            setForceChangePassword(false);
            setSessionUser(user);
          }}
        />
      ) : (
        <AppRoutes user={user} onLogout={handleLogout} />
      )}
    </HashRouter>
  );
}

export default App;