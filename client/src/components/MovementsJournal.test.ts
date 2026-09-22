import { describe, expect, it } from "vitest";
import { revealAddedMovement } from "./MovementsJournal";

describe("registrul nu ascunde mișcarea tocmai notată", () => {
  it("deschide ziua când cheltuiala de azi nu e pe ziua selectată", () => {
    expect(revealAddedMovement({ focusDay: "2026-09-21", fromDate: "", toDate: "" }, [{ date: "2026-09-23" }])).toEqual({
      focusDay: "",
      fromDate: "",
      toDate: "",
    });
  });

  it("lasă filtrul dacă mișcarea e chiar pe ziua deschisă", () => {
    const filters = { focusDay: "2026-09-23", fromDate: "", toDate: "" };
    expect(revealAddedMovement(filters, [{ date: "2026-09-23" }])).toBe(filters);
  });

  it("dă la o parte intervalul care nu conține data noii mișcări", () => {
    expect(revealAddedMovement({ focusDay: "", fromDate: "2026-08-01", toDate: "2026-08-31" }, [{ date: "2026-09-23" }])).toEqual({
      focusDay: "",
      fromDate: "",
      toDate: "",
    });
  });
});
