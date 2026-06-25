import type { GeneralizeVariant } from "../app/designState";

export interface GeneralizeFeedbackPoint {
  kind: "hit" | "deviation" | "miss";
  text: string;
  nodeRef?: string;
}

export interface GeneralizeFeedback {
  verdict: string;
  coverage: { covered: number; total: number };
  points: GeneralizeFeedbackPoint[];
  mentorComment: string;
  followUp: { question: string; targetConcept: string };
  weakPoints: string[];
  newcomerReply?: string;
  understood: boolean;
}

function includesAny(value: string, words: string[]): boolean {
  const lower = value.toLowerCase();
  return words.some((word) => lower.includes(word.toLowerCase()));
}

function point(hit: boolean, text: string, missText: string): GeneralizeFeedbackPoint {
  return {
    kind: hit ? "hit" : "miss",
    text: hit ? text : missText,
  };
}

export function buildLocalGeneralizeFeedback(
  genVar: GeneralizeVariant,
  response: string,
): GeneralizeFeedback {
  if (genVar === "Y") {
    const boundary = includesAny(response, ["命令", "边界", "commands", "command"]);
    const security = includesAny(response, ["key", "密钥", "安全", "泄露"]);
    const testability = includesAny(response, ["测试", "契约", "mock", "可测"]);
    const recovery = includesAny(response, ["失败", "错误", "恢复", "重试"]);
    const covered = [boundary, security, testability, recovery].filter(Boolean).length;
    return {
      verdict: covered >= 3 ? "后果链基本成立" : "后果链还没讲透",
      coverage: { covered, total: 4 },
      points: [
        point(boundary, "讲到了命令边界被绕过。", "需要说明为什么不能绕过命令边界。"),
        point(security, "讲到了 key / 安全风险。", "漏了 API key 和安全边界后果。"),
        point(testability, "讲到了可测试性受损。", "还要补测试契约会如何变差。"),
        point(recovery, "讲到了失败恢复。", "还没说模型失败后状态如何恢复。"),
      ],
      mentorComment: "反事实不是只说“会坏”，要把安全、状态、测试和恢复串成因果链。",
      followUp: {
        question: "如果模型返回失败，绕过 commands 后 UI 最容易丢哪一类状态？",
        targetConcept: "失败状态",
      },
      weakPoints: [
        ...(boundary ? [] : ["命令边界"]),
        ...(security ? [] : ["安全边界"]),
        ...(testability ? [] : ["可测试契约"]),
        ...(recovery ? [] : ["失败状态"]),
      ],
      understood: false,
    };
  }

  if (genVar === "Z") {
    const intention = includesAny(response, ["意图", "按钮", "ui", "UI"]);
    const command = includesAny(response, ["命令", "commands", "command", "边界"]);
    const safety = includesAny(response, ["安全", "key", "密钥", "状态", "错误", "恢复"]);
    const teachable = includesAny(response, ["新人", "理解", "复述", "不能直接"]);
    const covered = [intention, command, safety, teachable].filter(Boolean).length;
    const understood = covered >= 3 && command;
    return {
      verdict: understood ? "新人可以复述了" : "新人还会继续追问",
      coverage: { covered, total: 4 },
      points: [
        point(intention, "把 UI 讲成表达意图。", "还没把 UI 和用户意图区分开。"),
        point(command, "说明了命令层负责边界。", "需要讲清 commands 层为什么存在。"),
        point(safety, "讲到了安全、状态或错误恢复。", "还要补安全/状态/错误恢复。"),
        point(teachable, "表达方式适合新人复述。", "讲法还偏工程师内部语，需要更能复述。"),
      ],
      mentorComment: "教新人模式看的是对方能否复述，不是你能否堆术语。",
      followUp: {
        question: "你能用一句生活化类比说明 commands 层吗？",
        targetConcept: "新人复述",
      },
      weakPoints: [
        ...(command ? [] : ["命令边界"]),
        ...(safety ? [] : ["安全与状态"]),
        ...(teachable ? [] : ["新人复述"]),
      ],
      newcomerReply: understood
        ? "我能复述：UI 不直接碰模型，命令层负责安全边界、状态和错误恢复。"
        : "我还不太懂：为什么按钮不能直接调 API？",
      understood,
    };
  }

  const entry = includesAny(response, ["入口", "点击", "按钮", "提示词"]);
  const state = includesAny(response, ["状态", "store", "任务"]);
  const command = includesAny(response, ["命令", "commands", "边界"]);
  const model = includesAny(response, ["模型", "API", "供应商"]);
  const writeback = includesAny(response, ["回写", "结果", "资产", "出片"]);
  const failure = includesAny(response, ["失败", "错误", "恢复", "重试"]);
  const covered = [entry, state, command, model, writeback, failure].filter(Boolean).length;
  return {
    verdict: covered >= 5 ? "迁移链路覆盖完整" : "迁移链路还缺关键跳点",
    coverage: { covered, total: 6 },
    points: [
      point(entry, "覆盖了入口/用户意图。", "缺入口：用户怎么触发这条链路？"),
      point(state, "覆盖了状态/任务记录。", "缺状态：任务和 UI 状态在哪里记录？"),
      point(command, "覆盖了命令边界。", "缺命令边界：谁隔离 UI 和模型调用？"),
      point(model, "覆盖了模型/供应商调用。", "缺模型调用：请求怎么到供应商？"),
      point(writeback, "覆盖了结果回写资产。", "缺结果回写：出片后进入哪里？"),
      point(failure, "覆盖了失败恢复。", "缺失败处理：模型失败时用户看到什么？"),
    ],
    mentorComment: "情景推演要像走一条路线：入口、状态、命令、模型、回写、失败处理都要踩到。",
    followUp: {
      question: "如果生成成功但资产回写失败，哪一层该暴露可恢复状态？",
      targetConcept: "资产回写",
    },
    weakPoints: [
      ...(entry ? [] : ["入口"]),
      ...(state ? [] : ["状态"]),
      ...(command ? [] : ["命令边界"]),
      ...(model ? [] : ["模型调用"]),
      ...(writeback ? [] : ["资产回写"]),
      ...(failure ? [] : ["失败状态"]),
    ],
    understood: false,
  };
}
