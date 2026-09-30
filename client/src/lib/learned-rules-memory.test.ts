import { describe, expect, it, vi } from "vitest";

const store = new Map<string, string>();
const events: string[] = [];
vi.stubGlobal("window", {
  localStorage: { getItem: (k: string) => store.get(k) ?? null, setItem: (k: string, v: string) => void store.set(k, v), removeItem: (k: string) => void store.delete(k) },
  dispatchEvent: (event: Event) => { events.push(event.type); return true; },
});

const { forgetHabit, forgetPhrase, GUIDE_MEMORY_EVENT, readGuideMemory, writeGuideMemory } = await import("./learned-rules");

const learned = [{ shape: "am facut # la tombola", kind: "income" as const, title: "Tombolă", count: 1, lastAt: "2026-09-20T10:00:00Z" }];
const phrases = [{ key: "cafea", title: "Cafea", category: "Băuturi", count: 3, lastAt: "2026-09-20T10:00:00Z" }];

describe("memoria ghidului, din Setări", () => {
  it("uitarea unui obicei păstrează frazele învățate", () => {
    store.set("buget-familie:ai-memory-v1", JSON.stringify({ phrases, skippedOnline: 0, learned }));
    writeGuideMemory(forgetHabit(readGuideMemory(), "cafea"));
    const after = JSON.parse(store.get("buget-familie:ai-memory-v1") || "{}");
    expect(after.phrases).toEqual([]);
    expect(after.learned).toHaveLength(1);
    expect(events).toContain(GUIDE_MEMORY_EVENT);
  });

  it("o frază învățată se poate uita", () => {
    expect(forgetPhrase({ phrases, skippedOnline: 0, learned }, "am facut # la tombola").learned).toEqual([]);
  });
});
