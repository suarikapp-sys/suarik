import { ImageResponse } from "next/og";

export const size = { width: 180, height: 180 };
export const contentType = "image/png";

export default function AppleIcon() {
  return new ImageResponse(
    (
      <div style={{ width: 180, height: 180, display: "flex", background: "#0A0A0A", borderRadius: 40, position: "relative" }}>
        <div style={{ position: "absolute", left: 34, top: 28, width: 112, height: 31, borderRadius: 11, background: "#F0F0F0", display: "flex" }} />
        <div style={{ position: "absolute", left: 115, top: 28, width: 31, height: 68, borderRadius: 11, background: "#F0F0F0", display: "flex" }} />
        <div style={{ position: "absolute", left: 34, top: 121, width: 112, height: 31, borderRadius: 11, background: "#E8512A", display: "flex" }} />
        <div style={{ position: "absolute", left: 34, top: 84, width: 31, height: 68, borderRadius: 11, background: "#E8512A", display: "flex" }} />
      </div>
    ),
    { ...size }
  );
}
