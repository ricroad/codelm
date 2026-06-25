import { useEffect, useMemo, useState } from "react";
import type { GraphIssue } from "@understand-anything/core/schema";
import type { KnowledgeGraph } from "@understand-anything/core/types";
import GraphView from "../vendor/ua/components/GraphView";
import SearchBar from "../vendor/ua/components/SearchBar";
import NodeInfo from "../vendor/ua/components/NodeInfo";
import ProjectOverview from "../vendor/ua/components/ProjectOverview";
import FileExplorer from "../vendor/ua/components/FileExplorer";
import LayerLegend from "../vendor/ua/components/LayerLegend";
import WarningBanner from "../vendor/ua/components/WarningBanner";
import CodeViewer from "../vendor/ua/components/CodeViewer";
import { I18nProvider } from "../vendor/ua/contexts/I18nContext";
import { ThemeProvider } from "../vendor/ua/themes";
import { useDashboardStore } from "../vendor/ua/store";
import { graphSummary, loadGraphData, resolveGraphWarning } from "./graphData";

type LoadState =
  | { status: "loading"; error: null; graph: null; issues: GraphIssue[]; repoGitCommitHash: null }
  | {
      status: "ready";
      error: null;
      graph: KnowledgeGraph;
      issues: GraphIssue[];
      repoGitCommitHash: string | null;
    }
  | { status: "error"; error: string; graph: null; issues: GraphIssue[]; repoGitCommitHash: null };

function AppContent() {
  const setGraph = useDashboardStore((s) => s.setGraph);
  const selectedNodeId = useDashboardStore((s) => s.selectedNodeId);
  const codeViewerOpen = useDashboardStore((s) => s.codeViewerOpen);
  const closeCodeViewer = useDashboardStore((s) => s.closeCodeViewer);
  const [sidebarTab, setSidebarTab] = useState<"overview" | "files">("overview");
  const [state, setState] = useState<LoadState>({
    status: "loading",
    error: null,
    graph: null,
    issues: [],
    repoGitCommitHash: null,
  });

  useEffect(() => {
    let cancelled = false;
    loadGraphData()
      .then((data) => {
        if (cancelled) return;
        setGraph(data.graph);
        setState({
          status: "ready",
          error: null,
          graph: data.graph,
          issues: data.issues,
          repoGitCommitHash: data.repoGitCommitHash,
        });
      })
      .catch((error: unknown) => {
        if (cancelled) return;
        setState({
          status: "error",
          error: error instanceof Error ? error.message : String(error),
          graph: null,
          issues: [],
          repoGitCommitHash: null,
        });
      });
    return () => {
      cancelled = true;
    };
  }, [setGraph]);

  const summary = useMemo(
    () => (state.graph ? graphSummary(state.graph) : null),
    [state.graph],
  );
  const commitWarning = state.graph
    ? resolveGraphWarning(state.graph.project.gitCommitHash, state.repoGitCommitHash)
    : null;

  if (state.status === "loading") {
    return (
      <main className="flex h-screen w-screen items-center justify-center bg-root text-text-primary">
        <div className="rounded-lg border border-border-subtle bg-surface px-5 py-4 shadow-sm">
          <div className="text-sm font-semibold">code-reading</div>
          <div className="mt-1 text-xs text-text-secondary">正在加载图谱</div>
        </div>
      </main>
    );
  }

  if (state.status === "error") {
    return (
      <main className="flex h-screen w-screen items-center justify-center bg-root p-6 text-text-primary">
        <div className="max-w-xl rounded-lg border border-border-subtle bg-surface px-5 py-4 shadow-sm">
          <div className="text-sm font-semibold text-red-700">图谱加载失败</div>
          <div className="mt-2 font-mono text-xs leading-relaxed text-text-secondary">{state.error}</div>
        </div>
      </main>
    );
  }

  return (
    <main className="flex h-screen w-screen flex-col overflow-hidden bg-root text-text-primary">
      <header className="flex h-14 shrink-0 items-center gap-4 border-b border-border-subtle bg-surface px-4">
        <div className="min-w-0 shrink-0">
          <div className="truncate text-sm font-semibold">{state.graph.project.name}</div>
          <div className="font-mono text-[11px] text-text-muted">
            {summary?.nodes} nodes · {summary?.edges} edges · {summary?.layers} layers ·{" "}
            {summary?.tourSteps} tour
          </div>
        </div>
        <div className="min-w-0 flex-1 overflow-hidden">
          <LayerLegend />
        </div>
        <div className="w-[360px] shrink-0">
          <SearchBar />
        </div>
      </header>

      <WarningBanner issues={state.issues} />

      {commitWarning && (
        <div className="shrink-0 border-b border-amber-200 bg-amber-50 px-4 py-2 text-xs text-amber-900">
          {commitWarning}
        </div>
      )}

      <section className="grid min-h-0 flex-1 grid-cols-[340px_minmax(0,1fr)_380px]">
        <aside className="flex min-h-0 flex-col border-r border-border-subtle bg-surface">
          <div className="flex shrink-0 gap-1 border-b border-border-subtle p-2">
            <button
              type="button"
              onClick={() => setSidebarTab("overview")}
              className={`flex-1 rounded-md px-3 py-1.5 text-xs font-medium ${
                sidebarTab === "overview"
                  ? "bg-accent/10 text-accent"
                  : "text-text-secondary hover:bg-elevated"
              }`}
            >
              概览
            </button>
            <button
              type="button"
              onClick={() => setSidebarTab("files")}
              className={`flex-1 rounded-md px-3 py-1.5 text-xs font-medium ${
                sidebarTab === "files"
                  ? "bg-accent/10 text-accent"
                  : "text-text-secondary hover:bg-elevated"
              }`}
            >
              文件
            </button>
          </div>
          <div className="min-h-0 flex-1 overflow-auto">
            {sidebarTab === "files" ? <FileExplorer /> : <ProjectOverview />}
          </div>
        </aside>

        <div className="min-h-0 min-w-0 bg-root">
          <GraphView />
        </div>

        <aside className="flex min-h-0 flex-col border-l border-border-subtle bg-surface">
          <div className="min-h-0 flex-1 overflow-auto">
            {selectedNodeId ? (
              <NodeInfo />
            ) : (
              <div className="p-5 text-sm text-text-secondary">从图谱中选择一个节点。</div>
            )}
          </div>
          {codeViewerOpen && (
            <div className="h-[46%] min-h-[280px] border-t border-border-subtle">
              <CodeViewer accessToken="__local__" onClose={closeCodeViewer} />
            </div>
          )}
        </aside>
      </section>
    </main>
  );
}

export default function App() {
  return (
    <I18nProvider language="zh">
      <ThemeProvider>
        <AppContent />
      </ThemeProvider>
    </I18nProvider>
  );
}
