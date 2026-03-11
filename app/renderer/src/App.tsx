import { useEffect, useState } from 'react';
import { HashRouter } from 'react-router-dom';
import { Login } from './pages/Login';
import { AppRoutes } from './routes';
import { getSessionUser, setSessionUser } from './services/session';
import { ChangePassword } from './pages/ChangePassword';
import { BusinessSetup } from './pages/BusinessSetup';
import { getConfig } from './services/config';
import { SplashScreen } from './ui/SplashScreen';
import SetupWizard from './pages/SetupWizard';

type AppState = 'loading' | 'setup' | 'ready';

export default function App() {
  // ── Estado del instalador ──
  const [appState, setAppState]     = useState<AppState>('loading');
  const [autoConfig, setAutoConfig] = useState<any>(null);

  // ── Estado interno del POS ──
  const [showSplash, setShowSplash]             = useState(true);
  const [user, setUser]                         = useState<any>(null);
  const [forceChangePassword, setForceChangePassword] = useState(false);
  const [cfgChecked, setCfgChecked]             = useState(false);
  const [needsBusinessSetup, setNeedsBusinessSetup]   = useState(false);

  // ── 1. Autodetect MySQL (primer arranque) ──
  useEffect(() => {
    const init = async () => {
      try {
        const api = (window as any).api;
        const detect = await api.autodetect.status();

        if (!detect.ok) { setAppState('setup'); return; }

        const result = detect.data;

        if (result.status === 'ready') {
          setAppState('ready');
        } else if (result.status === 'server_auto') {
          if (result.dbInstalled) {
            setAppState('ready');
          } else {
            setAutoConfig({ ...result.config, mode: 'server' });
            setAppState('setup');
          }
        } else if (result.status === 'cashier') {
          setAutoConfig({ mode: 'cashier' });
          setAppState('setup');
        } else {
          // manual → mostrar wizard sin pre-llenado
          setAppState('setup');
        }
      } catch {
        // Si falla el autodetect (ej: primer dev sin NSIS)
        // ir directo al POS normal
        setAppState('ready');
      }
    };
    init();
  }, []);

  // ── 2. Splash screen (solo cuando el POS ya está listo) ──
  useEffect(() => {
    if (appState !== 'ready') return;
    const t = setTimeout(() => setShowSplash(false), 2000);
    return () => clearTimeout(t);
  }, [appState]);

  // ── 3. Cargar config del negocio y sesión ──
  useEffect(() => {
    if (appState !== 'ready') return;
    (async () => {
      const cfg = await getConfig();
      const hasName = !!String(cfg?.business?.name ?? '').trim();
      setNeedsBusinessSetup(!hasName);
      setCfgChecked(true);

      const u = getSessionUser?.();
      if (u) setUser(u);
    })();
  }, [appState]);

  // ── Handlers de sesión ──
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

  // ── RENDER ──

  // Paso 1: wizard de instalación MySQL (primer arranque)
  if (appState === 'loading') {
    return (
      <div style={{
        display: 'flex', alignItems: 'center',
        justifyContent: 'center', height: '100vh',
        background: '#F8FAFC',
      }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{
            width: 36, height: 36, margin: '0 auto 12px',
            border: '3px solid #DBEAFE', borderTopColor: '#2563EB',
            borderRadius: '50%', animation: 'spin 0.8s linear infinite',
          }} />
          <p style={{ color: '#64748B', fontSize: 14, margin: 0 }}>
            Iniciando sistema...
          </p>
        </div>
        <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
      </div>
    );
  }

  // Paso 2: wizard de instalación (BD no configurada)
  if (appState === 'setup') {
    return (
      <SetupWizard
        prefill={autoConfig}
        onComplete={() => setAppState('ready')}
      />
    );
  }

  // Paso 3: splash screen
  if (showSplash) {
    return <SplashScreen />;
  }

  // Paso 4: esperando que cargue la config
  if (!cfgChecked) {
    return null;
  }

  // Paso 5: POS normal
  return (
    <HashRouter>
      {needsBusinessSetup ? (
        <BusinessSetup onDone={() => setNeedsBusinessSetup(false)} />
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
