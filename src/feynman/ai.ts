import { invoke } from "@tauri-apps/api/core";
import type { FeynmanFeedback } from "./feedback";

declare global {
  interface Window {
    __TAURI_INTERNALS__?: unknown;
  }
}

function isTauriRuntime(): boolean {
  return typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;
}

export async function requestClaudeFeynmanFeedback(
  nodeId: string,
  userExplanation: string,
): Promise<FeynmanFeedback> {
  if (!isTauriRuntime()) {
    throw new Error("Claude feedback requires the desktop app runtime");
  }
  return invoke<FeynmanFeedback>("ai_feynman_feedback", { nodeId, userExplanation });
}
