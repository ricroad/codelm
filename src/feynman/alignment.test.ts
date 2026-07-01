import { describe, expect, test } from "vitest";
import type { GraphNode } from "@understand-anything/core/types";
import type { TruthContext } from "./truth";
import { buildTruthChecklist, scoreTruthChecklist } from "./alignment";

const node: GraphNode = {
  id: "file:src/features/canvas/Canvas.tsx",
  type: "file",
  name: "Canvas.tsx",
  filePath: "src/features/canvas/Canvas.tsx",
  summary: "承载节点画布交互、生成流程和画布 UI。",
  tags: ["canvas", "generation"],
  complexity: "complex",
};

const truthContext: TruthContext = {
  node: {
    id: node.id,
    nodeType: node.type,
    name: node.name,
    filePath: node.filePath,
    summary: node.summary,
    tags: node.tags,
    complexity: node.complexity,
  },
  layer: {
    id: "layer:canvas",
    name: "画布创作层",
    description: "组织画布交互和生成入口。",
  },
  incomingEdges: [
    {
      relation: "depends_on",
      direction: "forward",
      description: "App shell depends on canvas.",
      weight: 0.7,
      otherNodeId: "file:src/App.tsx",
      otherNodeName: "App.tsx",
    },
  ],
  outgoingEdges: [
    {
      relation: "calls",
      direction: "forward",
      description: "Canvas calls generation command.",
      weight: 0.8,
      otherNodeId: "file:src/commands/image.ts",
      otherNodeName: "image.ts",
    },
  ],
};

describe("feynman realtime alignment", () => {
  test("builds truth checklist from node responsibility, layer, and dependency edges", () => {
    const checklist = buildTruthChecklist(node, truthContext);

    expect(checklist.map((item) => item.kind)).toEqual([
      "responsibility",
      "layer",
      "outgoing",
      "incoming",
    ]);
    expect(checklist[0].evidence).toContain("画布交互");
    expect(checklist[1].evidence).toContain("画布创作层");
    expect(checklist[2].evidence).toContain("image.ts");
    expect(checklist[3].evidence).toContain("App.tsx");
  });

  test("scores explanation against the checklist as the learner types", () => {
    const checklist = buildTruthChecklist(node, truthContext);

    const partial = scoreTruthChecklist(checklist, "它负责画布交互和生成流程。");
    expect(partial.aligned).toBe(1);
    expect(partial.total).toBe(4);
    expect(partial.items[0].aligned).toBe(true);
    expect(partial.items[1].aligned).toBe(false);

    const fuller = scoreTruthChecklist(
      checklist,
      "Canvas.tsx 负责画布交互和生成流程，属于画布创作层。它调用 image.ts 里的生成命令，入口受 App.tsx 这类上游依赖影响。",
    );
    expect(fuller.aligned).toBe(4);
    expect(fuller.percent).toBe(100);
    expect(fuller.items.every((item) => item.aligned)).toBe(true);
  });
});
