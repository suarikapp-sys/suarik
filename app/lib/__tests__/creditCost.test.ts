import { describe, it, expect } from "vitest";
import { computeCost } from "../creditCost";

describe("computeCost — TTS", () => {
  it("charges minimum 2 credits for very short texts", () => {
    expect(computeCost("tts", { chars: 0   })).toBe(2);
    expect(computeCost("tts", { chars: 1   })).toBe(2);
    expect(computeCost("tts", { chars: 499 })).toBe(2);
  });

  it("charges 1 credit per 500 chars (min 2)", () => {
    // ceil(500/500)=1 → max(2,1)=2 (minimum applies)
    expect(computeCost("tts", { chars: 500  })).toBe(2);
    expect(computeCost("tts", { chars: 1000 })).toBe(2);   // ceil(1000/500)=2
    expect(computeCost("tts", { chars: 1001 })).toBe(3);   // ceil(1001/500)=3
    expect(computeCost("tts", { chars: 1500 })).toBe(3);
    expect(computeCost("tts", { chars: 5000 })).toBe(10);
  });

  it("caps at 30 credits for very long texts", () => {
    expect(computeCost("tts", { chars: 15000 })).toBe(30);
    expect(computeCost("tts", { chars: 99999 })).toBe(30);
  });

  it("works without meta (defaults to 0 chars → 2 credits)", () => {
    expect(computeCost("tts")).toBe(2);
  });
});

describe("computeCost — Music", () => {
  it("charges minimum 5 credits", () => {
    expect(computeCost("music", { duration: 0  })).toBe(5);
    expect(computeCost("music", { duration: 5  })).toBe(5);  // ceil(5/10)*3 = 3, max(5,3) = 5
  });

  it("charges 3 credits per 10 seconds (min 5)", () => {
    // ceil(10/10)*3=3 → max(5,3)=5 (minimum applies)
    expect(computeCost("music", { duration: 10 })).toBe(5);
    // ceil(20/10)*3=6 → max(5,6)=6
    expect(computeCost("music", { duration: 20 })).toBe(6);
    expect(computeCost("music", { duration: 30 })).toBe(9);
    expect(computeCost("music", { duration: 60 })).toBe(18);
  });

  it("defaults to 30s when no duration provided", () => {
    expect(computeCost("music")).toBe(9);
  });
});

describe("computeCost — Static tools", () => {
  it("returns correct static costs", () => {
    expect(computeCost("sfx")).toBe(5);
    expect(computeCost("storyboard")).toBe(20);
    expect(computeCost("lipsync")).toBe(50);
    expect(computeCost("voiceclone")).toBe(30);
    expect(computeCost("timeline")).toBe(3);
    expect(computeCost("dreamact")).toBe(45);
    expect(computeCost("videotranslate")).toBe(60);
  });

  it("returns 10 credits for unknown actions", () => {
    expect(computeCost("unknown_tool")).toBe(10);
    expect(computeCost("")).toBe(10);
  });
});
