import type { GraphNode } from "@understand-anything/core/types";
import type { TruthContext, TruthEdge } from "./truth";

export type TruthChecklistKind = "responsibility" | "layer" | "outgoing" | "incoming";

export interface TruthChecklistItem {
  id: string;
  kind: TruthChecklistKind;
  label: string;
  evidence: string;
  keywords: string[];
}

export interface ScoredTruthChecklistItem extends TruthChecklistItem {
  aligned: boolean;
}

export interface TruthChecklistScore {
  aligned: number;
  total: number;
  percent: number;
  items: ScoredTruthChecklistItem[];
}

function unique(values: string[]): string[] {
  return [...new Set(values.map((value) => value.trim()).filter((value) => value.length >= 2))];
}

function chineseWindows(value: string): string[] {
  const windows: string[] = [];
  for (const match of value.matchAll(/[\u4e00-\u9fff]{4,}/g)) {
    const text = match[0];
    for (let i = 0; i <= text.length - 4; i += 1) {
      windows.push(text.slice(i, i + 4));
    }
  }
  return windows;
}

function keywordParts(value: string): string[] {
  const normalized = value.toLowerCase();
  const pieces = normalized
    .split(/[\s,，、/|·:：;；()[\]{}"'`<>。！？!?.]+|和|与|及/g)
    .map((part) => part.trim())
    .filter((part) => part.length >= 2);
  return unique([normalized, ...pieces, ...chineseWindows(value)]);
}

function nodeAliases(node: GraphNode): string[] {
  const fileName = node.filePath?.split("/").pop();
  return unique([node.name, fileName ?? "", ...node.name.split(/[._-]/g)]);
}

function edgeEvidence(edge: TruthEdge): string {
  return `${edge.relation} → ${edge.otherNodeName}${edge.description ? ` · ${edge.description}` : ""}`;
}

function edgeKeywords(edge: TruthEdge, direction: "outgoing" | "incoming"): string[] {
  return unique([
    edge.relation,
    edge.otherNodeName,
    edge.description ?? "",
    direction === "outgoing" ? "调用" : "上游依赖",
    direction === "outgoing" ? "输出" : "输入",
    direction === "outgoing" ? "生成命令" : "依赖",
  ].flatMap(keywordParts));
}

export function buildTruthChecklist(
  node: GraphNode,
  truthContext: TruthContext | null,
): TruthChecklistItem[] {
  const truthNode = truthContext?.node;
  const summary = truthNode?.summary ?? node.summary;
  const tags = truthNode?.tags ?? node.tags;
  const items: TruthChecklistItem[] = [
    {
      id: "responsibility",
      kind: "responsibility",
      label: "职责",
      evidence: summary,
      keywords: unique([...nodeAliases(node), ...tags, summary].flatMap(keywordParts)),
    },
  ];

  if (truthContext?.layer) {
    items.push({
      id: "layer",
      kind: "layer",
      label: "分层",
      evidence: `${truthContext.layer.name} · ${truthContext.layer.description}`,
      keywords: unique([truthContext.layer.name].flatMap(keywordParts)),
    });
  }

  for (const edge of (truthContext?.outgoingEdges ?? []).slice(0, 2)) {
    items.push({
      id: `outgoing:${edge.otherNodeId}`,
      kind: "outgoing",
      label: "出边",
      evidence: edgeEvidence(edge),
      keywords: edgeKeywords(edge, "outgoing"),
    });
  }

  for (const edge of (truthContext?.incomingEdges ?? []).slice(0, 2)) {
    items.push({
      id: `incoming:${edge.otherNodeId}`,
      kind: "incoming",
      label: "入边",
      evidence: edgeEvidence(edge),
      keywords: edgeKeywords(edge, "incoming"),
    });
  }

  return items;
}

export function scoreTruthChecklist(
  checklist: TruthChecklistItem[],
  explanation: string,
): TruthChecklistScore {
  const normalizedExplanation = explanation.toLowerCase();
  const items = checklist.map((item) => ({
    ...item,
    aligned: item.keywords.some((keyword) => normalizedExplanation.includes(keyword.toLowerCase())),
  }));
  const aligned = items.filter((item) => item.aligned).length;
  const total = items.length;
  return {
    aligned,
    total,
    percent: total === 0 ? 0 : Math.round((aligned / total) * 100),
    items,
  };
}
