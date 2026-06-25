import { describe, expect, test } from "vitest";
import { buildSourceUrl, fallbackLanguage } from "./source";

describe("source helpers", () => {
  test("builds a browser fallback URL without leaking absolute paths", () => {
    expect(buildSourceUrl("src/features/canvas/Canvas.tsx")).toBe(
      "/file-content.json?path=src%2Ffeatures%2Fcanvas%2FCanvas.tsx",
    );
  });

  test("maps common extensions to Prism languages", () => {
    expect(fallbackLanguage("src/App.tsx")).toBe("tsx");
    expect(fallbackLanguage("README.md")).toBe("markdown");
    expect(fallbackLanguage("Dockerfile")).toBe("text");
  });
});
