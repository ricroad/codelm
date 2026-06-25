import { invoke } from "@tauri-apps/api/core";
import type { GeneralizeVariant } from "../app/designState";
import type { GeneralizeFeedback } from "./feedback";

declare global {
  interface Window {
    __TAURI_INTERNALS__?: unknown;
  }
}

function isTauriRuntime(): boolean {
  return typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;
}

export async function requestClaudeGeneralizeFeedback(
  genVar: GeneralizeVariant,
  userResponse: string,
): Promise<GeneralizeFeedback> {
  if (!isTauriRuntime()) {
    throw new Error("Claude generalize feedback requires the desktop app runtime");
  }
  return invoke<GeneralizeFeedback>("ai_generalize_feedback", { genVar, userResponse });
}
