import type { KnowledgeGraph } from "@understand-anything/core/types";

export type NodeProgressStatus = "unseen" | "attempted" | "mastered";

export interface NodeProgress {
  attempts: number;
  bestConvergence: number;
  status: NodeProgressStatus;
  weakConcepts: string[];
}

export interface LearningProgress {
  nodes: Record<string, NodeProgress>;
  streakDays: number;
}

export interface ProgressSummary {
  masteredNodes: number;
  masteryPercent: number;
  completedTourSteps: number;
  totalTourSteps: number;
  weakPoints: string[];
  streakDays: number;
}

export interface WeaknessBranch {
  weakPoint: string;
  title: string;
  description: string;
  nodeIds: string[];
}

export function createEmptyProgress(): LearningProgress {
  return { nodes: {}, streakDays: 1 };
}

export function recordAttempt(
  progress: LearningProgress,
  nodeId: string,
  convergence: number,
  weakConcepts: string[],
): LearningProgress {
  const current = progress.nodes[nodeId] ?? {
    attempts: 0,
    bestConvergence: 0,
    status: "unseen" as const,
    weakConcepts: [],
  };
  return {
    ...progress,
    nodes: {
      ...progress.nodes,
      [nodeId]: {
        attempts: current.attempts + 1,
        bestConvergence: Math.max(current.bestConvergence, convergence),
        status: current.status === "mastered" ? "mastered" : "attempted",
        weakConcepts: [...new Set([...current.weakConcepts, ...weakConcepts])],
      },
    },
  };
}

export function recordMastery(
  progress: LearningProgress,
  nodeId: string,
  weakConcepts: string[] = [],
): LearningProgress {
  const attempted = recordAttempt(progress, nodeId, 1, weakConcepts);
  return {
    ...attempted,
    nodes: {
      ...attempted.nodes,
      [nodeId]: {
        ...attempted.nodes[nodeId],
        status: "mastered",
        bestConvergence: 1,
      },
    },
  };
}

export function progressSummary(
  graph: KnowledgeGraph,
  progress: LearningProgress,
): ProgressSummary {
  const graphNodeIds = new Set(graph.nodes.map((node) => node.id));
  const mastered = new Set(
    Object.entries(progress.nodes)
      .filter(([nodeId, value]) => graphNodeIds.has(nodeId) && value.status === "mastered")
      .map(([nodeId]) => nodeId),
  );
  const weakPoints = [
    ...new Set(
      Object.entries(progress.nodes)
        .filter(([nodeId]) => graphNodeIds.has(nodeId))
        .map(([, node]) => node)
        .flatMap((node) => node.weakConcepts)
        .filter(Boolean),
    ),
  ].slice(0, 6);

  const completedTourSteps = graph.tour.filter((step) =>
    step.nodeIds.length > 0 && step.nodeIds.every((nodeId) => mastered.has(nodeId)),
  ).length;

  return {
    masteredNodes: mastered.size,
    masteryPercent: graph.nodes.length === 0 ? 0 : Math.round((mastered.size / graph.nodes.length) * 100),
    completedTourSteps,
    totalTourSteps: graph.tour.length,
    weakPoints,
    streakDays: progress.streakDays,
  };
}

function normalizedParts(value: string): string[] {
  const lower = value.toLowerCase();
  return [
    lower,
    ...lower
      .split(/[\s,，、/|·:：;；()[\]{}"'`]+/)
      .map((part) => part.trim())
      .filter((part) => part.length >= 2),
  ];
}

function textMatchesWeakPoint(text: string, weakPoint: string): boolean {
  const textLower = text.toLowerCase();
  return normalizedParts(weakPoint).some((part) => textLower.includes(part));
}

export function suggestWeaknessBranches(
  graph: KnowledgeGraph,
  progress: LearningProgress,
): WeaknessBranch[] {
  const summary = progressSummary(graph, progress);
  const graphNodeIds = new Set(graph.nodes.map((node) => node.id));
  const mastered = new Set(
    Object.entries(progress.nodes)
      .filter(([nodeId, value]) => graphNodeIds.has(nodeId) && value.status === "mastered")
      .map(([nodeId]) => nodeId),
  );
  const nodeById = new Map(graph.nodes.map((node) => [node.id, node]));

  return summary.weakPoints
    .map((weakPoint) => {
      const textMatchedNodeIds = graph.nodes
        .filter((node) => !mastered.has(node.id))
        .filter((node) => {
          const layerText = graph.layers
            .filter((layer) => layer.nodeIds.includes(node.id))
            .map((layer) => `${layer.name} ${layer.description}`)
            .join(" ");
          const nodeText = `${node.name} ${node.summary} ${node.tags.join(" ")} ${layerText}`;
          return textMatchesWeakPoint(nodeText, weakPoint);
        })
        .map((node) => node.id);
      const weakSourceNodeIds = Object.entries(progress.nodes)
        .filter(([nodeId, nodeProgress]) => {
          return (
            graphNodeIds.has(nodeId) &&
            nodeProgress.status !== "mastered" &&
            nodeProgress.weakConcepts.includes(weakPoint)
          );
        })
        .map(([nodeId]) => nodeId);
      const dependencyNodeIds = graph.edges
        .filter((edge) => weakSourceNodeIds.includes(edge.source) || weakSourceNodeIds.includes(edge.target))
        .flatMap((edge) => {
          if (weakSourceNodeIds.includes(edge.source)) return [edge.target];
          return [edge.source];
        })
        .filter((nodeId) => nodeById.has(nodeId) && !mastered.has(nodeId));
      const matchedNodeIds = [...new Set([...textMatchedNodeIds, ...dependencyNodeIds])].slice(0, 4);

      if (matchedNodeIds.length === 0) return null;
      return {
        weakPoint,
        title: `${weakPoint}支线`,
        description: `围绕「${weakPoint}」补走 ${matchedNodeIds.length} 个相关节点。`,
        nodeIds: matchedNodeIds,
      } satisfies WeaknessBranch;
    })
    .filter((branch): branch is WeaknessBranch => branch != null)
    .slice(0, 3);
}
