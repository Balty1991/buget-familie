import { describe, expect, it } from "vitest";
import { answerReviewPrompt, reviewPromptDue } from "./review-prompt";

const memory = () => { const map = new Map<string, string>(); return { getItem: (k: string) => map.get(k) ?? null, setItem: (k: string, v: string) => void map.set(k, v) }; };
const day = 86_400_000;

describe("cererea de recenzie", () => {
  it("doar pe Android, după a doua repartizare reușită și o săptămână de folosire; o singură dată", () => {
    const storage = memory();
    const start = Date.parse("2026-09-01T10:00:00Z");
    expect(reviewPromptDue(storage, 2, true, start)).toBe(false);
    expect(reviewPromptDue(storage, 2, true, start + 8 * day)).toBe(true);
    expect(reviewPromptDue(storage, 2, false, start + 8 * day)).toBe(false);
    expect(reviewPromptDue(storage, 1, true, start + 8 * day)).toBe(false);
    answerReviewPrompt(storage, "later", start + 8 * day);
    expect(reviewPromptDue(storage, 3, true, start + 30 * day)).toBe(false);
    expect(reviewPromptDue(storage, 3, true, start + 90 * day)).toBe(true);
    answerReviewPrompt(storage, "done", start + 90 * day);
    expect(reviewPromptDue(storage, 5, true, start + 400 * day)).toBe(false);
  });
});
