import { describe, expect, test } from "vitest";
import {
  applyDesignAction,
  defaultDesignState,
  getGeneralizePrompt,
  getModeHeading,
  getVariantLabel,
} from "./designState";

describe("designState", () => {
  test("uses the design-spec mode headings", () => {
    expect(getModeHeading("learn")).toBe("讲解 → 理解 → 讲回去 → 对齐，往复直至学会");
    expect(getModeHeading("overview")).toBe("主干据依赖图生成，支线据你的薄弱点动态生长");
    expect(getModeHeading("generalize")).toBe("泛化 · 把学过的模式用到新场景，串讲整条链路");
  });

  test("keeps the design defaults for mode and variants", () => {
    expect(defaultDesignState).toMatchObject({
      mode: "overview",
      variant: "A",
      genVar: "X",
      collapsed: false,
      submitted: false,
      genSubmitted: false,
    });
  });

  test("resets submitted flags when changing mode or variant", () => {
    const submitted = { ...defaultDesignState, mode: "learn" as const, submitted: true };
    expect(applyDesignAction(submitted, { type: "setVariant", variant: "B" })).toMatchObject({
      mode: "learn",
      variant: "B",
      submitted: false,
    });
    expect(applyDesignAction(submitted, { type: "setMode", mode: "generalize" })).toMatchObject({
      mode: "generalize",
      genVar: "X",
      submitted: false,
      genSubmitted: false,
    });
  });

  test("exposes the six design variant labels and prompts", () => {
    expect(getVariantLabel("A")).toBe("A · 对话式");
    expect(getVariantLabel("C")).toBe("C · 实时对齐");
    expect(getGeneralizePrompt("Y")).toContain("删掉 commands 层");
    expect(getGeneralizePrompt("Z")).toContain("为什么不直接在按钮点击里调模型 API");
  });
});
