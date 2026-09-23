import { describe, expect, it } from "vitest";
import { weekdayShortLabels } from "./civil-weekday";

describe("zilele grilei, independent de fus", () => {
  it("începe lunea și în limba română, și în engleză", () => {
    const ro = weekdayShortLabels("ro-RO").map((label) => label.toLocaleLowerCase("ro-RO"));
    expect(ro[0]).toMatch(/lun/);
    expect(ro[6]).toMatch(/dum/);
    expect(weekdayShortLabels("en-US")[0]).toMatch(/Mon/i);
    expect(weekdayShortLabels("en-US")[6]).toMatch(/Sun/i);
  });

  it("nu folosește miezul nopții UTC, care în Los Angeles e încă duminică", () => {
    const sundayInLosAngeles = new Intl.DateTimeFormat("en-US", {
      weekday: "short",
      timeZone: "America/Los_Angeles",
    }).format(new Date(Date.UTC(2024, 0, 1)));
    expect(sundayInLosAngeles).toMatch(/Sun/i);
    expect(weekdayShortLabels("en-US")[0]).not.toBe(sundayInLosAngeles);
  });
});
