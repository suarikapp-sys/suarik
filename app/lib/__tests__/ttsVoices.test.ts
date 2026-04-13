import { describe, it, expect } from "vitest";
import { TTS_VOICES } from "../ttsVoices";

describe("TTS_VOICES", () => {
  it("has at least 20 confirmed voices", () => {
    expect(TTS_VOICES.length).toBeGreaterThanOrEqual(20);
  });

  it("every voice has id, label, lang and gender", () => {
    for (const v of TTS_VOICES) {
      expect(v.id,     `voice ${v.id} missing id`).toBeTruthy();
      expect(v.label,  `voice ${v.id} missing label`).toBeTruthy();
      expect(v.lang,   `voice ${v.id} missing lang`).toBeTruthy();
      expect(v.gender, `voice ${v.id} missing gender`).toMatch(/^[MF]$/);
    }
  });

  it("has no duplicate voice IDs", () => {
    const ids = TTS_VOICES.map(v => v.id);
    const unique = new Set(ids);
    expect(unique.size).toBe(ids.length);
  });

  it("has Portuguese voices (PT)", () => {
    const ptVoices = TTS_VOICES.filter(v => v.lang === "PT");
    expect(ptVoices.length).toBeGreaterThanOrEqual(4);
  });

  it("has English voices (EN)", () => {
    const enVoices = TTS_VOICES.filter(v => v.lang === "EN");
    expect(enVoices.length).toBeGreaterThanOrEqual(4);
  });

  it("lang codes are valid ISO 639-1", () => {
    const valid = ["PT", "EN", "ES", "FR", "DE", "JA", "KO", "ZH", "AR"];
    for (const v of TTS_VOICES) {
      expect(valid, `unknown lang ${v.lang}`).toContain(v.lang);
    }
  });
});
