import { describe, expect, test } from "vitest";
import type { KnowledgeGraph } from "@understand-anything/core/types";
import { buildTruthContextFromGraph } from "./truth";

const graph: KnowledgeGraph = {
  version: "1",
  project: {
    name: "fixture",
    languages: ["TypeScript"],
    frameworks: ["React"],
    description: "fixture graph",
    analyzedAt: "2026-06-23T06:43:22.788Z",
    gitCommitHash: "graph-sha",
  },
  nodes: [
    {
      id: "file:src/App.tsx",
      type: "file",
      name: "App.tsx",
      filePath: "src/App.tsx",
      lineRange: [2, 3],
      summary: "Renders the application shell.",
      tags: ["react", "shell"],
      complexity: "simple",
    },
    {
      id: "module:api",
      type: "module",
      name: "API Client",
      summary: "Calls backend commands.",
      tags: ["api"],
      complexity: "moderate",
    },
    {
      id: "module:router",
      type: "module",
      name: "Router",
      summary: "Routes users into the app.",
      tags: ["routing"],
      complexity: "simple",
    },
  ],
  edges: [
    {
      source: "file:src/App.tsx",
      target: "module:api",
      type: "calls",
      direction: "forward",
      description: "App calls the API client.",
      weight: 0.8,
    },
    {
      source: "module:router",
      target: "file:src/App.tsx",
      type: "depends_on",
      direction: "forward",
      description: "Router depends on the app shell.",
      weight: 0.6,
    },
  ],
  layers: [
    {
      id: "layer:ui",
      name: "UI Layer",
      description: "React user interface",
      nodeIds: ["file:src/App.tsx", "module:router"],
    },
  ],
  tour: [],
};

describe("truth context", () => {
  test("builds the node truth card from graph metadata and source lines", async () => {
    const context = await buildTruthContextFromGraph(
      graph,
      "file:src/App.tsx",
      async () => ({
        path: "src/App.tsx",
        language: "tsx",
        content: "line one\nexport function App() {\n  return <main />;\n}\n",
        sizeBytes: 56,
        lineCount: 4,
      }),
    );

    expect(context.node.name).toBe("App.tsx");
    expect(context.layer?.name).toBe("UI Layer");
    expect(context.sourceSnippet?.startLine).toBe(2);
    expect(context.sourceSnippet?.content).toContain("export function App");
    expect(context.sourceSnippet?.content).not.toContain("line one");
    expect(context.outgoingEdges[0]).toMatchObject({
      relation: "calls",
      otherNodeId: "module:api",
      otherNodeName: "API Client",
    });
    expect(context.incomingEdges[0]).toMatchObject({
      relation: "depends_on",
      otherNodeId: "module:router",
      otherNodeName: "Router",
    });
  });

  test("rejects unknown node ids", async () => {
    await expect(buildTruthContextFromGraph(graph, "missing", async () => {
      throw new Error("source should not be loaded");
    })).rejects.toThrow("Node not found");
  });
});
