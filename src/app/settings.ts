import { invoke } from "@tauri-apps/api/core";

export type ApiKeyStatusSource = "env" | "settings" | "none" | "desktop-required";

export interface ApiKeyStatus {
  configured: boolean;
  source: ApiKeyStatusSource;
  maskedKey?: string | null;
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
