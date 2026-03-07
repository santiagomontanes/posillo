import { useEffect, useState } from "react";
import { login } from "../services/auth";
import logo from "../assets/logo.png";

type LoginUser = {
  id: string;
  name: string;
  email: string;
  role: string;
  mustChangePassword?: boolean;
};

export const Login = ({ onLogin }: { onLogin: (u: any) => void }) => {
  const [email, setEmail] = useState("admin@sistetecni.com");
  const [password, setPassword] = useState("admin");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [showCard, setShowCard] = useState(false);

  const whatsappNumber = "573043547758";
  const version = "v1.0.0";

  useEffect(() => {
    const t = setTimeout(() => setShowCard(true), 120);
    return () => clearTimeout(t);
  }, []);

  const openWhatsAppSupport = () => {
    const message = encodeURIComponent(
      "Hola, necesito soporte para Sistetecni POS."
    );
    const url = `https://wa.me/${whatsappNumber}?text=${message}`;
    window.open(url, "_blank");
  };

  const submit = async (): Promise<void> => {
    if (loading) return;

    setError("");
    setLoading(true);

    try {
      const u = (await login(email.trim(), password)) as LoginUser;

      if (u?.mustChangePassword) {
        onLogin({ ...u, _forceChangePassword: true });
        return;
      }

      onLogin(u);
    } catch (e: any) {
      const msg = String(e?.message ?? e ?? "Error");

      if (msg.toLowerCase().includes("credenciales")) {
        setError("Credenciales inválidas.");
      } else {
        setError(msg);
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      style={{
        minHeight: "100vh",
        background:
          "radial-gradient(circle at top left, rgba(59,130,246,.18), transparent 28%), radial-gradient(circle at bottom right, rgba(37,99,235,.14), transparent 24%), linear-gradient(135deg, #081120 0%, #0d1730 55%, #07101f 100%)",
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
        {/* PANEL IZQUIERDO */}
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
                  animation: "logoFloat 2.4s ease-in-out infinite",
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
              Un sistema profesional para puntos de venta, diseñado para dar
              control, velocidad y estabilidad a tu negocio.
            </p>

            <div
              style={{
                marginTop: 28,
                display: "grid",
                gap: 14,
              }}
            >
              <FeatureItem
                title="Inventario en tiempo real"
                text="Controla entradas, salidas y stock disponible al instante."
              />
              <FeatureItem
                title="Sistema multicaja"
                text="Diseñado para crecer con tu negocio y operar varias cajas."
              />
              <FeatureItem
                title="Reportes automáticos"
                text="Consulta ventas, gastos, utilidad y cierres con mayor claridad."
              />
              <FeatureItem
                title="Control de gastos"
                text="Registra egresos y obtén una visión más completa del movimiento diario."
              />
              <FeatureItem
                title="Facturación electrónica próximamente"
                text="Seguimos actualizando el software para integrar nuevas funciones."
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
            <span>Soporte y actualizaciones activas</span>
          </div>
        </div>

        {/* PANEL DERECHO */}
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
            display: "flex",
            flexDirection: "column",
            justifyContent: "center",
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
              Ingreso
            </h2>
            <p
              style={{
                marginTop: 8,
                marginBottom: 0,
                color: "rgba(255,255,255,.68)",
                lineHeight: 1.5,
              }}
            >
              Inicia sesión para acceder al sistema y continuar operando tu
              punto de venta.
            </p>
          </div>

          <input
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="Correo"
            autoComplete="username"
            disabled={loading}
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
            onKeyDown={(e) => {
              if (e.key === "Enter") void submit();
            }}
          />

          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Contraseña"
            autoComplete="current-password"
            disabled={loading}
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
            onKeyDown={(e) => {
              if (e.key === "Enter") void submit();
            }}
          />

          <button
            onClick={() => void submit()}
            disabled={loading}
            style={{
              width: "100%",
              padding: 14,
              borderRadius: 14,
              border: "none",
              background: loading ? "#2f7f35" : "#22c55e",
              color: "white",
              fontWeight: 800,
              fontSize: 15,
              cursor: loading ? "default" : "pointer",
              marginBottom: 12,
              boxShadow: "0 12px 24px rgba(34,197,94,.20)",
            }}
          >
            {loading ? "Entrando..." : "Entrar"}
          </button>

          <button
            onClick={openWhatsAppSupport}
            style={{
              width: "100%",
              padding: 14,
              borderRadius: 14,
              border: "1px solid rgba(255,255,255,.08)",
              background: "rgba(255,255,255,.04)",
              color: "white",
              fontWeight: 700,
              fontSize: 15,
              cursor: "pointer",
            }}
          >
            ¿Necesitas soporte? Escríbenos por WhatsApp
          </button>

          {!!error && (
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
              textAlign: "center",
            }}
          >
            Sistetecni POS {version}
            <br />
            Sistema desarrollado en Colombia 🇨🇴
          </div>
        </div>
      </div>

      <style>
        {`
          @keyframes logoFloat {
            0% { transform: translateY(0px); }
            50% { transform: translateY(-6px); }
            100% { transform: translateY(0px); }
          }
        `}
      </style>
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