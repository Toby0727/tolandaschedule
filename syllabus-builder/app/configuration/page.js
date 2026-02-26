export const dynamic = 'force-dynamic'

export default function ConfigurationPage() {
  return (
    <div
      style={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "#fff",
        position: "relative",
        padding: 24,
      }}
    >
      <div style={{ textAlign: "center" }}>
        <h1
          style={{
            margin: 0,
            color: "#111",
            fontFamily: "'Playfair Display',serif",
            fontSize: 38,
            fontWeight: 700,
          }}
        >
          Configuration
        </h1>
      </div>

      <button
        type="button"
        onClick={() => {
          window.location.href = "/configuration/secret";
        }}
        style={{
          position: "absolute",
          bottom: 10,
          right: 12,
          width: 10,
          height: 10,
          borderRadius: "50%",
          border: "1px solid #d2d2d2",
          background: "#fff",
          color: "#d2d2d2",
          fontSize: 6,
          fontFamily: "'DM Sans',sans-serif",
          lineHeight: 1,
          padding: 0,
          cursor: "pointer",
        }}
        aria-label="secret message"
      >
        ·
      </button>
    </div>
  );
}
