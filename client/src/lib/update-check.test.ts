import { describe, expect, it } from "vitest";
import { isNewer, publishedBuildId } from "./update-check";

const fake = (body: unknown, ok = true) => (async () => ({ ok, json: async () => body })) as unknown as typeof fetch;

describe("versiune nouă publicată", () => {
  it("citește identificatorul din build.json", async () => {
    expect(await publishedBuildId(fake({ id: "abc123" }), "/")).toBe("abc123");
    expect(await publishedBuildId(fake({}), "/")).toBeNull();
    expect(await publishedBuildId(fake({ id: "x" }, false), "/")).toBeNull();
    expect(await publishedBuildId((async () => { throw new Error("offline"); }) as unknown as typeof fetch, "/")).toBeNull();
  });

  it("anunță doar când build-ul publicat diferă de cel care rulează", () => {
    expect(isNewer("b2", "b1")).toBe(true);
    expect(isNewer("b1", "b1")).toBe(false);
    expect(isNewer(null, "b1")).toBe(false);
    expect(isNewer("b2", "dev")).toBe(false);
  });
});
