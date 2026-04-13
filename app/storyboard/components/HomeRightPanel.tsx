"use client";

import { useState } from "react";
import { Film, X, Play } from "lucide-react";
import type { WinningAd } from "../types";
import { GALLERY_CARDS } from "../utils";

const GALLERY_TAGS = ["All","Renda Extra","Saúde","Finanças","Dor","Ansiedade","UGC"];

export function HomeRightPanel({ activeTag, setActiveTag, onRaioX }: {
  activeTag:    string;
  setActiveTag: (t: string) => void;
  onRaioX:      (ad: WinningAd) => void;
}) {
  const cards = activeTag === "All" ? GALLERY_CARDS : GALLERY_CARDS.filter(c => c.tag === activeTag);

  // Preview fullscreen
  const [preview, setPreview] = useState<{ videoUrl: string; title: string } | null>(null);

  const handleCardClick = (card: typeof GALLERY_CARDS[0]) => {
    // Monta um WinningAd a partir do card (campos extras com placeholders)
    const ad: WinningAd = {
      id:           String(card.id),
      title:        card.title,
      niche:        card.tag,
      daysActive:   "—",
      thumbnailUrl: card.src,
      videoUrl:     card.videoUrl,
      hookText:     card.title,
      views:        "—",
      spend:        "—",
    };
    onRaioX(ad);
  };

  return (
    <div className="flex-1 flex flex-col overflow-hidden" style={{background:"#0a0a0a"}}>

      {/* ── Header + filtros ── */}
      <div className="shrink-0 px-4 pt-4 pb-0">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full"
              style={{background:"rgba(232,89,60,0.1)",border:"1px solid rgba(232,89,60,0.25)"}}>
              <Film className="w-3 h-3 text-orange-400"/>
              <span className="text-[13px] font-black uppercase tracking-wide" style={{fontFamily:"'Bebas Neue',sans-serif",letterSpacing:"2px",color:"#FF7A5C"}}>Hooks Virais</span>
              <span className="text-[9px] font-black px-1.5 py-0.5 rounded-full"
                style={{background:"rgba(232,89,60,0.15)",color:"#FF7A5C",border:"1px solid rgba(232,89,60,0.25)"}}>
                {GALLERY_CARDS.length} clips
              </span>
            </div>
          </div>
          <span className="text-[9px] text-gray-500 italic">clique para analisar</span>
        </div>

        {/* Tag filters */}
        <div className="flex items-center gap-1.5 pb-3 overflow-x-auto" style={{scrollbarWidth:"none"}}>
          {GALLERY_TAGS.map(tag=>(
            <button key={tag} onClick={()=>setActiveTag(tag)}
              className="shrink-0 px-3 py-1 rounded-full text-[9px] font-black transition-all"
              style={{
                background: activeTag===tag?"rgba(232,89,60,0.18)":"rgba(255,255,255,0.04)",
                border:     `1px solid ${activeTag===tag?"rgba(232,89,60,0.5)":"rgba(255,255,255,0.07)"}`,
                color:      activeTag===tag?"#FF7A5C":"#4b5563",
                boxShadow:  activeTag===tag?"0 0 14px rgba(232,89,60,0.2)":"none",
              }}>
              {tag}
            </button>
          ))}
        </div>
      </div>

      {/* ── Grid masonry ── */}
      <div className="flex-1 overflow-y-auto px-3 pb-4"
        style={{scrollbarWidth:"thin",scrollbarColor:"rgba(255,255,255,0.06) transparent"}}>
        <div style={{columnCount:3,columnGap:"8px"}}>
          {cards.map(card=>(
            <div
              key={card.id}
              onClick={() => handleCardClick(card)}
              className="break-inside-avoid mb-2 group relative rounded-xl overflow-hidden cursor-pointer"
              style={{border:"1px solid rgba(255,255,255,0.07)",background:"#0e0e0e"}}>

              <video
                src={card.videoUrl}
                autoPlay loop muted playsInline
                className="w-full h-56 object-cover rounded-t-lg"
                style={{aspectRatio:card.tall?"9/13":"4/3",display:"block",filter:"brightness(0.82) saturate(1.15)"}}
                onError={e=>{
                  const v = e.currentTarget;
                  const img = document.createElement("img");
                  img.src = card.src;
                  img.className = v.className;
                  img.style.cssText = v.style.cssText;
                  v.parentNode?.replaceChild(img, v);
                }}
              />

              {/* Gradiente overlay */}
              <div className="absolute inset-0 rounded-xl pointer-events-none"
                style={{background:"linear-gradient(to bottom,rgba(0,0,0,0.25) 0%,transparent 40%,rgba(0,0,0,0.88) 100%)"}}/>

              {/* Tag badge */}
              <div className="absolute top-2 left-2">
                <span className="text-[7px] font-black uppercase px-2 py-0.5 rounded-full"
                  style={{background:"rgba(232,89,60,0.25)",color:"#FF7A5C",border:"1px solid rgba(232,89,60,0.4)",backdropFilter:"blur(6px)"}}>
                  {card.tag}
                </span>
              </div>

              {/* Hover: Analisar button */}
              <div className="absolute top-2 right-2 flex items-center gap-1 px-1.5 py-0.5 rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
                style={{background:"rgba(232,89,60,0.8)",backdropFilter:"blur(6px)"}}>
                <Play className="w-2.5 h-2.5 text-white fill-white"/>
                <span className="text-[7px] font-black text-white">Analisar</span>
              </div>

              {/* Título */}
              <div className="absolute bottom-0 left-0 right-0 px-2.5 pb-2.5 pt-5">
                <p className="text-[9px] font-black text-white leading-snug"
                  style={{textShadow:"0 1px 6px rgba(0,0,0,0.9)",letterSpacing:"-0.01em"}}>
                  {card.title}
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* ── Preview fullscreen overlay ── */}
      {preview && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center"
          style={{background:"rgba(0,0,0,0.92)",backdropFilter:"blur(16px)"}}
          onClick={()=>setPreview(null)}>
          <div className="relative max-w-sm w-full mx-4" onClick={e=>e.stopPropagation()}>
            <button
              onClick={()=>setPreview(null)}
              className="absolute -top-10 right-0 p-2 rounded-full text-gray-400 hover:text-white transition-colors">
              <X className="w-5 h-5"/>
            </button>
            <p className="text-[11px] font-bold text-orange-400 uppercase tracking-wider mb-3 text-center">{preview.title}</p>
            <video
              src={preview.videoUrl}
              autoPlay loop muted playsInline controls
              className="w-full rounded-2xl"
              style={{maxHeight:"70vh",objectFit:"contain"}}
            />
          </div>
        </div>
      )}
    </div>
  );
}
