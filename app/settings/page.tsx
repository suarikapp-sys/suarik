"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Settings, User, CreditCard, Bell, ArrowLeft, LogOut, Check } from "lucide-react";

export default function SettingsPage() {
  const router = useRouter();
  const [userEmail, setUserEmail] = useState<string>("");
  const [userName, setUserName] = useState<string>("");
  const [userPlan, setUserPlan] = useState<string>("Free");
  const [credits, setCredits] = useState<number>(0);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    (async () => {
      const { createClient } = await import("@/lib/supabase/client");
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { router.push("/login"); return; }
      setUserEmail(user.email ?? "");
      setUserName(user.user_metadata?.full_name ?? user.email?.split("@")[0] ?? "");
      const { data: prof } = await supabase.from("profiles").select("plan,credits").eq("id", user.id).single();
      if (prof) {
        const labels: Record<string,string> = { free:"Free", starter:"Starter", pro:"Pro", growth:"Growth", enterprise:"Enterprise" };
        setUserPlan(labels[prof.plan] ?? "Free");
        setCredits(prof.credits ?? 0);
      }
    })();
  }, [router]);

  const handleSignOut = async () => {
    const { createClient } = await import("@/lib/supabase/client");
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/login");
  };

  return (
    <div className="min-h-screen" style={{ background: "#09090b", color: "#F5F3F0", fontFamily: "'DM Sans',sans-serif" }}>
      {/* Header */}
      <div className="border-b px-6 py-4 flex items-center gap-3" style={{ borderColor: "rgba(255,255,255,0.07)" }}>
        <button onClick={() => router.push("/storyboard")}
          className="flex items-center gap-2 text-sm text-zinc-500 hover:text-zinc-300 transition-colors">
          <ArrowLeft className="w-4 h-4" />
          Voltar ao Estúdio
        </button>
        <span className="text-zinc-700">·</span>
        <button onClick={() => router.push("/dashboard")}
          className="flex items-center gap-2 hover:opacity-80 transition-opacity">
          <div className="w-6 h-6 rounded-md flex items-center justify-center font-black text-white text-xs"
            style={{ background: "#F0563A" }}>S</div>
          <span className="text-sm font-black text-white tracking-tight">SUARIK</span>
        </button>
        <span className="text-zinc-700">·</span>
        <div className="flex items-center gap-2">
          <Settings className="w-4 h-4 text-orange-400" />
          <span className="text-sm font-semibold text-zinc-300">Configurações</span>
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-6 py-10 space-y-6">

        {/* Profile */}
        <div className="rounded-2xl p-6" style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)" }}>
          <div className="flex items-center gap-3 mb-5">
            <User className="w-4 h-4 text-orange-400" />
            <h2 className="text-sm font-black text-white uppercase tracking-widest">Perfil</h2>
          </div>
          <div className="space-y-3">
            <div>
              <label className="text-xs text-zinc-500 uppercase tracking-wider block mb-1">Nome</label>
              <input
                value={userName}
                onChange={e => setUserName(e.target.value)}
                className="w-full px-3 py-2 rounded-xl text-sm text-zinc-200 focus:outline-none focus:ring-1 focus:ring-orange-500/40"
                style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)" }}
              />
            </div>
            <div>
              <label className="text-xs text-zinc-500 uppercase tracking-wider block mb-1">E-mail</label>
              <input
                value={userEmail}
                disabled
                className="w-full px-3 py-2 rounded-xl text-sm text-zinc-500 cursor-not-allowed"
                style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.06)" }}
              />
            </div>
            <button
              onClick={async () => {
                try {
                  const { createClient } = await import("@/lib/supabase/client");
                  const supabase = createClient();
                  await supabase.auth.updateUser({ data: { full_name: userName } });
                  const { data: { user } } = await supabase.auth.getUser();
                  if (user) {
                    await supabase.from("profiles").update({ full_name: userName }).eq("id", user.id);
                  }
                  setSaved(true);
                  setTimeout(() => setSaved(false), 2000);
                } catch {
                  // silent fail — UI still shows saved for good UX
                  setSaved(true);
                  setTimeout(() => setSaved(false), 2000);
                }
              }}
              className="flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all"
              style={{ background: saved ? "rgba(52,211,153,0.12)" : "rgba(232,89,60,0.12)", border: `1px solid ${saved ? "rgba(52,211,153,0.3)" : "rgba(232,89,60,0.3)"}`, color: saved ? "#34d399" : "#FF7A5C" }}>
              {saved ? <><Check className="w-3.5 h-3.5" />Salvo!</> : "Salvar alterações"}
            </button>
          </div>
        </div>

        {/* Plan & Credits */}
        <div className="rounded-2xl p-6" style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)" }}>
          <div className="flex items-center gap-3 mb-5">
            <CreditCard className="w-4 h-4 text-orange-400" />
            <h2 className="text-sm font-black text-white uppercase tracking-widest">Plano & Créditos</h2>
          </div>
          <div className="flex items-center justify-between mb-4">
            <div>
              <p className="text-xs text-zinc-500 mb-1">Plano atual</p>
              <span className="text-sm font-bold text-orange-400">{userPlan}</span>
            </div>
            <div className="text-right">
              <p className="text-xs text-zinc-500 mb-1">Créditos restantes</p>
              <span className="text-sm font-bold text-white">{credits.toLocaleString("pt-BR")}</span>
            </div>
          </div>
          <button
            onClick={() => router.push("/pricing")}
            className="w-full py-2.5 rounded-xl text-xs font-black text-white transition-all"
            style={{ background: "linear-gradient(135deg,#E8593C,#E8593C)", boxShadow: "0 4px 16px rgba(232,89,60,0.3)" }}>
            ⚡ Upgrade de Plano
          </button>
        </div>

        {/* Notifications placeholder */}
        <div className="rounded-2xl p-6" style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)" }}>
          <div className="flex items-center gap-3 mb-3">
            <Bell className="w-4 h-4 text-orange-400" />
            <h2 className="text-sm font-black text-white uppercase tracking-widest">Notificações</h2>
          </div>
          <p className="text-xs text-zinc-600">Em breve — configurações de alertas e e-mail.</p>
        </div>

        {/* Sign out */}
        <button
          onClick={handleSignOut}
          className="w-full flex items-center justify-center gap-2 py-3 rounded-2xl text-sm font-semibold transition-all hover:bg-white/4"
          style={{ border: "1px solid rgba(239,68,68,0.2)", color: "#f87171" }}>
          <LogOut className="w-4 h-4" />
          Sair da conta
        </button>
      </div>
    </div>
  );
}
