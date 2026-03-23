"use client";

import { useState, useRef, useEffect, useCallback, useMemo } from "react";
import { useRouter } from "next/navigation";
import {
  Plus, Search, HelpCircle, Coins, LogIn,
  FileText, Mic, Sparkles, ChevronDown,
  Lock, X, Zap, Check, Brain, Film,
  Music2, Download, FileCode2, Play, Pause,
  Home, BookOpen, Wand2, CloudUpload, Upload,
  SkipBack, SkipForward, Volume2, RefreshCw,
  ArrowLeft, ChevronUp, GripVertical,
} from "lucide-react";
import { saveAs } from "file-saver";

// ─── Types ────────────────────────────────────────────────────────────────────
interface VideoOption     { url: string; source?: string; vault_category?: string; }
interface BackgroundTrack { url: string; title: string; is_premium_vault: boolean; }
interface Scene {
  segment: string; text_chunk?: string; vault_category?: string;
  sound_effect?: string; broll_search_keywords?: string;
  video_url?: string; video_options?: VideoOption[];
  sfx_url?: string; sfx_options?: string[];
  estimated_duration_seconds?: number;
}
interface GenerateResponse {
  project_vibe: string; music_style: string;
  scenes: Scene[]; background_tracks: BackgroundTrack[];
}
// Each individual clip block on the V1 track (a scene may split into multiple clips)
interface TimelineClip {
  id: string;           // unique — used as React key
  sceneIdx: number;
  url: string | null;   // null = gap placeholder (colored, not black)
  startSec: number;     // global timeline start
  durSec: number;       // how long this block lasts
  label: string;
  color: string;
}

// ─── Static data ──────────────────────────────────────────────────────────────
const NICHES = [
  { group:"Direct Response", options:[
    {value:"dr_nutra_pain",           label:"Dores Articulares"},
    {value:"dr_nutra_weight",         label:"Emagrecimento / Nutra"},
    {value:"dr_nutra_brain",          label:"Memória / Cognição"},
    {value:"dr_blood_sugar",          label:"Glicemia / Diabetes"},
    {value:"dr_bizopp",               label:"Renda Extra / BizOpp"},
    {value:"dr_financas_indenizacoes",label:"Indenizações / Acordos"},
    {value:"dr_financas_renda_extra", label:"Finanças / Investimentos"},
    {value:"dr_survival",             label:"Sobrevivência"},
    {value:"dr_manifestation",        label:"Espiritualidade"},
  ]},
  {group:"Tradicional & Agência", options:[
    {value:"trad_real_estate",label:"Imobiliário"},
    {value:"trad_corporate",  label:"Corporativo / B2B"},
    {value:"trad_fitness",    label:"Fitness / Saúde"},
    {value:"trad_education",  label:"Educação / Infoproduto"},
  ]},
];

const TEMPLATES = [
  { icon:"💊", label:"Copy Nutra",    copy:`Médicos estão proibindo esta informação porque destrói o mercado de remédios para dores articulares. Um composto natural descoberto na Amazônia dissolve o cristal de urato em apenas 21 dias. Sem cirurgia. Sem efeitos colaterais. Assista até o final — este vídeo pode sair do ar.` },
  { icon:"💰", label:"Copy Finanças", copy:`Existe um bug no sistema financeiro brasileiro que faz dinheiro desaparecer da sua conta sem você perceber. 47 bilhões em acordos judiciais esquecidos pelo governo. Seu nome pode estar na lista. Vou te mostrar como verificar em 3 minutos, de graça, pelo celular.` },
  { icon:"🎰", label:"Copy iGaming",  copy:`A maioria dos jogadores perde porque usa a estratégia errada. Depois de analisar 847 rodadas ao vivo, identificamos o único padrão que os cassinos tentam esconder. Nossa IA detecta o momento exato de entrar e sair. Retorno médio dos últimos 30 dias: +247%.` },
];

const ASPECTS   = ["📺 16:9 · VSL","📱 9:16 · Reels","🎬 Cinemático"];
const CLIP_COLS = ["#3b5bdb","#7048e8","#4c6ef5","#9c36b5","#1971c2","#6741d9"];

const GALLERY_TAGS  = ["All","Finanças","Nutra","Renda Extra","VFX","Retenção Agressiva","Cinematic"];
const GALLERY_CARDS = [
  {id:1, tag:"Finanças",           title:"Estrutura VSL Finanças",     src:"https://images.pexels.com/photos/4386442/pexels-photo-4386442.jpeg?auto=compress&w=400", tall:true },
  {id:2, tag:"Nutra",              title:"Gancho Rápido Nutra",         src:"https://images.pexels.com/photos/3683074/pexels-photo-3683074.jpeg?auto=compress&w=400", tall:false},
  {id:3, tag:"Cinematic",          title:"Abertura Cinematográfica",    src:"https://images.pexels.com/photos/1166209/pexels-photo-1166209.jpeg?auto=compress&w=400", tall:false},
  {id:4, tag:"Renda Extra",        title:"Hook Renda Extra 3s",         src:"https://images.pexels.com/photos/3729464/pexels-photo-3729464.jpeg?auto=compress&w=400", tall:true },
  {id:5, tag:"Retenção Agressiva", title:"Pattern Interrupt Agressivo", src:"https://images.pexels.com/photos/3184291/pexels-photo-3184291.jpeg?auto=compress&w=400", tall:false},
  {id:6, tag:"VFX",                title:"Transição VFX Zoom",          src:"https://images.pexels.com/photos/2263436/pexels-photo-2263436.jpeg?auto=compress&w=400", tall:true },
  {id:7, tag:"Finanças",           title:"Credibilidade & Selos",       src:"https://images.pexels.com/photos/259200/pexels-photo-259200.jpeg?auto=compress&w=400",   tall:false},
  {id:8, tag:"Nutra",              title:"Antes & Depois Saúde",        src:"https://images.pexels.com/photos/4386466/pexels-photo-4386466.jpeg?auto=compress&w=400", tall:false},
  {id:9, tag:"Cinematic",          title:"Drone Lifestyle Premium",     src:"https://images.pexels.com/photos/323780/pexels-photo-323780.jpeg?auto=compress&w=400",   tall:true },
  {id:10,tag:"Renda Extra",        title:"Depoimento Prova Social",     src:"https://images.pexels.com/photos/3771807/pexels-photo-3771807.jpeg?auto=compress&w=400", tall:false},
  {id:11,tag:"Retenção Agressiva", title:"Choque Emocional Opening",    src:"https://images.pexels.com/photos/3762800/pexels-photo-3762800.jpeg?auto=compress&w=400", tall:false},
  {id:12,tag:"VFX",                title:"Glitch Title Screen",         src:"https://images.pexels.com/photos/2510428/pexels-photo-2510428.jpeg?auto=compress&w=400", tall:true },
];

const LOADING_MSGS = [
  "Analisando psicologia da copy…","Detectando gatilhos de retenção…",
  "Cortando silêncios automaticamente…","Adicionando SFX de impacto…",
  "Mapeando Power Words…","Sincronizando B-rolls com a fala…",
  "Calibrando trilha para tensão máxima…","Finalizando mapa de edição premium…",
];

const POWER_WORDS = new Set([
  "segredo","proibido","nunca","grátis","agora","urgente","exclusivo","revelado",
  "bug","verdade","descoberto","destroi","dissolve","esquecido","padrão","esconder",
  "detecta","estratégia","bloqueado","bilhões","médicos","composto","amazônia",
]);

// ─── Helpers ──────────────────────────────────────────────────────────────────
function fmtTime(s: number) {
  const m = Math.floor(s / 60), sec = Math.floor(s % 60);
  return `${String(m).padStart(2,"0")}:${String(sec).padStart(2,"0")}`;
}

// ─── Zero Black Screen algorithm ─────────────────────────────────────────────
// Divides every scene into one or more TimelineClips so the V1 track is always
// 100% filled. If a scene has N video_options we tile them evenly across the
// scene's duration. Scenes with no video get a colored placeholder (not black).
function buildTimelineClips(scenes: Scene[]): TimelineClip[] {
  const clips: TimelineClip[] = [];
  let cursor = 0;
  for (let i = 0; i < scenes.length; i++) {
    const sc     = scenes[i];
    const dur    = sc.estimated_duration_seconds ?? 5;
    const col    = CLIP_COLS[i % CLIP_COLS.length];
    // Collect unique video URLs for this scene
    const urls: string[] = [];
    const add = (u?: string | null) => { if (u && !urls.includes(u)) urls.push(u); };
    add(sc.video_url);
    (sc.video_options ?? []).forEach(o => add(o.url));

    if (urls.length === 0) {
      // Placeholder — colored gradient, never solid black
      clips.push({ id:`sc${i}-0`, sceneIdx:i, url:null, startSec:cursor, durSec:dur, label:sc.segment, color:col });
    } else {
      // Distribute all available clips evenly across scene duration
      const segDur = dur / urls.length;
      urls.forEach((url, j) =>
        clips.push({ id:`sc${i}-${j}`, sceneIdx:i, url, startSec:cursor + j*segDur, durSec:segDur,
          label: urls.length > 1 ? `${sc.segment} · ${j+1}/${urls.length}` : sc.segment, color:col })
      );
    }
    cursor += dur;
  }
  return clips;
}

function generateSRT(scenes: Scene[]): string {
  let srt = ""; let idx = 1; let elapsed = 0;
  for (const sc of scenes) {
    const dur = sc.estimated_duration_seconds ?? 5;
    const start = fmtTime(elapsed).replace(":",",") + ",000";
    const end   = fmtTime(elapsed + dur).replace(":",",") + ",000";
    const words = (sc.text_chunk ?? sc.segment ?? "").trim();
    if (words) { srt += `${idx}\n00:${start} --> 00:${end}\n${words}\n\n`; idx++; }
    elapsed += dur;
  }
  return srt;
}

// ─── UploadModal ──────────────────────────────────────────────────────────────
function UploadModal({ onClose }: { onClose: () => void }) {
  const [dragging, setDragging] = useState(false);
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-6"
      style={{background:"rgba(0,0,0,0.85)",backdropFilter:"blur(12px)"}}
      onClick={onClose}>
      <div className="relative w-full max-w-lg rounded-2xl overflow-hidden"
        style={{background:"#111",border:"1px solid rgba(255,255,255,0.08)",boxShadow:"0 40px 100px rgba(0,0,0,0.7)"}}
        onClick={e=>e.stopPropagation()}>
        <div className="flex items-center justify-between px-6 py-5 border-b" style={{borderColor:"rgba(255,255,255,0.07)"}}>
          <div>
            <h2 className="text-base font-black text-white" style={{letterSpacing:"-0.02em"}}>Faça upload dos seus ativos</h2>
            <p className="text-xs text-gray-600 mt-0.5">Locução, takes brutos de vídeo ou trilha</p>
          </div>
          <button onClick={onClose} className="p-2 rounded-xl text-gray-600 hover:text-gray-300 hover:bg-white/6 transition-colors"><X className="w-4 h-4"/></button>
        </div>
        <div className="p-6">
          <div onDragOver={e=>{e.preventDefault();setDragging(true);}} onDragLeave={()=>setDragging(false)} onDrop={e=>{e.preventDefault();setDragging(false);}}
            className="flex flex-col items-center justify-center py-14 rounded-2xl border-2 border-dashed transition-all cursor-pointer"
            style={{borderColor:dragging?"rgba(59,130,246,0.7)":"rgba(255,255,255,0.12)",background:dragging?"rgba(37,99,235,0.06)":"rgba(255,255,255,0.02)"}}>
            <div className="w-16 h-16 rounded-2xl flex items-center justify-center mb-4 transition-all"
              style={{background:dragging?"rgba(37,99,235,0.2)":"rgba(255,255,255,0.05)",border:dragging?"1px solid rgba(59,130,246,0.4)":"1px solid rgba(255,255,255,0.08)",boxShadow:dragging?"0 0 30px rgba(37,99,235,0.3)":"none"}}>
              <CloudUpload className={`w-8 h-8 transition-colors ${dragging?"text-blue-400":"text-gray-600"}`}/>
            </div>
            <p className="text-sm font-semibold text-gray-300 mb-1">Arraste seus arquivos aqui</p>
            <p className="text-xs text-gray-600 text-center max-w-xs leading-relaxed">Suporta <span className="text-gray-500">.mp3 .wav</span> e takes de vídeo <span className="text-gray-500">.mp4 .mov</span></p>
          </div>
          <div className="flex items-center gap-3 my-4">
            <div className="flex-1 h-px" style={{background:"rgba(255,255,255,0.06)"}}/>
            <span className="text-[10px] text-gray-700 uppercase tracking-widest">ou</span>
            <div className="flex-1 h-px" style={{background:"rgba(255,255,255,0.06)"}}/>
          </div>
          <button className="w-full flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-semibold text-gray-300 border transition-all hover:bg-white/6" style={{borderColor:"rgba(255,255,255,0.1)"}}>
            <Upload className="w-4 h-4"/>Procurar arquivos
          </button>
        </div>
        <div className="px-6 pb-5 flex items-center gap-2 flex-wrap">
          {[".mp3",".wav",".mp4",".mov",".mkv"].map(f=>(
            <span key={f} className="text-[9px] font-bold px-2 py-0.5 rounded text-gray-600" style={{background:"rgba(255,255,255,0.04)",border:"1px solid rgba(255,255,255,0.07)"}}>{f}</span>
          ))}
        </div>
      </div>
    </div>
  );
}

// ─── GeneratingView ───────────────────────────────────────────────────────────
function GeneratingView() {
  const [msgIdx, setMsgIdx] = useState(0);
  const [fade,   setFade]   = useState(true);
  useEffect(()=>{
    const iv = setInterval(()=>{
      setFade(false);
      setTimeout(()=>{ setMsgIdx(i=>(i+1)%LOADING_MSGS.length); setFade(true); },250);
    },1100);
    return ()=>clearInterval(iv);
  },[]);
  return (
    <div className="flex-1 flex flex-col items-center justify-center gap-8 px-8">
      <div className="relative w-24 h-24 flex items-center justify-center">
        <div className="absolute inset-0 rounded-full animate-ping opacity-20" style={{background:"radial-gradient(circle,rgba(99,102,241,0.6),transparent)",animationDuration:"1.4s"}}/>
        <div className="absolute inset-2 rounded-full animate-spin" style={{border:"2px solid transparent",borderTopColor:"rgba(99,102,241,0.8)",borderRightColor:"rgba(99,102,241,0.3)",animationDuration:"1s"}}/>
        <div className="absolute inset-5 rounded-full animate-spin" style={{border:"2px solid transparent",borderBottomColor:"rgba(139,92,246,0.9)",borderLeftColor:"rgba(139,92,246,0.3)",animationDuration:"1.8s",animationDirection:"reverse"}}/>
        <Brain className="w-8 h-8 text-indigo-400" style={{filter:"drop-shadow(0 0 8px rgba(99,102,241,0.8))"}}/>
      </div>
      <div className="text-center space-y-2">
        <p className={`text-base font-semibold text-white transition-all duration-300 ${fade?"opacity-100 translate-y-0":"opacity-0 translate-y-1"}`} style={{letterSpacing:"-0.01em"}}>{LOADING_MSGS[msgIdx]}</p>
        <p className="text-xs text-gray-600">GPT-4o · Pexels HD · Freesound · Cofre Kraft</p>
      </div>
      <div className="w-48 h-0.5 rounded-full overflow-hidden" style={{background:"rgba(255,255,255,0.06)"}}>
        <div className="h-full rounded-full animate-pulse" style={{background:"linear-gradient(90deg,#4f46e5,#7c3aed,#4f46e5)",width:"70%"}}/>
      </div>
    </div>
  );
}

// ─── GalleryView ──────────────────────────────────────────────────────────────
function GalleryView({ activeTag, setActiveTag }: { activeTag:string; setActiveTag:(t:string)=>void }) {
  const cards = activeTag==="All" ? GALLERY_CARDS : GALLERY_CARDS.filter(c=>c.tag===activeTag);
  return (
    <>
      <div className="flex items-center gap-1 px-5 py-3.5 border-b shrink-0 overflow-x-auto" style={{borderColor:"rgba(255,255,255,0.05)"}}>
        {GALLERY_TAGS.map(tag=>(
          <button key={tag} onClick={()=>setActiveTag(tag)}
            className={`shrink-0 px-3.5 py-1.5 rounded-full text-xs font-semibold transition-all ${activeTag===tag?"text-white bg-white/10 border border-white/15":"text-gray-600 hover:text-gray-300 border border-transparent"}`}>{tag}</button>
        ))}
      </div>
      <div className="flex-1 overflow-y-auto px-4 py-4">
        <div style={{columnCount:3,columnGap:"10px"}}>
          {cards.map(card=>(
            <div key={card.id} className="break-inside-avoid mb-2.5 group relative rounded-xl overflow-hidden cursor-pointer" style={{border:"1px solid rgba(255,255,255,0.06)"}}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={card.src} alt={card.title} className="w-full object-cover opacity-65 group-hover:opacity-90 transition-all duration-300" style={{aspectRatio:card.tall?"9/13":"4/3",display:"block"}}/>
              <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/10 to-transparent"/>
              <div className="absolute bottom-0 left-0 right-0 p-2.5">
                <p className="text-[8px] font-bold text-gray-600 uppercase tracking-widest mb-0.5">{card.tag}</p>
                <p className="text-[11px] font-semibold text-white leading-snug">{card.title}</p>
              </div>
              <div className="absolute top-2 right-2 w-7 h-7 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity" style={{background:"rgba(255,255,255,0.15)",backdropFilter:"blur(6px)"}}>
                <Play className="w-3 h-3 text-white ml-0.5" fill="white"/>
              </div>
            </div>
          ))}
        </div>
      </div>
    </>
  );
}

// ─── PaywallModal ─────────────────────────────────────────────────────────────
function PaywallModal({ onClose }: { onClose: () => void }) {
  const router = useRouter();
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{background:"rgba(0,0,0,0.85)",backdropFilter:"blur(14px)"}} onClick={onClose}>
      <div className="relative w-full max-w-sm rounded-2xl p-7 text-center" style={{background:"#0f0f14",border:"1px solid rgba(79,70,229,0.35)",boxShadow:"0 0 80px rgba(79,70,229,0.2)"}} onClick={e=>e.stopPropagation()}>
        <button onClick={onClose} className="absolute top-4 right-4 p-1.5 rounded-lg text-gray-600 hover:text-gray-300 hover:bg-white/5 transition-colors"><X className="w-4 h-4"/></button>
        <div className="absolute inset-0 rounded-2xl pointer-events-none" style={{background:"radial-gradient(ellipse at 50% 0%,rgba(79,70,229,0.2) 0%,transparent 65%)"}}/>
        <div className="relative z-10">
          <div className="w-14 h-14 rounded-2xl flex items-center justify-center mx-auto mb-4" style={{background:"rgba(79,70,229,0.15)",border:"1px solid rgba(79,70,229,0.3)"}}>
            <Lock className="w-6 h-6 text-indigo-400"/>
          </div>
          <p className="text-[10px] text-indigo-400 font-bold uppercase tracking-[0.2em] mb-2">Recurso PRO</p>
          <h3 className="text-lg font-black text-white mb-2" style={{letterSpacing:"-0.02em"}}>Desbloqueie o poder total</h3>
          <p className="text-xs text-gray-500 leading-relaxed mb-5">Exporte e baixe suas mídias com qualidade máxima, sem marca d'água.</p>
          <ul className="space-y-2 mb-6 text-left">
            {["Exportar XML para Premiere","Download de mídias HD","Acervo Kraft Premium","Projetos ilimitados"].map(f=>(
              <li key={f} className="flex items-center gap-2.5 text-xs text-gray-400"><Check className="w-3.5 h-3.5 text-indigo-400 shrink-0"/>{f}</li>
            ))}
          </ul>
          <button onClick={()=>router.push("/pricing")} className="w-full py-3 rounded-xl text-sm font-black text-white flex items-center justify-center gap-2" style={{background:"linear-gradient(135deg,#4f46e5,#7c3aed)",boxShadow:"0 8px 28px rgba(79,70,229,0.45)"}}>
            <Zap className="w-4 h-4 text-yellow-300"/>⚡ Desbloquear Recursos PRO
          </button>
          <p className="text-[10px] text-gray-700 mt-2.5">Cancele quando quiser · Sem fidelidade</p>
        </div>
      </div>
    </div>
  );
}


// ─── WorkstationView ──────────────────────────────────────────────────────────
function WorkstationView({ result, copy: initialCopy, onBack }: {
  result: GenerateResponse;
  copy: string;
  onBack: () => void;
}) {
  // ── Refs ──
  const videoRef    = useRef<HTMLVideoElement>(null);
  const timelineRef = useRef<HTMLDivElement>(null);
  const musicRefs   = [useRef<HTMLAudioElement>(null), useRef<HTMLAudioElement>(null), useRef<HTMLAudioElement>(null)];
  const rafRef        = useRef<number>(0);
  const globalTimeRef = useRef(0);
  const lastTsRef     = useRef(0);
  const playingRef    = useRef(false);
  const seekOnLoadRef = useRef<number | null>(null);
  const prevClipId    = useRef("");

  // ── State ──
  const [localScenes,    setLocalScenes]    = useState<Scene[]>(()=>result.scenes??[]);
  const [loadingClipIds, setLoadingClipIds] = useState<Set<string>>(new Set());
  const [playing,        setPlaying]        = useState(false);
  const [currentTime,    setCurrentTime]    = useState(0);
  const [playheadPct,    setPlayheadPct]    = useState(0);
  const [isDragging,     setIsDragging]     = useState(false);
  const [selectedMusic,  setSelectedMusic]  = useState(0);
  const [playingMusic,   setPlayingMusic]   = useState<number|null>(null);
  const [exportOpen,     setExportOpen]     = useState(false);
  const [paywallOpen,    setPaywallOpen]    = useState(false);
  const [editCopy,       setEditCopy]       = useState(initialCopy);
  const [dragSrcUrl,     setDragSrcUrl]     = useState<string|null>(null);
  const [dragOverClipId, setDragOverClipId] = useState<string|null>(null);

  const tracks   = result.background_tracks ?? [];
  const totalDur = useMemo(()=>
    Math.max(localScenes.reduce((s,sc)=>s+(sc.estimated_duration_seconds??5),0),1),
    [localScenes]
  );

  // ── Zero Black Screen: timeline clips ──
  const timelineClips = useMemo(()=>buildTimelineClips(localScenes),[localScenes]);

  // Clip currently under the playhead
  const currentClip = useMemo(()=>
    timelineClips.find(c=>currentTime>=c.startSec&&currentTime<c.startSec+c.durSec)
    ??timelineClips[timelineClips.length-1]??null,
    [timelineClips,currentTime]
  );

  const activeScene = currentClip?.sceneIdx??0;
  const videoUrl    = currentClip?.url??"";

  // Cumulative scene starts for left-panel navigation
  const sceneStarts = useMemo(()=>{
    const s:number[]=[];let a=0;
    for(const sc of localScenes){s.push(a);a+=sc.estimated_duration_seconds??5;}
    return s;
  },[localScenes]);

  // ── RAF Tick — drives playhead in real time ──────────────────────────────
  const tickRef = useRef<(ts:number)=>void>(()=>{});
  useEffect(()=>{
    tickRef.current=(ts:number)=>{
      if(!playingRef.current) return;
      if(lastTsRef.current===0) lastTsRef.current=ts;
      const delta=Math.min((ts-lastTsRef.current)/1000,0.1);
      lastTsRef.current=ts;
      const newT=Math.min(globalTimeRef.current+delta,totalDur);
      globalTimeRef.current=newT;
      setCurrentTime(newT);
      setPlayheadPct((newT/totalDur)*100);
      if(newT>=totalDur){setPlaying(false);return;}
      rafRef.current=requestAnimationFrame(tickRef.current);
    };
  },[totalDur]);

  useEffect(()=>{playingRef.current=playing;},[playing]);

  useEffect(()=>{
    if(playing){lastTsRef.current=0;rafRef.current=requestAnimationFrame(tickRef.current);}
    else{cancelAnimationFrame(rafRef.current);lastTsRef.current=0;}
    return()=>cancelAnimationFrame(rafRef.current);
  },[playing]);

  // ── Auto-play video when clip changes ────────────────────────────────────
  useEffect(()=>{
    if(!currentClip||currentClip.id===prevClipId.current) return;
    prevClipId.current=currentClip.id;
    const local=globalTimeRef.current-currentClip.startSec;
    seekOnLoadRef.current=local>0.3?local:null;
    if(playingRef.current&&videoRef.current&&currentClip.url)
      videoRef.current.play().catch(()=>null);
  },[currentClip]);

  const handleLoadedMetadata=useCallback(()=>{
    if(seekOnLoadRef.current!==null&&videoRef.current){
      videoRef.current.currentTime=seekOnLoadRef.current;
      seekOnLoadRef.current=null;
    }
    if(playingRef.current&&videoRef.current)
      videoRef.current.play().catch(()=>null);
  },[]);

  // ── Play / Pause ─────────────────────────────────────────────────────────
  const togglePlay=useCallback(()=>{
    if(playing){setPlaying(false);videoRef.current?.pause();}
    else{
      if(globalTimeRef.current>=totalDur){globalTimeRef.current=0;setCurrentTime(0);setPlayheadPct(0);}
      setPlaying(true);
      videoRef.current?.play().catch(()=>null);
    }
  },[playing,totalDur]);

  // ── Seek to global time ──────────────────────────────────────────────────
  const seekToTime=useCallback((globalSec:number)=>{
    const clamped=Math.max(0,Math.min(totalDur,globalSec));
    globalTimeRef.current=clamped;
    setCurrentTime(clamped);
    setPlayheadPct((clamped/totalDur)*100);
    const clip=timelineClips.find(c=>clamped>=c.startSec&&clamped<c.startSec+c.durSec);
    if(clip&&videoRef.current){
      const local=clamped-clip.startSec;
      if(clip.id===prevClipId.current){videoRef.current.currentTime=Math.max(0,local);}
      else{seekOnLoadRef.current=local>0.3?local:null;}
    }
  },[totalDur,timelineClips]);

  // ── Timeline drag ────────────────────────────────────────────────────────
  const handleTimelineMouseDown=(e:React.MouseEvent<HTMLDivElement>)=>{
    if(!timelineRef.current) return;
    setIsDragging(true);
    const r=timelineRef.current.getBoundingClientRect();
    seekToTime(((e.clientX-r.left)/r.width)*totalDur);
  };
  useEffect(()=>{
    if(!isDragging) return;
    const mv=(e:MouseEvent)=>{
      if(!timelineRef.current) return;
      const r=timelineRef.current.getBoundingClientRect();
      seekToTime(Math.max(0,Math.min(1,(e.clientX-r.left)/r.width))*totalDur);
    };
    const up=()=>setIsDragging(false);
    window.addEventListener("mousemove",mv);window.addEventListener("mouseup",up);
    return()=>{window.removeEventListener("mousemove",mv);window.removeEventListener("mouseup",up);};
  },[isDragging,seekToTime]);

  // ── Suggest Another ──────────────────────────────────────────────────────
  const suggestAnother=useCallback(async(clipId:string)=>{
    const clip=timelineClips.find(c=>c.id===clipId);
    if(!clip) return;
    const sc=localScenes[clip.sceneIdx];
    const opts=sc.video_options??[];
    setLoadingClipIds(prev=>new Set(prev).add(clipId));
    try{
      if(opts.length>1){
        const cur=opts.findIndex(o=>o.url===clip.url);
        const next=opts[(cur+1)%opts.length];
        await new Promise(r=>setTimeout(r,500));
        setLocalScenes(prev=>{
          const u=[...prev];
          u[clip.sceneIdx]={...u[clip.sceneIdx],video_url:next.url,
            video_options:[next,...opts.filter(o=>o.url!==next.url)]};
          return u;
        });
      } else {
        const q=sc.broll_search_keywords??sc.vault_category??sc.segment??"cinematic";
        const page=Math.floor(Math.random()*5)+1;
        const res=await fetch(`/api/suggest-media?q=${encodeURIComponent(q)}&page=${page}`);
        if(res.ok){
          const data=await res.json();
          const newVids:VideoOption[]=(data.videos??[]).map((v:{url:string})=>({url:v.url}));
          if(newVids.length>0)
            setLocalScenes(prev=>{
              const u=[...prev];
              u[clip.sceneIdx]={...u[clip.sceneIdx],video_url:newVids[0].url,video_options:newVids};
              return u;
            });
        }
      }
    } finally{
      setLoadingClipIds(prev=>{const s=new Set(prev);s.delete(clipId);return s;});
    }
  },[timelineClips,localScenes]);

  // ── Drag & Drop from sidebar → V1 block ─────────────────────────────────
  const handleDropOnClip=useCallback((clipId:string,url:string)=>{
    const clip=timelineClips.find(c=>c.id===clipId);
    if(!clip) return;
    setLocalScenes(prev=>{
      const u=[...prev];
      const sc=u[clip.sceneIdx];
      u[clip.sceneIdx]={...sc,video_url:url,
        video_options:[{url},...(sc.video_options??[]).filter(o=>o.url!==url)]};
      return u;
    });
    setDragSrcUrl(null);setDragOverClipId(null);
  },[timelineClips]);

  // ── Current subtitle text ────────────────────────────────────────────────
  const currentSubtitle=useMemo(()=>{
    const sc=localScenes[activeScene];
    return sc?.text_chunk??sc?.segment??"";
  },[localScenes,activeScene]);

  // ── Sidebar alternatives ─────────────────────────────────────────────────
  const alternatives=useMemo(()=>{
    const sc=localScenes[activeScene];
    if(!sc) return [];
    const cur=sc.video_url??sc.video_options?.[0]?.url;
    return (sc.video_options??[]).filter(o=>o.url!==cur);
  },[localScenes,activeScene]);

  // ── Music ────────────────────────────────────────────────────────────────
  const toggleMusic=(idx:number)=>{
    if(playingMusic===idx){musicRefs[idx]?.current?.pause();setPlayingMusic(null);}
    else{musicRefs.forEach((r,i)=>{if(i!==idx)r.current?.pause();});musicRefs[idx]?.current?.play().catch(()=>null);setPlayingMusic(idx);}
  };
  const downloadSRT=()=>saveAs(new Blob([generateSRT(localScenes)],{type:"text/plain;charset=utf-8"}),"suarik-legendas.srt");
  const downloadMusic=()=>{const t=tracks[selectedMusic];if(t?.url)window.open(t.url,"_blank");};
  const musicOptions:BackgroundTrack[]=[
    ...tracks.slice(0,3),
    ...Array.from({length:Math.max(0,3-tracks.length)},(_,i)=>({
      title:["Dark Tension Loop","Cinematic Suspense","Epic Orchestral"][i]??"Trilha",
      url:"",is_premium_vault:false,
    })),
  ];

  // ── Render ───────────────────────────────────────────────────────────────
  return (
    <>
    <style>{`
      @keyframes wsIn{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:translateY(0)}}
      .ws-in{animation:wsIn .35s ease both}
      .v1clip:hover .v1clip-overlay{opacity:1!important}
      .v1clip-overlay{opacity:0;transition:opacity .15s ease}
    `}</style>
    <div className="flex h-screen overflow-hidden ws-in"
      style={{background:"#090909",color:"#e5e5e5",fontFamily:"var(--font-geist-sans,Inter,sans-serif)"}}>

      {/* ══ COL 1: Roteiro (24%) ══════════════════════════════════════════ */}
      <div className="w-[24%] shrink-0 flex flex-col border-r overflow-hidden"
        style={{background:"#0a0a0a",borderColor:"rgba(255,255,255,0.05)"}}>
        <div className="flex items-center gap-3 px-4 py-3.5 border-b shrink-0" style={{borderColor:"rgba(255,255,255,0.05)"}}>
          <button onClick={onBack} className="p-1.5 rounded-lg text-gray-600 hover:text-gray-200 hover:bg-white/6 transition-colors"><ArrowLeft className="w-4 h-4"/></button>
          <div>
            <p className="text-[11px] font-black text-white uppercase tracking-widest">Roteiro</p>
            <p className="text-[10px] text-gray-700 mt-0.5">{localScenes.length} cenas · {Math.round(totalDur)}s</p>
          </div>
        </div>
        <textarea value={editCopy} onChange={e=>setEditCopy(e.target.value)}
          className="flex-1 w-full bg-transparent text-[13px] text-gray-400 leading-relaxed px-4 py-4 resize-none focus:outline-none placeholder-gray-700"
          placeholder="Cole ou edite o roteiro aqui…" style={{fontFamily:"inherit"}}/>
        <div className="border-t" style={{borderColor:"rgba(255,255,255,0.05)"}}>
          <p className="text-[9px] uppercase tracking-[0.18em] text-gray-700 font-bold px-4 pt-3 pb-2">Cenas</p>
          <div className="overflow-y-auto max-h-[200px] px-2 pb-3 space-y-0.5">
            {localScenes.map((sc,i)=>(
              <button key={i} onClick={()=>seekToTime(sceneStarts[i]+0.01)}
                className={`w-full flex items-start gap-2 px-3 py-2.5 rounded-xl text-left transition-all ${activeScene===i?"bg-cyan-500/10 border border-cyan-500/25":"hover:bg-white/4 border border-transparent"}`}>
                <span className="text-[9px] font-black mt-0.5 shrink-0" style={{color:activeScene===i?"#22d3ee":CLIP_COLS[i%CLIP_COLS.length]}}>{String(i+1).padStart(2,"0")}</span>
                <div className="min-w-0">
                  <p className={`text-[11px] font-semibold truncate ${activeScene===i?"text-cyan-300":"text-gray-400"}`}>{sc.segment}</p>
                  <p className="text-[9px] text-gray-700 mt-0.5 line-clamp-1">{sc.text_chunk?.slice(0,55)??""}…</p>
                </div>
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* ══ COL 2: Player + Timeline (flex-1) ════════════════════════════ */}
      <div className="flex-1 flex flex-col overflow-hidden min-w-0">

        {/* Top bar */}
        <div className="flex items-center justify-between px-4 py-2.5 border-b shrink-0" style={{borderColor:"rgba(255,255,255,0.05)"}}>
          <div className="flex items-center gap-2">
            <div className={`w-1.5 h-1.5 rounded-full transition-colors ${playing?"bg-cyan-400 animate-pulse":"bg-gray-700"}`}/>
            <span className="text-[10px] font-bold text-gray-600 uppercase tracking-widest">Editor</span>
            {currentClip&&<span className="text-[9px] text-gray-700 border border-white/8 px-1.5 py-0.5 rounded truncate max-w-[130px]">{currentClip.label}</span>}
          </div>
          <span className="font-mono text-sm text-cyan-400 font-bold tabular-nums">{fmtTime(currentTime)} / {fmtTime(totalDur)}</span>
        </div>

        {/* ── Video Player ── */}
        <div className="shrink-0 px-3 pt-3 pb-2">
          <div className="relative w-full rounded-xl overflow-hidden cursor-pointer group"
            style={{aspectRatio:"16/7.2",background:"#000",border:"1px solid rgba(255,255,255,0.07)",boxShadow:"0 0 40px rgba(0,200,255,0.05)"}}
            onClick={togglePlay}>

            {videoUrl?(
              <video ref={videoRef} key={currentClip?.id} src={videoUrl}
                loop playsInline onLoadedMetadata={handleLoadedMetadata}
                className="w-full h-full object-cover"/>
            ):(
              <div className="w-full h-full flex flex-col items-center justify-center gap-3"
                style={{background:`linear-gradient(135deg,${currentClip?.color??"#111"}18,#040408)`}}>
                <div className="w-12 h-12 rounded-2xl flex items-center justify-center"
                  style={{background:`${currentClip?.color??"#333"}22`,border:`1px solid ${currentClip?.color??"#333"}44`}}>
                  <Film className="w-5 h-5" style={{color:currentClip?.color??"#555"}}/>
                </div>
                <p className="text-[10px] text-gray-700 font-medium">Sem mídia — passe o mouse no bloco e clique em 🔄</p>
              </div>
            )}

            {/* Subtitle overlay — always visible */}
            {currentSubtitle&&(
              <div className="absolute bottom-10 left-0 right-0 flex justify-center px-6 pointer-events-none">
                <div className="text-center px-3 py-1.5 rounded-lg max-w-lg" style={{background:"rgba(0,0,0,0.78)",backdropFilter:"blur(4px)"}}>
                  <p className="text-sm font-bold leading-snug">
                    {currentSubtitle.split(" ").slice(0,10).map((w,i)=>{
                      const isPW=POWER_WORDS.has(w.toLowerCase().replace(/[^a-záéíóúãõç]/g,""));
                      return <span key={i} className={`mr-1 ${isPW?"text-yellow-400":"text-white"}`}>{w}</span>;
                    })}
                  </p>
                </div>
              </div>
            )}

            {/* Play overlay */}
            <div className={`absolute inset-0 flex items-center justify-center transition-opacity ${playing?"opacity-0 group-hover:opacity-100":"opacity-100"}`}>
              <div className="w-14 h-14 rounded-full flex items-center justify-center transition-transform group-hover:scale-110"
                style={{background:"rgba(0,210,255,0.12)",border:"1px solid rgba(0,210,255,0.35)",backdropFilter:"blur(4px)",boxShadow:"0 0 24px rgba(0,200,255,0.25)"}}>
                {playing?<Pause className="w-5 h-5 text-cyan-300" fill="currentColor"/>:<Play className="w-5 h-5 text-cyan-300 ml-0.5" fill="currentColor"/>}
              </div>
            </div>

            {/* Transport HUD */}
            <div className="absolute bottom-0 left-0 right-0 px-4 py-2 flex items-center gap-3"
              style={{background:"linear-gradient(to top,rgba(0,0,0,0.9),transparent)"}}>
              <button onClick={e=>{e.stopPropagation();seekToTime(sceneStarts[Math.max(0,activeScene-1)]);}}><SkipBack className="w-4 h-4 text-white/50 hover:text-white"/></button>
              <button onClick={e=>{e.stopPropagation();togglePlay();}}>
                {playing?<Pause className="w-4 h-4 text-white" fill="currentColor"/>:<Play className="w-4 h-4 text-white" fill="currentColor"/>}
              </button>
              <button onClick={e=>{e.stopPropagation();seekToTime(sceneStarts[Math.min(localScenes.length-1,activeScene+1)]);}}><SkipForward className="w-4 h-4 text-white/50 hover:text-white"/></button>
              <div className="flex items-center gap-1.5 ml-auto" onClick={e=>e.stopPropagation()}>
                <Volume2 className="w-3.5 h-3.5 text-white/40"/>
                <input type="range" min="0" max="1" step="0.05" defaultValue="0.8"
                  onChange={e=>{if(videoRef.current)videoRef.current.volume=+e.target.value;}}
                  className="w-16 h-0.5 cursor-pointer accent-cyan-500"/>
              </div>
            </div>
          </div>
        </div>

        {/* ── Timeline ── */}
        <div className="flex-1 min-h-0 flex flex-col px-3 pb-3 gap-2">
          <div className="flex-1 min-h-0 rounded-xl overflow-hidden flex flex-col"
            style={{background:"#07070f",border:"1px solid rgba(255,255,255,0.06)"}}>

            <div ref={timelineRef}
              className="relative flex-1 overflow-hidden select-none"
              style={{cursor:isDragging?"col-resize":"crosshair"}}
              onMouseDown={handleTimelineMouseDown}>

              {/* Ruler */}
              <div className="flex h-5 border-b sticky top-0 z-10" style={{background:"#07070f",borderColor:"rgba(255,255,255,0.05)"}}>
                <div className="w-10 shrink-0 border-r" style={{borderColor:"rgba(255,255,255,0.05)"}}/>
                <div className="flex-1 relative">
                  {Array.from({length:Math.ceil(totalDur/5)+1}).map((_,i)=>(
                    <div key={i} className="absolute flex flex-col items-center" style={{left:`${(i*5/totalDur)*100}%`}}>
                      <div className="w-px h-2 mt-0.5" style={{background:"rgba(255,255,255,0.1)"}}/>
                      <span className="text-[7px] font-mono text-gray-700">{fmtTime(i*5)}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* ── V1: Video (absolutely positioned sub-clips) ── */}
              <div className="flex border-b" style={{borderColor:"rgba(255,255,255,0.04)"}}>
                <div className="w-10 h-10 shrink-0 flex items-center justify-center border-r" style={{borderColor:"rgba(255,255,255,0.04)"}}>
                  <span className="text-[8px] font-black text-gray-700">V1</span>
                </div>
                <div className="flex-1 relative h-10">
                  {timelineClips.map(clip=>{
                    const left=(clip.startSec/totalDur)*100;
                    const width=(clip.durSec/totalDur)*100;
                    const isAct=currentClip?.id===clip.id;
                    const isLoad=loadingClipIds.has(clip.id);
                    const isDT=dragOverClipId===clip.id;
                    return(
                      <div key={clip.id}
                        className={`v1clip absolute top-1 bottom-1 rounded cursor-pointer overflow-hidden transition-all
                          ${isAct?"ring-1 ring-cyan-400/80":""}
                          ${isDT?"ring-2 ring-purple-500 brightness-125":""}`}
                        style={{
                          left:`calc(${left}% + 1px)`,width:`calc(${width}% - 2px)`,
                          background:clip.url?`${clip.color}28`:`${clip.color}0d`,
                          border:`1px ${clip.url?"solid":"dashed"} ${clip.color}${clip.url?"55":"33"}`,
                        }}
                        onClick={e=>{e.stopPropagation();seekToTime(clip.startSec+0.01);}}
                        onDragOver={e=>{e.preventDefault();setDragOverClipId(clip.id);}}
                        onDragLeave={()=>setDragOverClipId(null)}
                        onDrop={e=>{e.preventDefault();if(dragSrcUrl)handleDropOnClip(clip.id,dragSrcUrl);}}>
                        {isLoad?(
                          <div className="w-full h-full flex items-center justify-center">
                            <div className="w-3 h-3 rounded-full border-2 border-t-transparent animate-spin"
                              style={{borderColor:`${clip.color}99`,borderTopColor:"transparent"}}/>
                          </div>
                        ):(
                          <>
                            <div className="flex items-center h-full px-1.5">
                              {!clip.url&&<div className="w-1.5 h-1.5 rounded-full animate-pulse shrink-0 mr-0.5" style={{background:clip.color+"88"}}/>}
                              <span className="text-[7px] font-bold text-white/60 truncate">{clip.label}</span>
                            </div>
                            <div className="v1clip-overlay absolute inset-0 flex items-center justify-center"
                              style={{background:"rgba(0,0,0,0.65)"}}>
                              <button title="Sugerir outra mídia"
                                onClick={e=>{e.stopPropagation();suggestAnother(clip.id);}}
                                className="flex items-center gap-1 hover:scale-110 transition-transform">
                                <RefreshCw className="w-3 h-3 text-white"/>
                              </button>
                            </div>
                          </>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* ── T1: Subtitle ── */}
              <div className="flex border-b" style={{borderColor:"rgba(255,255,255,0.04)"}}>
                <div className="w-10 h-8 shrink-0 flex items-center justify-center border-r" style={{borderColor:"rgba(255,255,255,0.04)"}}>
                  <span className="text-[8px] font-black text-gray-700">T1</span>
                </div>
                <div className="flex-1 relative h-8">
                  {localScenes.map((sc,i)=>{
                    const left=(sceneStarts[i]/totalDur)*100;
                    const width=((sc.estimated_duration_seconds??5)/totalDur)*100;
                    const words=(sc.text_chunk??sc.segment??"").split(" ").slice(0,6);
                    return(
                      <div key={i} className="absolute top-0.5 bottom-0.5 rounded overflow-hidden flex items-center gap-0.5 px-1.5"
                        style={{left:`calc(${left}%+1px)`,width:`calc(${width}%-2px)`,background:"rgba(234,179,8,0.07)",border:"1px solid rgba(234,179,8,0.2)"}}>
                        {words.map((ww,wi)=>{
                          const isPW=POWER_WORDS.has(ww.toLowerCase().replace(/[^a-záéíóúãõç]/g,""));
                          return <span key={wi} className={`text-[6px] font-bold shrink-0 ${isPW?"text-yellow-400":"text-gray-600"}`}>{ww}</span>;
                        })}
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* ── A1: Waveform ── */}
              <div className="flex border-b" style={{borderColor:"rgba(255,255,255,0.04)"}}>
                <div className="w-10 h-8 shrink-0 flex items-center justify-center border-r" style={{borderColor:"rgba(255,255,255,0.04)"}}>
                  <span className="text-[8px] font-black text-gray-700">A1</span>
                </div>
                <div className="flex-1 h-8 flex items-end overflow-hidden gap-px px-1" style={{background:"rgba(16,185,129,0.04)"}}>
                  {Array.from({length:90}).map((_,i)=>(
                    <div key={i} className="flex-1 rounded-full opacity-55" style={{background:"#10b981",height:`${18+Math.abs(Math.sin(i*1.7)*Math.cos(i*0.5))*82}%`}}/>
                  ))}
                </div>
              </div>

              {/* ── A2: SFX ── */}
              <div className="flex" style={{borderColor:"rgba(255,255,255,0.04)"}}>
                <div className="w-10 h-8 shrink-0 flex items-center justify-center border-r" style={{borderColor:"rgba(255,255,255,0.04)"}}>
                  <span className="text-[8px] font-black text-gray-700">A2</span>
                </div>
                <div className="flex-1 relative h-8">
                  {localScenes.map((sc,i)=>sc.sfx_url&&(
                    <div key={i} className="absolute top-0.5 bottom-0.5 rounded flex items-center gap-0.5 px-1.5 overflow-hidden"
                      style={{left:`calc(${(sceneStarts[i]/totalDur)*100}%+1px)`,width:`calc(${((sc.estimated_duration_seconds??5)/totalDur)*100}%-2px)`,background:"rgba(239,68,68,0.07)",border:"1px solid rgba(239,68,68,0.2)"}}>
                      {[40,80,55,30].map((h,j)=><div key={j} className="w-1 bg-red-500/60 rounded-full" style={{height:`${h}%`}}/>)}
                    </div>
                  ))}
                </div>
              </div>

              {/* ── Red Playhead Needle ── */}
              <div className="absolute top-0 bottom-0 pointer-events-none z-20"
                style={{left:`calc(40px + (100% - 40px) * ${playheadPct/100})`,transform:"translateX(-50%)"}}>
                <div className="w-px h-full bg-red-500" style={{boxShadow:"0 0 8px rgba(239,68,68,0.7)"}}/>
                <div className="w-3 h-3 bg-red-500 rounded-full absolute -top-1 left-1/2 -translate-x-1/2" style={{boxShadow:"0 0 10px rgba(239,68,68,0.9)"}}/>
              </div>
            </div>
          </div>

          {/* Export bar */}
          <div className="flex items-center justify-between shrink-0 gap-2">
            <span className="text-[10px] text-gray-700">{timelineClips.length} clipes · {localScenes.length} cenas · {result.music_style}</span>
            <div className="flex items-center gap-2">
              <div className="relative">
                <button onClick={()=>setExportOpen(v=>!v)}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[11px] font-bold border transition-all hover:bg-white/5"
                  style={{background:"rgba(255,255,255,0.03)",borderColor:"rgba(255,255,255,0.08)",color:"#9ca3af"}}>
                  <Download className="w-3.5 h-3.5"/>Exportar<ChevronUp className={`w-3 h-3 transition-transform ${exportOpen?"":"rotate-180"}`}/>
                </button>
                {exportOpen&&(
                  <div className="absolute bottom-full mb-2 right-0 w-52 rounded-xl overflow-hidden z-30"
                    style={{background:"#111",border:"1px solid rgba(255,255,255,0.08)",boxShadow:"0 -20px 40px rgba(0,0,0,0.6)"}}>
                    {[
                      {label:"Baixar Projeto Completo",icon:"📦",paywall:true},
                      {label:"Baixar Legendas (.srt)", icon:"💬",paywall:false,action:downloadSRT},
                      {label:"Baixar apenas Trilha",   icon:"🎵",paywall:false,action:downloadMusic},
                      {label:"Baixar Pack de Mídias",  icon:"🎬",paywall:true},
                    ].map(opt=>(
                      <button key={opt.label}
                        onClick={()=>{setExportOpen(false);if(opt.paywall)setPaywallOpen(true);else opt.action?.();}}
                        className="w-full flex items-center gap-3 px-4 py-2.5 text-xs text-left hover:bg-white/6 transition-colors border-b last:border-0"
                        style={{borderColor:"rgba(255,255,255,0.05)"}}>
                        <span>{opt.icon}</span>
                        <span className="flex-1 text-gray-300">{opt.label}</span>
                        {opt.paywall&&<Lock className="w-3 h-3 text-amber-500"/>}
                      </button>
                    ))}
                  </div>
                )}
              </div>
              <button onClick={()=>setPaywallOpen(true)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[11px] font-bold transition-all"
                style={{background:"linear-gradient(135deg,rgba(251,191,36,0.1),rgba(245,158,11,0.06))",border:"1px solid rgba(251,191,36,0.3)",color:"#fbbf24"}}>
                <FileCode2 className="w-3.5 h-3.5"/>Premiere<Lock className="w-3 h-3"/>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* ══ COL 3: Mídias Sugeridas + Trilha (26%) ══════════════════════ */}
      <div className="w-[26%] shrink-0 flex flex-col border-l overflow-hidden"
        style={{background:"#0a0a0a",borderColor:"rgba(255,255,255,0.05)"}}>

        <div className="flex items-center justify-between px-4 py-3.5 border-b shrink-0" style={{borderColor:"rgba(255,255,255,0.05)"}}>
          <p className="text-[11px] font-black text-white uppercase tracking-widest">Mídias Sugeridas</p>
          <span className="text-[9px] text-purple-400 font-bold flex items-center gap-1">
            <div className="w-1.5 h-1.5 rounded-full bg-purple-500 animate-pulse"/>Cena {activeScene+1}/{localScenes.length}
          </span>
        </div>

        <div className="flex-1 overflow-y-auto">

          {/* Alternatives — draggable to V1 */}
          <div className="p-3 border-b" style={{borderColor:"rgba(255,255,255,0.05)"}}>
            <p className="text-[9px] uppercase tracking-[0.18em] text-gray-700 font-bold mb-2">
              Alternativas · arraste para a timeline
            </p>
            {alternatives.length===0?(
              <p className="text-[10px] text-gray-700 py-3 text-center leading-relaxed">
                Passe o mouse em um bloco V1<br/>e clique em 🔄 para gerar alternativas
              </p>
            ):(
              <div className="grid grid-cols-2 gap-1.5">
                {alternatives.slice(0,6).map((opt,i)=>(
                  <div key={i}
                    className="relative rounded-lg overflow-hidden cursor-grab active:cursor-grabbing group/drag"
                    style={{aspectRatio:"16/9",border:"1px solid rgba(255,255,255,0.08)"}}
                    draggable onDragStart={()=>setDragSrcUrl(opt.url)} onDragEnd={()=>setDragSrcUrl(null)}>
                    <video src={opt.url} className="w-full h-full object-cover opacity-50 group-hover/drag:opacity-75 transition-opacity" muted preload="metadata"/>
                    <div className="absolute inset-0 flex flex-col items-center justify-center opacity-0 group-hover/drag:opacity-100 transition-opacity gap-0.5"
                      style={{background:"rgba(0,0,0,0.5)"}}>
                      <GripVertical className="w-4 h-4 text-white/80"/>
                      <span className="text-[8px] text-white font-bold">Arrastar</span>
                    </div>
                    <button onClick={()=>{const cl=timelineClips.find(c=>c.sceneIdx===activeScene);if(cl)handleDropOnClip(cl.id,opt.url);}}
                      className="absolute bottom-1 right-1 px-1.5 py-0.5 rounded text-[8px] font-bold text-white opacity-0 group-hover/drag:opacity-100 transition-opacity"
                      style={{background:"rgba(0,180,255,0.75)"}}>
                      Usar
                    </button>
                    <div className="absolute top-1 left-1 px-1 py-0.5 rounded text-[7px] font-black text-white/60" style={{background:"rgba(0,0,0,0.6)"}}>Alt {i+1}</div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* B-Rolls per scene */}
          <div className="p-3 border-b" style={{borderColor:"rgba(255,255,255,0.05)"}}>
            <p className="text-[9px] uppercase tracking-[0.18em] text-gray-700 font-bold mb-2">B-Rolls por Cena</p>
            <div className="space-y-2">
              {localScenes.map((sc,i)=>{
                const vid=sc.video_url??sc.video_options?.[0]?.url;
                const col=CLIP_COLS[i%CLIP_COLS.length];
                const isAct=activeScene===i;
                return(
                  <div key={i} className={`rounded-xl overflow-hidden border transition-all ${isAct?"border-purple-500/40":"border-transparent"}`}
                    style={{background:"rgba(255,255,255,0.025)"}}>
                    <div className="flex gap-2 p-2.5">
                      <div className="w-16 h-10 rounded-lg shrink-0 overflow-hidden relative"
                        style={{background:`${col}18`,border:`1px solid ${col}33`}}>
                        {vid?<video src={vid} className="w-full h-full object-cover opacity-65" muted preload="metadata"/>
                          :<div className="w-full h-full flex items-center justify-center"><Film className="w-3.5 h-3.5" style={{color:col+"99"}}/></div>}
                        <div className="absolute bottom-0.5 right-0.5 text-[7px] font-black px-1 rounded" style={{background:col+"aa",color:"#fff"}}>{i+1}</div>
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-[10px] font-bold text-gray-300 truncate">{sc.segment}</p>
                        <p className="text-[9px] text-gray-700 mt-0.5 line-clamp-1">{sc.broll_search_keywords??sc.vault_category??"Pexels HD"}</p>
                        <p className="text-[9px] mt-0.5" style={{color:col+"cc"}}>{sc.estimated_duration_seconds??5}s</p>
                      </div>
                    </div>
                    <div className="flex border-t" style={{borderColor:"rgba(255,255,255,0.04)"}}>
                      <button onClick={()=>{const cl=timelineClips.find(c=>c.sceneIdx===i);if(cl)suggestAnother(cl.id);}}
                        className="flex-1 flex items-center justify-center gap-1 py-1.5 text-[9px] text-gray-600 hover:text-purple-400 transition-colors border-r" style={{borderColor:"rgba(255,255,255,0.04)"}}>
                        <RefreshCw className="w-2.5 h-2.5"/>Sugerir
                      </button>
                      <button onClick={()=>{if(vid)window.open(vid,"_blank");else setPaywallOpen(true);}}
                        className="flex-1 flex items-center justify-center gap-1 py-1.5 text-[9px] text-gray-600 hover:text-cyan-400 transition-colors">
                        <Download className="w-2.5 h-2.5"/>Baixar
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Trilha Sonora */}
          <div className="p-3">
            <p className="text-[9px] uppercase tracking-[0.18em] text-gray-700 font-bold mb-2">Trilha Sonora</p>
            <div className="space-y-2">
              {musicOptions.map((track,i)=>{
                const isSel=selectedMusic===i;const isPlay=playingMusic===i;
                return(
                  <div key={i} className={`rounded-xl p-2.5 border transition-all cursor-pointer ${isSel?"border-purple-500/35":"border-transparent"}`}
                    style={{background:isSel?"rgba(139,92,246,0.07)":"rgba(255,255,255,0.025)"}} onClick={()=>setSelectedMusic(i)}>
                    <div className="flex items-center gap-2">
                      <button onClick={e=>{e.stopPropagation();toggleMusic(i);}}
                        className="w-7 h-7 rounded-full shrink-0 flex items-center justify-center"
                        style={{background:isPlay?"rgba(139,92,246,0.3)":"rgba(255,255,255,0.06)",border:"1px solid rgba(139,92,246,0.3)"}}>
                        {isPlay?<Pause className="w-3 h-3 text-purple-400" fill="currentColor"/>:<Play className="w-3 h-3 text-purple-400 ml-0.5" fill="currentColor"/>}
                      </button>
                      <div className="flex-1 min-w-0">
                        <p className={`text-[10px] font-semibold truncate ${isSel?"text-purple-300":"text-gray-400"}`}>{track.title}</p>
                        <p className="text-[8px] text-gray-700">{track.is_premium_vault?"💎 Cofre Kraft":"🎵 Pixabay"}</p>
                      </div>
                      {isSel&&<Check className="w-3 h-3 text-purple-400 shrink-0"/>}
                    </div>
                    <div className="mt-1.5 flex items-end gap-px h-3 overflow-hidden rounded">
                      {Array.from({length:40}).map((_,j)=>(
                        <div key={j} className="flex-1 rounded-full"
                          style={{height:`${20+Math.abs(Math.sin((j+i*7)*0.9)*Math.cos((j+i*3)*0.7))*80}%`,background:isSel?"rgba(139,92,246,0.5)":"rgba(255,255,255,0.07)"}}/>
                      ))}
                    </div>
                    {track.url&&<audio ref={musicRefs[i]} src={track.url} loop preload="none"/>}
                  </div>
                );
              })}
            </div>
            <div className="mt-2 grid grid-cols-2 gap-1.5">
              <button onClick={downloadMusic}
                className="flex items-center justify-center gap-1 py-1.5 rounded-lg text-[9px] font-bold border transition-all hover:bg-white/6"
                style={{borderColor:"rgba(255,255,255,0.07)",color:"#6b7280"}}>
                <Download className="w-2.5 h-2.5"/>Download
              </button>
              <button onClick={()=>setPaywallOpen(true)}
                className="flex items-center justify-center gap-1 py-1.5 rounded-lg text-[9px] font-bold border transition-all hover:border-purple-500/40"
                style={{borderColor:"rgba(139,92,246,0.3)",color:"#a78bfa",background:"rgba(139,92,246,0.06)"}}>
                <RefreshCw className="w-2.5 h-2.5"/>Trocar
              </button>
            </div>
          </div>
        </div>
      </div>

      {paywallOpen&&<PaywallModal onClose={()=>setPaywallOpen(false)}/>}
    </div>
    </>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function SuarikHome() {
  const router = useRouter();

  const [copy,             setCopy]          = useState("");
  const [niche,            setNiche]         = useState("dr_nutra_pain");
  const [aspect,           setAspect]        = useState(0);
  const [isCopyOpen,       setCopyOpen]      = useState(false);
  const [error,            setError]         = useState<string|null>(null);
  const [result,           setResult]        = useState<GenerateResponse|null>(null);
  const [isUploadModalOpen,setUploadOpen]    = useState(false);
  const [isGenerating,     setIsGenerating]  = useState(false);
  const [isGenerated,      setIsGenerated]   = useState(false);
  const [paywallOpen,      setPaywallOpen]   = useState(false);
  const [activeTag,        setActiveTag]     = useState("All");

  const aspectFormats = ["landscape","portrait","landscape"] as const;
  const themeMap: Record<number,string> = { 0:"vsl_long", 1:"social_organic", 2:"cinematic" };

  const handleGenerate = async () => {
    if (!copy.trim() || isGenerating) return;
    setIsGenerating(true); setIsGenerated(false); setError(null); setResult(null);
    try {
      const [data] = await Promise.all([
        fetch("/api/generate",{method:"POST",headers:{"Content-Type":"application/json"},
          body:JSON.stringify({copy,videoFormat:themeMap[aspect],videoTheme:niche,format:aspectFormats[aspect]})})
          .then(async res=>{
            const d = await res.json() as GenerateResponse;
            if(!res.ok) throw new Error((d as {error?:string}).error??"Erro.");
            return d;
          }),
        new Promise(r=>setTimeout(r,3000)),
      ]);
      sessionStorage.setItem("vb_project_result",JSON.stringify(data));
      sessionStorage.setItem("vb_project_copy",copy);
      setResult(data as GenerateResponse);
      setIsGenerated(true);
    } catch(e:unknown){
      setError(e instanceof Error?e.message:"Erro ao gerar.");
    } finally{
      setIsGenerating(false);
    }
  };

  const handleBack = () => { setIsGenerated(false); setResult(null); };

  const area3 = isGenerating?"generating":isGenerated?"generated":"gallery";

  // Full-screen workstation mode
  if (isGenerated && result) {
    return <WorkstationView result={result} copy={copy} onBack={handleBack}/>;
  }

  return (
    <>
    <style>{`@keyframes fadeIn{from{opacity:0;transform:translateY(6px)}to{opacity:1;transform:translateY(0)}}`}</style>

    <div className="flex h-screen overflow-hidden" style={{background:"#050505",color:"#e5e5e5",fontFamily:"var(--font-geist-sans,Inter,sans-serif)"}}>

      {/* ── SIDEBAR ──────────────────────────────────────────────────────── */}
      <aside className="w-[210px] shrink-0 flex flex-col border-r" style={{background:"#000",borderColor:"rgba(255,255,255,0.05)"}}>
        <div className="px-5 pt-6 pb-6 flex items-center gap-2.5">
          <div className="w-7 h-7 rounded-lg bg-blue-600 flex items-center justify-center font-black text-white italic text-sm" style={{boxShadow:"0 0 16px rgba(37,99,235,0.5)"}}>S</div>
          <span className="text-xl font-black text-white" style={{letterSpacing:"-0.04em"}}>Suarik</span>
        </div>
        <nav className="px-3 space-y-0.5 flex-1">
          {[
            {icon:<Plus className="w-4 h-4"/>,     label:"Criar",        action:()=>setCopyOpen(v=>!v)},
            {icon:<Home className="w-4 h-4"/>,     label:"Início",       action:()=>{}, active:true},
            {icon:<BookOpen className="w-4 h-4"/>, label:"Biblioteca",   action:()=>router.push("/editor")},
            {icon:<Search className="w-4 h-4"/>,   label:"Pesquisar ⌘K", action:()=>{}},
          ].map(item=>(
            <button key={item.label} onClick={item.action}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm transition-colors ${(item as {active?:boolean}).active?"bg-white/8 text-white font-semibold":"text-gray-600 hover:text-gray-300 hover:bg-white/4"}`}>
              {item.icon}{item.label}
            </button>
          ))}
        </nav>
        <div className="px-3 pb-5 space-y-1 border-t pt-4" style={{borderColor:"rgba(255,255,255,0.05)"}}>
          <button className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm text-gray-600 hover:text-gray-300 hover:bg-white/4 transition-colors">
            <HelpCircle className="w-4 h-4"/>Ajuda e Suporte
          </button>
          <button onClick={()=>router.push("/pricing")} className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm text-gray-600 hover:text-gray-300 hover:bg-white/4 transition-colors">
            <Coins className="w-4 h-4 text-amber-500"/>
            <span>Créditos <span className="text-amber-500 font-bold">500</span></span>
          </button>
          <button onClick={()=>router.push("/login")} className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-semibold text-gray-300 hover:text-white hover:bg-white/6 border transition-colors" style={{borderColor:"rgba(255,255,255,0.07)"}}>
            <LogIn className="w-4 h-4"/>Entrar / Perfil
          </button>
        </div>
      </aside>

      {/* ── CONTROL PANEL ────────────────────────────────────────────────── */}
      <div className="w-[390px] shrink-0 flex flex-col border-r overflow-y-auto" style={{borderColor:"rgba(255,255,255,0.05)"}}>
        <div className="flex-1 flex flex-col justify-center px-6 py-8">
          <p className="text-xs text-gray-600 leading-relaxed mb-6">Transforme roteiros em vídeos de alta retenção. Escolha o formato e a copy para mapear ganchos e B-rolls.</p>

          <div className="rounded-2xl overflow-hidden" style={{background:"#111",border:"1px solid rgba(255,255,255,0.07)"}}>
            <button onClick={()=>setCopyOpen(v=>!v)} className="w-full flex items-center gap-3 px-4 py-3.5 border-b hover:bg-white/3 transition-colors group" style={{borderColor:"rgba(255,255,255,0.05)"}}>
              <FileText className="w-4 h-4 text-gray-500 group-hover:text-gray-300 transition-colors"/>
              <span className="flex-1 text-sm text-left text-gray-500 group-hover:text-gray-300 transition-colors">Adicionar Copy / Roteiro</span>
              <Plus className="w-4 h-4 text-gray-700"/>
            </button>
            <button onClick={()=>setUploadOpen(true)} className="w-full flex items-center gap-3 px-4 py-3.5 border-b hover:bg-white/3 transition-colors group" style={{borderColor:"rgba(255,255,255,0.05)"}}>
              <Mic className="w-4 h-4 text-gray-500 group-hover:text-gray-300 transition-colors"/>
              <span className="flex-1 text-sm text-left text-gray-500 group-hover:text-gray-300 transition-colors">Adicionar Locução <span className="text-gray-700 text-xs">(Opcional)</span></span>
              <Plus className="w-4 h-4 text-gray-700"/>
            </button>

            <div className={`overflow-hidden transition-all duration-300 ${isCopyOpen?"max-h-[340px]":"max-h-16"}`}>
              <textarea value={copy} onChange={e=>setCopy(e.target.value)} disabled={isGenerating} rows={isCopyOpen?7:2}
                placeholder={isCopyOpen?"Cole sua VSL, roteiro ou copy aqui…":"Descreva sua edição ou cole a VSL. Pressione Tab para expandir…"}
                onFocus={()=>setCopyOpen(true)} onKeyDown={e=>e.key==="Tab"&&(e.preventDefault(),setCopyOpen(true))}
                className="w-full bg-transparent text-sm text-gray-300 placeholder-gray-700 px-4 py-3 resize-none focus:outline-none disabled:opacity-40" style={{fontFamily:"inherit"}}/>
              {isCopyOpen && (
                <div className="px-4 pb-3 flex flex-wrap gap-1.5">
                  {TEMPLATES.map(t=>(
                    <button key={t.label} onClick={()=>setCopy(t.copy)} className="flex items-center gap-1 text-[10px] font-semibold px-2.5 py-1 rounded-full border transition-all hover:bg-white/6" style={{borderColor:"rgba(255,255,255,0.1)",color:"#9ca3af"}}>{t.icon} {t.label}</button>
                  ))}
                </div>
              )}
            </div>

            <div className="flex items-center gap-2 px-3 py-2.5 border-t" style={{borderColor:"rgba(255,255,255,0.05)"}}>
              <div className="flex items-center gap-1 text-[10px] text-gray-600 font-semibold shrink-0">
                <Brain className="w-3 h-3"/>Neural
              </div>
              <div className="w-px h-3.5 bg-white/8 mx-0.5"/>
              <div className="relative shrink-0">
                <select value={aspect} onChange={e=>setAspect(+e.target.value)} disabled={isGenerating}
                  className="text-[10px] text-gray-500 pr-4 py-0.5 appearance-none cursor-pointer focus:outline-none bg-transparent disabled:opacity-40">
                  {ASPECTS.map((a,i)=><option key={i} value={i}>{a}</option>)}
                </select>
                <ChevronDown className="absolute right-0 top-1/2 -translate-y-1/2 w-3 h-3 text-gray-700 pointer-events-none"/>
              </div>
              <div className="w-px h-3.5 bg-white/8 mx-0.5"/>
              <div className="relative flex-1">
                <select value={niche} onChange={e=>setNiche(e.target.value)} disabled={isGenerating}
                  className="w-full text-[10px] text-gray-500 pr-4 py-0.5 appearance-none cursor-pointer focus:outline-none bg-transparent disabled:opacity-40 truncate">
                  {NICHES.map(g=>(<optgroup key={g.group} label={`── ${g.group}`}>{g.options.map(o=><option key={o.value} value={o.value}>{o.label}</option>)}</optgroup>))}
                </select>
                <ChevronDown className="absolute right-0 top-1/2 -translate-y-1/2 w-3 h-3 text-gray-700 pointer-events-none"/>
              </div>
              <Wand2 className="w-3.5 h-3.5 text-gray-700 hover:text-violet-400 cursor-pointer transition-colors shrink-0"/>
              <button onClick={handleGenerate} disabled={!copy.trim()||isGenerating}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all shrink-0"
                style={copy.trim()&&!isGenerating?{background:"linear-gradient(135deg,#2563eb,#4f46e5)",color:"#fff",boxShadow:"0 2px 12px rgba(79,70,229,0.4)"}:{background:"rgba(255,255,255,0.05)",color:"rgba(255,255,255,0.2)",cursor:"not-allowed"}}>
                {isGenerating?<><div className="w-3 h-3 border-2 border-blue-300/20 border-t-blue-300 rounded-full animate-spin"/>…</>:<><Sparkles className="w-3 h-3"/>Gerar</>}
              </button>
            </div>
          </div>

          {error && (
            <div className="mt-3 flex items-center gap-2 text-xs text-red-400 rounded-xl px-3 py-2.5" style={{background:"rgba(239,68,68,0.08)",border:"1px solid rgba(239,68,68,0.2)"}}>
              <X className="w-3 h-3 shrink-0"/>{error}
            </div>
          )}
        </div>
      </div>

      {/* ── AREA 3 ───────────────────────────────────────────────────────── */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {area3==="gallery"    && <GalleryView activeTag={activeTag} setActiveTag={setActiveTag}/>}
        {area3==="generating" && <GeneratingView/>}
      </div>
    </div>

    {isUploadModalOpen && <UploadModal onClose={()=>setUploadOpen(false)}/>}
    {paywallOpen       && <PaywallModal onClose={()=>setPaywallOpen(false)}/>}
    </>
  );
}
