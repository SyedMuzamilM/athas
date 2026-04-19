import { describe, expect, it } from "vite-plus/test";
import { getLanguageIdFromPath } from "./language-id";

describe("getLanguageIdFromPath", () => {
  it("detects scm files as scheme", () => {
    expect(getLanguageIdFromPath("/tmp/highlights.scm")).toBe("scheme");
  });
});
