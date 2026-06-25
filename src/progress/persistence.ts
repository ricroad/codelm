import { invoke } from "@tauri-apps/api/core";
import { createEmptyProgress, type LearningProgress, type NodeProgress } from "./progress";

const PROGRESS_STORAGE_KEY = "code-reading:progress:v1";

declare global {
  interface Window {
    __TAURI_INTERNALS__?: unknown;
  }
}

function isTauriRuntime(): boolean {
  return typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function normalizeNodeProgress(value: unknown): NodeProgress | null {
  if (!isRecord(value)) return null;
  const attempts = typeof value.attempts === "number" ? value.attempts : 0;
  const bestConvergence =
    typeof value.bestConvergence === "number" ? value.bestConvergence : 0;
  const status =
    value.status === "attempted" || value.status === "mastered" ? value.status : "unseen";
  const weakConcepts = Array.isArray(value.weakConcepts)
    ? value.weakConcepts.filter((item): item is string => typeof item === "string")
    : [];
  return {
    attempts,
    bestConvergence,
    status,
    weakConcepts,
  };
}

export function normalizeProgress(value: unknown): LearningProgress {
  if (!isRecord(value) || !isRecord(value.nodes)) {
    return createEmptyProgress();
  }
  const nodes = Object.fromEntries(
    Object.entries(value.nodes)
      .map(([nodeId, nodeProgress]) => [nodeId, normalizeNodeProgress(nodeProgress)] as const)
      .filter((entry): entry is readonly [string, NodeProgress] => entry[1] !== null),
  );
  return {
    nodes,
    streakDays: typeof value.streakDays === "number" ? value.streakDays : 1,
  };
}

export async function loadStoredProgress(): Promise<LearningProgress> {
  if (isTauriRuntime()) {
    return normalizeProgress(await invoke<unknown>("load_progress"));
  }
  const raw = window.localStorage.getItem(PROGRESS_STORAGE_KEY);
  if (!raw) return createEmptyProgress();
  return normalizeProgress(JSON.parse(raw));
}

export async function saveStoredProgress(progress: LearningProgress): Promise<void> {
  if (isTauriRuntime()) {
    await invoke("save_progress", { progress });
    return;
  }
  window.localStorage.setItem(PROGRESS_STORAGE_KEY, JSON.stringify(progress));
}
