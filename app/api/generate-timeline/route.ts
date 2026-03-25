import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

// ─── System Prompt ─────────────────────────────────────────────────────────────
// This prompt simulates a senior VSL editor + art director. The key principle:
// analyze SUBTEXT, not literal meaning. "bug no sistema" → financial exploit,
// not an insect. "médicos escondendo" → authority suppression, not hiding doctors.
const SYSTEM_PROMPT = `Você é um editor sênior de VSLs e Diretor de Arte especializado em Direct Response.

Sua tarefa: quebrar o texto recebido em cenas de 3 a 5 segundos, identificar o gatilho emocional de cada trecho e gerar metadados visuais e sonoros precisos para o editor montar a timeline.

═══════════════════════════════════════════════
REGRAS OBRIGATÓRIAS
═══════════════════════════════════════════════
1. PROCESSE 100% DO TEXTO. Não pule nenhuma frase. Cada palavra deve aparecer em algum textSnippet.
2. textSnippet: trecho EXATO da copy, na ordem original, sem alterações.
3. duration: calcule baseado no tempo real de leitura em voz alta (palavras ÷ 2.8), mínimo 3.0s, máximo 5.0s. Arredonde para 1 casa decimal.
4. emotion: classifique o gatilho emocional dominante do trecho. Use EXATAMENTE um destes valores:
   Revelação · Urgência · Choque · Dor · Esperança · Oportunidade · Mistério · Gancho · CTA · Vantagem · Prova Social
5. searchQueries: TRÊS termos em inglês para busca no Pexels/Unsplash. REGRA CRÍTICA:
   - Analise o CONCEITO VISUAL, não traduza literalmente o português.
   - "bug no sistema financeiro" → ["financial system glitch hack", "money fraud digital network", "banking vulnerability exposed"] ← CORRETO
   - "bug no sistema" → ["insect system"] ← ERRADO
   - "médicos escondendo" → ["serious doctor authority portrait", "medical secret classified", "pharmaceutical suppression"] ← CORRETO
   - Termos devem ser concretos, literais e buscáveis (evite: "success", "concept", "abstract").
6. suggestedSfx: tipo de SFX ideal para o início deste corte. Use EXATAMENTE um destes valores ou null:
   "riser" · "impact" · "glitch" · "cash_register" · "heartbeat" · "bell" · "whoosh" · "tension_sting" · null

═══════════════════════════════════════════════
EXEMPLOS DE RACIOCÍNIO (SUBTEXTO)
═══════════════════════════════════════════════
"Existe um bug no sistema financeiro que faz dinheiro desaparecer"
  → emotion: "Revelação"
  → searchQueries: ["financial system fraud glitch", "money disappearing digital", "banking exploit exposed"]
  → suggestedSfx: "glitch"

"Os médicos estão pedindo para esconder essa informação"
  → emotion: "Urgência"
  → searchQueries: ["serious doctor authority figure", "medical secret forbidden", "pharmaceutical suppression"]
  → suggestedSfx: "riser"

"que destrói o mercado"
  → emotion: "Choque"
  → searchQueries: ["stock market crash red chart", "financial collapse economy", "market destruction graph"]
  → suggestedSfx: "impact"

═══════════════════════════════════════════════
FORMATO DE SAÍDA — JSON OBRIGATÓRIO
═══════════════════════════════════════════════
Retorne APENAS este JSON (sem texto fora dele):
{
  "scenes": [
    {
      "id": "drs-0",
      "textSnippet": "trecho exato da copy aqui",
      "duration": 3.6,
      "emotion": "Revelação",
      "searchQueries": ["financial system glitch", "banking fraud exposed", "money digital corruption"],
      "suggestedSfx": "glitch"
    }
  ]
}`;

// ─── POST /api/generate-timeline ─────────────────────────────────────────────
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const copy = typeof body?.copy === "string" ? body.copy.trim() : "";

    if (!copy) {
      return NextResponse.json(
        { error: "O campo 'copy' é obrigatório e não pode estar vazio." },
        { status: 400 }
      );
    }

    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      // json_object mode guarantees valid JSON output (required: "json" in prompt ✓)
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        {
          role: "user",
          content: `Quebre esta copy em cenas para a timeline de VSL:\n\n${copy}`,
        },
      ],
      temperature: 0.35, // low temperature for consistent, structured output
      max_tokens: 4096,
    });

    const raw = completion.choices[0]?.message?.content;
    if (!raw) {
      return NextResponse.json(
        { error: "A IA não retornou conteúdo. Tente novamente." },
        { status: 500 }
      );
    }

    const parsed = JSON.parse(raw);

    // Model returns { scenes: [...] } — unwrap it
    const rawScenes: unknown[] = Array.isArray(parsed)
      ? parsed
      : Array.isArray(parsed.scenes)
      ? parsed.scenes
      : // fallback: find first array value in the object
        (Object.values(parsed).find((v) => Array.isArray(v)) as unknown[] | undefined) ?? [];

    if (!rawScenes.length) {
      return NextResponse.json(
        { error: "A IA não gerou cenas. Verifique a copy e tente novamente." },
        { status: 500 }
      );
    }

    // ── Normalize + validate each scene ──────────────────────────────────────
    const VALID_EMOTIONS = new Set([
      "Revelação","Urgência","Choque","Dor","Esperança",
      "Oportunidade","Mistério","Gancho","CTA","Vantagem","Prova Social",
    ]);
    const VALID_SFX = new Set([
      "riser","impact","glitch","cash_register","heartbeat",
      "bell","whoosh","tension_sting",
    ]);

    type RawScene = Record<string, unknown>;

    const scenes = (rawScenes as RawScene[]).map((sc, i) => {
      const wordCount = String(sc.textSnippet ?? sc.text_chunk ?? sc.text ?? "")
        .trim()
        .split(/\s+/)
        .filter(Boolean).length;

      // Recalculate duration server-side as a safety net
      const calcDuration = Math.max(3.0, Math.min(5.0,
        Math.round((wordCount / 2.8) * 10) / 10
      ));

      const rawEmotion  = String(sc.emotion ?? "Gancho");
      const rawSfx      = sc.suggestedSfx ?? sc.sfx ?? null;
      const rawQueries  = Array.isArray(sc.searchQueries)
        ? sc.searchQueries
        : Array.isArray(sc.searchKeywords)
        ? sc.searchKeywords
        : [];

      return {
        id:            String(sc.id ?? `drs-${i}`),
        textSnippet:   String(sc.textSnippet ?? sc.text_chunk ?? sc.text ?? ""),
        duration:      typeof sc.duration === "number"
          ? Math.max(3.0, Math.min(5.0, sc.duration))
          : calcDuration,
        emotion:       VALID_EMOTIONS.has(rawEmotion) ? rawEmotion : "Gancho",
        searchQueries: (rawQueries as unknown[]).slice(0, 3).map(String),
        suggestedSfx:  rawSfx !== null && VALID_SFX.has(String(rawSfx))
          ? String(rawSfx)
          : null,
      };
    });

    return NextResponse.json(scenes);

  } catch (err: unknown) {
    console.error("[generate-timeline] Erro:", err);
    if (err instanceof SyntaxError) {
      return NextResponse.json(
        { error: "Erro ao processar resposta da IA (JSON inválido). Tente novamente." },
        { status: 500 }
      );
    }
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Erro interno do servidor." },
      { status: 500 }
    );
  }
}
