import { describe, expect, test } from "vitest";
import type { KnowledgeGraph } from "@understand-anything/core/types";
import { recordMastery, createEmptyProgress } from "../progress/progress";
import { buildOverviewRouteSteps } from "./routeMap";

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
    {
      id: "entry",
      type: "file",
      name: "Entry.tsx",
      summary: "User entry.",
      tags: [],
      complexity: "simple",
    },
    {
      id: "command",
      type: "file",
      name: "commands.ts",
      summary: "Command boundary.",
      tags: [],
      complexity: "moderate",
    },
    {
      id: "model",
      type: "file",
      name: "model.ts",
      summary: "Model adapter.",
      tags: [],
      complexity: "complex",
    },
  ],
  edges: [],
  layers: [
    { id: "ui", name: "UI 层", description: "", nodeIds: ["entry"] },
    { id: "commands", name: "命令层", description: "", nodeIds: ["command", "model"] },
  ],
  tour: [
    { order: 2, title: "命令边界", description: "再看命令层。", nodeIds: ["command", "model"] },
    { order: 1, title: "入口", description: "先看入口。", nodeIds: ["entry"] },
    { order: 3, title: "空步骤", description: "没有节点时也能显示。", nodeIds: [] },
  ],
};

describe("overview route map", () => {
  test("builds ordered route steps with current, mastery, node, and layer metadata", () => {
    const progress = recordMastery(createEmptyProgress(), "entry");

    const steps = buildOverviewRouteSteps(graph, progress, 1);

    expect(steps.map((step) => step.order)).toEqual([1, 2, 3]);
    expect(steps[0]).toMatchObject({
      title: "入口",
      status: "completed",
      nodeCount: 1,
      masteredNodeCount: 1,
      firstNodeName: "Entry.tsx",
      layerNames: ["UI 层"],
    });
    expect(steps[1]).toMatchObject({
      title: "命令边界",
      status: "current",
      nodeCount: 2,
      masteredNodeCount: 0,
      firstNodeName: "commands.ts",
      layerNames: ["命令层"],
    });
    expect(steps[2]).toMatchObject({
      title: "空步骤",
      status: "upcoming",
      nodeCount: 0,
      masteredNodeCount: 0,
      firstNodeName: null,
      layerNames: [],
    });
  });
});
