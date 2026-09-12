import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { createEmptyAppData } from "./finance-data";

describe("alerte termen obiectiv economisire", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-09-12T08:00:00"));
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it("programează alerta pentru obiectiv cu dueDate în 3 zile", async () => {
    const { buildLocalAlerts } = await import("./local-notifications");
    const data = createEmptyAppData();
    data.savings = [{
      id: "goal-1",
      name: "Vacanță",
      current: 400,
      target: 2000,
      due: "15 septembrie",
      dueDate: "2026-09-15",
      tone: "honey",
    }];
    const alerts = buildLocalAlerts(data);
    const hit = alerts.find((item) => item.tag.startsWith("goal-due-goal-1"));
    expect(hit).toBeTruthy();
    expect(hit!.title.length).toBeGreaterThan(3);
    expect(hit!.body).toContain("Vacanță");
  });
});
