import type { GraphNode } from "@understand-anything/core/types";

export interface FeynmanFeedbackPoint {
  kind: "hit" | "deviation" | "miss";
  text: string;
  nodeRef?: string;
}

export interface FeynmanFeedback {
  verdict: string;
  convergence: { aligned: number; total: number };
  points: FeynmanFeedbackPoint[];
  mentorComment: string;
  followUp: { question: string; targetConcept: string };
  weakPoints: string[];
}

export function composeFollowUpExplanation(
  originalExplanation: string,
  followUpQuestion: string,
  followUpAnswer: string,
): string {
  return [
    originalExplanation.trim(),
    `追问：${followUpQuestion.trim()}`,
    `补答：${followUpAnswer.trim()}`,
  ]
    .filter(Boolean)
    .join("\n\n");
}

function includesAny(value: string, words: string[]): boolean {
  const lower = value.toLowerCase();
  return words.some((word) => lower.includes(word.toLowerCase()));
}

export function buildLocalFeynmanFeedback(
  node: GraphNode,
  userExplanation: string,
): FeynmanFeedback {
  const responsibilityHit =
    userExplanation.trim().length > 12 &&
    includesAny(userExplanation, [node.name, "负责", "承载", "处理", "组织", "生成", "交互"]);
  const layerHit = includesAny(userExplanation, ["层", "边界", "隔离", "适配", "依赖"]);
  const dependencyHit = includesAny(userExplanation, ["依赖", "调用", "流向", "输入", "输出"]);
  const aligned = [responsibilityHit, layerHit, dependencyHit].filter(Boolean).length + 1;

  return {
    verdict: responsibilityHit ? "基本到位 · 还差 1 个关键点" : "先抓住主干 · 需要补齐职责和依赖",
    convergence: { aligned, total: 4 },
    points: [
      {
        kind: responsibilityHit ? "hit" : "miss",
        text: responsibilityHit
          ? `讲到了 ${node.name} 的核心职责。`
          : `还需要说清 ${node.name} 在这条链路里具体负责什么。`,
        nodeRef: node.id,
      },
      {
        kind: layerHit ? "hit" : "deviation",
        text: layerHit
          ? "你开始把它放回分层边界里理解。"
          : "容易把职责边界讲散，需要补一句它属于哪一层、隔离了什么。",
      },
      {
        kind: dependencyHit ? "hit" : "miss",
        text: dependencyHit
          ? "依赖流向有提到，可以继续讲上下游。"
          : "遗漏了关键依赖流向：它从谁拿输入，又把结果交给谁。",
      },
    ],
    mentorComment: `${node.summary} 你的讲法先保留自己的话，再补上分层位置和上下游依赖，就更接近代码真相。`,
    followUp: {
      question: `如果 ${node.name} 的上游依赖变了，它最先会影响哪一段流程？`,
      targetConcept: "关键依赖流向",
    },
    weakPoints: dependencyHit ? ["分层边界"] : ["关键依赖流向", "分层边界"],
  };
}
