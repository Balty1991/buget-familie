import { describe, expect, it } from "vitest";
import { notifyKindOf, readNotifyPrefs } from "./notify-prefs";

describe("preferințele notificărilor", () => {
  it("pune fiecare alertă la felul ei", () => {
    expect(notifyKindOf("due-internet")).toBe("bills");
    expect(notifyKindOf("debt-d1-2026-10-10")).toBe("bills");
    expect(notifyKindOf("env-warn-a1")).toBe("envelopes");
    expect(notifyKindOf("pace-over-plan")).toBe("envelopes");
    expect(notifyKindOf("payday-eve-2026-10-18")).toBe("income");
    expect(notifyKindOf("goal-due-s1-2027-07-09")).toBe("goals");
    expect(notifyKindOf("month-card-2026-10")).toBe("summaries");
    expect(notifyKindOf("checkin-2026-10-02")).toBe("checkin");
  });

  it("citește doar valori cunoscute, cu ora între 17 și 23", () => {
    const store = (value: unknown) => ({ getItem: () => JSON.stringify(value) });
    expect(readNotifyPrefs(store({ off: ["checkin", "spam"], eveningHour: 21 }))).toEqual({ off: ["checkin"], eveningHour: 21 });
    expect(readNotifyPrefs(store({ eveningHour: 3 }))).toEqual({ off: [], eveningHour: 20 });
    expect(readNotifyPrefs({ getItem: () => "{nu e json" })).toEqual({ off: [], eveningHour: 20 });
  });
});
