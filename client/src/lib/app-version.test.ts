import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { APP_VERSION, APP_VERSION_CODE } from "./app-version";

const read = (path: string) => readFileSync(fileURLToPath(new URL(path, import.meta.url)), "utf8");

describe("versiunea aplicației", () => {
  it("e aceeași în aplicație, package.json și build.gradle", () => {
    const gradle = read("../../../android/app/build.gradle");
    expect(JSON.parse(read("../../../package.json")).version).toBe(APP_VERSION);
    expect(gradle).toContain(`versionName "${APP_VERSION}"`);
    expect(gradle).toMatch(new RegExp(`versionCode ${APP_VERSION_CODE}\\b`));
  });
});
