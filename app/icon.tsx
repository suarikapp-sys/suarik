import { ImageResponse } from "next/og";

export const size = { width: 32, height: 32 };
export const contentType = "image/png";

export default function Icon() {
  return new ImageResponse(
    (
      <div style={{ width: 32, height: 32, display: "flex", background: "#0A0A0A", borderRadius: 7 }}>
        {/* White top-right corner */}
        <div style={{ position: "absolute", left: 6, top: 5, width: 20, height: 5.5, borderRadius: 2, background: "#F0F0F0", display: "flex" }} />
        <div style={{ position: "absolute", left: 20.5, top: 5, width: 5.5, height: 12, borderRadius: 2, background: "#F0F0F0", display: "flex" }} />
        {/* Orange bottom-left corner */}
        <div style={{ position: "absolute", left: 6, top: 21.5, width: 20, height: 5.5, borderRadius: 2, background: "#E8512A", display: "flex" }} />
        <div style={{ position: "absolute", left: 6, top: 15, width: 5.5, height: 12, borderRadius: 2, background: "#E8512A", display: "flex" }} />
      </div>
    ),
    { ...size }
  );
}
