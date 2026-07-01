import type { KnowledgeGraph, GraphNode } from "@understand-anything/core/types";
import type { GeneralizeVariant } from "../app/designState";
import type { GeneralizeFeedback } from "./feedback";

export type GeneralizeCoverageStatus = "covered" | "missing" | "pending";

export interface GeneralizeCoverageStep {
  id: string;
  label: string;
  description: string;
  status: GeneralizeCoverageStatus;
  routeNodeNames: string[];
}

interface CoverageTarget {
  id: string;
  label: string;
  description: string;
  aliases: string[];
  keywords: string[];
}

const COVERAGE_TARGETS: Record<GeneralizeVariant, CoverageTarget[]> = {
  X: [
    {
      id: "entry",
      label: "入口",
      description: "用户从哪里触发新场景，UI 表达了什么意图。",
      aliases: ["入口", "用户意图"],
      keywords: ["入口", "点击", "按钮", "prompt", "ui", "意图"],
    },
    {
      id: "state",
      label: "状态",
      description: "任务、进度和界面状态在哪里记录与流转。",
      aliases: ["状态", "任务"],
      keywords: ["状态", "store", "task", "任务", "progress"],
    },
    {
      id: "command-boundary",
      label: "命令边界",
      description: "哪一层隔离 UI 与真实模型/文件系统副作用。",
      aliases: ["命令边界", "命令", "commands", "command"],
      keywords: ["命令", "commands", "command", "边界", "tauri"],
    },
    {
      id: "model-call",
      label: "模型调用",
      description: "请求如何进入模型、供应商或适配器。",
      aliases: ["模型调用", "模型", "供应商"],
      keywords: ["模型", "model", "api", "供应商", "adapter", "provider"],
    },
    {
      id: "asset-writeback",
      label: "资产回写",
      description: "成功结果如何进入资产、文件或可继续编辑的状态。",
      aliases: ["资产回写", "回写", "资产", "结果"],
      keywords: ["资产", "asset", "回写", "结果", "write", "export"],
    },
    {
      id: "failure-state",
      label: "失败状态",
      description: "失败、错误和重试如何向用户暴露可恢复状态。",
      aliases: ["失败状态", "失败", "错误恢复", "重试"],
      keywords: ["失败", "错误", "恢复", "重试", "error", "retry"],
    },
  ],
  Y: [
    {
      id: "command-boundary",
      label: "命令边界",
      description: "如果绕过命令层，谁会失去统一入口和副作用控制。",
      aliases: ["命令边界", "命令", "commands", "command"],
      keywords: ["命令", "commands", "command", "边界", "tauri"],
    },
    {
      id: "security-boundary",
      label: "安全边界",
      description: "API key、权限和敏感调用会在哪些位置泄露。",
      aliases: ["安全边界", "安全", "key", "密钥"],
      keywords: ["安全", "security", "key", "密钥", "secret", "permission"],
    },
    {
      id: "test-contract",
      label: "可测试契约",
      description: "边界被移除后，mock、契约测试和回归定位会怎样变差。",
      aliases: ["可测试契约", "测试契约", "测试", "mock"],
      keywords: ["测试", "test", "mock", "契约", "contract"],
    },
    {
      id: "failure-state",
      label: "失败状态",
      description: "模型失败后，UI 如何恢复、重试或保留上下文。",
      aliases: ["失败状态", "失败", "错误恢复", "重试"],
      keywords: ["失败", "错误", "恢复", "重试", "error", "retry"],
    },
  ],
  Z: [
    {
      id: "ui-intent",
      label: "UI 意图",
      description: "把按钮和界面讲成用户意图，而不是直接讲实现细节。",
      aliases: ["UI 意图", "意图", "UI"],
      keywords: ["ui", "按钮", "入口", "意图", "view"],
    },
    {
      id: "command-boundary",
      label: "命令边界",
      description: "用新人能复述的话讲清 commands 层为什么存在。",
      aliases: ["命令边界", "命令", "commands", "command"],
      keywords: ["命令", "commands", "command", "边界", "tauri"],
    },
    {
      id: "safety-state",
      label: "安全与状态",
      description: "解释安全、状态、错误恢复为什么不能散落在按钮里。",
      aliases: ["安全与状态", "安全", "状态", "错误恢复"],
      keywords: ["安全", "状态", "错误", "恢复", "key", "store"],
    },
    {
      id: "newcomer-retell",
      label: "新人复述",
      description: "对方能否用自己的话复述，而不是只听过术语。",
      aliases: ["新人复述", "新人", "复述", "理解"],
      keywords: ["新人", "复述", "理解", "teach", "learn"],
    },
  ],
};

function normalize(value: string): string {
  return value.toLowerCase();
}

function containsAny(value: string, words: string[]): boolean {
  const source = normalize(value);
  return words.some((word) => source.includes(normalize(word)));
}

function weakPointMatches(target: CoverageTarget, weakPoint: string): boolean {
  const normalizedWeakPoint = normalize(weakPoint.trim());
  return target.aliases.some((alias) => {
    const normalizedAlias = normalize(alias);
    if (normalizedWeakPoint === normalizedAlias) return true;
    return (
      normalizedAlias.length >= 4 &&
      (normalizedWeakPoint.includes(normalizedAlias) || normalizedAlias.includes(normalizedWeakPoint))
    );
  });
}

function buildSearchText(node: GraphNode | undefined): string {
  if (!node) return "";
  return [node.name, node.summary, node.filePath ?? "", ...node.tags].join(" ");
}

function routeNodeNamesForTarget(target: CoverageTarget, graph: KnowledgeGraph): string[] {
  const nodeById = new Map(graph.nodes.map((node) => [node.id, node]));
  const matchedNodeIds: string[] = [];

  for (const step of [...graph.tour].sort((a, b) => a.order - b.order)) {
    const stepText = `${step.title} ${step.description}`;
    const stepMatches = containsAny(stepText, [...target.aliases, ...target.keywords]);
    for (const nodeId of step.nodeIds) {
      const node = nodeById.get(nodeId);
      if (stepMatches || containsAny(buildSearchText(node), target.keywords)) {
        matchedNodeIds.push(nodeId);
      }
    }
  }

  if (matchedNodeIds.length === 0) {
    for (const node of graph.nodes) {
      if (containsAny(buildSearchText(node), target.keywords)) {
        matchedNodeIds.push(node.id);
      }
    }
  }

  return [...new Set(matchedNodeIds)]
    .map((nodeId) => nodeById.get(nodeId)?.name)
    .filter((name): name is string => Boolean(name))
    .slice(0, 3);
}

function statusForTarget(
  target: CoverageTarget,
  index: number,
  feedback: GeneralizeFeedback | null,
): GeneralizeCoverageStatus {
  if (!feedback) return "pending";
  if (feedback.weakPoints.some((weakPoint) => weakPointMatches(target, weakPoint))) {
    return "missing";
  }

  const point = feedback.points[index];
  if (!point) return "covered";
  return point.kind === "hit" ? "covered" : "missing";
}

export function buildGeneralizeCoverageSteps(
  genVar: GeneralizeVariant,
  graph: KnowledgeGraph,
  feedback: GeneralizeFeedback | null,
): GeneralizeCoverageStep[] {
  return COVERAGE_TARGETS[genVar].map((target, index) => ({
    id: target.id,
    label: target.label,
    description: target.description,
    status: statusForTarget(target, index, feedback),
    routeNodeNames: routeNodeNamesForTarget(target, graph),
  }));
}
