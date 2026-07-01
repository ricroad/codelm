import { describe, expect, test } from "vitest";
import { aiModelSettingsLabel, apiKeyStatusLabel, projectPathsLabel } from "./settings";

describe("settings helpers", () => {
  test("labels key status sources", () => {
    expect(apiKeyStatusLabel({ configured: true, source: "env", maskedKey: "sk-a...cret" })).toBe(
      "环境变量 · sk-a...cret",
    );
    expect(
      apiKeyStatusLabel({ configured: true, source: "settings", maskedKey: "sk-a...cret" }),
    ).toBe("本地设置 · sk-a...cret");
    expect(apiKeyStatusLabel({ configured: false, source: "desktop-required" })).toBe(
      "请在桌面 App 中配置",
    );
    expect(apiKeyStatusLabel({ configured: false, source: "none" })).toBe("未配置");
  });

  test("labels project path sources", () => {
    expect(
      projectPathsLabel({
        repoRoot: "/workspace/frontend-repo",
        graphPath: "/workspace/frontend-repo/.understand-anything/knowledge-graph.json",
        configured: false,
        source: "default",
      }),
    ).toBe("默认路径");
    expect(
      projectPathsLabel({
        repoRoot: "/custom/repo",
        graphPath: "/custom/graph.json",
        configured: true,
        source: "settings",
      }),
    ).toBe("本地设置");
    expect(
      projectPathsLabel({
        repoRoot: "",
        graphPath: "",
        configured: false,
        source: "desktop-required",
      }),
    ).toBe("请在桌面 App 中配置");
  });

  test("labels AI model setting sources", () => {
    expect(
      aiModelSettingsLabel({
        model: "claude-sonnet-4-6",
        configured: false,
        source: "default",
      }),
    ).toBe("默认模型 · claude-sonnet-4-6");
    expect(
      aiModelSettingsLabel({
        model: "claude-opus-4-8",
        configured: true,
        source: "settings",
      }),
    ).toBe("本地设置 · claude-opus-4-8");
    expect(
      aiModelSettingsLabel({
        model: "claude-env-model",
        configured: true,
        source: "env",
      }),
    ).toBe("环境变量 · claude-env-model");
    expect(
      aiModelSettingsLabel({
        model: "",
        configured: false,
        source: "desktop-required",
      }),
    ).toBe("请在桌面 App 中配置");
  });
});
