"use client";

/**
 * SuarikLogo — brand-consistent logo (symbol + optional wordmark)
 *
 * Usage:
 *   <SuarikLogo />                    — symbol only, 20px
 *   <SuarikLogo size={32} />          — symbol only, 32px
 *   <SuarikLogo showName />           — symbol + "Suarik" text
 *   <SuarikLogo showName size={24} /> — symbol + text, custom size
 */

interface SuarikLogoProps {
  size?: number;
  showName?: boolean;
  className?: string;
}

export default function SuarikLogo({ size = 20, showName = false, className }: SuarikLogoProps) {
  // Scale border-radius based on size (rx=14 at 64px → rx/64 ratio)
  const rx = Math.round((size / 64) * 14);
  const innerRx = Math.max(2, Math.round((size / 64) * 4));

  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: Math.round(size * 0.45) }} className={className}>
      <svg width={size} height={size} viewBox="0 0 64 64" xmlns="http://www.w3.org/2000/svg" style={{ display: "block", flexShrink: 0 }}>
        <rect width="64" height="64" rx={rx < 8 ? Math.max(rx, 6) : rx} fill="#0A0A0A" />
        {/* White: top-right corner of the S */}
        <rect x="12" y="10" width="40" height="11" rx={innerRx} fill="#F0F0F0" />
        <rect x="41" y="10" width="11" height="24" rx={innerRx} fill="#F0F0F0" />
        {/* Orange: bottom-left corner of the S */}
        <rect x="12" y="43" width="40" height="11" rx={innerRx} fill="#E8512A" />
        <rect x="12" y="30" width="11" height="24" rx={innerRx} fill="#E8512A" />
      </svg>
      {showName && (
        <span style={{
          fontSize: Math.round(size * 0.75),
          fontWeight: 700,
          color: "#EAEAEA",
          letterSpacing: "-0.01em",
          lineHeight: 1,
        }}>
          Suarik
        </span>
      )}
    </span>
  );
}
