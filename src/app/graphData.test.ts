import { describe, expect, test } from "vitest";
import type { KnowledgeGraph } from "@understand-anything/core/types";
import { graphSummary, resolveGraphWarning } from "./graphData";

const graphFixture: KnowledgeGraph = {
  version: "1",
  project: {
    name: "storyboard-copilot",
    languages: [],
    frameworks: [],
    description: "",
    analyzedAt: "2026-06-23T06:43:22.788Z",
    gitCommitHash: "graph-sha",
  },
  nodes: [
    {
      id: "n1",
      type: "file",
      name: "A",
      summary: "",
      tags: [],
      complexity: "simple",
    },
  ],
  edges: [],
  layers: [{ id: "l1", name: "Layer", description: "", nodeIds: ["n1"] }],
  tour: [{ order: 1, title: "Start", description: "", nodeIds: ["n1"] }],
};

describe("graphData helpers", () => {
  test("summarizes graph counts for the P0 status bar", () => {
    expect(graphSummary(graphFixture)).toEqual({
      nodes: 1,
      edges: 0,
      layers: 1,
      tourSteps: 1,
    });
  });

  test("warns when graph commit and repo commit differ", () => {
    expect(resolveGraphWarning("graph-sha", "repo-sha")).toContain("graph-sha");
    expect(resolveGraphWarning("same", "same")).toBeNull();
    expect(resolveGraphWarning("same", null)).toBeNull();
  });
});
