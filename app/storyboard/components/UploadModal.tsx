"use client";

import { useRef, useState } from "react";
import { X, CloudUpload, Upload } from "lucide-react";

const ACCEPTED = ".mp3,.wav,.mp4,.mov,.mkv,.webm";

export function UploadModal({
  onClose,
  onFile,
}: {
  onClose:  () => void;
  onFile?:  (file: File) => void;
}) {
  const [dragging, setDragging] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const handleFile = (file: File | undefined) => {
    if (!file) return;
    onFile?.(file);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-6"
      style={{background:"rgba(0,0,0,0.85)",backdropFilter:"blur(12px)"}}
      onClick={onClose}>
      <div className="relative w-full max-w-lg rounded-2xl overflow-hidden"
        style={{background:"#111",border:"1px solid rgba(255,255,255,0.08)",boxShadow:"0 40px 100px rgba(0,0,0,0.7)"}}
        onClick={e=>e.stopPropagation()}>

        <div className="flex items-center justify-between px-6 py-5 border-b" style={{borderColor:"rgba(255,255,255,0.07)"}}>
          <div>
            <h2 className="text-lg font-black text-white" style={{fontFamily:"'Bebas Neue',sans-serif",letterSpacing:"1.5px"}}>Faça upload dos seus ativos</h2>
            <p className="text-xs text-gray-400 mt-0.5">Locução, takes brutos de vídeo ou trilha</p>
          </div>
          <button onClick={onClose} className="p-2 rounded-xl text-gray-600 hover:text-gray-300 hover:bg-white/6 transition-colors">
            <X className="w-4 h-4"/>
          </button>
        </div>

        <div className="p-6">
          {/* Drop zone — click também abre o file picker */}
          <div
            onDragOver={e=>{e.preventDefault();setDragging(true);}}
            onDragLeave={()=>setDragging(false)}
            onDrop={e=>{e.preventDefault();setDragging(false);handleFile(e.dataTransfer.files[0]);}}
            onClick={()=>fileRef.current?.click()}
            className="flex flex-col items-center justify-center py-14 rounded-2xl border-2 border-dashed transition-all cursor-pointer"
            style={{borderColor:dragging?"rgba(232,89,60,0.7)":"rgba(255,255,255,0.12)",background:dragging?"rgba(232,89,60,0.06)":"rgba(255,255,255,0.02)"}}>
            <div className="w-16 h-16 rounded-2xl flex items-center justify-center mb-4 transition-all"
              style={{background:dragging?"rgba(232,89,60,0.2)":"rgba(255,255,255,0.05)",border:dragging?"1px solid rgba(232,89,60,0.4)":"1px solid rgba(255,255,255,0.08)",boxShadow:dragging?"0 0 30px rgba(232,89,60,0.3)":"none"}}>
              <CloudUpload className={`w-8 h-8 transition-colors ${dragging?"text-orange-400":"text-gray-500"}`}/>
            </div>
            <p className="text-sm font-semibold text-gray-300 mb-1">Arraste seus arquivos aqui</p>
            <p className="text-xs text-gray-500 text-center max-w-xs leading-relaxed">Suporta <span className="text-gray-400">.mp3 .wav</span> e takes de vídeo <span className="text-gray-400">.mp4 .mov</span></p>
          </div>

          <div className="flex items-center gap-3 my-4">
            <div className="flex-1 h-px" style={{background:"rgba(255,255,255,0.06)"}}/>
            <span className="text-[10px] text-gray-500 uppercase tracking-widest">ou</span>
            <div className="flex-1 h-px" style={{background:"rgba(255,255,255,0.06)"}}/>
          </div>

          {/* Input oculto — acionado pelo botão e pela drop zone */}
          <input
            ref={fileRef}
            type="file"
            accept={ACCEPTED}
            style={{display:"none"}}
            onChange={e=>handleFile(e.target.files?.[0])}
          />

          <button
            onClick={()=>fileRef.current?.click()}
            className="w-full flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-semibold text-gray-300 border transition-all hover:bg-white/6"
            style={{borderColor:"rgba(255,255,255,0.1)"}}>
            <Upload className="w-4 h-4"/>Procurar arquivos
          </button>
        </div>

        <div className="px-6 pb-5 flex items-center gap-2 flex-wrap">
          {[".mp3",".wav",".mp4",".mov",".mkv"].map(f=>(
            <span key={f} className="text-[9px] font-bold px-2 py-0.5 rounded text-gray-500" style={{background:"rgba(255,255,255,0.04)",border:"1px solid rgba(255,255,255,0.07)"}}>{f}</span>
          ))}
        </div>
      </div>
    </div>
  );
}
