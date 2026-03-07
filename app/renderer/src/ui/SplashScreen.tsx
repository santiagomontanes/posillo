import logo from "../assets/logo.png";

export const SplashScreen = () => {
  return (
    <div
      style={{
        height: "100vh",
        background:
          "radial-gradient(circle at top left, rgba(59,130,246,.2), transparent 30%), linear-gradient(135deg,#081120,#0d1730)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        flexDirection: "column",
        color: "white",
        fontFamily: "system-ui",
      }}
    >
      <img
        src={logo}
        style={{
          width: 120,
          marginBottom: 20,
          animation: "logoFloat 2s ease-in-out infinite",
        }}
      />

      <h1 style={{ fontSize: 36, margin: 0 }}>Sistetecni POS</h1>

      <p style={{ opacity: 0.7, marginTop: 10 }}>
        Sistema profesional para puntos de venta
      </p>

      <div style={{ marginTop: 20, opacity: 0.6 }}>
        Software hecho en Colombia 🇨🇴
      </div>

      <style>
        {`
        @keyframes logoFloat {
          0% { transform: translateY(0px); }
          50% { transform: translateY(-8px); }
          100% { transform: translateY(0px); }
        }
        `}
      </style>
    </div>
  );
};