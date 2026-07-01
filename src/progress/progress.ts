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
