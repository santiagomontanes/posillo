import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import logo from "../assets/logo.png";

export const Activate = () => {
  const [licenseKey, setLicenseKey] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [showCard, setShowCard] = useState(false);

  const navigate = useNavigate();
  const api = (window as any).api;

  const whatsappNumber = "573043547758";
  const version = "v1.2.1";

  useEffect(() => {
    const t = setTimeout(() => setShowCard(true), 120);
    return () => clearTimeout(t);
  }, []);

  const openWhatsApp = () => {
    const message = encodeURIComponent(
      "Hola, necesito renovar o activar mi licencia de Sistetecni POS."
    );
    const url = `https://wa.me/${whatsappNumber}?text=${message}`;
    window.open(url, "_blank");
  };

  if (!api?.license?.activate) {
    return (
      <div
        style={{
          minHeight: "100vh",
          background:
            "linear-gradient(135deg, #081120 0%, #10213e 45%, #0c1730 100%)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          color: "white",
          fontFamily: "system-ui, sans-serif",
          padding: 24,
        }}
      >
        <div
          style={{
            width: "100%",
            maxWidth: 520,
            background: "rgba(17, 24, 39, 0.88)",
            border: "1px solid rgba(255,255,255,.08)",
            borderRadius: 22,
            padding: 28,
            boxShadow: "0 24px 60px rgba(0,0,0,.35)",
          }}
        >
          <h2 style={{ marginTop: 0 }}>Activar Sistetecni POS</h2>
          <p style={{ opacity: 0.8 }}>
            Error: API de licencia no disponible (preload).
          </p>
        </div>
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
        minHeight: "100vh",
        background:
          "radial-gradient(circle at top left, rgba(59,130,246,.18), transparent 28%), radial-gradient(circle at bottom right, rgba(37,99,235,.16), transparent 24%), linear-gradient(135deg, #081120 0%, #0d1730 55%, #07101f 100%)",
        display: "flex",
        justifyContent: "center",
        alignItems: "center",
        padding: 24,
        fontFamily: "system-ui, sans-serif",
        color: "white",
      }}
    >
      <div
        style={{
          width: "100%",
          maxWidth: 1080,
          display: "grid",
          gridTemplateColumns: "1.1fr 0.9fr",
          gap: 28,
          alignItems: "stretch",
        }}
      >
        {/* PANEL IZQUIERDO / BIENVENIDA */}
        <div
          style={{
            background: "rgba(13, 23, 48, 0.72)",
            border: "1px solid rgba(255,255,255,.06)",
            borderRadius: 24,
            padding: 34,
            boxShadow: "0 24px 60px rgba(0,0,0,.28)",
            backdropFilter: "blur(10px)",
            display: "flex",
            flexDirection: "column",
            justifyContent: "space-between",
          }}
        >
          <div>
            <div
              style={{
                width: 82,
                height: 82,
                borderRadius: 20,
                background: "rgba(255,255,255,.96)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                padding: 10,
                boxSizing: "border-box",
                marginBottom: 22,
                boxShadow: "0 16px 30px rgba(0,0,0,.18)",
              }}
            >
              <img
                src={logo}
                alt="Logo Sistetecni"
                style={{
                  width: "100%",
                  height: "100%",
                  objectFit: "contain",
                }}
              />
            </div>

            <div
              style={{
                display: "inline-block",
                padding: "6px 12px",
                borderRadius: 999,
                background: "rgba(37,99,235,.18)",
                border: "1px solid rgba(96,165,250,.22)",
                color: "#cfe0ff",
                fontSize: 12,
                fontWeight: 700,
                marginBottom: 16,
              }}
            >
              Software hecho por colombianos 🇨🇴
            </div>

            <h1
              style={{
                margin: 0,
                fontSize: 38,
                lineHeight: 1.08,
                fontWeight: 900,
                letterSpacing: "-0.02em",
              }}
            >
              Bienvenido a
              <br />
              Sistetecni POS
            </h1>

            <p
              style={{
                marginTop: 16,
                marginBottom: 0,
                fontSize: 16,
                lineHeight: 1.6,
                color: "rgba(255,255,255,.78)",
                maxWidth: 580,
              }}
            >
              Un sistema desarrollado para negocios que buscan control,
              estabilidad y soporte real. Estamos mejorando constantemente
              nuestro software para ofrecer una experiencia más profesional,
              moderna y confiable.
            </p>

            <div
              style={{
                marginTop: 28,
                display: "grid",
                gap: 14,
              }}
            >
              <FeatureItem
                title="Soporte y acompañamiento"
                text="Estamos disponibles para ayudarte con instalación, activación y uso diario del sistema."
              />
              <FeatureItem
                title="Actualizaciones constantes"
                text="Seguimos mejorando el software para agregar funciones útiles y una experiencia más sólida."
              />
              <FeatureItem
                title="Facturación electrónica próximamente"
                text="Estamos preparando nuevas integraciones para que el sistema crezca junto con tu negocio."
              />
            </div>
          </div>

          <div
            style={{
              marginTop: 28,
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              gap: 12,
              flexWrap: "wrap",
              color: "rgba(255,255,255,.62)",
              fontSize: 13,
            }}
          >
            <span>Sistetecni POS {version}</span>
            <span>Licenciamiento y soporte oficial</span>
          </div>
        </div>

        {/* PANEL DERECHO / ACTIVACIÓN */}
        <div
          style={{
            background: "rgba(17, 24, 39, 0.9)",
            border: "1px solid rgba(255,255,255,.08)",
            borderRadius: 24,
            padding: 34,
            boxShadow: "0 24px 60px rgba(0,0,0,.35)",
            backdropFilter: "blur(12px)",
            transform: showCard ? "translateY(0px)" : "translateY(18px)",
            opacity: showCard ? 1 : 0,
            transition: "all .45s ease",
          }}
        >
          <div style={{ marginBottom: 22 }}>
            <h2
              style={{
                margin: 0,
                fontSize: 28,
                fontWeight: 800,
              }}
            >
              Activación de licencia
            </h2>
            <p
              style={{
                marginTop: 8,
                marginBottom: 0,
                color: "rgba(255,255,255,.68)",
                lineHeight: 1.5,
              }}
            >
              Ingresa tu licencia para comenzar a usar el sistema o contáctanos
              para renovarla.
            </p>
          </div>

          <div
            style={{
              background: "rgba(255,255,255,.03)",
              border: "1px solid rgba(255,255,255,.06)",
              borderRadius: 16,
              padding: 16,
              marginBottom: 18,
            }}
          >
            <div
              style={{
                fontSize: 13,
                color: "rgba(255,255,255,.62)",
                marginBottom: 8,
              }}
            >
              Formato esperado
            </div>
            <div
              style={{
                fontWeight: 800,
                letterSpacing: ".08em",
                color: "#dbeafe",
              }}
            >
              SISTE-XXXX-XXXX
            </div>
          </div>

          <input
            value={licenseKey}
            onChange={(e) => setLicenseKey(e.target.value)}
            placeholder="Ingresa tu licencia"
            style={{
              width: "100%",
              padding: "14px 14px",
              borderRadius: 14,
              border: "1px solid rgba(255,255,255,.10)",
              background: "#1b2435",
              color: "white",
              marginBottom: 14,
              outline: "none",
              boxSizing: "border-box",
              fontSize: 15,
            }}
          />

          <button
            onClick={handleActivate}
            disabled={loading || !licenseKey.trim()}
            style={{
              width: "100%",
              padding: 14,
              borderRadius: 14,
              border: "none",
              background: loading ? "#29498d" : "#2563eb",
              color: "white",
              fontWeight: 800,
              fontSize: 15,
              cursor: loading ? "default" : "pointer",
              marginBottom: 12,
              boxShadow: "0 12px 24px rgba(37,99,235,.28)",
            }}
          >
            {loading ? "Activando..." : "Activar licencia"}
          </button>

          <button
            onClick={openWhatsApp}
            style={{
              width: "100%",
              padding: 14,
              borderRadius: 14,
              border: "none",
              background: "#25D366",
              color: "white",
              fontWeight: 800,
              fontSize: 15,
              cursor: "pointer",
              boxShadow: "0 12px 24px rgba(37,211,102,.20)",
            }}
          >
            Renovar o solicitar licencia por WhatsApp
          </button>

          {error && (
            <div
              style={{
                marginTop: 14,
                padding: 12,
                borderRadius: 12,
                background: "rgba(220,38,38,.12)",
                border: "1px solid rgba(248,113,113,.22)",
                color: "#fca5a5",
                fontSize: 14,
                textAlign: "center",
              }}
            >
              {error}
            </div>
          )}

          <div
            style={{
              marginTop: 22,
              paddingTop: 18,
              borderTop: "1px solid rgba(255,255,255,.06)",
              color: "rgba(255,255,255,.58)",
              fontSize: 13,
              lineHeight: 1.6,
            }}
          >
            Al activar tu licencia podrás acceder al sistema, recibir mejoras
            progresivas y mantener tu software actualizado.
          </div>
        </div>
      </div>
    </div>
  );
};

const FeatureItem = ({
  title,
  text,
}: {
  title: string;
  text: string;
}) => {
  return (
    <div
      style={{
        padding: "14px 16px",
        borderRadius: 16,
        background: "rgba(255,255,255,.03)",
        border: "1px solid rgba(255,255,255,.06)",
      }}
    >
      <div style={{ fontWeight: 800, marginBottom: 4 }}>{title}</div>
      <div
        style={{
          color: "rgba(255,255,255,.72)",
          lineHeight: 1.5,
          fontSize: 14,
        }}
      >
        {text}
      </div>
    </div>
  );
};