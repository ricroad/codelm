import { invoke } from "@tauri-apps/api/core";
import type {
  GraphEdge,
  GraphNode,
  KnowledgeGraph,
  Layer,
} from "@understand-anything/core/types";
import { loadSource, type SourceFile } from "../app/source";

export interface TruthNode {
  id: string;
  nodeType: string;
  name: string;
  filePath?: string;
  lineRange?: [number, number];
  summary: string;
  tags: string[];
  complexity: string;
}

export interface TruthLayer {
  id: string;
  name: string;
  description: string;
}

export interface TruthEdge {
  relation: string;
  direction: string;
  description?: string;
  weight: number;
  otherNodeId: string;
  otherNodeName: string;
}

export interface SourceSnippet {
  path: string;
  language: string;
  startLine: number;
  endLine: number;
  content: string;
}

export interface TruthContext {
  node: TruthNode;
  layer?: TruthLayer;
  incomingEdges: TruthEdge[];
  outgoingEdges: TruthEdge[];
  sourceSnippet?: SourceSnippet;
}

declare global {
  interface Window {
    __TAURI_INTERNALS__?: unknown;
  }
}

type SourceLoader = (filePath: string, signal?: AbortSignal) => Promise<SourceFile>;

function isTauriRuntime(): boolean {
  return typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;
}

function toTruthNode(node: GraphNode): TruthNode {
  return {
    id: node.id,
    nodeType: node.type,
    name: node.name,
    filePath: node.filePath,
    lineRange: node.lineRange,
    summary: node.summary,
    tags: node.tags,
    complexity: node.complexity,
  };
}

function toTruthLayer(layer: Layer | undefined): TruthLayer | undefined {
  if (!layer) return undefined;
  return {
    id: layer.id,
    name: layer.name,
    description: layer.description,
  };
}

function edgeForNode(edge: GraphEdge, otherNode: GraphNode | undefined, otherNodeId: string): TruthEdge {
  return {
    relation: edge.type,
    direction: edge.direction,
    description: edge.description,
    weight: edge.weight,
    otherNodeId,
    otherNodeName: otherNode?.name ?? otherNodeId,
  };
}

export function extractSourceSnippet(
  source: SourceFile,
  lineRange?: [number, number],
): SourceSnippet {
  const lines = source.content.split("\n");
  const totalLines = Math.max(source.lineCount, 1);
  const [rawStart, rawEnd] = lineRange ?? [1, Math.min(totalLines, 120)];
  const startLine = Math.min(Math.max(rawStart, 1), totalLines);
  const endLine = Math.min(Math.max(rawEnd, startLine), totalLines);

  return {
    path: source.path,
    language: source.language,
    startLine,
    endLine,
    content: lines.slice(startLine - 1, endLine).join("\n"),
  };
}

export async function buildTruthContextFromGraph(
  graph: KnowledgeGraph,
  nodeId: string,
  sourceLoader: SourceLoader = loadSource,
  signal?: AbortSignal,
): Promise<TruthContext> {
  const node = graph.nodes.find((item) => item.id === nodeId);
  if (!node) {
    throw new Error(`Node not found: ${nodeId}`);
  }

  const nodeById = new Map(graph.nodes.map((item) => [item.id, item]));
  const layer = graph.layers.find((item) => item.nodeIds.includes(nodeId));
  const incomingEdges = graph.edges
    .filter((edge) => edge.target === nodeId)
    .map((edge) => edgeForNode(edge, nodeById.get(edge.source), edge.source));
  const outgoingEdges = graph.edges
    .filter((edge) => edge.source === nodeId)
    .map((edge) => edgeForNode(edge, nodeById.get(edge.target), edge.target));
  const sourceSnippet = node.filePath
    ? extractSourceSnippet(await sourceLoader(node.filePath, signal), node.lineRange)
    : undefined;

  return {
    node: toTruthNode(node),
    layer: toTruthLayer(layer),
    incomingEdges,
    outgoingEdges,
    sourceSnippet,
  };
}

export async function loadTruthContext(
  graph: KnowledgeGraph,
  nodeId: string,
  signal?: AbortSignal,
): Promise<TruthContext> {
  if (isTauriRuntime()) {
    return invoke<TruthContext>("read_truth_context", { nodeId });
  }
  return buildTruthContextFromGraph(graph, nodeId, loadSource, signal);
}
