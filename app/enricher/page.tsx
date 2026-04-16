"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import { useRouter } from "next/navigation";
import SuarikLogo from "@/components/SuarikLogo";

const C = {
  bg:"#060606", bg2:"#09090B", bg3:"#0F0F0F", bg4:"#141414", bg5:"#1C1C1C",
  b:"#131313",  b2:"#1A1A1A", b3:"#222",
  t:"#EAEAEA",  t2:"#7A7A7A", t3:"#444", t4:"#252525",
  o:"#E8512A",  o2:"#FF6B3D", os:"rgba(232,81,42,.07)", om:"rgba(232,81,42,.16)",
  grn:"#3ECF8E", gs:"rgba(62,207,142,.07)",  gm:"rgba(62,207,142,.18)",
  pur:"#9B8FF8", ps:"rgba(155,143,248,.07)",
  blu:"#4A9EFF", bs:"rgba(74,158,255,.07)",
};

async function storeFileInIDB(file: File): Promise<void> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open("enricherDB", 1);
    req.onupgradeneeded = () => req.result.createObjectStore("files");
    req.onsuccess = () => {
      const tx = req.result.transaction("files", "readwrite");
      tx.objectStore("files").put(file, "pending");
      tx.oncomplete = () => { req.result.close(); resolve(); };
      tx.onerror = () => reject(tx.error);
    };
    req.onerror = () => reject(req.error);
  });
}

const isVideoFile = (f: File) =>
  f.type.startsWith("video/") || f.type === "" ||
  /\.(mp4|mov|avi|mkv|webm|wmv|flv|m4v|mts|m2ts|3gp|ts|mxf)$/i.test(f.name);

export default function EnricherPage() {
  const router = useRouter();
  const [dragging,        setDragging]        = useState(false);
  const [file,            setFile]            = useState<File | null>(null);
  const [selectedFormat,  setSelectedFormat]  = useState<"16:9"|"9:16"|"1:1">("9:16");
  const [analyzing,       setAnalyzing]       = useState(false);
  const [activeSbi,       setActiveSbi]       = useState("timeline");
  const [recentProjects,  setRecentProjects]  = useState<{ id: string; title: string; created_at: string }[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    fetch("/api/projects")
      .then(r => r.json())
      .then((d: { projects?: { id: string; tool: string; title: string; created_at: string }[] }) => {
        const projects = (d.projects ?? []).filter(p => p.tool === "storyboard").slice(0, 3);
        setRecentProjects(projects);
      })
      .catch(() => {});
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
    const f = e.dataTransfer.files[0];
    if (f && isVideoFile(f)) setFile(f);
  }, []);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (f) setFile(f);
  };

  const handleAnalyze = async () => {
    if (!file || analyzing) return;
    setAnalyzing(true);
    try {
      await storeFileInIDB(file);
      sessionStorage.setItem("vb_enricher_format", selectedFormat);
      sessionStorage.setItem("vb_enricher_pending", "1");
      router.push("/storyboard");
    } catch { setAnalyzing(false); }
  };

  const DZ_FEATS = [
    { bg: C.bs, ico: <svg width="14" height="14" viewBox="0 0 16 16" fill="none"><circle cx="8" cy="8" r="6" stroke={C.blu} strokeWidth="1.2"/><path d="M8 5v3l2 2" stroke={C.blu} strokeWidth="1.2" strokeLinecap="round"/></svg>, t: "Fast Ingest", s: "Transcrição automática · timecodes por cena" },
    { bg: C.ps,  ico: <svg width="14" height="14" viewBox="0 0 16 16" fill="none"><path d="M2 8h3l2.5-5 2.5 10 2.5-5H15" stroke={C.pur} strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round"/></svg>, t: "B-Roll Suggest", s: "Sugestões por cena com análise semântica IA" },
    { bg: C.gs,  ico: <svg width="14" height="14" viewBox="0 0 16 16" fill="none"><rect x="2" y="4" width="12" height="8" rx="1.5" stroke={C.grn} strokeWidth="1.2"/><path d="M2 7h12M6 4v8" stroke={C.grn} strokeWidth="1"/></svg>, t: "Auto-Transcribe", s: "Legendas CC sincronizadas · PT · EN · ES" },
  ];

  const FORMATS = [
    { ratio: "16:9" as const, label: "Cinematic" },
    { ratio: "9:16" as const, label: "Social / Reels" },
    { ratio: "1:1"  as const, label: "Square" },
  ];

  const SBI_NAV = [
    { id: "timeline", label: "Timeline" },
    { id: "aitools",  label: "AI Tools" },
    { id: "meta",     label: "Metadados" },
    { id: "export",   label: "Exportar" },
  ];

  return (
    <div style={{ background: C.bg, color: C.t, fontFamily: "'Geist',system-ui,sans-serif", display: "flex", flexDirection: "column", height: "100vh", overflow: "hidden", WebkitFontSmoothing: "antialiased" }}>
      <style>{`
        @keyframes ring-spin { from{transform:rotate(0)} to{transform:rotate(360deg)} }
        .en-sbi { display:flex;align-items:center;gap:8px;padding:7px 9px;border-radius:7px;cursor:pointer;transition:all .15s;margin-bottom:1px;color:${C.t3};border:1px solid transparent; }
        .en-sbi:hover { background:${C.bg3};color:${C.t2}; }
        .en-sbi.on { background:${C.bg3};color:${C.t};border-color:${C.b2}; }
        .en-rec { display:flex;align-items:center;gap:7px;padding:6px 9px;border-radius:7px;cursor:pointer;transition:all .15s;margin-bottom:1px; }
        .en-rec:hover { background:${C.bg3}; }
        .en-drop-zone { width:100%;max-width:580px;border:1.5px dashed ${C.b2};border-radius:11px;display:flex;flex-direction:column;align-items:center;gap:0;cursor:pointer;transition:all .25s;overflow:hidden;background:${C.bg2}; }
        .en-drop-zone:hover,.en-drop-zone.drag { border-color:rgba(232,81,42,.4);box-shadow:0 0 0 4px rgba(232,81,42,.04); }
        .en-dz-btn { display:flex;align-items:center;gap:5px;font-size:12px;font-weight:500;padding:8px 16px;border-radius:7px;border:1px solid ${C.b};background:${C.bg3};color:${C.t2};cursor:pointer;font-family:inherit;transition:all .2s; }
        .en-dz-btn:hover { border-color:${C.b2};color:${C.t}; }
        .en-format-btn { flex:1;display:flex;flex-direction:column;align-items:center;justify-content:center;padding:20px 12px;border-radius:9px;transition:all .15s;border:1px solid;cursor:pointer;background:none;font-family:inherit; }
      `}</style>

      {/* ── TOPBAR ─────────────────────────────────────────────────────────── */}
      <div style={{ height: 46, background: C.bg, borderBottom: `1px solid ${C.b}`, display: "flex", alignItems: "center", padding: "0 14px", gap: 8, flexShrink: 0, zIndex: 100 }}>
        <button onClick={() => router.back()} style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 11, color: C.t3, cursor: "pointer", padding: "5px 8px", borderRadius: 6, border: "none", background: "none", fontFamily: "inherit" }}
          onMouseOver={e => { (e.currentTarget as HTMLElement).style.background = C.bg3; (e.currentTarget as HTMLElement).style.color = C.t2; }}
          onMouseOut={e => { (e.currentTarget as HTMLElement).style.background = "none"; (e.currentTarget as HTMLElement).style.color = C.t3; }}>
          <svg width="12" height="12" viewBox="0 0 13 13" fill="none"><path d="M8 2L3 6.5l5 4.5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round"/></svg>
          Voltar
        </button>
        <div style={{ display: "flex", alignItems: "center", gap: 7, padding: "0 10px", borderLeft: `1px solid ${C.b}`, borderRight: `1px solid ${C.b}`, flexShrink: 0 }}>
          <SuarikLogo size={18} showName />
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <span style={{ fontSize: 12, color: C.t4 }}>·</span>
          <span style={{ fontSize: 12, fontWeight: 600, color: C.t2 }}>B-Roll Studio</span>
          <span style={{ fontSize: 10, color: C.t4, padding: "2px 7px", background: C.bg3, border: `1px solid ${C.b}`, borderRadius: 10, letterSpacing: ".06em", textTransform: "uppercase" as const }}>
            {file ? "Configurar" : "Upload"}
          </span>
        </div>
        <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 6 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 5, padding: "4px 10px", background: C.bg3, border: `1px solid ${C.b}`, borderRadius: 6, fontSize: 11, color: C.t2, cursor: "pointer" }}>
            <svg width="10" height="10" viewBox="0 0 12 12" fill="none"><rect x="1" y="2" width="10" height="8" rx="1.5" stroke="currentColor" strokeWidth="1"/><path d="M4 5l2 2 2-2" stroke="currentColor" strokeWidth=".9" strokeLinecap="round"/></svg>
            <span>BROLL_WORKFLOW_02</span>
          </div>
          <div style={{ width: 1, height: 14, background: C.b, flexShrink: 0 }} />
          <button onClick={file ? handleAnalyze : () => inputRef.current?.click()} disabled={analyzing}
            style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 11, fontWeight: 600, padding: "6px 12px", borderRadius: 6, border: `1px solid ${C.o}`, background: C.o, color: "#fff", cursor: "pointer", fontFamily: "inherit" }}>
            <svg width="11" height="11" viewBox="0 0 12 12" fill="none"><path d="M2 6h8M7 3l3 3-3 3" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/></svg>
            {file ? (analyzing ? "Preparando..." : "Iniciar Análise") : "Nova Sequência"}
          </button>
        </div>
      </div>

      {/* ── MAIN GRID ──────────────────────────────────────────────────────── */}
      <div style={{ display: "grid", gridTemplateColumns: "196px 1fr", flex: 1, overflow: "hidden" }}>

        {/* ── SIDEBAR ──────────────────────────────────────────────────────── */}
        <div style={{ borderRight: `1px solid ${C.b}`, display: "flex", flexDirection: "column", overflow: "hidden", background: C.bg }}>
          <div style={{ padding: "12px 11px 8px", borderBottom: `1px solid ${C.b}`, flexShrink: 0 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 7, marginBottom: 2 }}>
              <svg width="14" height="14" viewBox="0 0 16 16" fill="none"><rect x="1" y="3" width="14" height="10" rx="1.5" stroke={C.o} strokeWidth="1.2"/><path d="M1 6h14" stroke={C.o} strokeWidth="1"/><path d="M9 9l2-2-2-2" stroke={C.o} strokeWidth="1.1" strokeLinecap="round" strokeLinejoin="round"/></svg>
              <span style={{ fontSize: 9, fontWeight: 700, letterSpacing: ".12em", textTransform: "uppercase" as const, color: C.o }}>B-Roll Studio</span>
            </div>
            <div style={{ fontSize: 10, color: C.t3 }}>AI Overlay Suite</div>
            <button onClick={() => { setFile(null); setAnalyzing(false); }}
              style={{ width: "100%", marginTop: 10, padding: 8, background: C.o, color: "#fff", border: "none", borderRadius: 7, fontSize: 11, fontWeight: 700, cursor: "pointer", fontFamily: "inherit", display: "flex", alignItems: "center", justifyContent: "center", gap: 5 }}>
              <svg width="11" height="11" viewBox="0 0 12 12" fill="none"><path d="M6 1v10M1 6h10" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/></svg>
              Nova Sequência
            </button>
          </div>

          <div style={{ flex: 1, overflowY: "auto", padding: "8px 8px 0" }}>
            <div style={{ fontSize: 9, fontWeight: 700, letterSpacing: ".12em", textTransform: "uppercase" as const, color: C.t4, padding: "0 8px 5px" }}>Navegação</div>
            {SBI_NAV.map(item => (
              <div key={item.id} className={`en-sbi${activeSbi === item.id ? " on" : ""}`} onClick={() => setActiveSbi(item.id)}>
                <div style={{ width: 24, height: 24, borderRadius: 5, background: C.bg4, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                  {item.id === "timeline" && <svg width="12" height="12" viewBox="0 0 14 14" fill="none"><path d="M2 4h10M2 7h7M2 10h8" stroke={activeSbi === item.id ? C.t2 : C.t3} strokeWidth="1.1" strokeLinecap="round"/></svg>}
                  {item.id === "aitools" && <svg width="12" height="12" viewBox="0 0 14 14" fill="none"><path d="M7 1L5.5 4.5H2l2.5 2-1 3.5L7 7.5l3.5 2.5-1-3.5 2.5-2H8.5L7 1z" fill="currentColor" opacity=".6"/></svg>}
                  {item.id === "meta" && <svg width="12" height="12" viewBox="0 0 14 14" fill="none"><rect x="2" y="2" width="10" height="10" rx="1.5" stroke={C.t3} strokeWidth="1.1"/><path d="M4 5h6M4 7.5h4M4 10h5" stroke={C.t3} strokeWidth="1" strokeLinecap="round"/></svg>}
                  {item.id === "export" && <svg width="12" height="12" viewBox="0 0 14 14" fill="none"><path d="M7 10V2M4 7l3 4 3-4M2 12h10" stroke={C.t3} strokeWidth="1.1" strokeLinecap="round" strokeLinejoin="round"/></svg>}
                </div>
                <span style={{ fontSize: 12, fontWeight: activeSbi === item.id ? 500 : 400, whiteSpace: "nowrap" as const }}>{item.label}</span>
              </div>
            ))}

            <div style={{ height: 1, background: C.b, margin: "6px 8px" }} />
            <div style={{ fontSize: 9, fontWeight: 700, letterSpacing: ".12em", textTransform: "uppercase" as const, color: C.t4, padding: "0 8px 5px" }}>Recentes</div>
            {recentProjects.length === 0
              ? <div style={{ fontSize: 10, color: C.t4, padding: "4px 9px" }}>Nenhum projeto ainda</div>
              : recentProjects.map(r => (
                  <div key={r.id} className="en-rec" onClick={() => router.push("/storyboard")}>
                    <div style={{ width: 22, height: 22, borderRadius: 4, background: C.bg4, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                      <svg width="10" height="10" viewBox="0 0 12 12" fill="none"><rect x="1" y="2" width="10" height="8" rx="1" stroke={C.t4} strokeWidth="1"/><path d="M4 5l2 2 2-2" stroke={C.t4} strokeWidth="1" strokeLinecap="round"/></svg>
                    </div>
                    <span style={{ fontSize: 11, color: C.t3, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" as const, flex: 1 }}>{r.title}</span>
                    <span style={{ fontSize: 9, color: C.t4 }}>
                      {(() => { const d = new Date(r.created_at); const diff = Date.now() - d.getTime(); const h = Math.floor(diff / 3_600_000); return h < 24 ? `${h}h` : `${Math.floor(h / 24)}d`; })()}
                    </span>
                  </div>
                ))}
          </div>

          <div style={{ borderTop: `1px solid ${C.b}`, padding: "9px 10px", flexShrink: 0 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 10, color: C.t3 }}>
              <svg width="10" height="10" viewBox="0 0 12 12" fill="none"><rect x="1" y="4" width="10" height="7" rx="1" stroke={C.t4} strokeWidth="1"/><path d="M4 4V3a2 2 0 014 0v1" stroke={C.t4} strokeWidth="1"/></svg>
              Upload criptografado
            </div>
          </div>
        </div>

        {/* ── MAIN ─────────────────────────────────────────────────────────── */}
        <div style={{ display: "flex", flexDirection: "column", overflow: "hidden", background: C.bg2 }}>
          <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", padding: 32, overflowY: "auto" }}>
            {!file ? (
              /* Drop zone */
              <div
                className={`en-drop-zone${dragging ? " drag" : ""}`}
                onDragOver={e => { e.preventDefault(); setDragging(true); }}
                onDragLeave={() => setDragging(false)}
                onDrop={handleDrop}
                onClick={() => inputRef.current?.click()}>
                <input ref={inputRef} type="file" accept="video/*,.mkv,.avi,.mov,.wmv,.flv,.m4v,.mts,.m2ts,.ts,.mxf" style={{ display: "none" }} onChange={handleFileChange} />

                {/* Feature cards row */}
                <div style={{ width: "100%", padding: 20, borderBottom: `1px solid ${C.b}`, display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8 }}>
                  {DZ_FEATS.map((f, i) => (
                    <div key={i} style={{ background: C.bg3, border: `1px solid ${C.b}`, borderRadius: 7, padding: "10px 11px", display: "flex", flexDirection: "column", gap: 6 }}>
                      <div style={{ width: 28, height: 28, borderRadius: 6, background: f.bg, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>{f.ico}</div>
                      <div style={{ fontSize: 11, fontWeight: 600, color: C.t, letterSpacing: "-.01em" }}>{f.t}</div>
                      <div style={{ fontSize: 10, color: C.t3, lineHeight: 1.4 }}>{f.s}</div>
                    </div>
                  ))}
                </div>

                {/* Drop center */}
                <div style={{ padding: "24px 20px", display: "flex", flexDirection: "column", alignItems: "center", gap: 12, textAlign: "center" }}>
                  <div style={{ width: 52, height: 52, borderRadius: "50%", background: C.bg3, border: `1.5px dashed ${C.b2}`, display: "flex", alignItems: "center", justifyContent: "center", color: C.t3 }}>
                    <svg width="22" height="22" viewBox="0 0 24 24" fill="none"><path d="M12 16V4M8 8l4-4 4 4M4 20h16" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/></svg>
                  </div>
                  <div style={{ fontSize: 16, fontWeight: 700, color: C.t, letterSpacing: "-.02em" }}>Arraste qualquer vídeo aqui</div>
                  <div style={{ fontSize: 12, color: C.t2, lineHeight: 1.6 }}>MP4 · MOV · MKV · AVI · WebM e mais<br/>A análise IA começa imediatamente após o upload</div>
                  <div style={{ display: "flex", gap: 8 }} onClick={e => e.stopPropagation()}>
                    <button className="en-dz-btn" onClick={() => inputRef.current?.click()}>
                      <svg width="11" height="11" viewBox="0 0 12 12" fill="none"><rect x="1" y="1" width="10" height="10" rx="1.5" stroke="currentColor" strokeWidth="1"/><path d="M4 6h4M6 4v4" stroke="currentColor" strokeWidth="1" strokeLinecap="round"/></svg>
                      Procurar Arquivo
                    </button>
                    <button className="en-dz-btn">
                      <svg width="11" height="11" viewBox="0 0 12 12" fill="none"><path d="M6 1C3.2 1 1 3.2 1 6s2.2 5 5 5 5-2.2 5-5S8.8 1 6 1z" stroke="currentColor" strokeWidth="1"/><path d="M4 6h4M6 4v4" stroke="currentColor" strokeWidth=".9" strokeLinecap="round"/></svg>
                      Biblioteca Cloud
                    </button>
                  </div>
                  <div style={{ fontSize: 10, color: C.t4, letterSpacing: ".04em" }}>Upload criptografado · sem limite de resolução</div>
                </div>
              </div>
            ) : (
              /* File selected — format selection */
              <div style={{ width: "100%", maxWidth: 540, display: "flex", flexDirection: "column", gap: 20 }}>
                {/* File info */}
                <div style={{ display: "flex", alignItems: "center", gap: 12, padding: 14, background: C.os, border: `1px solid ${C.om}`, borderRadius: 10 }}>
                  <div style={{ width: 44, height: 44, borderRadius: 8, background: C.o, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                    <svg width="20" height="20" viewBox="0 0 22 22" fill="none"><rect x="2" y="3" width="18" height="16" rx="2" stroke="#fff" strokeWidth="1.3"/><path d="M8 8l7 3-7 3V8z" fill="#fff" opacity=".9"/></svg>
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 14, fontWeight: 600, color: C.t, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" as const }}>{file.name}</div>
                    <div style={{ fontSize: 11, color: C.t2, marginTop: 2 }}>{(file.size / 1024 / 1024).toFixed(1)} MB</div>
                  </div>
                  <button onClick={() => setFile(null)} style={{ fontSize: 11, color: C.t3, background: "none", border: "none", cursor: "pointer", fontFamily: "inherit" }}>Trocar</button>
                </div>

                {/* Format selection */}
                <div>
                  <div style={{ fontSize: 9, fontWeight: 700, letterSpacing: ".12em", textTransform: "uppercase" as const, color: C.t4, marginBottom: 10 }}>Formato de Saída</div>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10 }}>
                    {FORMATS.map(fmt => {
                      const on = selectedFormat === fmt.ratio;
                      return (
                        <button key={fmt.ratio} className="en-format-btn" onClick={() => setSelectedFormat(fmt.ratio)}
                          style={{ borderColor: on ? C.om : C.b2, background: on ? C.os : C.bg3 }}>
                          <div style={{
                            borderRadius: 4, marginBottom: 10, border: `1px solid ${on ? C.om : C.b2}`, background: on ? C.om : C.bg4,
                            width: fmt.ratio === "16:9" ? 48 : fmt.ratio === "1:1" ? 28 : 20,
                            height: fmt.ratio === "16:9" ? 28 : fmt.ratio === "1:1" ? 28 : 40,
                          }} />
                          <div style={{ fontSize: 13, fontWeight: 700, color: on ? C.o : C.t, fontFamily: "inherit" }}>{fmt.ratio}</div>
                          <div style={{ fontSize: 10, color: C.t3, marginTop: 3 }}>{fmt.label}</div>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Analyze button */}
                <button onClick={handleAnalyze} disabled={analyzing}
                  style={{ width: "100%", padding: "16px 0", borderRadius: 10, fontWeight: 700, fontSize: 14, color: "#fff", border: "none", cursor: analyzing ? "not-allowed" : "pointer", background: `linear-gradient(135deg,${C.o},#c44527)`, opacity: analyzing ? .7 : 1, fontFamily: "inherit" }}>
                  {analyzing ? "⏳ Preparando análise..." : "⚡ Iniciar Análise Neural"}
                </button>
              </div>
            )}
          </div>

          {/* Footer bar */}
          <div style={{ padding: "10px 16px", borderTop: `1px solid ${C.b}`, display: "flex", alignItems: "center", gap: 12, background: C.bg, flexShrink: 0 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 11, color: C.t4 }}>
              Target <span style={{ fontWeight: 600, color: C.t2, marginLeft: 4 }}>BROLL_WORKFLOW_02</span>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 11, color: C.t4, marginLeft: 12 }}>
              Est. Duration <span style={{ fontWeight: 600, color: C.t2, marginLeft: 4 }}>~2:45 min</span>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 10, color: C.grn, marginLeft: "auto", fontWeight: 600 }}>
              <svg width="10" height="10" viewBox="0 0 12 12" fill="none"><rect x="1" y="4" width="10" height="7" rx="1" stroke="currentColor" strokeWidth="1"/><path d="M4 4V3a2 2 0 014 0v1" stroke="currentColor" strokeWidth="1"/></svg>
              Upload Criptografado
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
