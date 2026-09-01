export default function DashboardLoading() {
  return (
    <div
      style={{
        minHeight: "100vh",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: 14,
        background: "#05070a",
      }}
    >
      <div
        style={{
          width: 34,
          height: 34,
          borderRadius: "50%",
          border: "2.5px solid rgba(255,255,255,0.12)",
          borderTopColor: "#22d3ee",
          animation: "spin 0.8s linear infinite",
        }}
      />
      <div style={{ fontSize: 13, color: "#8b8f99" }}>Préparation de ton projet...</div>
      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
      `}</style>
    </div>
  );
}
