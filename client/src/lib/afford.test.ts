import { describe, expect, it } from "vitest";
import { buildDemoData } from "./demo-data";
import { affordCheck } from "./afford";

describe("îmi permit?", () => {
  const today = "2026-10-02";
  const data = buildDemoData(today);

  it("fără sumă nu răspunde", () => {
    expect(affordCheck(data, 0, undefined, today)).toBeUndefined();
  });

  it("din plic: da cât încape, strâmt când trece în banii liberi, nu peste ei", () => {
    const small = affordCheck(data, 20, "a-timp", today)!;
    expect(small.tone).toBe("yes");
    expect(small.envelope).toMatchObject({ label: "Timp liber" });
    expect(small.envelope!.after).toBe(Math.round((small.envelope!.before - 20) * 100) / 100);
    const huge = affordCheck(data, 50_000, "a-timp", today)!;
    expect(huge.tone).toBe("no");
  });

  it("arată cât din drumul spre primul obiectiv ar costa", () => {
    const answer = affordCheck(data, 500, undefined, today)!;
    expect(answer.goal?.name).toBe("Vacanță la mare");
    expect(answer.goal!.weeks).toBeGreaterThan(0);
  });
});
