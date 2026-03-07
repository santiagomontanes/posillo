import { useState } from "react";
import { useNavigate } from "react-router-dom";

export const Activate = () => {
  const [licenseKey, setLicenseKey] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const navigate = useNavigate();
  const api = (window as any).api;

  const whatsappNumber = "573043547758";

  const openWhatsApp = () => {
    const message = encodeURIComponent(
      "Hola, necesito renovar o activar mi licencia de Sistetecni POS."
    );

    const url = `https://wa.me/${whatsappNumber}?text=${message}`;
    window.open(url, "_blank");
  };

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

      if (!res?.ok) {
        setError(res?.message || "Licencia inválida o vencida.");
        return;
      }

      navigate("/dashboard", { replace: true });
    } catch (err: any) {
      setError(err?.message || "Error activando licencia");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      style={{
        height: "100vh",
        background: "#0f172a",
        display: "flex",
        justifyContent: "center",
        alignItems: "center",
        fontFamily: "system-ui",
        color: "white",
      }}
    >
      <div
        style={{
          width: 460,
          background: "#111827",
          borderRadius: 16,
          padding: 40,
          boxShadow: "0 20px 60px rgba(0,0,0,.45)",
        }}
      >
        {/* LOGO / TITULO */}
        <div style={{ textAlign: "center", marginBottom: 30 }}>
          <div style={{ fontSize: 28, fontWeight: 800 }}>
            Sistetecni POS
          </div>

          <div style={{ opacity: 0.7 }}>
            Activación de licencia
          </div>
        </div>

        {/* MENSAJE */}
        <div
          style={{
            background: "#1f2937",
            padding: 16,
            borderRadius: 10,
            marginBottom: 20,
            fontSize: 14,
            lineHeight: 1.5,
          }}
        >
          <b>Software hecho por colombianos 🇨🇴</b>
          <br />
          Nuestro sistema se actualiza constantemente para ofrecer
          mejoras, estabilidad y nuevas funciones.
          <br />
          Contamos con soporte técnico para ayudarte en cualquier momento.
          <br />
          <br />
          🚀 Próximamente integraremos <b>facturación electrónica</b>
          directamente desde el sistema.
        </div>

        {/* INPUT LICENCIA */}
        <input
          value={licenseKey}
          onChange={(e) => setLicenseKey(e.target.value)}
          placeholder="Ingresa tu licencia (SISTE-XXXX)"
          style={{
            width: "100%",
            padding: 12,
            borderRadius: 10,
            border: "1px solid #374151",
            background: "#1f2937",
            color: "white",
            marginBottom: 12,
          }}
        />

        {/* BOTON ACTIVAR */}
        <button
          onClick={handleActivate}
          disabled={loading || !licenseKey.trim()}
          style={{
            width: "100%",
            padding: 12,
            borderRadius: 10,
            border: "none",
            background: "#2563eb",
            color: "white",
            fontWeight: 700,
            cursor: "pointer",
            marginBottom: 10,
          }}
        >
          {loading ? "Activando..." : "Activar licencia"}
        </button>

        {/* BOTON WHATSAPP */}
        <button
          onClick={openWhatsApp}
          style={{
            width: "100%",
            padding: 12,
            borderRadius: 10,
            border: "none",
            background: "#25D366",
            color: "white",
            fontWeight: 700,
            cursor: "pointer",
          }}
        >
          Renovar o solicitar licencia por WhatsApp
        </button>

        {/* ERROR */}
        {error && (
          <div
            style={{
              marginTop: 14,
              color: "#ff7b7b",
              fontSize: 14,
              textAlign: "center",
            }}
          >
            {error}
          </div>
        )}

        {/* FOOTER */}
        <div
          style={{
            marginTop: 20,
            fontSize: 12,
            opacity: 0.6,
            textAlign: "center",
          }}
        >
          Sistetecni POS · Sistema de punto de venta
        </div>
      </div>
    </div>
  );
};