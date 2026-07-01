import type { KnowledgeGraph } from "@understand-anything/core/types";
import type { LearningProgress } from "../progress/progress";

export type OverviewRouteStatus = "completed" | "current" | "upcoming";

export interface OverviewRouteStep {
  order: number;
  title: string;
  description: string;
  nodeIds: string[];
  nodeCount: number;
  masteredNodeCount: number;
  firstNodeName: string | null;
  layerNames: string[];
  status: OverviewRouteStatus;
}

export function buildOverviewRouteSteps(
  graph: KnowledgeGraph,
  progress: LearningProgress,
  currentTourStep: number,
): OverviewRouteStep[] {
  const masteredNodeIds = new Set(
    Object.entries(progress.nodes)
      .filter(([, value]) => value.status === "mastered")
      .map(([nodeId]) => nodeId),
  );
  const nodeById = new Map(graph.nodes.map((node) => [node.id, node]));
  const layerNamesByNodeId = new Map<string, string[]>();
  for (const layer of graph.layers) {
    for (const nodeId of layer.nodeIds) {
      layerNamesByNodeId.set(nodeId, [...(layerNamesByNodeId.get(nodeId) ?? []), layer.name]);
    }
  }

  return [...graph.tour]
    .sort((a, b) => a.order - b.order)
    .map((step, index) => {
      const validNodeIds = step.nodeIds.filter((nodeId) => nodeById.has(nodeId));
      const masteredNodeCount = validNodeIds.filter((nodeId) => masteredNodeIds.has(nodeId)).length;
      const firstNode = validNodeIds.map((nodeId) => nodeById.get(nodeId)).find(Boolean);
      const layerNames = [
        ...new Set(validNodeIds.flatMap((nodeId) => layerNamesByNodeId.get(nodeId) ?? [])),
      ];
      const completed = validNodeIds.length > 0 && masteredNodeCount === validNodeIds.length;

      return {
        order: step.order,
        title: step.title,
        description: step.description,
        nodeIds: step.nodeIds,
        nodeCount: validNodeIds.length,
        masteredNodeCount,
        firstNodeName: firstNode?.name ?? null,
        layerNames,
        status: index === currentTourStep ? "current" : completed ? "completed" : "upcoming",
      };
    });
}
