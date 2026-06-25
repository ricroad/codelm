import { describe, expect, test } from "vitest";
import { buildLocalGeneralizeFeedback } from "./feedback";

describe("local generalize feedback", () => {
  test("scores scenario coverage across route hops", () => {
    const feedback = buildLocalGeneralizeFeedback(
      "X",
      "入口接收提示词，状态记录任务，命令边界调用模型，结果回写资产，并处理失败。",
    );

    expect(feedback.coverage.covered).toBeGreaterThanOrEqual(5);
    expect(feedback.points.some((point) => point.text.includes("命令边界"))).toBe(true);
    expect(feedback.understood).toBe(false);
  });

  test("counterfactual asks for consequences when boundary is thin", () => {
    const feedback = buildLocalGeneralizeFeedback(
      "Y",
      "hook 直接 fetch 模型会绕过命令层，也会暴露 key，让测试和失败恢复都更难。",
    );

    expect(feedback.verdict).toContain("后果链");
    expect(feedback.weakPoints).not.toContain("命令边界");
  });

  test("teach-newcomer marks understood only when the answer is teachable", () => {
    const feedback = buildLocalGeneralizeFeedback(
      "Z",
      "不能在按钮里直接调模型 API。新人可以理解为：UI 只表达意图，命令层负责安全边界、状态和错误恢复。",
    );

    expect(feedback.newcomerReply).toContain("我能复述");
    expect(feedback.understood).toBe(true);
  });
});
