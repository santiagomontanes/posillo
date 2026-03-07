import { useEffect, useState } from 'react';
import { HashRouter } from 'react-router-dom';
import { Login } from './pages/Login';
import { AppRoutes } from './routes';
import { getSessionUser, setSessionUser } from './services/session';
import { ChangePassword } from './pages/ChangePassword';
import { BusinessSetup } from './pages/BusinessSetup';
import { getConfig } from './services/config';
import { SplashScreen } from './ui/SplashScreen';

function App() {
  const [showSplash, setShowSplash] = useState(true);

  const [user, setUser] = useState<any>(null);
  const [forceChangePassword, setForceChangePassword] = useState(false);

  const [cfgChecked, setCfgChecked] = useState(false);
  const [needsBusinessSetup, setNeedsBusinessSetup] = useState(false);

  useEffect(() => {
    const splashTimer = setTimeout(() => {
      setShowSplash(false);
    }, 2000);

    return () => clearTimeout(splashTimer);
  }, []);

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

  if (showSplash) {
    return <SplashScreen />;
  }

  if (!cfgChecked) {
    return null;
  }

  return (
    <HashRouter>
      {needsBusinessSetup ? (
        <BusinessSetup
          onDone={() => {
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