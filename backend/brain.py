"""
brain.py
────────
PILLAR 1 — The Semantic Brain.

Two AI functions that turn raw text into structured visual data:

  get_visual_keywords(script_text)
      → ["keyword1", "keyword2", "keyword3"]   (3–5 English terms)

  generate_timeline_vsl(full_text)
      → [{"texto_narracao": "...", "keywords_broll": ["a","b","c"]}, ...]

LLM strategy:
  - Primary:  OpenAI gpt-4o-mini  (fast, cheap, supports json_object mode)
  - Fallback: Anthropic claude-haiku-4-5-20251001 (if no OpenAI key present)

Both keys are read from the environment (.env via python-dotenv loaded at
app startup; no load_dotenv() call here to avoid double-loading).

Error handling:
  - API errors (HTTP 4xx/5xx, timeouts) → raise BrainError with context
  - Invalid / unparseable JSON → raise BrainError so the route returns 502
  - Callers should catch BrainError and return an appropriate HTTP error.
"""

import json
import logging
import os
import re
from typing import Any, Dict, List

logger = logging.getLogger(__name__)

# ── Model config ──────────────────────────────────────────────────────────────

OPENAI_MODEL    = "gpt-4o-mini"
ANTHROPIC_MODEL = "claude-haiku-4-5-20251001"

# ── Custom exception ──────────────────────────────────────────────────────────

class BrainError(Exception):
    """
    Raised when an LLM call fails or returns unusable output.

    FastAPI routes should catch this and return HTTP 502:

        except BrainError as e:
            raise HTTPException(status_code=502, detail=str(e))
    """


# ── System prompts (exact wording per spec) ───────────────────────────────────

_KEYWORDS_SYSTEM = (
    "You are a Direct Response Video Art Director. "
    "Read the excerpt and extract 3 to 5 visual and cinematic keywords "
    "to illustrate the scene. "
    "Return ONLY the keywords, translated into ENGLISH, separated by commas."
)

_TIMELINE_SYSTEM = (
    "You are a Master Retention Video Editor. "
    "Slice this VSL script into short dynamic scenes (1 to 3 sentences). "
    "Return STRICTLY a valid JSON array of scenes. "
    "Each scene must have exactly two keys:\n"
    '  "texto_narracao"  — the exact excerpt from the script (1–3 sentences)\n'
    '  "keywords_broll"  — an array of exactly 3 cinematic search terms in English\n'
    "No markdown, no commentary — output ONLY the raw JSON array."
)


# ── Low-level LLM callers ─────────────────────────────────────────────────────

def _call_openai(system: str, user_content: str, *, json_mode: bool = False) -> str:
    """
    Call OpenAI chat completions.

    Args:
        system:       System prompt string.
        user_content: User message string.
        json_mode:    When True, forces response_format={"type":"json_object"}.
                      Only set True when the system prompt explicitly asks for JSON.

    Returns:
        Raw text content of the model response.

    Raises:
        BrainError: on any API or network error.
    """
    try:
        from openai import OpenAI, OpenAIError  # type: ignore
    except ImportError as e:
        raise BrainError("openai package not installed. Run: pip install openai") from e

    try:
        client = OpenAI(api_key=os.environ["OPENAI_API_KEY"])
        kwargs: dict[str, Any] = {
            "model":       OPENAI_MODEL,
            "temperature": 0.2,
            "max_tokens":  4096,
            "messages": [
                {"role": "system", "content": system},
                {"role": "user",   "content": user_content},
            ],
        }
        if json_mode:
            kwargs["response_format"] = {"type": "json_object"}

        res = client.chat.completions.create(**kwargs)
        return res.choices[0].message.content or ""

    except KeyError:
        raise BrainError("OPENAI_API_KEY is not set in the environment.")
    except Exception as exc:           # OpenAIError, httpx timeouts, etc.
        raise BrainError(f"OpenAI call failed: {exc}") from exc


def _call_anthropic(system: str, user_content: str) -> str:
    """
    Call Anthropic Messages API (fallback when OpenAI is unavailable).

    Anthropic does not natively support json_object mode, so JSON output
    is enforced via the system prompt wording alone.

    Returns:
        Raw text content of the model response.

    Raises:
        BrainError: on any API or network error.
    """
    try:
        import anthropic  # type: ignore
    except ImportError as e:
        raise BrainError("anthropic package not installed. Run: pip install anthropic") from e

    try:
        client = anthropic.Anthropic(api_key=os.environ["ANTHROPIC_API_KEY"])
        msg = client.messages.create(
            model=ANTHROPIC_MODEL,
            max_tokens=4096,
            system=system,
            messages=[{"role": "user", "content": user_content}],
        )
        return msg.content[0].text

    except KeyError:
        raise BrainError("ANTHROPIC_API_KEY is not set in the environment.")
    except Exception as exc:
        raise BrainError(f"Anthropic call failed: {exc}") from exc


# ── Router: OpenAI first, Anthropic fallback ──────────────────────────────────

def _call_llm(system: str, user_content: str, *, json_mode: bool = False) -> str:
    """
    Call the best available LLM.

    Tries OpenAI first (if OPENAI_API_KEY is set), then falls back to
    Anthropic (if ANTHROPIC_API_KEY is set). Raises BrainError if neither
    key is present or both calls fail.
    """
    errors: List[str] = []

    if os.environ.get("OPENAI_API_KEY"):
        try:
            return _call_openai(system, user_content, json_mode=json_mode)
        except BrainError as e:
            errors.append(f"OpenAI: {e}")
            logger.warning("OpenAI failed, trying Anthropic fallback. Error: %s", e)

    if os.environ.get("ANTHROPIC_API_KEY"):
        try:
            return _call_anthropic(system, user_content)
        except BrainError as e:
            errors.append(f"Anthropic: {e}")

    raise BrainError(
        "All LLM providers failed or no API keys configured. "
        + " | ".join(errors)
    )


# ── JSON extraction helper ────────────────────────────────────────────────────

def _parse_json_array(raw: str, context: str = "") -> list[Any]:
    """
    Parse a JSON array from a raw LLM response.

    Handles:
      - Markdown code fences (```json ... ```)
      - Models that wrap arrays in {"result": [...]} or {"scenes": [...]}
        when json_object mode forces a top-level object

    Args:
        raw:     Raw text from the LLM.
        context: Label for error messages (e.g., "timeline scenes").

    Returns:
        A Python list.

    Raises:
        BrainError: if parsing fails or result is not a list.
    """
    # Strip markdown fences
    clean = re.sub(r"^```(?:json)?\s*", "", raw.strip(), flags=re.IGNORECASE)
    clean = re.sub(r"\s*```$", "", clean.strip())

    try:
        parsed = json.loads(clean)
    except json.JSONDecodeError as exc:
        raise BrainError(
            f"LLM returned invalid JSON for {context!r}. "
            f"Parse error: {exc}. Raw (first 300 chars): {clean[:300]}"
        ) from exc

    # Unwrap {"scenes": [...]} or any single-key dict wrapping an array
    if isinstance(parsed, dict):
        for v in parsed.values():
            if isinstance(v, list):
                return v
        raise BrainError(
            f"Expected JSON array for {context!r}, got object with keys: "
            f"{list(parsed.keys())}"
        )

    if not isinstance(parsed, list):
        raise BrainError(
            f"Expected JSON array for {context!r}, got {type(parsed).__name__}."
        )

    return parsed


# ── Public API ────────────────────────────────────────────────────────────────

def get_visual_keywords(script_text: str) -> list[str]:
    """
    Art Director: extract 3–5 cinematic English keywords from a script excerpt.

    The LLM returns a plain comma-separated string (e.g. "empty wallet,
    storm clouds timelapse, frustrated woman at table"). This function
    splits, strips, and returns a Python list.

    Args:
        script_text: Any excerpt of a sales script (≥ 10 characters).

    Returns:
        List of 3–5 English keyword strings.

    Raises:
        ValueError:  script_text is empty or too short.
        BrainError:  LLM call failed or returned unusable output.

    Example:
        >>> get_visual_keywords("Você estava endividado, sem esperança...")
        ["frustrated man bills", "empty wallet macro", "storm clouds timelapse"]
    """
    if not script_text or len(script_text.strip()) < 10:
        raise ValueError("script_text must be at least 10 characters.")

    # Send only the first 600 characters — enough context, minimises token spend
    raw = _call_llm(_KEYWORDS_SYSTEM, script_text[:600])

    # Response is plain comma-separated text, not JSON
    keywords = [k.strip() for k in raw.split(",") if k.strip()]

    if not keywords:
        raise BrainError(
            f"LLM returned no keywords. Raw response: {raw[:200]!r}"
        )

    # Clamp to 5 max as a safety guard
    return keywords[:5]


def generate_timeline_vsl(full_text: str) -> list[dict[str, Any]]:
    """
    Master Editor: slice a full VSL script into timeline scenes.

    Each scene is a dict with:
      - "texto_narracao"  (str)   — 1–3 sentence excerpt from the original script
      - "keywords_broll"  (list)  — exactly 3 English B-roll search terms

    The OpenAI call uses json_object response_format to guarantee parseable
    output. The Anthropic fallback relies on strict prompt wording instead.

    Args:
        full_text: The complete VSL script (≥ 20 characters).

    Returns:
        List of scene dicts, in script order.

    Raises:
        ValueError:  full_text is empty or too short.
        BrainError:  LLM call failed, returned invalid JSON, or missing keys.

    Example:
        >>> scenes = generate_timeline_vsl("Você já se sentiu preso...")
        >>> scenes[0]
        {"texto_narracao": "Você já se sentiu preso...", "keywords_broll": ["trapped person", "dark room", "looking out window"]}
    """
    if not full_text or len(full_text.strip()) < 20:
        raise ValueError("full_text must be at least 20 characters.")

    raw = _call_llm(_TIMELINE_SYSTEM, full_text, json_mode=True)

    scenes_raw = _parse_json_array(raw, context="timeline scenes")

    # Validate and normalise each scene
    validated: List[Dict[str, Any]] = []
    for i, scene in enumerate(scenes_raw):
        if not isinstance(scene, dict):
            raise BrainError(
                f"Scene {i} is not a dict (got {type(scene).__name__}). "
                f"Raw scene: {scene!r}"
            )

        missing = [k for k in ("texto_narracao", "keywords_broll") if k not in scene]
        if missing:
            raise BrainError(
                f"Scene {i} is missing required keys {missing}. "
                f"Got keys: {list(scene.keys())}"
            )

        broll = scene["keywords_broll"]
        if not isinstance(broll, list) or len(broll) == 0:
            raise BrainError(
                f"Scene {i} has invalid keywords_broll: {broll!r}. "
                "Expected a non-empty list."
            )

        validated.append({
            "texto_narracao": str(scene["texto_narracao"]).strip(),
            "keywords_broll": [str(k).strip() for k in broll[:3]],
        })

    if not validated:
        raise BrainError("LLM returned an empty scene list.")

    logger.info("generate_timeline_vsl: %d scenes generated.", len(validated))
    return validated
