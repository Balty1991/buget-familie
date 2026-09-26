import { describe, expect, it } from "vitest";
import { MEMBER_COLORS, memberColor, nextMemberColor } from "./member-color";

describe("culoarea membrului", () => {
  const members = [{ id: "a", name: "Ana" }, { id: "b", name: "Bogdan", color: "#7A4FB3" }, { id: "c", name: "Cris" }];
  it("folosește culoarea aleasă sau pe cea din paletă, după loc", () => {
    expect(memberColor(members, "a")).toBe(MEMBER_COLORS[0].value);
    expect(memberColor(members, "b")).toBe("#7A4FB3");
    expect(memberColor(members, "c")).toBe(MEMBER_COLORS[2].value);
    expect(memberColor(members, "x")).toBeUndefined();
  });
  it("trece la următoarea culoare și revine la prima", () => {
    expect(nextMemberColor(MEMBER_COLORS[0].value)).toBe(MEMBER_COLORS[1].value);
    expect(nextMemberColor(MEMBER_COLORS[MEMBER_COLORS.length - 1].value)).toBe(MEMBER_COLORS[0].value);
    expect(nextMemberColor("#123456")).toBe(MEMBER_COLORS[0].value);
  });
});
