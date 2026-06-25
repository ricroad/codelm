import { invoke } from "@tauri-apps/api/core";

export interface SourceFile {
  path: string;
  language: string;
  content: string;
  sizeBytes: number;
  lineCount: number;
}

declare global {
  interface Window {
    __TAURI_INTERNALS__?: unknown;
  }
}

export function buildSourceUrl(filePath: string): string {
  const params = new URLSearchParams({ path: filePath });
  return `/file-content.json?${params.toString()}`;
}

export function fallbackLanguage(filePath: string | undefined): string {
  const fileName = filePath?.split("/").pop()?.toLowerCase();
  if (!fileName) return "text";
  const ext = fileName.includes(".") ? fileName.split(".").pop() : "";
  const byExt: Record<string, string> = {
    css: "css",
    go: "go",
    html: "markup",
    js: "javascript",
    jsx: "jsx",
    json: "json",
    md: "markdown",
    py: "python",
    rb: "ruby",
    rs: "rust",
    sh: "bash",
    ts: "typescript",
    tsx: "tsx",
    yaml: "yaml",
    yml: "yaml",
  };
  return ext ? byExt[ext] ?? "text" : "text";
}

function isTauriRuntime(): boolean {
  return typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;
}

async function loadSourceFromBrowser(filePath: string, signal?: AbortSignal): Promise<SourceFile> {
  const response = await fetch(buildSourceUrl(filePath), { signal });
  const data = (await response.json()) as SourceFile | { error?: string };
  if (!response.ok) {
    throw new Error("error" in data && data.error ? data.error : "Source unavailable");
  }
  return data as SourceFile;
}

export async function loadSource(filePath: string, signal?: AbortSignal): Promise<SourceFile> {
  if (isTauriRuntime()) {
    return invoke<SourceFile>("read_source", { path: filePath });
  }
  return loadSourceFromBrowser(filePath, signal);
}
