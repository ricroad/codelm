import { describe, expect, test } from "vitest";
import type { KnowledgeGraph } from "@understand-anything/core/types";
import { createEmptyProgress, progressSummary, recordMastery } from "./progress";

const graph: KnowledgeGraph = {
  version: "1",
  project: {
    name: "fixture",
    languages: [],
    frameworks: [],
    description: "",
    analyzedAt: "2026-06-23T06:43:22.788Z",
    gitCommitHash: "sha",
  },
  nodes: [
    { id: "n1", type: "file", name: "A", summary: "", tags: [], complexity: "simple" },
    { id: "n2", type: "file", name: "B", summary: "", tags: [], complexity: "simple" },
  ],
  edges: [],
  layers: [],
  tour: [
    { order: 1, title: "One", description: "", nodeIds: ["n1"] },
    { order: 2, title: "Two", description: "", nodeIds: ["n2"] },
  ],
};

describe("progress", () => {
  test("summarizes mastery and weak points", () => {
    const initial = createEmptyProgress();
    const first = recordMastery(initial, "n1", ["命令层隔离"]);
    const summary = progressSummary(graph, first);

    expect(summary.masteredNodes).toBe(1);
    expect(summary.masteryPercent).toBe(50);
    expect(summary.completedTourSteps).toBe(1);
    expect(summary.weakPoints).toEqual(["命令层隔离"]);
  });
});
