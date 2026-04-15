// ─── /privacy ── Política de Privacidade ─────────────────────────────────────
import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Política de Privacidade — Suarik",
  description: "Política de Privacidade da plataforma Suarik.",
};

export default function PrivacyPage() {
  return (
    <main className="mx-auto max-w-3xl px-6 py-16 text-[15px] leading-relaxed text-neutral-800 dark:text-neutral-200">
      <Link href="/" className="text-sm text-neutral-500 hover:text-neutral-900 dark:hover:text-white">← Voltar</Link>
      <h1 className="mt-6 mb-4 text-3xl font-semibold tracking-tight">Política de Privacidade</h1>
      <p className="text-sm text-neutral-500">Última atualização: 14 de abril de 2026</p>

      <section className="mt-8 space-y-4">
        <h2 className="text-xl font-semibold">1. Dados que coletamos</h2>
        <ul className="list-disc pl-6 space-y-1">
          <li><strong>Conta:</strong> nome, email e dados de login (OAuth Google/GitHub quando aplicável).</li>
          <li><strong>Uso:</strong> logs de requisição, créditos consumidos, ferramentas utilizadas.</li>
          <li><strong>Conteúdo:</strong> áudios, vídeos, imagens e textos que você envia para processamento.</li>
          <li><strong>Pagamento:</strong> processado pela Stripe. Não armazenamos dados de cartão.</li>
        </ul>

        <h2 className="text-xl font-semibold">2. Finalidades</h2>
        <p>Utilizamos seus dados para: operar o serviço, processar pagamentos, dar suporte, prevenir fraudes e cumprir obrigações legais. Não vendemos dados pessoais.</p>

        <h2 className="text-xl font-semibold">3. Processadores terceiros</h2>
        <p>Para executar o serviço, compartilhamos dados estritamente necessários com: Supabase (autenticação/dados), Stripe (pagamentos), OpenAI (transcrição e geração), MiniMax (TTS/clonagem de voz), Newport AI (lip-sync), Cloudflare R2 (armazenamento de mídia), Vercel (hospedagem), Upstash (rate limit).</p>

        <h2 className="text-xl font-semibold">4. Retenção</h2>
        <p>Mantemos dados enquanto sua conta estiver ativa. Após encerramento, logs de uso podem ser retidos por até 12 meses para auditoria. Conteúdo gerado é apagado em até 30 dias após exclusão da conta.</p>

        <h2 className="text-xl font-semibold">5. Seus direitos (LGPD)</h2>
        <p>Você pode: (i) acessar seus dados; (ii) corrigir dados incorretos; (iii) exportar dados em formato legível; (iv) solicitar exclusão; (v) revogar consentimentos; (vi) reclamar à ANPD. Solicite por <a className="underline" href="mailto:privacidade@suarik.com">privacidade@suarik.com</a>.</p>

        <h2 className="text-xl font-semibold">6. Clonagem de voz</h2>
        <p>Você só pode clonar vozes das quais seja titular ou tenha consentimento expresso. As amostras enviadas para clonagem são enviadas à MiniMax exclusivamente para gerar o voice_id e associadas apenas à sua conta.</p>

        <h2 className="text-xl font-semibold">7. Cookies</h2>
        <p>Utilizamos cookies essenciais de sessão para autenticação. Não utilizamos cookies de rastreamento publicitário.</p>

        <h2 className="text-xl font-semibold">8. Segurança</h2>
        <p>Adotamos TLS em todas as comunicações, Row Level Security no banco, rate limit e rotação de credenciais. Nenhum sistema é 100% seguro; em caso de incidente comunicaremos conforme a LGPD.</p>

        <h2 className="text-xl font-semibold">9. Menores</h2>
        <p>O serviço não é destinado a menores de 18 anos. Se identificarmos conta de menor, iremos encerrá-la.</p>

        <h2 className="text-xl font-semibold">10. Alterações</h2>
        <p>Mudanças materiais nesta política serão comunicadas com 30 dias de antecedência por email.</p>

        <h2 className="text-xl font-semibold">11. Encarregado</h2>
        <p>Encarregado de Proteção de Dados: <a className="underline" href="mailto:privacidade@suarik.com">privacidade@suarik.com</a>.</p>
      </section>
    </main>
  );
}
