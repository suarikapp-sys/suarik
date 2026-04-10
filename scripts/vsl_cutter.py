"""
VSL Reader & Cutter — generates a structured timeline from a long sales script.

Usage:
    python vsl_cutter.py                    # runs built-in test copy
    python vsl_cutter.py script.txt         # reads copy from a .txt file

Requires ONE of:
    pip install anthropic          (uses claude-haiku-4-5  — cheapest/fastest)
    pip install openai             (uses gpt-3.5-turbo     — fallback)

Set env vars:
    ANTHROPIC_API_KEY=sk-ant-...
    OPENAI_API_KEY=sk-...          (only needed if Anthropic not available)
"""

import json
import os
import re
import sys
import textwrap
from typing import Any

# ── Model config ──────────────────────────────────────────────────────────────
ANTHROPIC_MODEL = "claude-haiku-4-5-20251001"   # cheapest Claude as of 2026
OPENAI_MODEL    = "gpt-3.5-turbo"

SYSTEM_PROMPT = """\
You are a Master Editor of Direct Response videos.
Your task is to take a long sales script and slice it into a sequence of dynamic scenes.
Each scene should have between 1 and 3 sentences, focusing on the rhythm of retention.

Rules:
- Cover 100% of the narration text — do NOT skip or summarise any part.
- Each scene must be self-contained: a viewer must understand it without context.
- keywords_broll must be 3 ENGLISH words/phrases, cinematic and Pexels-searchable.
- Return ONLY a valid JSON array. No markdown, no commentary, no extra keys.

Output format (strict):
[
  {
    "narration_text": "<exact excerpt from the script>",
    "keywords_broll": ["keyword1", "keyword2", "keyword3"]
  },
  ...
]
"""

# ── Test copy (VSL sample) ────────────────────────────────────────────────────
TEST_COPY = """\
O que vou te mostrar nos próximos minutos pode mudar completamente a forma como você ganha dinheiro online.
Eu sei que parece mais uma promessa vazia. Mas fique comigo, porque o que descobri não tem nada a ver com cursos,
pirâmides ou qualquer coisa que você já tenha visto antes.

Meu nome é Rafael, e há 18 meses eu estava completamente endividado.
Cartão no limite, aluguel atrasado, e uma sensação constante de que o chão ia desabar a qualquer momento.
Foi nesse ponto que um amigo me mostrou um método que eu nunca tinha ouvido falar.

Nas primeiras duas semanas, gerei R$ 4.200 reais sem sair de casa.
No segundo mês, esse número chegou a R$ 11.000 reais.
E hoje, consistentemente, fecho entre R$ 20 e R$ 30 mil mensais.

O segredo está numa brecha no mercado digital que 97% das pessoas simplesmente ignoram.
Não é copywriting, não é dropshipping, não é gestão de tráfego.
É algo muito mais simples — e muito mais poderoso.

Nos próximos minutos, vou te mostrar exatamente como funciona, passo a passo.
Tudo que você precisa é de um celular e 2 horas por semana.
Se você aplicar o que vou ensinar, os resultados podem aparecer em menos de 7 dias.

Mas eu preciso que você assista até o final.
Porque a parte mais importante vem lá na frente — e sem ela, o método não funciona.
Então segura comigo. Vale muito a pena.
"""


# ── LLM caller — tries Anthropic first, falls back to OpenAI ─────────────────

def _call_anthropic(text: str) -> str:
    import anthropic  # type: ignore
    client = anthropic.Anthropic(api_key=os.environ["ANTHROPIC_API_KEY"])
    msg = client.messages.create(
        model=ANTHROPIC_MODEL,
        max_tokens=4096,
        system=SYSTEM_PROMPT,
        messages=[{"role": "user", "content": text}],
    )
    return msg.content[0].text


def _call_openai(text: str) -> str:
    from openai import OpenAI  # type: ignore
    client = OpenAI(api_key=os.environ["OPENAI_API_KEY"])
    resp = client.chat.completions.create(
        model=OPENAI_MODEL,
        messages=[
            {"role": "system", "content": SYSTEM_PROMPT},
            {"role": "user",   "content": text},
        ],
        temperature=0.4,
    )
    return resp.choices[0].message.content


def _call_llm(text: str) -> str:
    """Try Anthropic, then OpenAI. Raise if neither key is set."""
    if os.environ.get("ANTHROPIC_API_KEY"):
        try:
            return _call_anthropic(text)
        except ImportError:
            print("  [warn] 'anthropic' package not installed — trying OpenAI…")

    if os.environ.get("OPENAI_API_KEY"):
        try:
            return _call_openai(text)
        except ImportError:
            pass

    raise EnvironmentError(
        "No LLM available.\n"
        "Set ANTHROPIC_API_KEY (and run: pip install anthropic)\n"
        "or   OPENAI_API_KEY   (and run: pip install openai)"
    )


# ── JSON extractor (handles models that wrap output in markdown) ──────────────

def _extract_json(raw: str) -> list[dict[str, Any]]:
    """Strip markdown fences and parse the JSON array."""
    # Remove ```json ... ``` or ``` ... ``` wrappers if present
    clean = re.sub(r"^```(?:json)?\s*", "", raw.strip(), flags=re.IGNORECASE)
    clean = re.sub(r"\s*```$", "", clean.strip())
    return json.loads(clean)


# ── Main public function ──────────────────────────────────────────────────────

def generate_timeline_vsl(full_text: str) -> list[dict[str, Any]]:
    """
    Send full_text to an LLM and return a list of timeline scene dicts:
        [
          {
            "narration_text":  str,
            "keywords_broll":  [str, str, str]
          },
          ...
        ]
    Raises ValueError if the LLM response is not valid JSON.
    """
    print(f"\n⚙  Sending {len(full_text)} chars to LLM ({ANTHROPIC_MODEL})…")
    raw = _call_llm(full_text)

    try:
        scenes = _extract_json(raw)
    except json.JSONDecodeError as e:
        raise ValueError(f"LLM returned invalid JSON:\n{raw}\n\nError: {e}") from e

    if not isinstance(scenes, list):
        raise ValueError(f"Expected JSON array, got {type(scenes).__name__}")

    for i, s in enumerate(scenes):
        if "narration_text" not in s or "keywords_broll" not in s:
            raise ValueError(f"Scene {i} is missing required keys: {s}")

    return scenes


# ── Pretty printer ────────────────────────────────────────────────────────────
COLORS = {
    "reset":  "\033[0m",
    "bold":   "\033[1m",
    "cyan":   "\033[96m",
    "yellow": "\033[93m",
    "green":  "\033[92m",
    "gray":   "\033[90m",
}

def _c(color: str, text: str) -> str:
    return f"{COLORS.get(color, '')}{text}{COLORS['reset']}"


def print_timeline(scenes: list[dict[str, Any]]) -> None:
    total = len(scenes)
    print()
    print(_c("bold", f"{'━' * 62}"))
    print(_c("bold", f"  TIMELINE — {total} scenes generated"))
    print(_c("bold", f"{'━' * 62}"))

    for i, scene in enumerate(scenes, 1):
        narration = scene["narration_text"]
        broll     = scene.get("keywords_broll", [])

        print()
        print(_c("cyan", f"  ┌─ SCENE {i:02d}/{total:02d} ─────────────────────────────────"))
        # Wrap long narration text
        wrapped = textwrap.fill(narration, width=56, initial_indent="  │  ", subsequent_indent="  │  ")
        print(_c("yellow", wrapped))
        print(_c("green",  f"  │  B-roll → {' · '.join(broll)}"))
        print(_c("gray",   f"  └────────────────────────────────────────────────"))

    print()
    print(_c("bold", f"  ✓ {total} scenes ready for the Front-end timeline."))
    print()


# ── JSON export helper (for Next.js consumption) ──────────────────────────────

def export_json(scenes: list[dict[str, Any]], path: str = "timeline.json") -> None:
    with open(path, "w", encoding="utf-8") as f:
        json.dump(scenes, f, ensure_ascii=False, indent=2)
    print(_c("gray", f"  → Exported to {path}"))


# ── CLI entry point ───────────────────────────────────────────────────────────

if __name__ == "__main__":
    if len(sys.argv) > 1:
        filepath = sys.argv[1]
        with open(filepath, encoding="utf-8") as f:
            copy = f.read()
        print(f"  Reading copy from: {filepath}")
    else:
        copy = TEST_COPY
        print("  Using built-in test copy (VSL sample).")

    scenes = generate_timeline_vsl(copy)
    print_timeline(scenes)
    export_json(scenes)
