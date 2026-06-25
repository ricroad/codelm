import { invoke } from "@tauri-apps/api/core";
import { validateGraph } from "@understand-anything/core/schema";
import type { GraphIssue } from "@understand-anything/core/schema";
import type { KnowledgeGraph } from "@understand-anything/core/types";
import { DEFAULT_GRAPH_PATH, DEFAULT_REPO_ROOT } from "./config";

export interface GraphSummary {
  nodes: number;
  edges: number;
  layers: number;
  tourSteps: number;
}

export interface GraphLoadData {
  graph: KnowledgeGraph;
  issues: GraphIssue[];
  repoRoot: string;
  graphPath: string;
  repoGitCommitHash: string | null;
}

interface GraphCommandResponse {
  graph: unknown;
  repo_root: string;
  graph_path: string;
  repo_git_commit_hash: string | null;
}

declare global {
  interface Window {
    __TAURI_INTERNALS__?: unknown;
  }
}

export function graphSummary(graph: KnowledgeGraph): GraphSummary {
  return {
    nodes: graph.nodes.length,
    edges: graph.edges.length,
    layers: graph.layers.length,
    tourSteps: graph.tour.length,
  };
}

export function resolveGraphWarning(
  graphGitCommitHash: string,
  repoGitCommitHash: string | null,
): string | null {
  if (!repoGitCommitHash || graphGitCommitHash === repoGitCommitHash) return null;
  return `图谱来自 ${graphGitCommitHash}，当前源码是 ${repoGitCommitHash}。源码预览可能和图谱摘要不完全一致。`;
}

function isTauriRuntime(): boolean {
  return typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;
}

function parseGraph(
  graph: unknown,
  repoRoot: string,
  graphPath: string,
  repoGitCommitHash: string | null,
): GraphLoadData {
  const result = validateGraph(graph);
  if (!result.success || !result.data) {
    throw new Error(result.fatal ?? "Invalid knowledge graph");
  }

  return {
    graph: result.data,
    issues: result.issues,
    repoRoot,
    graphPath,
    repoGitCommitHash,
  };
}

async function loadFromTauri(): Promise<GraphLoadData> {
  const response = await invoke<GraphCommandResponse>("load_graph");
  return parseGraph(
    response.graph,
    response.repo_root,
    response.graph_path,
    response.repo_git_commit_hash,
  );
}

async function loadFromBrowserFallback(): Promise<GraphLoadData> {
  const response = await fetch("/knowledge-graph.json");
  if (!response.ok) {
    throw new Error(`Failed to load graph: ${response.status} ${response.statusText}`);
  }
  const graph = await response.json();
  const commitResponse = await fetch("/repo-meta.json").catch(() => null);
  const meta = commitResponse?.ok
    ? ((await commitResponse.json()) as { repoGitCommitHash?: string | null })
    : {};
  return parseGraph(
    graph,
    DEFAULT_REPO_ROOT,
    DEFAULT_GRAPH_PATH,
    meta.repoGitCommitHash ?? null,
  );
}

export async function loadGraphData(): Promise<GraphLoadData> {
  if (isTauriRuntime()) return loadFromTauri();
  return loadFromBrowserFallback();
}
