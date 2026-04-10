"use client";

import React from "react";

interface Props {
  children: React.ReactNode;
}

interface State {
  hasError: boolean;
  message:  string;
}

export class ErrorBoundary extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, message: "" };
  }

  static getDerivedStateFromError(error: unknown): State {
    const message = error instanceof Error ? error.message : "Erro inesperado";
    return { hasError: true, message };
  }

  componentDidCatch(error: unknown, info: React.ErrorInfo) {
    console.error("[ErrorBoundary] Caught error:", error, info.componentStack);
  }

  handleReload = () => {
    if (typeof window !== "undefined") window.location.reload();
  };

  handleBack = () => {
    if (typeof window !== "undefined") window.location.href = "/dashboard";
  };

  render() {
    if (!this.state.hasError) return this.props.children;

    return (
      <div style={{
        minHeight: "100vh", background: "#09090b",
        display: "flex", alignItems: "center", justifyContent: "center",
        fontFamily: "'DM Sans', sans-serif", padding: 24,
      }}>
        <div style={{
          maxWidth: 440, width: "100%", textAlign: "center",
          padding: "48px 40px", borderRadius: 20,
          background: "rgba(255,255,255,0.03)",
          border: "1px solid rgba(255,255,255,0.08)",
        }}>
          <div style={{ fontSize: 48, marginBottom: 20 }}>💥</div>
          <h1 style={{
            fontSize: 20, fontWeight: 800, color: "#fff",
            margin: "0 0 12px", letterSpacing: -0.5,
          }}>
            Algo deu errado
          </h1>
          <p style={{
            fontSize: 13, color: "#666", margin: "0 0 8px", lineHeight: 1.6,
          }}>
            Um erro inesperado ocorreu nesta página.
          </p>
          {this.state.message && (
            <p style={{
              fontSize: 11, color: "#444", margin: "0 0 28px",
              fontFamily: "monospace", padding: "8px 12px", borderRadius: 8,
              background: "rgba(255,255,255,0.03)", border: "1px solid #222",
              wordBreak: "break-word",
            }}>
              {this.state.message}
            </p>
          )}
          <div style={{ display: "flex", gap: 10, justifyContent: "center" }}>
            <button
              onClick={this.handleBack}
              style={{
                padding: "10px 20px", borderRadius: 10,
                border: "1px solid #333", background: "transparent",
                color: "#888", fontSize: 13, fontWeight: 600, cursor: "pointer",
              }}
            >
              ← Dashboard
            </button>
            <button
              onClick={this.handleReload}
              style={{
                padding: "10px 20px", borderRadius: 10,
                border: "none", cursor: "pointer", fontSize: 13, fontWeight: 700,
                background: "linear-gradient(135deg,#F0563A,#c44527)", color: "#fff",
              }}
            >
              ↺ Recarregar
            </button>
          </div>
        </div>
      </div>
    );
  }
}
