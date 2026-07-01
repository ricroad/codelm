import { describe, expect, test } from "vitest";
import type { KnowledgeGraph } from "@understand-anything/core/types";
import { buildLocalGeneralizeFeedback } from "./feedback";
import { buildGeneralizeCoverageSteps } from "./coverage";

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
      name: "PromptButton.tsx",
      summary: "UI 入口按钮表达用户意图。",
      tags: ["ui"],
      complexity: "simple",
    },
    {
      id: "command",
      type: "file",
      name: "commands.rs",
      summary: "命令边界负责隔离 UI 与模型调用。",
      tags: ["command"],
      complexity: "moderate",
    },
    {
      id: "asset",
      type: "file",
      name: "asset-writer.ts",
      summary: "生成成功后把结果回写到资产库。",
      tags: ["asset"],
      complexity: "moderate",
    },
  ],
  edges: [],
  layers: [
    { id: "ui", name: "UI 层", description: "", nodeIds: ["entry"] },
    { id: "runtime", name: "运行层", description: "", nodeIds: ["command", "asset"] },
  ],
  tour: [
    { order: 1, title: "入口", description: "从按钮和用户意图开始。", nodeIds: ["entry"] },
    { order: 2, title: "命令边界", description: "再看 commands 如何隔离调用。", nodeIds: ["command"] },
    { order: 3, title: "资产回写", description: "最后看生成结果写入资产。", nodeIds: ["asset"] },
  ],
};

describe("generalize coverage", () => {
  test("marks every route target as pending before the learner submits", () => {
    const steps = buildGeneralizeCoverageSteps("X", graph, null);

    expect(steps).toHaveLength(6);
    expect(steps.map((step) => step.status)).toEqual([
      "pending",
      "pending",
      "pending",
      "pending",
      "pending",
      "pending",
    ]);
  });

  test("highlights missing X scenario hops from feedback weak points", () => {
    const feedback = buildLocalGeneralizeFeedback(
      "X",
      "入口点击后进入状态任务，再经过 commands 命令边界请求模型 API。",
    );

    const steps = buildGeneralizeCoverageSteps("X", graph, feedback);

    expect(steps.map((step) => [step.label, step.status])).toEqual([
      ["入口", "covered"],
      ["状态", "covered"],
      ["命令边界", "covered"],
      ["模型调用", "covered"],
      ["资产回写", "missing"],
      ["失败状态", "missing"],
    ]);
    expect(steps.find((step) => step.label === "资产回写")?.routeNodeNames).toEqual([
      "asset-writer.ts",
    ]);
  });

  test("keeps Z teaching coverage aligned to newcomer-understanding targets", () => {
    const feedback = buildLocalGeneralizeFeedback("Z", "UI 表达意图，命令层负责安全状态。");

    const steps = buildGeneralizeCoverageSteps("Z", graph, feedback);

    expect(steps.map((step) => step.label)).toEqual([
      "UI 意图",
      "命令边界",
      "安全与状态",
      "新人复述",
    ]);
    expect(steps.find((step) => step.label === "新人复述")?.status).toBe("missing");
  });
});
