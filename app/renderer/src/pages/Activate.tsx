import { useState } from "react";
import { useNavigate } from "react-router-dom";

export const Activate = () => {
  const [licenseKey, setLicenseKey] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const api = (window as any).api;

  if (!api?.license?.activate) {
    return (
      <div style={{ padding: 40, color: "white" }}>
        <h2>Activar Sistetecni POS</h2>
        <p>Error: API de licencia no disponible (preload).</p>
      </div>
    );
  }

  const handleActivate = async () => {
    setError("");
    setLoading(true);

    try {
      const res = await api.license.activate(licenseKey.trim());

      // ✅ si NO es válida, NO navegues
      if (!res?.ok) {
        setError(res?.message || "Licencia inválida o vencida.");
        return;
      }

      // ✅ ok=true: entra
      navigate("/dashboard", { replace: true });
    } catch (err: any) {
      setError(err?.message || "Error activando licencia");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ padding: 40, color: "white" }}>
      <h2>Activar Sistetecni POS</h2>

      <input
        value={licenseKey}
        onChange={(e) => setLicenseKey(e.target.value)}
        placeholder="SISTE-1234"
        style={{ padding: 10, width: 320 }}
      />

      <div style={{ height: 12 }} />

      <button onClick={handleActivate} disabled={loading || !licenseKey.trim()}>
        {loading ? "Activando..." : "Activar"}
      </button>

      {error && <p style={{ color: "tomato", marginTop: 12 }}>{error}</p>}
    </div>
  );
};