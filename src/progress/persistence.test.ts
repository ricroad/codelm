import { describe, expect, test } from "vitest";
import { normalizeProgress } from "./persistence";

describe("progress persistence", () => {
  test("falls back to empty progress for invalid stored data", () => {
    expect(normalizeProgress(null)).toEqual({ nodes: {}, streakDays: 1 });
    expect(normalizeProgress({ nodes: [] })).toEqual({ nodes: {}, streakDays: 1 });
  });

  test("keeps valid node progress values", () => {
    const progress = normalizeProgress({
      streakDays: 4,
      nodes: {
        "file:src/App.tsx": {
          attempts: 2,
          bestConvergence: 0.75,
          status: "attempted",
          weakConcepts: ["关键依赖流向"],
        },
      },
    });

    expect(progress.streakDays).toBe(4);
    expect(progress.nodes["file:src/App.tsx"].attempts).toBe(2);
    expect(progress.nodes["file:src/App.tsx"].weakConcepts).toEqual(["关键依赖流向"]);
  });
});
