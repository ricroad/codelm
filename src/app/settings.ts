import { invoke } from "@tauri-apps/api/core";
import { DEFAULT_GRAPH_PATH, DEFAULT_REPO_ROOT } from "./config";

export type ApiKeyStatusSource = "env" | "settings" | "none" | "desktop-required";
export type ProjectPathsSource = "default" | "settings" | "desktop-required";

export interface ApiKeyStatus {
  configured: boolean;
  source: ApiKeyStatusSource;
  maskedKey?: string | null;
}

export interface ProjectPaths {
  repoRoot: string;
  graphPath: string;
  configured: boolean;
  source: ProjectPathsSource;
}

declare global {
  interface Window {
    __TAURI_INTERNALS__?: unknown;
  }
}

function isTauriRuntime(): boolean {
  return typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;
}

export function apiKeyStatusLabel(status: ApiKeyStatus): string {
  if (status.source === "desktop-required") return "请在桌面 App 中配置";
  if (!status.configured) return "未配置";
  const masked = status.maskedKey ? ` · ${status.maskedKey}` : "";
  if (status.source === "env") return `环境变量${masked}`;
  return `本地设置${masked}`;
}

export function projectPathsLabel(paths: ProjectPaths): string {
  if (paths.source === "desktop-required") return "请在桌面 App 中配置";
  if (paths.source === "settings" || paths.configured) return "本地设置";
  return "默认路径";
}

export async function loadApiKeyStatus(): Promise<ApiKeyStatus> {
  if (!isTauriRuntime()) {
    return { configured: false, source: "desktop-required" };
  }
  return invoke<ApiKeyStatus>("api_key_status");
}

export async function saveApiKey(apiKey: string): Promise<ApiKeyStatus> {
  if (!isTauriRuntime()) {
    throw new Error("API key settings require the desktop app runtime");
  }
  return invoke<ApiKeyStatus>("save_api_key", { apiKey });
}

export async function clearApiKey(): Promise<ApiKeyStatus> {
  if (!isTauriRuntime()) {
    throw new Error("API key settings require the desktop app runtime");
  }
  return invoke<ApiKeyStatus>("clear_api_key");
}

export async function loadProjectPaths(): Promise<ProjectPaths> {
  if (!isTauriRuntime()) {
    return {
      repoRoot: DEFAULT_REPO_ROOT,
      graphPath: DEFAULT_GRAPH_PATH,
      configured: false,
      source: "desktop-required",
    };
  }
  return invoke<ProjectPaths>("project_paths");
}

export async function saveProjectPaths(
  repoRoot: string,
  graphPath: string,
): Promise<ProjectPaths> {
  if (!isTauriRuntime()) {
    throw new Error("Project path settings require the desktop app runtime");
  }
  return invoke<ProjectPaths>("save_project_paths", { repoRoot, graphPath });
}
