import { useEffect, useState } from 'react';

type BusinessProfile = {
  businessName: string;
  businessTagline?: string;
  logoDataUrl?: string;
  nit?: string;
  phone?: string;
};

export const BusinessSettings = ({ onDone }: { onDone?: () => void }) => {
  const [businessName, setBusinessName] = useState('');
  const [businessTagline, setBusinessTagline] = useState('');
  const [logoDataUrl, setLogoDataUrl] = useState<string>('');
  const [nit, setNit] = useState('');
  const [phone, setPhone] = useState('');
  const [msg, setMsg] = useState('');

  useEffect(() => {
    (async () => {
      const cfg = await window.api.config.get();
      const p = (cfg?.businessProfile ?? cfg?.business ?? {}) as BusinessProfile;

      setBusinessName(p.businessName ?? cfg?.business?.name ?? '');
      setBusinessTagline(p.businessTagline ?? '');
      setLogoDataUrl(p.logoDataUrl ?? cfg?.business?.logoDataUrl ?? '');
      setNit(p.nit ?? cfg?.business?.nit ?? '');
      setPhone(p.phone ?? cfg?.business?.phone ?? '');
    })();
  }, []);

  const onPickLogo = async (file: File | null) => {
    setMsg('');
    if (!file) return;

    if (file.size > 600 * 1024) {
      setMsg('Logo muy pesado. Usa uno menor a 600 KB (PNG recomendado).');
      return;
    }

    const reader = new FileReader();
    reader.onload = () => setLogoDataUrl(String(reader.result ?? ''));
    reader.readAsDataURL(file);
  };

  const save = async () => {
    setMsg('');
    if (!businessName.trim()) return setMsg('El nombre del negocio es obligatorio.');

    const cfg = await window.api.config.get();

    await window.api.config.set({
      ...cfg,
      businessProfile: {
        businessName: businessName.trim(),
        businessTagline: businessTagline.trim() || '',
        logoDataUrl: logoDataUrl || '',
        nit: nit.trim() || '',
        phone: phone.trim() || '',
      },
      business: {
        ...(cfg?.business ?? {}),
        name: businessName.trim(),
        logoDataUrl: logoDataUrl || '',
        nit: nit.trim() || '',
        phone: phone.trim() || '',
      },
    });

    setMsg('Guardado ✅');
    onDone?.();
  };

  return (
    <div className="main">
      <div className="card grid">
        <h1>Perfil del negocio</h1>

        <label>
          <b>Nombre del negocio</b>
          <input value={businessName} onChange={(e) => setBusinessName(e.target.value)} />
        </label>

        <label>
          <b>Eslogan (opcional)</b>
          <input value={businessTagline} onChange={(e) => setBusinessTagline(e.target.value)} />
        </label>

        <label>
          <b>NIT (opcional)</b>
          <input value={nit} onChange={(e) => setNit(e.target.value)} placeholder="Ej: 901234567-8" />
        </label>

        <label>
          <b>Celular / teléfono (opcional)</b>
          <input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="Ej: 3001234567" />
        </label>

        <label>
          <b>Logo (PNG/JPG)</b>
          <input
            type="file"
            accept="image/png,image/jpeg"
            onChange={(e) => onPickLogo(e.target.files?.[0] ?? null)}
          />
        </label>

        {logoDataUrl && (
          <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
            <img
              src={logoDataUrl}
              alt="logo"
              style={{ width: 56, height: 56, objectFit: 'contain', borderRadius: 10 }}
            />
            <button className="btn btn--ghost" onClick={() => setLogoDataUrl('')}>
              Quitar logo
            </button>
          </div>
        )}

        <button className="btn" onClick={save}>Guardar</button>
        {msg && <small style={{ color: msg.includes('✅') ? 'green' : 'red' }}>{msg}</small>}
      </div>
    </div>
  );
};