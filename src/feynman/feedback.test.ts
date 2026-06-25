import { describe, expect, test } from "vitest";
import type { GraphNode } from "@understand-anything/core/types";
import { buildLocalFeynmanFeedback } from "./feedback";

const node: GraphNode = {
  id: "file:src/features/canvas/Canvas.tsx",
  type: "file",
  name: "Canvas.tsx",
  filePath: "src/features/canvas/Canvas.tsx",
  summary: "承载节点画布交互、生成流程和画布 UI。",
  tags: ["canvas", "generation"],
  complexity: "complex",
};

describe("feedback", () => {
  test("creates design-shaped feedback before the Claude API is wired", () => {
    const feedback = buildLocalFeynmanFeedback(node, "它负责画布交互和生成流程。");

    expect(feedback.verdict).toContain("基本到位");
    expect(feedback.convergence.total).toBeGreaterThan(0);
    expect(feedback.points.map((point) => point.kind)).toContain("hit");
    expect(feedback.followUp.question).toContain("依赖");
    expect(feedback.weakPoints.length).toBeGreaterThan(0);
  });
});
