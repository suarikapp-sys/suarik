// ─── Transactional email helpers via Resend ──────────────────────────────────
// Requires RESEND_API_KEY in env vars.
// All functions are fire-and-forget — never throw, never block critical paths.

import { Resend } from "resend";

const FROM = "SUARIK <noreply@suarik.com.br>";

// Lazy — instanciado apenas quando RESEND_API_KEY estiver presente,
// evita crash no build quando a variável não está definida.
function getResend(): Resend {
  return new Resend(process.env.RESEND_API_KEY!);
}

// ── Welcome email (sent on first sign-up) ────────────────────────────────────
export async function sendWelcomeEmail(to: string, name?: string) {
  if (!process.env.RESEND_API_KEY) return;
  const firstName = (name ?? to.split("@")[0]).split(" ")[0];
  try {
    await getResend().emails.send({
      from:    FROM,
      to,
      subject: "🎬 Bem-vindo ao SUARIK — comece em 60 segundos",
      html: `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"/><meta name="viewport" content="width=device-width"/></head>
<body style="margin:0;padding:0;background:#0a0a0a;font-family:'Helvetica Neue',Arial,sans-serif;">
  <div style="max-width:560px;margin:0 auto;padding:40px 24px;">

    <!-- Logo -->
    <div style="display:flex;align-items:center;gap:10px;margin-bottom:32px;">
      <div style="width:36px;height:36px;border-radius:9px;background:#F0563A;display:inline-flex;align-items:center;justify-content:center;font-weight:900;color:#fff;font-size:18px;">S</div>
      <span style="font-size:18px;font-weight:900;color:#fff;letter-spacing:-0.5px;">SUARIK</span>
    </div>

    <!-- Hero -->
    <h1 style="font-size:26px;font-weight:900;color:#fff;margin:0 0 12px;letter-spacing:-0.5px;">
      Olá, ${firstName}! Sua conta está pronta 🚀
    </h1>
    <p style="font-size:15px;color:#888;line-height:1.7;margin:0 0 28px;">
      O SUARIK transforma sua copy em storyboards profissionais com B-rolls, legendas e música — tudo em segundos.
    </p>

    <!-- Steps -->
    <div style="background:#111;border:1px solid rgba(255,255,255,0.07);border-radius:14px;padding:24px;margin-bottom:28px;">
      <p style="font-size:11px;font-weight:700;color:#555;text-transform:uppercase;letter-spacing:1.5px;margin:0 0 16px;">3 passos para sua primeira edição</p>
      ${["Cole sua copy ou script de venda", "IA gera cenas, B-rolls e música automaticamente", "Exporte para Premiere, DaVinci ou CapCut"].map((step, i) => `
      <div style="display:flex;gap:12px;align-items:flex-start;margin-bottom:${i < 2 ? "12px" : "0"};">
        <div style="width:24px;height:24px;border-radius:6px;background:rgba(240,86,58,0.15);border:1px solid rgba(240,86,58,0.3);display:inline-flex;align-items:center;justify-content:center;font-size:11px;font-weight:800;color:#F0563A;flex-shrink:0;">${i+1}</div>
        <p style="font-size:13px;color:#ccc;margin:4px 0 0;">${step}</p>
      </div>`).join("")}
    </div>

    <!-- CTA -->
    <a href="https://suarik.com.br/storyboard"
      style="display:block;text-align:center;padding:14px 0;border-radius:12px;background:linear-gradient(135deg,#F0563A,#c44527);color:#fff;font-size:15px;font-weight:800;text-decoration:none;letter-spacing:-0.3px;">
      🎬 Criar meu primeiro storyboard
    </a>

    <!-- Footer -->
    <p style="font-size:11px;color:#333;text-align:center;margin-top:32px;line-height:1.6;">
      Você está recebendo este e-mail porque criou uma conta no SUARIK.<br/>
      <a href="https://suarik.com.br" style="color:#555;text-decoration:none;">suarik.com.br</a>
    </p>
  </div>
</body>
</html>`,
    });
  } catch (e) {
    console.error("[email] Welcome email failed:", e);
  }
}

// ── Payment confirmation (topup) ─────────────────────────────────────────────
export async function sendTopupEmail(to: string, name: string | undefined, credits: number, amount: string) {
  if (!process.env.RESEND_API_KEY) return;
  const firstName = (name ?? to.split("@")[0]).split(" ")[0];
  try {
    await getResend().emails.send({
      from:    FROM,
      to,
      subject: `✅ ${credits.toLocaleString("pt-BR")} créditos adicionados à sua conta`,
      html: `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"/></head>
<body style="margin:0;padding:0;background:#0a0a0a;font-family:'Helvetica Neue',Arial,sans-serif;">
  <div style="max-width:560px;margin:0 auto;padding:40px 24px;">
    <div style="display:flex;align-items:center;gap:10px;margin-bottom:32px;">
      <div style="width:36px;height:36px;border-radius:9px;background:#F0563A;display:inline-flex;align-items:center;justify-content:center;font-weight:900;color:#fff;font-size:18px;">S</div>
      <span style="font-size:18px;font-weight:900;color:#fff;letter-spacing:-0.5px;">SUARIK</span>
    </div>
    <h1 style="font-size:24px;font-weight:900;color:#fff;margin:0 0 8px;">Pagamento confirmado ✅</h1>
    <p style="font-size:15px;color:#888;margin:0 0 28px;">Olá, ${firstName}! Seus créditos foram adicionados.</p>
    <div style="background:#111;border:1px solid rgba(52,211,153,0.2);border-radius:14px;padding:24px;margin-bottom:28px;text-align:center;">
      <p style="font-size:13px;color:#555;margin:0 0 6px;text-transform:uppercase;letter-spacing:1px;">Créditos adicionados</p>
      <p style="font-size:42px;font-weight:900;color:#34d399;margin:0;letter-spacing:-1px;">${credits.toLocaleString("pt-BR")}</p>
      <p style="font-size:12px;color:#444;margin:8px 0 0;">Valor pago: ${amount}</p>
    </div>
    <a href="https://suarik.com.br/storyboard"
      style="display:block;text-align:center;padding:14px 0;border-radius:12px;background:linear-gradient(135deg,#F0563A,#c44527);color:#fff;font-size:15px;font-weight:800;text-decoration:none;">
      🚀 Usar créditos agora
    </a>
    <p style="font-size:11px;color:#333;text-align:center;margin-top:32px;">
      Dúvidas? <a href="mailto:suporte@suarik.com.br" style="color:#555;">suporte@suarik.com.br</a>
    </p>
  </div>
</body>
</html>`,
    });
  } catch (e) {
    console.error("[email] Topup email failed:", e);
  }
}

// ── Subscription activated ───────────────────────────────────────────────────
export async function sendSubscriptionEmail(to: string, name: string | undefined, plan: string, credits: number) {
  if (!process.env.RESEND_API_KEY) return;
  const firstName = (name ?? to.split("@")[0]).split(" ")[0];
  const planLabel = ({ starter:"Starter", pro:"Pro", growth:"Growth", enterprise:"Enterprise" } as Record<string,string>)[plan] ?? plan;
  try {
    await getResend().emails.send({
      from:    FROM,
      to,
      subject: `🎉 Plano ${planLabel} ativado — bem-vindo ao SUARIK Pro!`,
      html: `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"/></head>
<body style="margin:0;padding:0;background:#0a0a0a;font-family:'Helvetica Neue',Arial,sans-serif;">
  <div style="max-width:560px;margin:0 auto;padding:40px 24px;">
    <div style="display:flex;align-items:center;gap:10px;margin-bottom:32px;">
      <div style="width:36px;height:36px;border-radius:9px;background:#F0563A;display:inline-flex;align-items:center;justify-content:center;font-weight:900;color:#fff;font-size:18px;">S</div>
      <span style="font-size:18px;font-weight:900;color:#fff;letter-spacing:-0.5px;">SUARIK</span>
    </div>
    <h1 style="font-size:24px;font-weight:900;color:#fff;margin:0 0 8px;">Plano ${planLabel} ativado 🎉</h1>
    <p style="font-size:15px;color:#888;margin:0 0 28px;">Olá, ${firstName}! Sua assinatura está ativa.</p>
    <div style="background:#111;border:1px solid rgba(240,86,58,0.2);border-radius:14px;padding:24px;margin-bottom:28px;">
      <div style="display:flex;justify-content:space-between;margin-bottom:12px;">
        <span style="font-size:13px;color:#555;">Plano</span>
        <span style="font-size:13px;color:#F0563A;font-weight:700;">${planLabel}</span>
      </div>
      <div style="display:flex;justify-content:space-between;border-top:1px solid rgba(255,255,255,0.05);padding-top:12px;">
        <span style="font-size:13px;color:#555;">Créditos mensais</span>
        <span style="font-size:13px;color:#fff;font-weight:700;">${credits.toLocaleString("pt-BR")}</span>
      </div>
    </div>
    <a href="https://suarik.com.br/storyboard"
      style="display:block;text-align:center;padding:14px 0;border-radius:12px;background:linear-gradient(135deg,#F0563A,#c44527);color:#fff;font-size:15px;font-weight:800;text-decoration:none;">
      🎬 Começar a criar
    </a>
    <p style="font-size:11px;color:#333;text-align:center;margin-top:32px;">
      Gerencie sua assinatura em <a href="https://suarik.com.br/settings" style="color:#555;">suarik.com.br/settings</a>
    </p>
  </div>
</body>
</html>`,
    });
  } catch (e) {
    console.error("[email] Subscription email failed:", e);
  }
}
