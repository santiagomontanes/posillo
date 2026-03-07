import { useEffect, useState } from 'react';
import { getConfig, setConfig } from '../services/config';

const MAX_LOGO_BYTES = 450_000; // ~450KB (seguro para thermal + config.json)

export const BusinessSetup = ({ onDone }: { onDone: () => void }) => {
  const [name, setName] = useState('');
  const [logoDataUrl, setLogoDataUrl] = useState<string>('');
  const [error, setError] = useState('');

  useEffect(() => {
    (async () => {
      const cfg = await getConfig();
      setName(cfg?.business?.name ?? '');
      setLogoDataUrl(cfg?.business?.logoDataUrl ?? '');
    })();
  }, []);

  const pickLogo = async (file: File | null) => {
    setError('');
    if (!file) return;

    if (file.size > MAX_LOGO_BYTES) {
      setError('El logo es muy pesado. Usa uno menor a ~450KB (PNG/JPG).');
      return;
    }

    const dataUrl = await new Promise<string>((resolve, reject) => {
      const r = new FileReader();
      r.onload = () => resolve(String(r.result ?? ''));
      r.onerror = () => reject(new Error('No se pudo leer el archivo'));
      r.readAsDataURL(file);
    });

    setLogoDataUrl(dataUrl);
  };

  const save = async () => {
    setError('');
    const businessName = name.trim();
    if (!businessName) {
      setError('El nombre del negocio es obligatorio.');
      return;
    }

    await setConfig({
      business: {
        name: businessName,
        logoDataUrl: logoDataUrl || '',
      },
    });

    // en dev recarga, en prod reinicia por config:set.
    onDone();
  };

  return (
    <div className="main">
      <div className="card grid" style={{ maxWidth: 520, margin: '20px auto' }}>
        <h1>Configurar negocio</h1>
        <div style={{ opacity: 0.85 }}>
          Esto se mostrará en el POS y en la factura (sin quitar “Sistetecni POS”).
        </div>

        <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <b>Nombre del negocio</b>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Ej: Supermercado La 14"
          />
        </label>

        <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <b>Logo (opcional)</b>
          <input
            type="file"
            accept="image/png,image/jpeg"
            onChange={(e) => pickLogo(e.target.files?.[0] ?? null)}
          />
          <div className="muted" style={{ fontSize: 12, opacity: 0.85 }}>
            Recomendado: PNG/JPG pequeño. Se imprime mejor en 58mm si es simple.
          </div>
        </label>

        {logoDataUrl ? (
          <div className="card" style={{ padding: 12, borderRadius: 14 }}>
            <div style={{ fontWeight: 800, marginBottom: 8 }}>Vista previa</div>
            <img
              src={logoDataUrl}
              alt="logo"
              style={{ maxWidth: 180, maxHeight: 120, objectFit: 'contain' }}
            />
            <div style={{ marginTop: 10 }}>
              <button className="btn btn--ghost" onClick={() => setLogoDataUrl('')}>
                Quitar logo
              </button>
            </div>
          </div>
        ) : null}

        <button className="btn" onClick={save}>
          Guardar
        </button>

        {error ? <small style={{ color: '#ffd0d7' }}>{error}</small> : null}
      </div>
    </div>
  );
};