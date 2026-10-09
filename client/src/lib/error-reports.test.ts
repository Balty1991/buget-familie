import { describe, expect, it } from "vitest";
import { scrubEvent, scrubText } from "./error-reports";

describe("rapoartele de erori nu duc date personale", () => {
  it("cifrele și textul dintre ghilimele ies din mesaj", () => {
    expect(scrubText("Plicul „Alimente” are 213,71 lei în S2 pe 2026-10-12")).toBe("Plicul „…” are # lei în S# pe #-#-#");
    expect(scrubText('Cannot read properties of undefined (reading "Mega Image")')).toBe("Cannot read properties of undefined (reading „…”)");
  });

  it("pașii dinaintea erorii, cererea, utilizatorul și datele în plus nu pleacă", () => {
    const event = scrubEvent({
      message: "Salariu 4270",
      exception: { values: [{ value: "Suma 165,50 nu e validă" }] },
      breadcrumbs: [{ message: "click: Cumpărături Lidl 47,30" }],
      request: { url: "https://x/?familie=27S27D" },
      user: { email: "a@b.ro" },
      extra: { data: { amount: 10 } },
      contexts: { state: { transactions: [] }, os: { name: "Android" } },
    });
    expect(event).toEqual({
      message: "Salariu #",
      exception: { values: [{ value: "Suma # nu e validă" }] },
      contexts: { os: { name: "Android" } },
    });
  });
});
