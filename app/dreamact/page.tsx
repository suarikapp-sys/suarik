"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { useCredits } from "@/hooks/useCredits";
import { InsufficientCreditsModal } from "@/components/CreditsBar";
import { useToast, ToastContainer } from "@/components/Toast";

// ─── Types ────────────────────────────────────────────────────────────────────
type Stage = "setup" | "processing" | "done" | "error";

// ─── Helpers ──────────────────────────────────────────────────────────────────
async function uploadToR2(blob: Blob, filename: string, contentType: string): Promise<string> {
  const { uploadUrl, publicUrl } = await fetch("/api/upload", {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ filename, contentType }),
  }).then(r => r.json());
  const r2Res = await fetch(uploadUrl, {
    method: "PUT", headers: { "Content-Type": contentType }, body: blob,
  });
  if (!r2Res.ok) throw new Error(`Upload falhou (HTTP ${r2Res.status})`);
  return publicUrl as string;
}
function sleep(ms: number) { return new Promise(r => setTimeout(r, ms)); }

// ─── Preset motion prompts ────────────────────────────────────────────────────
const MOTION_PRESETS = [
  { label: "Acenar",        prompt: "wave hello naturally, friendly smile"                        },
  { label: "Falar",         prompt: "talk expressively, natural head movements while speaking"    },
  { label: "Dançar",        prompt: "dance to upbeat music, energetic upper body movement"        },
  { label: "Respirar",      prompt: "subtle breathing, calm natural idle motion"                  },
  { label: "Rir",           prompt: "laugh naturally, shoulders moving with laughter"             },
  { label: "Acenar cabeça", prompt: "nod head in agreement, positive affirmation gesture"        },
  { label: "Apresentar",    prompt: "present something with open arms, welcoming gesture"         },
  { label: "Pensar",        prompt: "thinking pose, hand on chin, looking contemplative"          },
  { label: "Entusiasmado",  prompt: "excited and enthusiastic, energetic expressions"             },
  { label: "Confiante",     prompt: "confident posture, slight smile, authoritative presence"     },
];

const DURATION_OPTIONS = [2, 4, 6, 8, 10];

// ─── CSS variables inline ─────────────────────────────────────────────────────
const C = {
  bg:  "#060606", bg2: "#09090B", bg3: "#0F0F0F", bg4: "#141414", bg5: "#1C1C1C",
  b:   "#131313", b2: "#1A1A1A", b3: "#222",
  t:   "#EAEAEA", t2: "#7A7A7A", t3: "#444", t4: "#252525",
  o:   "#E8512A", o2: "#FF6B3D",
  pur: "#9B8FF8",
  ps:  "rgba(155,143,248,.07)", pm: "rgba(155,143,248,.16)",
  grn: "#3ECF8E", gs: "rgba(62,207,142,.07)", gm: "rgba(62,207,142,.18)",
};

// ─── Page ─────────────────────────────────────────────────────────────────────
export default function DreamActPage() {
  const router   = useRouter();
  const supabase = createClient();

  const [initials, setInitials] = useState("US");
  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) { router.push("/login"); return; }
      setInitials((user.email ?? "U")[0].toUpperCase());
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const { credits, plan, spend, cost, refresh, refund } = useCredits();
  const { toasts, remove: removeToast, toast } = useToast();
  const [showCreditModal, setShowCreditModal] = useState(false);

  // Image upload
  const [imageFile,    setImageFile]    = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [imageUrl,     setImageUrl]     = useState<string | null>(null);
  const [uploadingImg, setUploadingImg] = useState(false);
  const imageInputRef = useRef<HTMLInputElement>(null);

  // Prompt / duration
  const [prompt,   setPrompt]   = useState("");
  const [duration, setDuration] = useState(4);

  // Generation
  const [stage,       setStage]       = useState<Stage>("setup");
  const [progress,    setProgress]    = useState(0);
  const [statusMsg,   setStatusMsg]   = useState("");
  const [errorMsg,    setErrorMsg]    = useState("");
  const [resultVideo, setResultVideo] = useState<string | null>(null);

  const handleImageSelect = useCallback(async (file: File) => {
    setImageFile(file);
    setImagePreview(URL.createObjectURL(file));
    setUploadingImg(true);
    try {
      const url = await uploadToR2(file, `dreamact-img-${Date.now()}.${file.name.split(".").pop()}`, file.type || "image/jpeg");
      setImageUrl(url);
    } catch {
      toast.error("Falha ao fazer upload da imagem. Tenta novamente.");
      setImageFile(null); setImagePreview(null); setImageUrl(null);
    } finally { setUploadingImg(false); }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Poll com exponential backoff — evita hammerar a API e detecta falhas cedo
  const pollResult = useCallback(async (taskId: string, refundId: string) => {
    const MAX_ELAPSED = 600_000; // 10 min
    let   elapsed     = 0;
    let   delay       = 3000;    // 3s → 4.5s → 6.7s → ... até 15s
    let   consecutiveFails = 0;

    while (elapsed < MAX_ELAPSED) {
      await sleep(delay);
      elapsed += delay;
      delay    = Math.min(15_000, Math.round(delay * 1.5));
      setProgress(Math.min(90, 10 + (elapsed / MAX_ELAPSED) * 80));

      try {
        const res  = await fetch("/api/dreamact/poll", {
          method: "POST", headers: { "Content-Type": "application/json" },
          body:   JSON.stringify({ taskId }),
        });
        if (!res.ok) { consecutiveFails++; if (consecutiveFails > 5) break; continue; }
        consecutiveFails = 0;
        const data = await res.json() as { status: number; videoUrl: string | null };
        if (data.status === 1) setStatusMsg("Na fila...");
        if (data.status === 2) setStatusMsg("Animando...");
        if (data.status === 3 && data.videoUrl) {
          setProgress(100);
          setResultVideo(data.videoUrl);
          setStage("done");
          toast.success("Avatar animado com sucesso! 🎭");
          fetch("/api/projects", {
            method: "POST", headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              tool: "dreamact", title: `DreamAct — ${prompt.slice(0, 50)}`,
              result_url: data.videoUrl, meta: { taskId, duration },
            }),
          }).catch(() => {});
          return;
        }
        if (data.status === 4) {
          setStage("error"); setErrorMsg("Geração falhou. Tente com outra imagem ou prompt.");
          toast.error("Geração falhou."); await refund("dreamact", refundId); return;
        }
      } catch { consecutiveFails++; if (consecutiveFails > 5) break; }
    }
    await refund("dreamact", refundId);
    setStage("error"); setErrorMsg("Tempo limite excedido.");
    toast.error("Tempo limite excedido. Tente novamente.");
  }, [prompt, duration, refund, toast]);

  const handleGenerate = useCallback(async () => {
    if (!imageUrl || !prompt.trim()) return;
    const cr = await spend("dreamact");
    if (!cr.ok) { setShowCreditModal(true); return; }
    const { refundId } = cr;
    setStage("processing"); setProgress(5); setStatusMsg("Enviando para Newport AI..."); setErrorMsg("");
    try {
      const res  = await fetch("/api/dreamact", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body:   JSON.stringify({ imageUrl, prompt: prompt.trim(), duration }),
      });
      const data = await res.json() as { taskId?: string; error?: string };
      if (!data.taskId) {
        setStage("error"); setErrorMsg(data.error ?? "Erro ao iniciar job");
        await refund("dreamact", refundId);
        return;
      }
      setProgress(10); setStatusMsg("Job criado! Processando...");
      await pollResult(data.taskId, refundId);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Erro desconhecido";
      setStage("error"); setErrorMsg(msg); toast.error(msg);
      await refund("dreamact", refundId);
    }
  }, [imageUrl, prompt, duration, spend, pollResult, toast, refund]);

  const canGenerate = !!imageUrl && !!prompt.trim() && !uploadingImg;

  // Step states: 0=idle, 1=active, 2=done
  const stepState = (n: number) => {
    if (n === 0) return imageUrl ? 2 : (uploadingImg ? 1 : 0);
    if (n === 1) return prompt.trim() ? 2 : (imageUrl ? 1 : 0);
    if (n === 2) return canGenerate ? 1 : 0;
    return 0;
  };

  const stepColor = (s: number) => s === 2 ? C.grn : s === 1 ? C.pur : C.t3;

  // ─── Render ───────────────────────────────────────────────────────────────
  return (
    <div style={{display:"flex",flexDirection:"column",height:"100vh",background:C.bg,color:C.t,fontFamily:"'Geist','DM Sans',system-ui,sans-serif",overflow:"hidden"}}>

      <style>{`
        @keyframes spin{to{transform:rotate(360deg)}}
        @keyframes da-ring-pulse{0%,100%{opacity:.3;transform:scale(1)}50%{opacity:.6;transform:scale(1.04)}}
        @keyframes pulse2{0%,100%{opacity:1}50%{opacity:.4}}
        .da-mv-pill:hover{border-color:rgba(155,143,248,.45)!important;color:${C.pur}!important}
        .da-drop-inner:hover{border-color:rgba(155,143,248,.5)!important;background:rgba(155,143,248,.08)!important}
        input,textarea{box-sizing:border-box}
        textarea:focus{border-color:rgba(155,143,248,.35)!important;outline:none}
        input[type=range]{cursor:pointer;height:3px;border-radius:2px;accent-color:${C.pur}}
        ::-webkit-scrollbar{width:4px;height:4px}
        ::-webkit-scrollbar-thumb{background:${C.b2};border-radius:2px}
      `}</style>

      {/* ── PROCESSING OVERLAY ── */}
      {stage === "processing" && (
        <div style={{position:"fixed",inset:0,zIndex:1000,background:"rgba(4,4,4,.93)",backdropFilter:"blur(16px)",display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",gap:20}}>
          <div style={{position:"relative",width:80,height:80}}>
            <div style={{position:"absolute",inset:0,borderRadius:"50%",border:`2px solid transparent`,borderTopColor:C.pur,animation:"spin 1.1s linear infinite"}}/>
            <div style={{position:"absolute",inset:8,borderRadius:"50%",border:`2px solid transparent`,borderTopColor:C.o,animation:"spin 1.5s linear infinite reverse"}}/>
            <div style={{position:"absolute",inset:0,display:"flex",alignItems:"center",justifyContent:"center",fontSize:28}}>🎭</div>
          </div>
          <div style={{textAlign:"center"}}>
            <h2 style={{fontSize:19,fontWeight:700,letterSpacing:"-.025em",margin:"0 0 6px"}}>Animando Avatar</h2>
            <p style={{fontSize:12,color:C.t2,margin:0}}>{statusMsg}</p>
          </div>
          <div style={{background:C.bg3,border:`1px solid ${C.b}`,borderRadius:12,padding:"14px 16px",width:"100%",maxWidth:360}}>
            {[
              {lbl:"Imagem recebida",done:true},
              {lbl:"Analisando pose e rosto...",done:progress>30},
              {lbl:"Gerando movimento",done:progress>60},
              {lbl:"Renderizando vídeo",done:progress>85},
            ].map((s,i)=>(
              <div key={i} style={{display:"flex",alignItems:"center",gap:10,padding:"8px 0",borderBottom:i<3?`1px solid ${C.b}`:"none"}}>
                <div style={{width:16,height:16,borderRadius:"50%",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0,
                  background:s.done?"rgba(62,207,142,.12)":progress>0&&i===Math.floor(progress/25)?"rgba(155,143,248,.08)":"transparent",
                  border:`1px solid ${s.done?C.grn:C.b2}`}}>
                  {s.done ? <span style={{fontSize:8,color:C.grn}}>✓</span>
                    : <div style={{width:8,height:8,borderRadius:"50%",border:`1.5px solid transparent`,borderTopColor:C.pur,animation:"spin .8s linear infinite"}}/>}
                </div>
                <span style={{fontSize:11,color:s.done?C.t:C.t2}}>{s.lbl}</span>
              </div>
            ))}
          </div>
          <div style={{width:"100%",maxWidth:360}}>
            <div style={{height:2,background:C.bg4,borderRadius:1,overflow:"hidden"}}>
              <div style={{height:"100%",background:`linear-gradient(90deg,${C.pur},#C4BAF8)`,width:`${progress}%`,transition:"width .5s ease"}}/>
            </div>
            <div style={{display:"flex",justifyContent:"space-between",marginTop:6}}>
              <span style={{fontSize:11,color:C.t4}}>{Math.round(progress)}%</span>
              <span style={{fontSize:11,color:C.t4}}>~{Math.max(0, Math.round((1-progress/100)*2))} min restantes</span>
            </div>
          </div>
        </div>
      )}

      {/* ── RESULT OVERLAY ── */}
      {stage === "done" && resultVideo && (
        <div style={{position:"fixed",inset:0,zIndex:1000,background:"rgba(4,4,4,.96)",backdropFilter:"blur(20px)",display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",padding:32,gap:20}}>
          <div style={{width:"100%",maxWidth:520}}>
            <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:16}}>
              <div style={{width:8,height:8,borderRadius:"50%",background:C.grn,animation:"pulse2 2s infinite"}}/>
              <span style={{fontSize:11,color:C.t3,textTransform:"uppercase",letterSpacing:".08em"}}>DreamAct · Concluído</span>
            </div>
            <video src={resultVideo} controls autoPlay
              style={{width:"100%",borderRadius:14,background:"#000",maxHeight:"55vh",marginBottom:16}}/>
            <div style={{display:"flex",gap:8}}>
              <button onClick={()=>{sessionStorage.setItem("vb_pending_video",resultVideo);sessionStorage.setItem("vb_restore_requested","1");router.push("/storyboard");}}
                style={{flex:1,padding:"11px 0",borderRadius:8,border:"none",background:C.pur,color:"#fff",fontSize:13,fontWeight:700,cursor:"pointer"}}>
                ⚡ Usar no Editor
              </button>
              <a href={resultVideo} download="dreamact.mp4"
                style={{padding:"11px 18px",borderRadius:8,border:`1px solid ${C.b2}`,background:C.bg3,color:C.t2,fontSize:13,fontWeight:600,display:"flex",alignItems:"center",textDecoration:"none"}}>
                ↓ Download
              </a>
              <button onClick={()=>{setStage("setup");setResultVideo(null);setProgress(0);}}
                style={{padding:"11px 16px",borderRadius:8,border:`1px solid ${C.b}`,background:"transparent",color:C.t3,fontSize:13,cursor:"pointer"}}>
                ↺ Novo
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── ERROR OVERLAY ── */}
      {stage === "error" && (
        <div style={{position:"fixed",inset:0,zIndex:1000,background:"rgba(4,4,4,.95)",backdropFilter:"blur(20px)",display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",gap:16}}>
          <div style={{fontSize:40}}>⚠️</div>
          <h2 style={{fontSize:18,fontWeight:700,margin:0}}>Algo correu mal</h2>
          <p style={{color:C.t2,fontSize:13,textAlign:"center",maxWidth:320,margin:0}}>{errorMsg}</p>
          <button onClick={()=>{setStage("setup");setProgress(0);setErrorMsg("");}}
            style={{padding:"11px 28px",borderRadius:8,border:"none",background:C.pur,color:"#fff",fontSize:13,fontWeight:700,cursor:"pointer"}}>
            Tentar novamente
          </button>
        </div>
      )}

      {/* ── TOPBAR (46px) ── */}
      <header style={{height:46,display:"flex",alignItems:"center",gap:8,padding:"0 14px",background:C.bg,borderBottom:`1px solid ${C.b}`,flexShrink:0,zIndex:10}}>
        <button onClick={()=>router.back()}
          style={{display:"flex",alignItems:"center",gap:5,fontSize:11,color:C.t3,cursor:"pointer",padding:"5px 8px",borderRadius:6,border:"none",background:"none",fontFamily:"inherit",transition:"all .15s"}}
          onMouseEnter={e=>{(e.currentTarget as HTMLElement).style.background=C.bg3;(e.currentTarget as HTMLElement).style.color=C.t2;}}
          onMouseLeave={e=>{(e.currentTarget as HTMLElement).style.background="none";(e.currentTarget as HTMLElement).style.color=C.t3;}}>
          <svg width="12" height="12" viewBox="0 0 12 12" fill="none"><path d="M8 2L4 6l4 4" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/></svg>
          Voltar
        </button>
        <div style={{display:"flex",alignItems:"center",gap:7,padding:"0 10px",borderLeft:`1px solid ${C.b}`,borderRight:`1px solid ${C.b}`,flexShrink:0}}>
          <svg width="18" height="18" viewBox="0 0 20 20" fill="none"><rect width="20" height="20" rx="6" fill="#E8512A"/><text x="10" y="14" textAnchor="middle" fill="white" fontSize="9" fontWeight="900" fontFamily="sans-serif">S</text></svg>
          <span style={{fontSize:13,fontWeight:700,color:C.t,letterSpacing:"-.025em"}}>Suarik</span>
        </div>
        <div style={{display:"flex",alignItems:"center",gap:6}}>
          <span style={{fontSize:12,color:C.t4}}>/</span>
          <span style={{fontSize:12,fontWeight:600,color:C.t2}}>DreamAct</span>
          <span style={{fontSize:10,color:C.t4,padding:"2px 7px",background:C.bg3,border:`1px solid ${C.b}`,borderRadius:10,letterSpacing:".06em",textTransform:"uppercase"}}>IA</span>
        </div>
        <div style={{marginLeft:"auto",display:"flex",alignItems:"center",gap:6}}>
          <div style={{display:"flex",alignItems:"center",gap:5,padding:"4px 10px",background:C.bg3,border:`1px solid ${C.b}`,borderRadius:6,cursor:"pointer"}} onClick={()=>router.push("/pricing")}>
            <svg width="11" height="11" viewBox="0 0 12 12" fill="none"><path d="M6 1L4.5 4.5H1L3.5 7 2.5 10.5 6 8.5 9.5 10.5 8.5 7 11 4.5H7.5L6 1Z" fill="#F5A623" opacity=".85"/></svg>
            <span style={{fontSize:11,fontWeight:600,color:C.t}}>{credits.toLocaleString("pt-BR")}</span>
            <span style={{fontSize:10,color:C.t3}}>créditos</span>
          </div>
          <div style={{width:1,height:14,background:C.b,flexShrink:0}}/>
          <div style={{width:28,height:28,borderRadius:"50%",background:C.pur,display:"flex",alignItems:"center",justifyContent:"center",fontSize:11,fontWeight:700,color:"#fff",flexShrink:0}}>
            {initials}
          </div>
        </div>
      </header>

      {/* ── BODY ── */}
      <div style={{display:"grid",gridTemplateColumns:"188px 1fr 1fr",flex:1,overflow:"hidden"}}>

        {/* ── SIDEBAR (188px) ── */}
        <aside style={{borderRight:`1px solid ${C.b}`,display:"flex",flexDirection:"column",overflow:"hidden",background:C.bg}}>
          {/* Brand header */}
          <div style={{padding:"12px 11px 8px",borderBottom:`1px solid ${C.b}`,flexShrink:0}}>
            <div style={{display:"flex",alignItems:"center",gap:7,marginBottom:2}}>
              <span style={{fontSize:9,fontWeight:700,letterSpacing:".12em",textTransform:"uppercase",color:C.pur}}>DreamAct</span>
            </div>
            <span style={{fontSize:10,color:C.t3}}>Anime avatares com IA</span>
            <button onClick={()=>{setStage("setup");setImageFile(null);setImagePreview(null);setImageUrl(null);setPrompt("");setDuration(4);}}
              style={{width:"100%",marginTop:10,padding:"8px",background:C.pur,color:"#fff",border:"none",borderRadius:7,fontSize:11,fontWeight:700,cursor:"pointer",fontFamily:"inherit",display:"flex",alignItems:"center",justifyContent:"center",gap:5}}>
              + Nova Geração
            </button>
          </div>

          {/* Nav + How it works */}
          <div style={{flex:1,overflowY:"auto",padding:"8px"}}>
            {/* Sidebar items */}
            {[
              {icon:"🎭",label:"Animador de Avatar",on:true},
              {icon:"📸",label:"Talking Photo",on:false,route:"/dreamface"},
            ].map(item=>(
              <button key={item.label} onClick={()=>item.route&&router.push(item.route)}
                style={{display:"flex",alignItems:"center",gap:8,padding:"7px 9px",borderRadius:7,cursor:"pointer",width:"100%",border:`1px solid ${item.on?C.b2:"transparent"}`,background:item.on?C.bg3:"transparent",color:item.on?C.t:C.t3,marginBottom:1,fontFamily:"inherit",fontSize:12,fontWeight:item.on?500:400,transition:"all .15s"}}>
                <div style={{width:24,height:24,borderRadius:5,background:item.on?C.bg5:C.bg4,display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0,fontSize:12}}>
                  {item.icon}
                </div>
                <span style={{fontSize:12}}>{item.label}</span>
                {!item.on && <span style={{marginLeft:"auto",fontSize:9,padding:"1px 5px",borderRadius:8,background:C.bg4,color:C.t3,fontWeight:700}}>45cr</span>}
              </button>
            ))}

            <div style={{height:1,background:C.b,margin:"6px 8px"}}/>

            {/* How it works */}
            <div style={{padding:"10px 11px",borderRadius:11,border:`1px solid ${C.b}`,background:C.bg3,margin:"4px 0 6px"}}>
              <span style={{fontSize:9,fontWeight:700,letterSpacing:".12em",textTransform:"uppercase",color:C.t4,display:"block",marginBottom:8}}>Como funciona</span>
              {["Upload da foto","Escolha o movimento","Selecione duração","Gere e exporte"].map((s,i)=>{
                const done = i===0?!!imageUrl : i===1?!!prompt.trim() : i===2?true : false;
                return (
                  <div key={i} style={{display:"flex",alignItems:"center",gap:8,marginBottom:i<3?6:0}}>
                    <div style={{width:16,height:16,borderRadius:"50%",flexShrink:0,display:"flex",alignItems:"center",justifyContent:"center",
                      background:done?"rgba(62,207,142,.12)":"transparent",border:`1px solid ${done?C.grn:C.b2}`}}>
                      {done ? <span style={{fontSize:8,color:C.grn}}>✓</span>
                        : <span style={{fontSize:8,color:C.t4,fontWeight:700}}>{i+1}</span>}
                    </div>
                    <span style={{fontSize:10,color:done?C.t2:C.t3}}>{s}</span>
                  </div>
                );
              })}
            </div>

            {/* Cost card */}
            <div style={{padding:"10px 11px",borderRadius:11,border:`1px solid rgba(155,143,248,.16)`,background:C.ps,margin:"4px 0"}}>
              <div style={{fontSize:24,fontWeight:800,letterSpacing:"-.03em",color:C.pur,marginBottom:2}}>{cost("dreamact")}</div>
              <div style={{fontSize:14,color:C.t3}}>créditos por geração</div>
              <div style={{fontSize:10,color:C.t4,marginTop:4}}>Resultado em ~1–3 min</div>
            </div>
          </div>

          {/* Footer */}
          <div style={{borderTop:`1px solid ${C.b}`,padding:"9px 10px",flexShrink:0}}>
            <div style={{display:"flex",alignItems:"center",gap:5,fontSize:10,color:C.t3}}>
              <svg width="11" height="11" viewBox="0 0 12 12" fill="none"><rect x="1" y="5" width="10" height="7" rx="1.5" stroke={C.t3} strokeWidth="1.2"/><path d="M4 5V3.5a2 2 0 014 0V5" stroke={C.t3} strokeWidth="1.2" strokeLinecap="round"/></svg>
              Geração privada · {plan||"starter"}
            </div>
          </div>
        </aside>

        {/* ── CENTER: Stage ── */}
        <div style={{borderRight:`1px solid ${C.b}`,display:"flex",flexDirection:"column",overflow:"hidden",background:C.bg2}}>

          {/* Stage */}
          <div style={{flex:1,position:"relative",overflow:"hidden",display:"flex",alignItems:"center",justifyContent:"center",
            background:"linear-gradient(135deg,rgba(155,143,248,.04) 0%,transparent 60%), #060608"}}>

            {!imagePreview ? (
              /* Empty state */
              <div style={{display:"flex",flexDirection:"column",alignItems:"center",textAlign:"center",padding:32,gap:20,width:"100%"}}>
                <div style={{position:"relative",width:160,height:160}}>
                  {[0,1,2].map(i=>(
                    <div key={i} style={{position:"absolute",inset:-(i*18),borderRadius:"50%",border:`1px solid rgba(155,143,248,${.15-i*.04})`,
                      animation:`da-ring-pulse 3s ease-in-out infinite`,animationDelay:`${i*.9}s`,pointerEvents:"none"}}/>
                  ))}
                  <div
                    className="da-drop-inner"
                    onClick={()=>imageInputRef.current?.click()}
                    onDragOver={e=>e.preventDefault()}
                    onDrop={e=>{e.preventDefault();const f=e.dataTransfer.files[0];if(f&&f.type.startsWith("image/"))handleImageSelect(f);}}
                    style={{position:"absolute",inset:0,borderRadius:"50%",border:"1.5px dashed rgba(155,143,248,.25)",
                      background:"rgba(155,143,248,.04)",display:"flex",flexDirection:"column",
                      alignItems:"center",justifyContent:"center",cursor:"pointer",transition:"all .2s",gap:8}}>
                    <svg width="40" height="40" viewBox="0 0 40 40" fill="none">
                      <rect x="4" y="8" width="32" height="24" rx="3" stroke={C.pur} strokeWidth="1.5" opacity=".6"/>
                      <circle cx="14" cy="18" r="3" stroke={C.pur} strokeWidth="1.5" opacity=".6"/>
                      <path d="M4 28l8-8 6 6 5-5 9 7" stroke={C.pur} strokeWidth="1.5" strokeLinecap="round" opacity=".5"/>
                    </svg>
                    <span style={{fontSize:11,color:C.t3,fontWeight:500}}>Upload foto</span>
                  </div>
                </div>
                <div style={{display:"flex",flexDirection:"column",gap:6}}>
                  {[
                    {color:C.pur, text:"Foto JPG, PNG ou WEBP"},
                    {color:C.grn, text:"Rosto frontal ou ¾"},
                    {color:C.o,   text:"Fundo limpo recomendado"},
                  ].map(item=>(
                    <div key={item.text} style={{display:"flex",alignItems:"center",gap:8,fontSize:11,color:C.t2}}>
                      <div style={{width:5,height:5,borderRadius:"50%",background:item.color,flexShrink:0}}/>
                      {item.text}
                    </div>
                  ))}
                </div>
                <input ref={imageInputRef} type="file" accept="image/*" style={{display:"none"}}
                  onChange={e=>{const f=e.target.files?.[0];if(f)handleImageSelect(f);}}/>
              </div>
            ) : (
              /* Filled state */
              <div style={{display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",flex:1,padding:20,gap:12}}>
                <div style={{position:"relative"}}>
                  {/* Frame */}
                  <div style={{width:200,height:280,borderRadius:18,overflow:"hidden",position:"relative",
                    boxShadow:"0 0 0 1px rgba(255,255,255,.06),0 32px 80px rgba(0,0,0,.8)",background:"#080810"}}>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={imagePreview} alt="avatar" style={{width:"100%",height:"100%",objectFit:"cover"}}/>
                    {uploadingImg && (
                      <div style={{position:"absolute",inset:0,background:"rgba(0,0,0,.7)",display:"flex",alignItems:"center",justifyContent:"center"}}>
                        <div style={{width:24,height:24,borderRadius:"50%",border:`2px solid transparent`,borderTopColor:C.pur,animation:"spin .8s linear infinite"}}/>
                      </div>
                    )}
                    {/* Status badge */}
                    <div style={{position:"absolute",top:10,left:"50%",transform:"translateX(-50%)",
                      fontSize:9,borderRadius:20,padding:"3px 10px",whiteSpace:"nowrap",
                      background:imageUrl?"rgba(62,207,142,.15)":"rgba(155,143,248,.15)",
                      border:`1px solid ${imageUrl?C.grn:C.pur}`,color:imageUrl?C.grn:C.pur}}>
                      {imageUrl ? "✓ Pronto para animar" : "⏳ Enviando..."}
                    </div>
                  </div>
                  {/* Side controls */}
                  <div style={{position:"absolute",right:-44,top:"50%",transform:"translateY(-50%)",display:"flex",flexDirection:"column",gap:6}}>
                    <button onClick={()=>{setImageFile(null);setImagePreview(null);setImageUrl(null);imageInputRef.current?.click();}}
                      title="Trocar foto"
                      style={{width:32,height:32,borderRadius:8,border:`1px solid ${C.b2}`,background:C.bg3,color:C.t2,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",fontSize:14}}>
                      ×
                    </button>
                  </div>
                </div>

                {/* Info row */}
                <div style={{display:"flex",alignItems:"center",gap:10,padding:"6px 12px",borderRadius:8,background:C.bg3,border:`1px solid ${C.b}`}}>
                  <span style={{fontSize:11,color:C.t2,maxWidth:120,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{imageFile?.name||"foto.jpg"}</span>
                  <div style={{width:1,height:12,background:C.b}}/>
                  <span style={{fontSize:11,color:C.t3}}>{duration}s</span>
                  {prompt&&<>
                    <div style={{width:1,height:12,background:C.b}}/>
                    <span style={{fontSize:11,color:C.pur,maxWidth:100,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{MOTION_PRESETS.find(p=>p.prompt===prompt)?.label||"Custom"}</span>
                  </>}
                </div>
                <input ref={imageInputRef} type="file" accept="image/*" style={{display:"none"}}
                  onChange={e=>{const f=e.target.files?.[0];if(f)handleImageSelect(f);}}/>
              </div>
            )}
          </div>

          {/* Center step indicators */}
          <div style={{display:"flex",alignItems:"center",gap:8,padding:"10px 14px",borderTop:`1px solid ${C.b}`,flexShrink:0,background:C.bg}}>
            {["Foto","Movimento","Duração","Gerar"].map((s,i)=>{
              const st = stepState(i);
              return (
                <div key={s} style={{display:"flex",alignItems:"center",gap:6}}>
                  {i>0&&<div style={{width:14,height:1,background:C.b2}}/>}
                  <div style={{display:"flex",alignItems:"center",gap:5}}>
                    <div style={{width:18,height:18,borderRadius:"50%",flexShrink:0,display:"flex",alignItems:"center",justifyContent:"center",fontSize:8,fontWeight:700,
                      background:st===2?"rgba(62,207,142,.12)":st===1?`rgba(155,143,248,.1)`:"transparent",
                      border:`1px solid ${stepColor(st)}`}}>
                      {st===2?"✓":i+1}
                    </div>
                    <span style={{fontSize:10,color:stepColor(st)}}>{s}</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* ── RIGHT: Controls ── */}
        <div style={{display:"flex",flexDirection:"column",overflowY:"auto",background:C.bg}}>

          {/* Movements */}
          <div style={{padding:"12px 14px",borderBottom:`1px solid ${C.b}`}}>
            <span style={{fontSize:9,fontWeight:700,letterSpacing:".12em",textTransform:"uppercase",color:C.t4,display:"block",marginBottom:10}}>Movimentos</span>
            <div style={{display:"flex",flexWrap:"wrap",gap:4,marginBottom:8}}>
              {MOTION_PRESETS.map(p=>(
                <button key={p.label} className="da-mv-pill"
                  onClick={()=>setPrompt(p.prompt)}
                  style={{padding:"6px 13px",borderRadius:20,fontSize:11,cursor:"pointer",fontFamily:"inherit",transition:"all .15s",
                    border:`1px solid ${prompt===p.prompt?C.pur:C.b}`,
                    background:prompt===p.prompt?`rgba(155,143,248,.15)`:"transparent",
                    color:prompt===p.prompt?C.t:C.t3,
                    fontWeight:prompt===p.prompt?500:400}}>
                  {p.label}
                </button>
              ))}
            </div>
            <textarea
              value={prompt}
              onChange={e=>setPrompt(e.target.value.slice(0,200))}
              placeholder="Descreva o movimento (EN ou PT)..."
              rows={3}
              style={{width:"100%",height:72,padding:"9px 11px",background:C.bg3,border:`1px solid ${C.b}`,borderRadius:7,
                color:C.t,fontSize:12,lineHeight:1.6,resize:"none",fontFamily:"inherit",caretColor:C.pur,boxSizing:"border-box"}}
            />
            <p style={{fontSize:10,color:C.t4,marginTop:3}}>💡 Escreva em inglês para melhor resultado</p>
          </div>

          {/* Duration */}
          <div style={{padding:"12px 14px",borderBottom:`1px solid ${C.b}`}}>
            <span style={{fontSize:9,fontWeight:700,letterSpacing:".12em",textTransform:"uppercase",color:C.t4,display:"block",marginBottom:8}}>Duração</span>
            <div style={{display:"grid",gridTemplateColumns:"repeat(5,1fr)",gap:4}}>
              {DURATION_OPTIONS.map(d=>(
                <button key={d} onClick={()=>setDuration(d)}
                  style={{padding:"8px 0",textAlign:"center",borderRadius:7,fontSize:12,fontWeight:500,cursor:"pointer",fontFamily:"inherit",transition:"all .15s",
                    border:`1px solid ${duration===d?C.pur:C.b}`,
                    background:duration===d?C.pur:"transparent",
                    color:duration===d?"#fff":C.t3}}>
                  {d}s
                </button>
              ))}
            </div>
          </div>

          {/* Tips */}
          <div style={{padding:"12px 14px",flex:1}}>
            <span style={{fontSize:9,fontWeight:700,letterSpacing:".12em",textTransform:"uppercase",color:C.t4,display:"block",marginBottom:8}}>Dicas</span>
            {[
              "Rosto frontal ou ¾ funciona melhor",
              "Fundo limpo ou neutro",
              "Boa iluminação no rosto",
              "Sem oclusões (óculos escuros, máscara)",
            ].map((tip,i)=>(
              <div key={i} style={{display:"flex",alignItems:"flex-start",gap:6,marginBottom:5}}>
                <div style={{width:4,height:4,borderRadius:"50%",background:C.pur,marginTop:4,flexShrink:0}}/>
                <span style={{fontSize:10,color:C.t3,lineHeight:1.5}}>{tip}</span>
              </div>
            ))}
          </div>

          {/* Generate footer */}
          <div style={{padding:"12px 14px",borderTop:`1px solid ${C.b}`,flexShrink:0,position:"sticky",bottom:0,background:C.bg}}>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:8}}>
              <span style={{fontSize:11,color:C.t3}}>{cost("dreamact")} créditos por geração</span>
              <span style={{fontSize:10,color:C.t4}}>~1–3 min</span>
            </div>
            <button
              onClick={handleGenerate}
              disabled={!canGenerate}
              style={{width:"100%",padding:"12px",borderRadius:7,border:"none",cursor:canGenerate?"pointer":"not-allowed",fontFamily:"inherit",fontSize:13,fontWeight:700,
                background:canGenerate?C.pur:C.bg4,color:canGenerate?"#fff":C.t3,
                transition:"all .25s",boxShadow:canGenerate?"0 8px 28px rgba(155,143,248,.3)":"none",
                display:"flex",alignItems:"center",justifyContent:"center",gap:7}}>
              {uploadingImg ? (
                <><div style={{width:14,height:14,borderRadius:"50%",border:`2px solid transparent`,borderTopColor:"#fff",animation:"spin .7s linear infinite"}}/> Enviando...</>
              ) : (
                <>✨ Gerar DreamAct</>
              )}
            </button>
          </div>
        </div>

      </div>

      {showCreditModal && (
        <InsufficientCreditsModal action="dreamact" cost={cost("dreamact")} credits={credits} onClose={()=>setShowCreditModal(false)}/>
      )}
      <ToastContainer toasts={toasts} onRemove={removeToast}/>
    </div>
  );
}
