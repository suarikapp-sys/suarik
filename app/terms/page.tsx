// ─── /terms ── Termos de Uso ──────────────────────────────────────────────────
import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Termos de Uso — Suarik",
  description: "Termos de Uso da plataforma Suarik.",
};

export default function TermsPage() {
  return (
    <main className="mx-auto max-w-3xl px-6 py-16 text-[15px] leading-relaxed text-neutral-800 dark:text-neutral-200">
      <Link href="/" className="text-sm text-neutral-500 hover:text-neutral-900 dark:hover:text-white">← Voltar</Link>
      <h1 className="mt-6 mb-4 text-3xl font-semibold tracking-tight">Termos de Uso</h1>
      <p className="text-sm text-neutral-500">Última atualização: 14 de abril de 2026</p>

      <section className="mt-8 space-y-4">
        <h2 className="text-xl font-semibold">1. Aceitação</h2>
        <p>Ao criar uma conta ou utilizar a Suarik, você concorda com estes Termos de Uso. Se não concorda, não utilize o serviço.</p>

        <h2 className="text-xl font-semibold">2. O serviço</h2>
        <p>A Suarik é uma plataforma de criação de conteúdo audiovisual assistida por inteligência artificial. Oferecemos ferramentas de TTS, clonagem de voz, lip-sync, animação e geração de timeline a partir de transcrições.</p>

        <h2 className="text-xl font-semibold">3. Conta e responsabilidade</h2>
        <p>Você é responsável por manter a confidencialidade das credenciais e por todas as atividades realizadas na sua conta. Informe-nos imediatamente em caso de uso não autorizado.</p>

        <h2 className="text-xl font-semibold">4. Créditos e cobrança</h2>
        <p>O uso de ferramentas consome créditos, cujo custo é exibido na interface antes da geração. Compras de crédito e assinaturas são processadas via Stripe. Créditos consumidos não são reembolsáveis salvo falha comprovada do serviço.</p>

        <h2 className="text-xl font-semibold">5. Conteúdo do usuário</h2>
        <p>Você mantém todos os direitos sobre o conteúdo que envia. Ao enviar, você nos concede licença limitada para processar o conteúdo exclusivamente para prestar o serviço. Você declara ter os direitos necessários sobre vozes, imagens e textos enviados.</p>

        <h2 className="text-xl font-semibold">6. Uso proibido</h2>
        <p>É proibido utilizar a Suarik para: clonagem de voz sem consentimento do titular, geração de deepfakes difamatórios, desinformação, violação de direitos autorais, assédio, fraude financeira ou qualquer atividade ilegal.</p>

        <h2 className="text-xl font-semibold">7. Propriedade intelectual</h2>
        <p>A plataforma, código, marca e design são de propriedade da Suarik. O conteúdo gerado pertence ao usuário, respeitadas as licenças das bibliotecas de terceiros (Pexels, Pixabay, Freesound, Jamendo).</p>

        <h2 className="text-xl font-semibold">8. Limitação de responsabilidade</h2>
        <p>O serviço é fornecido &ldquo;no estado em que se encontra&rdquo;. Não garantimos disponibilidade ininterrupta nem que o resultado atenderá a expectativa específica do usuário. Nossa responsabilidade máxima limita-se ao valor pago nos últimos 12 meses.</p>

        <h2 className="text-xl font-semibold">9. Rescisão</h2>
        <p>Podemos suspender ou encerrar contas que violem estes Termos. Você pode encerrar sua conta a qualquer momento nas configurações.</p>

        <h2 className="text-xl font-semibold">10. Alterações</h2>
        <p>Podemos atualizar estes Termos. Mudanças materiais serão comunicadas com 30 dias de antecedência por email.</p>

        <h2 className="text-xl font-semibold">11. Foro</h2>
        <p>Fica eleito o foro da comarca de São Paulo/SP para dirimir questões decorrentes destes Termos.</p>

        <h2 className="text-xl font-semibold">12. Contato</h2>
        <p>Dúvidas: <a className="underline" href="mailto:suporte@suarik.com">suporte@suarik.com</a>.</p>
      </section>
    </main>
  );
}
