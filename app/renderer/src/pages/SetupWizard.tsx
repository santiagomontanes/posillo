/**
 * SetupWizard.tsx
 * ===============
 * Wizard de instalación automática de la base de datos MySQL.
 * Se muestra al primer arranque cuando no hay BD configurada.
 *
 * Pasos:
 *  1. Conexión MySQL (host, puerto, usuario, contraseña, nombre BD)
 *  2. Administrador (nombre, email, contraseña)
 *  3. Instalando (progreso en tiempo real)
 *  4. Listo
 */

import { useState, useEffect, useRef } from 'react';

// ─────────────────────────────────────────────
// Tipos
// ─────────────────────────────────────────────
type Step = 'connection' | 'admin' | 'installing' | 'done' | 'error';

interface InstallProgress {
  step: string;
  message: string;
  percent: number;
}

interface FormData {
  host: string;
  port: string;
  user: string;
  password: string;
  database: string;
  adminName: string;
  adminEmail: string;
  adminPassword: string;
  adminPasswordConfirm: string;
  companyName: string;
}

interface PrefillData {
  mode?: 'server' | 'cashier' | null;
  host?: string;
  port?: number;
  user?: string;
  password?: string;
  database?: string;
}

// ─────────────────────────────────────────────
// Componente principal
// ─────────────────────────────────────────────
export default function SetupWizard({
  onComplete,
  prefill,
}: {
  onComplete: () => void;
  prefill?: PrefillData | null;
}) {
  const isCashier = prefill?.mode === 'cashier';

  const [step, setStep]             = useState<Step>('connection');
  const [form, setForm]             = useState<FormData>({
    host:                 prefill?.host     ?? 'localhost',
    port:                 String(prefill?.port ?? 3306),
    user:                 prefill?.user     ?? '',
    password:             prefill?.password ?? '',
    database:             prefill?.database ?? 'sistetecni_pos',
    adminName: '', adminEmail: '', adminPassword: '',
    adminPasswordConfirm: '', companyName: '',
  });
  const [testing, setTesting]       = useState(false);
  const [testResult, setTestResult] = useState<{ ok: boolean; message?: string } | null>(null);
  const [errors, setErrors]         = useState<Partial<FormData>>({});
  const [progress, setProgress]     = useState<InstallProgress[]>([]);
  const [currentProgress, setCurrentProgress] = useState<InstallProgress | null>(null);
  const [errorMsg, setErrorMsg]     = useState('');
  const [showPass, setShowPass]     = useState(false);
  const logRef = useRef<HTMLDivElement>(null);

  // Escuchar progreso en tiempo real
  useEffect(() => {
    const api = (window as any).api;
    if (!api?.on) return;
    const unsub = api.on?.('installer:progress', (p: InstallProgress) => {
      setCurrentProgress(p);
      setProgress(prev => [...prev, p]);
    });
    return () => { unsub?.(); };
  }, []);

  // Auto-scroll en log
  useEffect(() => {
    if (logRef.current) {
      logRef.current.scrollTop = logRef.current.scrollHeight;
    }
  }, [progress]);

  const set = (field: keyof FormData) => (e: React.ChangeEvent<HTMLInputElement>) => {
    setForm(f => ({ ...f, [field]: e.target.value }));
    setErrors(er => ({ ...er, [field]: '' }));
    setTestResult(null);
  };

  // ── Probar conexión ──
  const handleTestConnection = async () => {
    const api = (window as any).api;
    setTesting(true);
    setTestResult(null);
    const result = await api.installer.testConnection({
      host: form.host.trim(),
      port: Number(form.port) || 3306,
      user: form.user.trim(),
      password: form.password,
      database: form.database.trim(),
    });
    setTestResult(result);
    setTesting(false);
  };

  // ── Validar paso 1 ──
  const validateConnection = () => {
    const e: Partial<FormData> = {};
    if (!form.host.trim())     e.host     = 'Requerido';
    if (!form.user.trim())     e.user     = 'Requerido';
    if (!form.database.trim()) e.database = 'Requerido';
    if (isNaN(Number(form.port)) || Number(form.port) < 1) e.port = 'Puerto inválido';
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  // ── Validar paso 2 ──
  const validateAdmin = () => {
    const e: Partial<FormData> = {};
    if (!form.adminName.trim())  e.adminName  = 'Requerido';
    if (!form.adminEmail.trim()) e.adminEmail = 'Requerido';
    else if (!/\S+@\S+\.\S+/.test(form.adminEmail)) e.adminEmail = 'Email inválido';
    if (!form.adminPassword)     e.adminPassword = 'Requerido';
    else if (form.adminPassword.length < 6) e.adminPassword = 'Mínimo 6 caracteres';
    if (form.adminPassword !== form.adminPasswordConfirm)
      e.adminPasswordConfirm = 'Las contraseñas no coinciden';
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  // ── Ejecutar instalación ──
  const handleInstall = async () => {
    if (!validateAdmin()) return;
    const api = (window as any).api;
    setStep('installing');
    setProgress([]);

    const result = await api.installer.run({
      mysql: {
        host: form.host.trim(),
        port: Number(form.port) || 3306,
        user: form.user.trim(),
        password: form.password,
        database: form.database.trim(),
      },
      adminName: form.adminName.trim(),
      adminEmail: form.adminEmail.trim().toLowerCase(),
      adminPassword: form.adminPassword,
      companyName: form.companyName.trim(),
    });

    if (result.ok) {
      setStep('done');
    } else {
      setErrorMsg(result.error ?? 'Error desconocido');
      setStep('error');
    }
  };

  // ─────────────────────────────────────────────
  // RENDER
  // ─────────────────────────────────────────────
  return (
    <div style={styles.overlay}>
      <div style={styles.card}>

        {/* Header */}
        <div style={styles.header}>
          <div style={styles.logoMark}>
            <svg width="32" height="32" viewBox="0 0 32 32" fill="none">
              <rect width="32" height="32" rx="8" fill="#2563EB"/>
              <path d="M8 22L14 10L20 18L23 14L26 22H8Z" fill="white" fillOpacity="0.9"/>
              <circle cx="23" cy="11" r="2.5" fill="#60A5FA"/>
            </svg>
          </div>
          <div>
            <h1 style={styles.title}>Sistetecni POS</h1>
            <p style={styles.subtitle}>
              {isCashier ? 'Conectar al servidor de la red' : 'Configuración inicial del sistema'}
            </p>
          </div>
        </div>

        {/* Indicador de pasos */}
        {(step === 'connection' || step === 'admin') && (
          <div style={styles.stepper}>
            {['Conexión MySQL', 'Administrador', 'Instalando'].map((label, i) => {
              // En modo cajero solo mostramos el paso de conexión
              if (isCashier && i > 0) return null;
              const active = (step === 'connection' && i === 0) || (step === 'admin' && i === 1);
              const done   = (step === 'admin' && i === 0);
              return (
                <div key={i} style={styles.stepItem}>
                  <div style={{
                    ...styles.stepCircle,
                    background: done ? '#22C55E' : active ? '#2563EB' : '#E5E7EB',
                    color: (done || active) ? '#fff' : '#9CA3AF',
                  }}>
                    {done ? '✓' : i + 1}
                  </div>
                  <span style={{ ...styles.stepLabel, color: active ? '#1D4ED8' : done ? '#16A34A' : '#9CA3AF' }}>
                    {label}
                  </span>
                  {i < 2 && !isCashier && <div style={styles.stepLine} />}
                </div>
              );
            })}
          </div>
        )}

        {/* ── PASO 1: CONEXIÓN ── */}
        {step === 'connection' && (
          <div style={styles.body}>
            <p style={styles.sectionDesc}>
              {isCashier
                ? '⚠️ Este es un PC Cajero. Ingresa la IP del PC Servidor y las credenciales de acceso.'
                : <>Ingresa los datos de tu servidor MySQL. Si es local, usa <code style={styles.code}>localhost</code>.</>
              }
            </p>

            <div style={styles.row2}>
              <Field label={isCashier ? 'IP del PC Servidor' : 'Host / IP'} error={errors.host}>
                <input
                  style={inputStyle(!!errors.host)}
                  value={form.host}
                  onChange={set('host')}
                  placeholder={isCashier ? '192.168.1.100' : 'localhost'}
                />
              </Field>
              <Field label="Puerto" error={errors.port}>
                <input style={inputStyle(!!errors.port)} value={form.port} onChange={set('port')} placeholder="3306" />
              </Field>
            </div>

            <div style={styles.row2}>
              <Field label="Usuario MySQL" error={errors.user}>
                <input style={inputStyle(!!errors.user)} value={form.user} onChange={set('user')} placeholder="root" autoComplete="off" />
              </Field>
              <Field label="Contraseña MySQL" error={errors.password}>
                <input style={inputStyle(!!errors.password)} value={form.password} onChange={set('password')} type="password" placeholder="••••••••" autoComplete="new-password" />
              </Field>
            </div>

            <Field label="Nombre de la base de datos" error={errors.database}>
              <input style={inputStyle(!!errors.database)} value={form.database} onChange={set('database')} placeholder="sistetecni_pos" />
            </Field>

            <p style={styles.hint}>
              {isCashier
                ? '💡 Pide la IP del servidor y las credenciales al administrador del sistema.'
                : '💡 Si la base de datos no existe, se creará automáticamente.'
              }
            </p>

            {/* Resultado del test */}
            {testResult && (
              <div style={{ ...styles.alert, background: testResult.ok ? '#F0FDF4' : '#FEF2F2', borderColor: testResult.ok ? '#86EFAC' : '#FCA5A5' }}>
                <span style={{ color: testResult.ok ? '#16A34A' : '#DC2626', fontSize: 14 }}>
                  {testResult.ok ? '✓ Conexión exitosa. Puedes continuar.' : `✗ ${testResult.message}`}
                </span>
              </div>
            )}

            <div style={styles.actions}>
              <button
                style={{ ...styles.btnSecondary, opacity: testing ? 0.7 : 1 }}
                onClick={handleTestConnection}
                disabled={testing}
              >
                {testing ? 'Probando...' : 'Probar conexión'}
              </button>
              <button
                style={styles.btnPrimary}
                onClick={() => {
                  if (!validateConnection()) return;
                  // Cajero: no necesita crear admin, ir directo a instalar
                  if (isCashier) {
                    handleInstallCashier();
                  } else {
                    setStep('admin');
                  }
                }}
              >
                {isCashier ? 'Conectar →' : 'Siguiente →'}
              </button>
            </div>
          </div>
        )}

        {/* ── PASO 2: ADMINISTRADOR (solo PC Servidor) ── */}
        {step === 'admin' && !isCashier && (
          <div style={styles.body}>
            <p style={styles.sectionDesc}>
              Crea el usuario administrador principal del sistema.
            </p>

            <Field label="Nombre completo" error={errors.adminName}>
              <input style={inputStyle(!!errors.adminName)} value={form.adminName} onChange={set('adminName')} placeholder="Nombre Apellido" />
            </Field>

            <Field label="Empresa / Negocio (opcional)" error={errors.companyName}>
              <input style={inputStyle(false)} value={form.companyName} onChange={set('companyName')} placeholder="Mi Empresa S.A.S." />
            </Field>

            <Field label="Email del administrador" error={errors.adminEmail}>
              <input style={inputStyle(!!errors.adminEmail)} value={form.adminEmail} onChange={set('adminEmail')} placeholder="admin@miempresa.com" type="email" autoComplete="off" />
            </Field>

            <div style={styles.row2}>
              <Field label="Contraseña" error={errors.adminPassword}>
                <div style={styles.passWrapper}>
                  <input
                    style={{ ...inputStyle(!!errors.adminPassword), paddingRight: 40 }}
                    value={form.adminPassword}
                    onChange={set('adminPassword')}
                    type={showPass ? 'text' : 'password'}
                    placeholder="Mínimo 6 caracteres"
                    autoComplete="new-password"
                  />
                  <button style={styles.eyeBtn} onClick={() => setShowPass(s => !s)} type="button">
                    {showPass ? '🙈' : '👁️'}
                  </button>
                </div>
              </Field>
              <Field label="Confirmar contraseña" error={errors.adminPasswordConfirm}>
                <input
                  style={inputStyle(!!errors.adminPasswordConfirm)}
                  value={form.adminPasswordConfirm}
                  onChange={set('adminPasswordConfirm')}
                  type={showPass ? 'text' : 'password'}
                  placeholder="Repetir contraseña"
                  autoComplete="new-password"
                />
              </Field>
            </div>

            <div style={styles.actions}>
              <button style={styles.btnSecondary} onClick={() => setStep('connection')}>
                ← Volver
              </button>
              <button style={styles.btnPrimary} onClick={handleInstall}>
                Instalar sistema
              </button>
            </div>
          </div>
        )}

        {/* ── PASO 3: INSTALANDO ── */}
        {step === 'installing' && (
          <div style={styles.body}>
            <div style={styles.progressHeader}>
              <div style={styles.spinnerWrap}>
                <div style={styles.spinner} />
              </div>
              <div>
                <p style={{ margin: 0, fontWeight: 600, color: '#1E293B', fontSize: 16 }}>
                  {isCashier ? 'Conectando al servidor...' : 'Instalando sistema...'}
                </p>
                <p style={{ margin: '4px 0 0', color: '#64748B', fontSize: 13 }}>
                  {currentProgress?.message ?? 'Iniciando...'}
                </p>
              </div>
            </div>

            <div style={styles.progressBar}>
              <div style={{ ...styles.progressFill, width: `${currentProgress?.percent ?? 0}%` }} />
            </div>
            <p style={styles.progressPct}>{currentProgress?.percent ?? 0}%</p>

            <div ref={logRef} style={styles.logBox}>
              {progress.map((p, i) => (
                <div key={i} style={styles.logLine}>
                  <span style={styles.logCheck}>{p.step === 'error' ? '✗' : '✓'}</span>
                  <span style={{ color: p.step === 'error' ? '#EF4444' : '#334155' }}>
                    {p.message}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── PASO 4: LISTO ── */}
        {step === 'done' && (
          <div style={{ ...styles.body, textAlign: 'center' }}>
            <div style={styles.successIcon}>✓</div>
            <h2 style={{ fontSize: 22, fontWeight: 700, color: '#15803D', margin: '12px 0 8px' }}>
              {isCashier ? '¡Conectado al servidor!' : '¡Sistema instalado correctamente!'}
            </h2>
            <p style={{ color: '#475569', fontSize: 14, margin: '0 0 8px' }}>
              {isCashier
                ? 'Este PC cajero está listo para operar.'
                : 'La base de datos, tablas y usuario administrador fueron creados.'
              }
            </p>
            <div style={styles.summaryBox}>
              <SummaryRow label="Servidor"      value={`${form.host}:${form.port}`} />
              <SummaryRow label="Base de datos" value={form.database} />
              {!isCashier && <SummaryRow label="Administrador" value={form.adminEmail} />}
            </div>
            {!isCashier && (
              <p style={{ color: '#94A3B8', fontSize: 12, margin: '12px 0 20px' }}>
                Guarda estos datos en un lugar seguro.
              </p>
            )}
            <button style={{ ...styles.btnPrimary, width: '100%', justifyContent: 'center' }} onClick={onComplete}>
              Ingresar al sistema →
            </button>
          </div>
        )}

        {/* ── ERROR ── */}
        {step === 'error' && (
          <div style={{ ...styles.body, textAlign: 'center' }}>
            <div style={styles.errorIcon}>✗</div>
            <h2 style={{ fontSize: 20, fontWeight: 700, color: '#DC2626', margin: '12px 0 8px' }}>
              {isCashier ? 'Error al conectar' : 'Error en la instalación'}
            </h2>
            <div style={{ ...styles.alert, background: '#FEF2F2', borderColor: '#FCA5A5', textAlign: 'left' }}>
              <code style={{ fontSize: 12, color: '#991B1B', whiteSpace: 'pre-wrap', wordBreak: 'break-all' }}>
                {errorMsg}
              </code>
            </div>
            <p style={{ color: '#64748B', fontSize: 13, margin: '12px 0 20px' }}>
              {isCashier
                ? 'Verifica que la IP del servidor sea correcta y que el PC servidor esté encendido.'
                : 'Verifica los datos de conexión y que el usuario MySQL tenga permisos de CREATE DATABASE.'
              }
            </p>
            <div style={styles.actions}>
              <button style={styles.btnSecondary} onClick={() => { setStep('connection'); setErrors({}); }}>
                ← Volver a configurar
              </button>
              <button style={styles.btnPrimary} onClick={() => {
                setProgress([]);
                setStep('installing');
                isCashier ? handleInstallCashier() : handleInstall();
              }}>
                Reintentar
              </button>
            </div>
          </div>
        )}

      </div>

      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        @keyframes fadeIn { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: translateY(0); } }
      `}</style>
    </div>
  );

  // ── Instalación cajero: solo guarda config y verifica conexión ──
  async function handleInstallCashier() {
    const api = (window as any).api;
    setStep('installing');
    setProgress([]);

    const result = await api.installer.run({
      mysql: {
        host: form.host.trim(),
        port: Number(form.port) || 3306,
        user: form.user.trim(),
        password: form.password,
        database: form.database.trim(),
      },
      // Cajero no crea admin, usa el del servidor
      adminName:    '_cashier_',
      adminEmail:   '_cashier_@sistetecni.local',
      adminPassword: '_skip_',
      companyName:  '',
      isCashier:    true,
    });

    if (result.ok) {
      setStep('done');
    } else {
      setErrorMsg(result.error ?? 'Error desconocido');
      setStep('error');
    }
  }
}

// ─────────────────────────────────────────────
// Sub-componentes
// ─────────────────────────────────────────────
function Field({ label, error, children }: { label: string; error?: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 16 }}>
      <label style={styles.label}>{label}</label>
      {children}
      {error && <p style={styles.errorText}>{error}</p>}
    </div>
  );
}

function SummaryRow({ label, value }: { label: string; value: string }) {
  return (
    <div style={styles.summaryRow}>
      <span style={{ color: '#64748B', fontSize: 13 }}>{label}</span>
      <span style={{ color: '#1E293B', fontSize: 13, fontWeight: 600 }}>{value}</span>
    </div>
  );
}

// ─────────────────────────────────────────────
// Estilos
// ─────────────────────────────────────────────
const inputStyle = (hasError: boolean): React.CSSProperties => ({
  width: '100%',
  padding: '9px 12px',
  border: `1.5px solid ${hasError ? '#F87171' : '#E2E8F0'}`,
  borderRadius: 8,
  fontSize: 14,
  color: '#1E293B',
  background: '#FAFAFA',
  outline: 'none',
  boxSizing: 'border-box',
  transition: 'border-color 0.15s',
});

const styles: Record<string, React.CSSProperties> = {
  overlay: {
    position: 'fixed', inset: 0,
    background: 'linear-gradient(135deg, #EFF6FF 0%, #F0F9FF 50%, #F0FDF4 100%)',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    zIndex: 9999, padding: 16,
    animation: 'fadeIn 0.3s ease',
  },
  card: {
    background: '#FFFFFF',
    borderRadius: 16,
    boxShadow: '0 20px 60px rgba(0,0,0,0.12), 0 4px 16px rgba(0,0,0,0.06)',
    width: '100%', maxWidth: 560,
    overflow: 'hidden',
  },
  header: {
    display: 'flex', alignItems: 'center', gap: 14,
    padding: '24px 28px 20px',
    borderBottom: '1px solid #F1F5F9',
    background: 'linear-gradient(135deg, #EFF6FF, #F8FAFC)',
  },
  logoMark: { flexShrink: 0 },
  title: { margin: 0, fontSize: 20, fontWeight: 700, color: '#1E293B', letterSpacing: '-0.3px' },
  subtitle: { margin: '2px 0 0', fontSize: 13, color: '#64748B' },
  stepper: {
    display: 'flex', alignItems: 'center',
    padding: '16px 28px', borderBottom: '1px solid #F1F5F9',
    background: '#FAFAFA',
  },
  stepItem: { display: 'flex', alignItems: 'center', flex: 1, gap: 8 },
  stepCircle: {
    width: 28, height: 28, borderRadius: '50%',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    fontSize: 12, fontWeight: 700, flexShrink: 0,
  },
  stepLabel: { fontSize: 12, fontWeight: 500, whiteSpace: 'nowrap' },
  stepLine: { flex: 1, height: 1, background: '#E2E8F0', margin: '0 4px' },
  body: { padding: '24px 28px 28px' },
  sectionDesc: { margin: '0 0 20px', color: '#475569', fontSize: 14, lineHeight: 1.5 },
  row2: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 },
  label: { display: 'block', fontSize: 13, fontWeight: 600, color: '#374151', marginBottom: 6 },
  errorText: { margin: '4px 0 0', fontSize: 12, color: '#EF4444' },
  hint: { margin: '4px 0 16px', fontSize: 12, color: '#94A3B8', background: '#F8FAFC', padding: '8px 12px', borderRadius: 6 },
  alert: { padding: '10px 14px', borderRadius: 8, border: '1px solid', margin: '12px 0' },
  code: { background: '#F1F5F9', padding: '1px 5px', borderRadius: 4, fontSize: 12, fontFamily: 'monospace', color: '#475569' },
  passWrapper: { position: 'relative' },
  eyeBtn: { position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', fontSize: 16, padding: '0 4px' },
  actions: { display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 24 },
  btnPrimary: {
    display: 'flex', alignItems: 'center', gap: 6,
    padding: '10px 22px', background: '#2563EB', color: '#fff',
    border: 'none', borderRadius: 8, fontSize: 14, fontWeight: 600,
    cursor: 'pointer', transition: 'background 0.15s',
  },
  btnSecondary: {
    padding: '10px 18px', background: 'transparent', color: '#475569',
    border: '1.5px solid #E2E8F0', borderRadius: 8, fontSize: 14, fontWeight: 500,
    cursor: 'pointer',
  },
  progressHeader: { display: 'flex', alignItems: 'center', gap: 16, marginBottom: 20 },
  spinnerWrap: { flexShrink: 0 },
  spinner: {
    width: 36, height: 36, borderRadius: '50%',
    border: '3px solid #DBEAFE', borderTopColor: '#2563EB',
    animation: 'spin 0.8s linear infinite',
  },
  progressBar: { height: 8, background: '#F1F5F9', borderRadius: 99, overflow: 'hidden', marginBottom: 6 },
  progressFill: {
    height: '100%', background: 'linear-gradient(90deg, #2563EB, #60A5FA)',
    borderRadius: 99, transition: 'width 0.4s ease',
  },
  progressPct: { textAlign: 'right', fontSize: 12, color: '#94A3B8', margin: '0 0 12px' },
  logBox: {
    background: '#0F172A', borderRadius: 10, padding: '12px 14px',
    maxHeight: 180, overflowY: 'auto', fontFamily: 'monospace',
  },
  logLine: { display: 'flex', gap: 8, marginBottom: 4, animation: 'fadeIn 0.2s ease' },
  logCheck: { color: '#34D399', fontSize: 12, flexShrink: 0, marginTop: 1 },
  successIcon: {
    width: 64, height: 64, borderRadius: '50%', background: '#DCFCE7',
    color: '#16A34A', fontSize: 28, display: 'flex', alignItems: 'center',
    justifyContent: 'center', margin: '8px auto 0', fontWeight: 700,
  },
  errorIcon: {
    width: 64, height: 64, borderRadius: '50%', background: '#FEE2E2',
    color: '#DC2626', fontSize: 28, display: 'flex', alignItems: 'center',
    justifyContent: 'center', margin: '8px auto 0', fontWeight: 700,
  },
  summaryBox: {
    background: '#F8FAFC', border: '1px solid #E2E8F0',
    borderRadius: 10, padding: '12px 16px', margin: '12px 0',
  },
  summaryRow: { display: 'flex', justifyContent: 'space-between', padding: '5px 0', borderBottom: '1px solid #F1F5F9' },
};
