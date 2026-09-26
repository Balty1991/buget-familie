import { describe, expect, it } from "vitest";
import { answerReviewPrompt, reviewPromptDue } from "./review-prompt";

const memory = () => { const map = new Map<string, string>(); return { getItem: (k: string) => map.get(k) ?? null, setItem: (k: string, v: string) => void map.set(k, v) }; };
const day = 86_400_000;

describe("cererea de recenzie", () => {
  it("apare doar pe Android, după 3 săptămâni și 30 de mișcări; „Nu acum” amână, „Nu mai întreba” oprește", () => {
    const storage = memory();
    const start = Date.parse("2026-09-01T10:00:00Z");
    expect(reviewPromptDue(storage, 40, true, start)).toBe(false);
    expect(reviewPromptDue(storage, 40, true, start + 22 * day)).toBe(true);
    expect(reviewPromptDue(storage, 40, false, start + 22 * day)).toBe(false);
    expect(reviewPromptDue(storage, 10, true, start + 22 * day)).toBe(false);
    answerReviewPrompt(storage, "later", start + 22 * day);
    expect(reviewPromptDue(storage, 40, true, start + 30 * day)).toBe(false);
    expect(reviewPromptDue(storage, 40, true, start + 90 * day)).toBe(true);
    answerReviewPrompt(storage, "never", start + 90 * day);
    expect(reviewPromptDue(storage, 40, true, start + 400 * day)).toBe(false);
  });
});
