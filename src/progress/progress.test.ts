import { describe, expect, test } from "vitest";
import type { KnowledgeGraph } from "@understand-anything/core/types";
import {
  createEmptyProgress,
  progressSummary,
  recordAttempt,
  recordMastery,
  suggestWeaknessBranches,
} from "./progress";

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

  test("ignores progress entries outside the current graph", () => {
    const polluted = recordMastery(
      recordMastery(createEmptyProgress(), "old-project-node", ["旧项目薄弱点"]),
      "n1",
      ["命令层隔离"],
    );
    const summary = progressSummary(graph, polluted);

    expect(summary.masteredNodes).toBe(1);
    expect(summary.masteryPercent).toBe(50);
    expect(summary.completedTourSteps).toBe(1);
    expect(summary.weakPoints).toEqual(["命令层隔离"]);
  });

  test("suggests side branches from weak concepts and current graph nodes", () => {
    const branchGraph: KnowledgeGraph = {
      ...graph,
      nodes: [
        {
          id: "cmd",
          type: "file",
          name: "commands.ts",
          summary: "封装模型调用命令边界。",
          tags: ["commands", "命令边界"],
          complexity: "moderate",
        },
        {
          id: "ui",
          type: "file",
          name: "Canvas.tsx",
          summary: "画布 UI 入口。",
          tags: ["ui"],
          complexity: "simple",
        },
        {
          id: "mastered-command",
          type: "file",
          name: "old-command.ts",
          summary: "已经掌握的命令边界。",
          tags: ["命令边界"],
          complexity: "simple",
        },
      ],
      layers: [
        {
          id: "layer:commands",
          name: "命令适配层",
          description: "隔离 UI 和模型供应商调用。",
          nodeIds: ["cmd", "mastered-command"],
        },
      ],
    };
    const progress = recordMastery(
      recordAttempt(createEmptyProgress(), "ui", 0.4, ["命令边界"]),
      "mastered-command",
    );

    const branches = suggestWeaknessBranches(branchGraph, progress);

    expect(branches).toHaveLength(1);
    expect(branches[0].weakPoint).toBe("命令边界");
    expect(branches[0].nodeIds).toEqual(["cmd"]);
    expect(branches[0].title).toContain("命令边界");
  });

  test("grows side branches from weak attempted node dependencies", () => {
    const branchGraph: KnowledgeGraph = {
      ...graph,
      nodes: [
        { id: "ui", type: "file", name: "UI.tsx", summary: "入口。", tags: [], complexity: "simple" },
        {
          id: "api",
          type: "file",
          name: "api.ts",
          summary: "模型供应商请求。",
          tags: ["api"],
          complexity: "moderate",
        },
      ],
      edges: [
        {
          source: "ui",
          target: "api",
          type: "calls",
          direction: "forward",
          description: "UI calls API adapter.",
          weight: 0.8,
        },
      ],
    };
    const progress = recordAttempt(createEmptyProgress(), "ui", 0.25, ["关键依赖流向"]);

    const branches = suggestWeaknessBranches(branchGraph, progress);

    expect(branches).toHaveLength(1);
    expect(branches[0].weakPoint).toBe("关键依赖流向");
    expect(branches[0].nodeIds).toEqual(["api"]);
  });
});
