import { ImageResponse } from "next/og";

export const runtime = "edge";
export const alt = "SUARIK — AI Cinematic Engine";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default async function Image() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          background: "linear-gradient(145deg, #060606 0%, #0A0A0C 50%, #0F0808 100%)",
          fontFamily: "system-ui, sans-serif",
          position: "relative",
          overflow: "hidden",
        }}
      >
        {/* Subtle grid overlay */}
        <div
          style={{
            position: "absolute",
            inset: 0,
            backgroundImage:
              "linear-gradient(rgba(255,255,255,0.02) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.02) 1px, transparent 1px)",
            backgroundSize: "40px 40px",
            display: "flex",
          }}
        />

        {/* Orange accent glow */}
        <div
          style={{
            position: "absolute",
            top: "-200px",
            right: "-100px",
            width: "600px",
            height: "600px",
            borderRadius: "50%",
            background: "radial-gradient(circle, rgba(232,81,42,0.12) 0%, transparent 70%)",
            display: "flex",
          }}
        />

        {/* Purple accent glow */}
        <div
          style={{
            position: "absolute",
            bottom: "-150px",
            left: "-50px",
            width: "500px",
            height: "500px",
            borderRadius: "50%",
            background: "radial-gradient(circle, rgba(155,143,248,0.08) 0%, transparent 70%)",
            display: "flex",
          }}
        />

        {/* Logo */}
        <div
          style={{
            fontSize: "64px",
            fontWeight: 900,
            color: "#E8512A",
            letterSpacing: "8px",
            marginBottom: "24px",
            display: "flex",
          }}
        >
          SUARIK
        </div>

        {/* Tagline */}
        <div
          style={{
            fontSize: "28px",
            fontWeight: 600,
            color: "#EAEAEA",
            marginBottom: "12px",
            display: "flex",
          }}
        >
          AI Cinematic Engine
        </div>

        {/* Description */}
        <div
          style={{
            fontSize: "18px",
            color: "#7A7A7A",
            maxWidth: "700px",
            textAlign: "center",
            lineHeight: 1.5,
            display: "flex",
          }}
        >
          Transforme sua copy em storyboard profissional com IA
        </div>

        {/* Bottom bar */}
        <div
          style={{
            position: "absolute",
            bottom: 0,
            left: 0,
            right: 0,
            height: "4px",
            background: "linear-gradient(90deg, #E8512A, #9B8FF8, #3ECF8E, #E8512A)",
            display: "flex",
          }}
        />

        {/* Pill chips */}
        <div
          style={{
            display: "flex",
            gap: "12px",
            marginTop: "32px",
          }}
        >
          {["B-Rolls", "Legendas", "Trilha", "SFX", "Export"].map((label) => (
            <div
              key={label}
              style={{
                fontSize: "14px",
                fontWeight: 600,
                color: "#7A7A7A",
                padding: "6px 16px",
                borderRadius: "20px",
                border: "1px solid #1A1A1A",
                background: "#0F0F0F",
                display: "flex",
              }}
            >
              {label}
            </div>
          ))}
        </div>
      </div>
    ),
    { ...size }
  );
}
