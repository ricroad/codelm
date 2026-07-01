import { useCallback, useEffect, useMemo, useReducer, useState } from "react";
import type { GraphIssue } from "@understand-anything/core/schema";
import type { GraphNode, KnowledgeGraph, TourStep } from "@understand-anything/core/types";
import GraphView from "../vendor/ua/components/GraphView";
import SearchBar from "../vendor/ua/components/SearchBar";
import NodeInfo from "../vendor/ua/components/NodeInfo";
import FileExplorer from "../vendor/ua/components/FileExplorer";
import WarningBanner from "../vendor/ua/components/WarningBanner";
import CodeViewer from "../vendor/ua/components/CodeViewer";
import { I18nProvider } from "../vendor/ua/contexts/I18nContext";
import { ThemeProvider } from "../vendor/ua/themes";
import { useDashboardStore } from "../vendor/ua/store";
import {
  GENERALIZE_VARIANTS,
  LEARN_VARIANTS,
  MODE_LABELS,
  OVERVIEW_CAPTION,
  applyDesignAction,
  defaultDesignState,
  getModeHeading,
  type AppMode,
  type GeneralizeVariant,
  type LearnVariant,
} from "./designState";
import { graphSummary, loadGraphData, resolveGraphWarning } from "./graphData";
import { requestClaudeFeynmanFeedback } from "../feynman/ai";
import { buildLocalFeynmanFeedback, type FeynmanFeedback } from "../feynman/feedback";
import { loadTruthContext, type TruthContext, type TruthEdge } from "../feynman/truth";
import { requestClaudeGeneralizeFeedback } from "../generalize/ai";
import {
  appendGeneralizeConversation,
  buildLocalGeneralizeFeedback,
  type GeneralizeConversationTurn,
  type GeneralizeFeedback,
} from "../generalize/feedback";
import {
  createEmptyProgress,
  progressSummary,
  recordAttempt,
  recordMastery,
  type LearningProgress,
} from "../progress/progress";
import { loadStoredProgress, saveStoredProgress } from "../progress/persistence";
import {
  apiKeyStatusLabel,
  clearApiKey,
  loadApiKeyStatus,
  loadProjectPaths,
  projectPathsLabel,
  saveApiKey,
  saveProjectPaths,
  type ApiKeyStatus,
  type ProjectPaths,
} from "./settings";

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

function sortedTour(graph: KnowledgeGraph): TourStep[] {
  return [...graph.tour].sort((a, b) => a.order - b.order);
}

function nodeForLearning(
  graph: KnowledgeGraph,
  selectedNodeId: string | null,
  currentTourStep: number,
): GraphNode | null {
  if (selectedNodeId) {
    const selected = graph.nodes.find((node) => node.id === selectedNodeId);
    if (selected) return selected;
  }
  const step = sortedTour(graph)[currentTourStep] ?? sortedTour(graph)[0];
  const firstStepNode = step?.nodeIds
    .map((id) => graph.nodes.find((node) => node.id === id))
    .find(Boolean);
  return firstStepNode ?? graph.nodes[0] ?? null;
}

function PillButton({
  active,
  children,
  onClick,
}: {
  active: boolean;
  children: React.ReactNode;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`h-8 rounded-full px-3 text-xs font-medium transition ${
        active
          ? "bg-[#1d1d1f] text-white shadow-sm"
          : "bg-white/70 text-text-secondary hover:bg-white hover:text-text-primary"
      }`}
    >
      {children}
    </button>
  );
}

function ModeTabs({
  mode,
  onMode,
}: {
  mode: AppMode;
  onMode: (mode: AppMode) => void;
}) {
  return (
    <div className="flex rounded-full border border-border-subtle bg-elevated p-1 shadow-sm">
      {(Object.keys(MODE_LABELS) as AppMode[]).map((item) => (
        <button
          key={item}
          type="button"
          onClick={() => onMode(item)}
          className={`h-8 rounded-full px-5 text-sm font-medium transition ${
            mode === item
              ? "bg-white text-accent shadow-sm"
              : "text-text-secondary hover:text-text-primary"
          }`}
        >
          {MODE_LABELS[item]}
        </button>
      ))}
    </div>
  );
}

function SettingsPanel({
  status,
  projectPaths,
  draftKey,
  repoRootDraft,
  graphPathDraft,
  saving,
  projectPathsSaving,
  error,
  projectPathsError,
  onDraftKey,
  onRepoRootDraft,
  onGraphPathDraft,
  onSave,
  onClear,
  onSaveProjectPaths,
  onClose,
}: {
  status: ApiKeyStatus;
  projectPaths: ProjectPaths;
  draftKey: string;
  repoRootDraft: string;
  graphPathDraft: string;
  saving: boolean;
  projectPathsSaving: boolean;
  error: string | null;
  projectPathsError: string | null;
  onDraftKey: (value: string) => void;
  onRepoRootDraft: (value: string) => void;
  onGraphPathDraft: (value: string) => void;
  onSave: () => void;
  onClear: () => void;
  onSaveProjectPaths: () => void;
  onClose: () => void;
}) {
  const desktopRequired = status.source === "desktop-required";
  const projectPathsDesktopRequired = projectPaths.source === "desktop-required";
  return (
    <div className="absolute right-5 top-[62px] z-50 max-h-[calc(100vh-88px)] w-[min(520px,calc(100vw-40px))] overflow-auto rounded-xl border border-border-subtle bg-white p-4 shadow-2xl">
      <div className="flex items-center justify-between gap-3">
        <div>
          <div className="text-sm font-semibold">设置</div>
          <div className="mt-1 text-xs text-text-muted">
            API {apiKeyStatusLabel(status)} · 路径 {projectPathsLabel(projectPaths)}
          </div>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="h-8 rounded-lg border border-border-subtle px-3 text-xs text-text-secondary"
        >
          关闭
        </button>
      </div>

      <section className="mt-4">
        <div className="flex items-center justify-between gap-3">
          <div className="text-xs font-semibold uppercase tracking-wide text-accent">
            Claude API
          </div>
          <div className="text-xs text-text-muted">{apiKeyStatusLabel(status)}</div>
        </div>
        <input
          value={draftKey}
          onChange={(event) => onDraftKey(event.target.value)}
          disabled={desktopRequired}
          className="mt-3 h-10 w-full rounded-lg border border-border-subtle bg-elevated px-3 font-mono text-xs outline-none focus:border-accent disabled:opacity-50"
          placeholder={desktopRequired ? "桌面 App 中可保存 key" : "sk-ant-api03-..."}
          type="password"
        />
        <div className="mt-4 flex gap-2">
          <button
            type="button"
            onClick={onSave}
            disabled={desktopRequired || saving || draftKey.trim().length === 0}
            className="h-9 flex-1 rounded-lg bg-accent text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-40"
          >
            {saving ? "保存中" : "保存 key"}
          </button>
          <button
            type="button"
            onClick={onClear}
            disabled={desktopRequired || saving || status.source === "env"}
            className="h-9 flex-1 rounded-lg border border-border-subtle bg-white text-sm disabled:cursor-not-allowed disabled:opacity-40"
          >
            清除本地 key
          </button>
        </div>
      </section>

      <section className="mt-5 border-t border-border-subtle pt-4">
        <div className="flex items-center justify-between gap-3">
          <div className="text-xs font-semibold uppercase tracking-wide text-accent">
            项目路径
          </div>
          <div className="text-xs text-text-muted">{projectPathsLabel(projectPaths)}</div>
        </div>
        <label className="mt-3 block text-[11px] font-semibold uppercase tracking-wide text-text-muted">
          Repo root
        </label>
        <input
          value={repoRootDraft}
          onChange={(event) => onRepoRootDraft(event.target.value)}
          disabled={projectPathsDesktopRequired}
          className="mt-2 h-10 w-full rounded-lg border border-border-subtle bg-elevated px-3 font-mono text-xs outline-none focus:border-accent disabled:opacity-50"
          placeholder="~/Desktop/yanzu/画布项目/frontend-repo"
        />
        <label className="mt-3 block text-[11px] font-semibold uppercase tracking-wide text-text-muted">
          Graph JSON
        </label>
        <input
          value={graphPathDraft}
          onChange={(event) => onGraphPathDraft(event.target.value)}
          disabled={projectPathsDesktopRequired}
          className="mt-2 h-10 w-full rounded-lg border border-border-subtle bg-elevated px-3 font-mono text-xs outline-none focus:border-accent disabled:opacity-50"
          placeholder="留空则使用 repo/.understand-anything/knowledge-graph.json"
        />
        <button
          type="button"
          onClick={onSaveProjectPaths}
          disabled={projectPathsDesktopRequired || projectPathsSaving}
          className="mt-4 h-9 w-full rounded-lg bg-accent text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-40"
        >
          {projectPathsSaving ? "保存并加载中" : "保存路径并重载"}
        </button>
      </section>

      {error && (
        <div className="mt-3 rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs leading-5 text-amber-900">
          {error}
        </div>
      )}
      {projectPathsError && (
        <div className="mt-3 rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs leading-5 text-amber-900">
          {projectPathsError}
        </div>
      )}
    </div>
  );
}

function MetricTile({ value, label }: { value: string | number; label: string }) {
  return (
    <div className="rounded-lg border border-border-subtle bg-elevated p-3">
      <div className="font-mono text-2xl text-accent">{value}</div>
      <div className="mt-1 text-[11px] text-text-muted">{label}</div>
    </div>
  );
}

function OverviewRail({
  graph,
  currentTourStep,
  onStep,
  onStart,
}: {
  graph: KnowledgeGraph;
  currentTourStep: number;
  onStep: (index: number) => void;
  onStart: () => void;
}) {
  const summary = graphSummary(graph);
  const tour = sortedTour(graph);
  return (
    <aside className="flex min-h-0 flex-col border-r border-border-subtle bg-surface">
      <div className="border-b border-border-subtle p-5">
        <div className="text-xs font-semibold uppercase tracking-wide text-accent">学习路径</div>
        <h2 className="mt-2 text-2xl font-semibold tracking-tight">{graph.project.name}</h2>
        <p className="mt-3 text-sm leading-6 text-text-secondary">{OVERVIEW_CAPTION}</p>
        <div className="mt-5 grid grid-cols-2 gap-3">
          <MetricTile value={summary.nodes} label="节点" />
          <MetricTile value={summary.layers} label="层级" />
          <MetricTile value={summary.tourSteps} label="路径步" />
          <MetricTile value={summary.edges} label="依赖边" />
        </div>
        <button
          type="button"
          onClick={onStart}
          className="mt-5 h-10 w-full rounded-lg bg-accent text-sm font-semibold text-white shadow-sm"
        >
          开始导览
        </button>
      </div>
      <div className="min-h-0 flex-1 overflow-auto p-3">
        {tour.map((step, index) => (
          <button
            key={`${step.order}-${step.title}`}
            type="button"
            onClick={() => onStep(index)}
            className={`mb-2 w-full rounded-lg border p-3 text-left transition ${
              index === currentTourStep
                ? "border-accent bg-accent/10"
                : "border-border-subtle bg-white hover:border-accent/30"
            }`}
          >
            <div className="flex items-center justify-between gap-3">
              <span className="text-xs font-semibold text-accent">
                {String(step.order).padStart(2, "0")}
              </span>
              <span className="text-[11px] text-text-muted">{step.nodeIds.length} 个节点</span>
            </div>
            <div className="mt-1 text-sm font-semibold text-text-primary">{step.title}</div>
            <div className="mt-1 line-clamp-2 text-xs leading-5 text-text-secondary">
              {step.description}
            </div>
          </button>
        ))}
      </div>
    </aside>
  );
}

function ProgressRail({
  graph,
  progress,
  commitWarning,
  storageWarning,
}: {
  graph: KnowledgeGraph;
  progress: LearningProgress;
  commitWarning: string | null;
  storageWarning: string | null;
}) {
  const summary = progressSummary(graph, progress);
  return (
    <aside className="flex min-h-0 flex-col border-l border-border-subtle bg-surface">
      <div className="border-b border-border-subtle p-5">
        <div className="text-xs font-semibold uppercase tracking-wide text-accent">掌握度</div>
        <div className="mt-3 flex items-end gap-2">
          <span className="font-mono text-4xl text-text-primary">{summary.masteryPercent}%</span>
          <span className="pb-1 text-xs text-text-muted">
            {summary.masteredNodes}/{graph.nodes.length} 节点
          </span>
        </div>
        <div className="mt-4 h-2 overflow-hidden rounded-full bg-elevated">
          <div className="h-full bg-accent" style={{ width: `${summary.masteryPercent}%` }} />
        </div>
        <div className="mt-4 grid grid-cols-2 gap-3">
          <MetricTile value={`${summary.completedTourSteps}/${summary.totalTourSteps}`} label="路径完成" />
          <MetricTile value={summary.streakDays} label="连续天数" />
        </div>
      </div>
      <div className="min-h-0 flex-1 overflow-auto p-5">
        <div className="text-xs font-semibold uppercase tracking-wide text-accent">薄弱点</div>
        <div className="mt-3 flex flex-wrap gap-2">
          {(summary.weakPoints.length > 0 ? summary.weakPoints : ["关键依赖流向", "分层边界"]).map(
            (point) => (
              <span key={point} className="rounded-full border border-border-subtle bg-elevated px-3 py-1 text-xs text-text-secondary">
                {point}
              </span>
            ),
          )}
        </div>
        {commitWarning && (
          <div className="mt-5 rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs leading-5 text-amber-900">
            {commitWarning}
          </div>
        )}
        {storageWarning && (
          <div className="mt-3 rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs leading-5 text-amber-900">
            {storageWarning}
          </div>
        )}
        <div className="mt-5 text-xs font-semibold uppercase tracking-wide text-accent">文件树</div>
        <div className="mt-3 max-h-[420px] overflow-auto rounded-lg border border-border-subtle">
          <FileExplorer />
        </div>
      </div>
    </aside>
  );
}

function LearningPathBar({
  graph,
  currentTourStep,
  onStep,
}: {
  graph: KnowledgeGraph;
  currentTourStep: number;
  onStep: (index: number) => void;
}) {
  const tour = sortedTour(graph);
  return (
    <div className="absolute left-5 right-5 top-5 z-10 rounded-xl border border-border-subtle bg-white/90 p-3 shadow-sm backdrop-blur">
      <div className="flex items-center justify-between gap-4">
        <div>
          <div className="text-[11px] font-semibold uppercase tracking-wide text-accent">
            学习路径 · {Math.min(currentTourStep + 1, tour.length)}/{tour.length}
          </div>
          <div className="mt-1 text-sm font-semibold">{tour[currentTourStep]?.title ?? "项目概览"}</div>
        </div>
        <div className="flex min-w-0 flex-1 gap-1 overflow-hidden">
          {tour.map((step, index) => (
            <button
              key={step.order}
              type="button"
              title={step.title}
              onClick={() => onStep(index)}
              className={`h-2 flex-1 rounded-full ${
                index <= currentTourStep ? "bg-accent" : "bg-elevated"
              }`}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

function FeedbackCard({
  feedback,
  onReset,
  onMastered,
}: {
  feedback: FeynmanFeedback;
  onReset: () => void;
  onMastered: () => void;
}) {
  const percent = Math.round((feedback.convergence.aligned / feedback.convergence.total) * 100);
  return (
    <div className="mt-4 rounded-xl border border-border-subtle bg-white p-4 shadow-sm">
      <div className="flex items-center justify-between gap-3">
        <div className="text-sm font-semibold">{feedback.verdict}</div>
        <div className="font-mono text-xs text-accent">
          {feedback.convergence.aligned}/{feedback.convergence.total} · {percent}%
        </div>
      </div>
      <div className="mt-3 h-2 overflow-hidden rounded-full bg-elevated">
        <div className="h-full bg-accent" style={{ width: `${percent}%` }} />
      </div>
      <div className="mt-4 space-y-2">
        {feedback.points.map((point, index) => (
          <div key={`${point.kind}-${index}`} className="flex gap-2 text-sm leading-6">
            <span
              className={`mt-1 h-4 w-4 shrink-0 rounded-full text-center text-[10px] leading-4 text-white ${
                point.kind === "hit"
                  ? "bg-emerald-500"
                  : point.kind === "deviation"
                    ? "bg-amber-500"
                    : "bg-rose-500"
              }`}
            >
              {point.kind === "hit" ? "✓" : point.kind === "deviation" ? "!" : "×"}
            </span>
            <span className="text-text-secondary">{point.text}</span>
          </div>
        ))}
      </div>
      <p className="mt-4 rounded-lg bg-elevated p-3 text-sm leading-6 text-text-secondary">
        {feedback.mentorComment}
      </p>
      <div className="mt-3 rounded-lg border border-accent/20 bg-accent/5 p-3 text-sm">
        <div className="text-xs font-semibold text-accent">{feedback.followUp.targetConcept}</div>
        <div className="mt-1 text-text-primary">{feedback.followUp.question}</div>
      </div>
      <div className="mt-4 flex gap-2">
        <button type="button" onClick={onReset} className="h-9 flex-1 rounded-lg border border-border-subtle bg-white text-sm">
          再讲一遍
        </button>
        <button type="button" onClick={onMastered} className="h-9 flex-1 rounded-lg bg-accent text-sm font-semibold text-white">
          标记学会
        </button>
      </div>
    </div>
  );
}

function EdgeList({ title, edges }: { title: string; edges: TruthEdge[] }) {
  if (edges.length === 0) return null;
  return (
    <div>
      <div className="text-[11px] font-semibold uppercase tracking-wide text-text-muted">{title}</div>
      <div className="mt-2 space-y-1">
        {edges.slice(0, 4).map((edge) => (
          <div
            key={`${edge.relation}-${edge.otherNodeId}`}
            className="rounded-lg bg-white px-3 py-2 text-xs leading-5 text-text-secondary"
          >
            <span className="font-mono text-accent">{edge.relation}</span>
            <span className="mx-2 text-text-muted">→</span>
            <span className="font-medium text-text-primary">{edge.otherNodeName}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function TruthContextCard({
  node,
  truthContext,
  truthLoading,
  truthError,
}: {
  node: GraphNode;
  truthContext: TruthContext | null;
  truthLoading: boolean;
  truthError: string | null;
}) {
  const truthNode = truthContext?.node;
  const snippet = truthContext?.sourceSnippet;
  return (
    <div className="rounded-xl border border-border-subtle bg-elevated p-4">
      <div className="flex items-center justify-between gap-3">
        <div className="text-[11px] font-semibold uppercase tracking-wide text-accent">真相卡</div>
        {truthContext?.layer && (
          <span className="rounded-full bg-white px-2.5 py-1 text-[11px] text-text-secondary">
            {truthContext.layer.name}
          </span>
        )}
      </div>
      <div className="mt-2 text-lg font-semibold">{truthNode?.name ?? node.name}</div>
      <p className="mt-2 text-sm leading-6 text-text-secondary">
        {truthNode?.summary ?? node.summary}
      </p>
      <div className="mt-3 flex flex-wrap gap-2">
        {(truthNode?.tags ?? node.tags).slice(0, 5).map((tag) => (
          <span key={tag} className="rounded-full bg-white px-2.5 py-1 text-[11px] text-text-secondary">
            {tag}
          </span>
        ))}
      </div>
      {truthLoading && (
        <div className="mt-4 rounded-lg border border-border-subtle bg-white p-3 text-xs text-text-muted">
          正在读取源码片段和依赖边
        </div>
      )}
      {truthError && (
        <div className="mt-4 rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs leading-5 text-amber-900">
          真相上下文暂不可用：{truthError}
        </div>
      )}
      {snippet && (
        <div className="mt-4 overflow-hidden rounded-lg border border-border-subtle bg-[#1d1d1f]">
          <div className="flex items-center justify-between border-b border-white/10 px-3 py-2 font-mono text-[11px] text-white/65">
            <span>{snippet.path}</span>
            <span>
              L{snippet.startLine}-L{snippet.endLine}
            </span>
          </div>
          <pre className="max-h-44 overflow-auto p-3 font-mono text-[11px] leading-5 text-white">
            {snippet.content}
          </pre>
        </div>
      )}
      {truthContext && (
        <div className="mt-4 grid gap-3">
          <EdgeList title="它依赖 / 调用" edges={truthContext.outgoingEdges} />
          <EdgeList title="谁依赖它" edges={truthContext.incomingEdges} />
        </div>
      )}
    </div>
  );
}

function FeynmanPanel({
  node,
  variant,
  truthContext,
  truthLoading,
  truthError,
  feedbackLoading,
  feedbackError,
  submitted,
  explanation,
  feedback,
  onVariant,
  onExplanation,
  onSubmit,
  onReset,
  onMastered,
}: {
  node: GraphNode | null;
  variant: LearnVariant;
  truthContext: TruthContext | null;
  truthLoading: boolean;
  truthError: string | null;
  feedbackLoading: boolean;
  feedbackError: string | null;
  submitted: boolean;
  explanation: string;
  feedback: FeynmanFeedback | null;
  onVariant: (variant: LearnVariant) => void;
  onExplanation: (value: string) => void;
  onSubmit: () => void;
  onReset: () => void;
  onMastered: () => void;
}) {
  const selectedVariant = LEARN_VARIANTS[variant];
  return (
    <aside className="flex min-h-0 flex-col border-l border-border-subtle bg-surface">
      <div className="border-b border-border-subtle p-5">
        <div className="text-xs font-semibold uppercase tracking-wide text-accent">费曼闭环</div>
        <h2 className="mt-2 text-xl font-semibold">{selectedVariant.title}</h2>
        <p className="mt-2 text-sm leading-6 text-text-secondary">{selectedVariant.description}</p>
        <div className="mt-4 flex gap-2">
          {(Object.keys(LEARN_VARIANTS) as LearnVariant[]).map((item) => (
            <PillButton key={item} active={item === variant} onClick={() => onVariant(item)}>
              {LEARN_VARIANTS[item].label}
            </PillButton>
          ))}
        </div>
      </div>
      <div className="min-h-0 flex-1 overflow-auto p-5">
        {node ? (
          <>
            <TruthContextCard
              node={node}
              truthContext={truthContext}
              truthLoading={truthLoading}
              truthError={truthError}
            />
            <label className="mt-4 block text-xs font-semibold uppercase tracking-wide text-accent">
              你来讲
            </label>
            <textarea
              value={explanation}
              onChange={(event) => onExplanation(event.target.value)}
              className="mt-2 h-36 w-full resize-none rounded-xl border border-border-subtle bg-white p-3 text-sm leading-6 outline-none focus:border-accent"
              placeholder="用自己的话讲清职责、分层位置、依赖流向。"
            />
            <button
              type="button"
              onClick={onSubmit}
              disabled={feedbackLoading || explanation.trim().length === 0}
              className="mt-3 h-10 w-full rounded-lg bg-accent text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-40"
            >
              {feedbackLoading ? "正在对齐" : "对齐一下"}
            </button>
            {feedbackError && (
              <div className="mt-3 rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs leading-5 text-amber-900">
                {feedbackError}
              </div>
            )}
            {submitted && feedback && (
              <FeedbackCard feedback={feedback} onReset={onReset} onMastered={onMastered} />
            )}
          </>
        ) : (
          <div className="rounded-xl border border-border-subtle bg-elevated p-4 text-sm text-text-secondary">
            图谱加载后会出现节点真相卡。
          </div>
        )}
      </div>
    </aside>
  );
}

function LearnOverlay({
  variant,
  node,
  truthContext,
  truthLoading,
  truthError,
  feedbackLoading,
  feedbackError,
  explanation,
  feedback,
  submitted,
  onExplanation,
  onSubmit,
  onReset,
  onMastered,
}: {
  variant: LearnVariant;
  node: GraphNode | null;
  truthContext: TruthContext | null;
  truthLoading: boolean;
  truthError: string | null;
  feedbackLoading: boolean;
  feedbackError: string | null;
  explanation: string;
  feedback: FeynmanFeedback | null;
  submitted: boolean;
  onExplanation: (value: string) => void;
  onSubmit: () => void;
  onReset: () => void;
  onMastered: () => void;
}) {
  if (variant === "A" || !node) return null;
  const isDiff = variant === "C";
  const checklist = [
    `职责：${truthContext?.node.summary ?? node.summary}`,
    truthContext?.layer ? `分层：${truthContext.layer.name} · ${truthContext.layer.description}` : null,
    ...((truthContext?.outgoingEdges ?? []).slice(0, 2).map((edge) => `出边：${edge.relation} → ${edge.otherNodeName}`)),
    ...((truthContext?.incomingEdges ?? []).slice(0, 2).map((edge) => `入边：${edge.otherNodeName} → ${edge.relation}`)),
  ].filter(Boolean);
  return (
    <div className="absolute inset-0 z-20 flex items-center justify-center bg-[#e8e8ed]/75 p-10 backdrop-blur-sm">
      <div className="grid max-h-full w-[min(980px,100%)] grid-cols-2 gap-5 overflow-auto rounded-2xl border border-border-subtle bg-white p-5 shadow-2xl">
        <section>
          <div className="text-xs font-semibold uppercase tracking-wide text-accent">
            {isDiff ? "代码真相清单" : "专注讲台"}
          </div>
          <h3 className="mt-2 text-2xl font-semibold">{node.name}</h3>
          <p className="mt-3 text-sm leading-6 text-text-secondary">{node.summary}</p>
          {truthLoading && (
            <div className="mt-4 rounded-lg bg-elevated p-3 text-xs text-text-muted">
              正在读取源码片段和依赖边
            </div>
          )}
          {truthError && (
            <div className="mt-4 rounded-lg bg-amber-50 p-3 text-xs leading-5 text-amber-900">
              真相上下文暂不可用：{truthError}
            </div>
          )}
          {truthContext?.sourceSnippet && (
            <pre className="mt-4 max-h-56 overflow-auto rounded-lg bg-[#1d1d1f] p-3 font-mono text-[11px] leading-5 text-white">
              {truthContext.sourceSnippet.content}
            </pre>
          )}
          {isDiff && (
            <div className="mt-4 space-y-2">
              {(checklist.length > 0 ? checklist : ["职责", "分层位置", "关键依赖流向", "上下游影响"]).map((item, index) => (
                <div key={item} className="rounded-lg bg-elevated p-3 text-sm">
                  {index + 1}. {item}
                </div>
              ))}
            </div>
          )}
        </section>
        <section>
          <label className="text-xs font-semibold uppercase tracking-wide text-accent">
            {isDiff ? "你的讲解" : "对着源码讲"}
          </label>
          <textarea
            value={explanation}
            onChange={(event) => onExplanation(event.target.value)}
            className="mt-2 h-48 w-full resize-none rounded-xl border border-border-subtle bg-elevated p-3 text-sm leading-6 outline-none focus:border-accent"
            placeholder="先讲职责，再讲边界，最后讲依赖流向。"
          />
          <button
            type="button"
            onClick={onSubmit}
            disabled={feedbackLoading || explanation.trim().length === 0}
            className="mt-3 h-10 w-full rounded-lg bg-accent text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-40"
          >
            {feedbackLoading ? "正在对齐" : "生成对齐卡"}
          </button>
          {feedbackError && (
            <div className="mt-3 rounded-lg bg-amber-50 p-3 text-xs leading-5 text-amber-900">
              {feedbackError}
            </div>
          )}
          {submitted && feedback && (
            <FeedbackCard feedback={feedback} onReset={onReset} onMastered={onMastered} />
          )}
        </section>
      </div>
    </div>
  );
}

function GeneralizePanel({
  genVar,
  submitted,
  response,
  conversation,
  feedback,
  feedbackLoading,
  feedbackError,
  onGenVar,
  onResponse,
  onSubmit,
  onReset,
}: {
  genVar: GeneralizeVariant;
  submitted: boolean;
  response: string;
  conversation: GeneralizeConversationTurn[];
  feedback: GeneralizeFeedback | null;
  feedbackLoading: boolean;
  feedbackError: string | null;
  onGenVar: (value: GeneralizeVariant) => void;
  onResponse: (value: string) => void;
  onSubmit: () => void;
  onReset: () => void;
}) {
  const selected = GENERALIZE_VARIANTS[genVar];
  const hasTeachHistory = genVar === "Z" && conversation.length > 0;
  const needsTeachFollowUp = hasTeachHistory && !feedback?.understood;
  const percent = feedback
    ? Math.round((feedback.coverage.covered / Math.max(feedback.coverage.total, 1)) * 100)
    : 0;
  return (
    <aside className="flex min-h-0 flex-col border-l border-border-subtle bg-surface">
      <div className="border-b border-border-subtle p-5">
        <div className="text-xs font-semibold uppercase tracking-wide text-accent">泛化</div>
        <h2 className="mt-2 text-xl font-semibold">{selected.title}</h2>
        <div className="mt-4 flex gap-2">
          {(Object.keys(GENERALIZE_VARIANTS) as GeneralizeVariant[]).map((item) => (
            <PillButton key={item} active={item === genVar} onClick={() => onGenVar(item)}>
              {GENERALIZE_VARIANTS[item].label}
            </PillButton>
          ))}
        </div>
      </div>
      <div className="min-h-0 flex-1 overflow-auto p-5">
        <div className="rounded-xl border border-accent/20 bg-accent/5 p-4 text-sm leading-6">
          {selected.prompt}
        </div>
        {hasTeachHistory && (
          <div className="mt-4 space-y-2 rounded-xl border border-border-subtle bg-elevated p-3">
            <div className="text-[11px] font-semibold uppercase tracking-wide text-accent">
              新人对话
            </div>
            {conversation.map((turn, index) => (
              <div
                key={`${turn.speaker}-${index}`}
                className={`rounded-lg px-3 py-2 text-sm leading-6 ${
                  turn.speaker === "learner"
                    ? "bg-white text-text-primary"
                    : "border border-accent/20 bg-accent/5 text-text-secondary"
                }`}
              >
                <span className="mr-2 font-semibold text-accent">
                  {turn.speaker === "learner" ? "你" : "新人"}
                </span>
                {turn.text}
              </div>
            ))}
          </div>
        )}
        <textarea
          value={response}
          onChange={(event) => onResponse(event.target.value)}
          className="mt-4 h-44 w-full resize-none rounded-xl border border-border-subtle bg-white p-3 text-sm leading-6 outline-none focus:border-accent"
          placeholder="串讲整条链路：入口、状态、命令边界、模型调用、结果回写。"
        />
        <button
          type="button"
          onClick={onSubmit}
          disabled={feedbackLoading || response.trim().length === 0}
          className="mt-3 h-10 w-full rounded-lg bg-accent text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-40"
        >
          {feedbackLoading ? "正在核对" : needsTeachFollowUp ? "回答新人追问" : "核对迁移能力"}
        </button>
        {feedbackError && (
          <div className="mt-3 rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs leading-5 text-amber-900">
            {feedbackError}
          </div>
        )}
        {submitted && feedback && (
          <div className="mt-4 rounded-xl border border-border-subtle bg-white p-4 shadow-sm">
            <div className="flex items-center justify-between gap-3">
              <div className="text-sm font-semibold">{feedback.verdict}</div>
              <div className="font-mono text-xs text-accent">
                {feedback.coverage.covered}/{feedback.coverage.total} · {percent}%
              </div>
            </div>
            <div className="mt-3 h-2 overflow-hidden rounded-full bg-elevated">
              <div className="h-full bg-accent" style={{ width: `${percent}%` }} />
            </div>
            <div className="mt-4 space-y-2 text-sm text-text-secondary">
              {feedback.points.map((point, index) => (
                <div key={`${point.kind}-${index}`} className="flex gap-2 leading-6">
                  <span
                    className={`mt-1 h-4 w-4 shrink-0 rounded-full text-center text-[10px] leading-4 text-white ${
                      point.kind === "hit"
                        ? "bg-emerald-500"
                        : point.kind === "deviation"
                          ? "bg-amber-500"
                          : "bg-rose-500"
                    }`}
                  >
                    {point.kind === "hit" ? "✓" : point.kind === "deviation" ? "!" : "×"}
                  </span>
                  <span>{point.text}</span>
                </div>
              ))}
            </div>
            <p className="mt-4 rounded-lg bg-elevated p-3 text-sm leading-6 text-text-secondary">
              {feedback.mentorComment}
            </p>
            {genVar === "Z" && feedback.newcomerReply && (
              <div className="mt-3 rounded-lg border border-accent/20 bg-accent/5 p-3 text-sm leading-6">
                <div className="text-xs font-semibold text-accent">
                  {feedback.understood ? "新人已能复述" : "新人继续追问"}
                </div>
                <div className="mt-1 text-text-primary">{feedback.newcomerReply}</div>
              </div>
            )}
            <div className="mt-3 rounded-lg border border-accent/20 bg-accent/5 p-3 text-sm">
              <div className="text-xs font-semibold text-accent">
                {feedback.followUp.targetConcept}
              </div>
              <div className="mt-1 text-text-primary">{feedback.followUp.question}</div>
            </div>
            <button type="button" onClick={onReset} className="mt-4 h-9 w-full rounded-lg border border-border-subtle bg-white text-sm">
              {genVar === "Z" ? "再教一遍" : "再推演一次"}
            </button>
          </div>
        )}
      </div>
    </aside>
  );
}

function NodeRail({ selectedNodeId, codeViewerOpen, closeCodeViewer }: {
  selectedNodeId: string | null;
  codeViewerOpen: boolean;
  closeCodeViewer: () => void;
}) {
  return (
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
  );
}

function AppContent() {
  const setGraph = useDashboardStore((s) => s.setGraph);
  const selectedNodeId = useDashboardStore((s) => s.selectedNodeId);
  const codeViewerOpen = useDashboardStore((s) => s.codeViewerOpen);
  const closeCodeViewer = useDashboardStore((s) => s.closeCodeViewer);
  const startTour = useDashboardStore((s) => s.startTour);
  const setTourStep = useDashboardStore((s) => s.setTourStep);
  const currentTourStep = useDashboardStore((s) => s.currentTourStep);
  const [designState, dispatchDesign] = useReducer(applyDesignAction, defaultDesignState);
  const [progress, setProgress] = useState<LearningProgress>(() => createEmptyProgress());
  const [explanation, setExplanation] = useState("");
  const [generalizeResponse, setGeneralizeResponse] = useState("");
  const [feedback, setFeedback] = useState<FeynmanFeedback | null>(null);
  const [feedbackLoading, setFeedbackLoading] = useState(false);
  const [feedbackError, setFeedbackError] = useState<string | null>(null);
  const [generalizeFeedback, setGeneralizeFeedback] = useState<GeneralizeFeedback | null>(null);
  const [generalizeConversation, setGeneralizeConversation] = useState<GeneralizeConversationTurn[]>([]);
  const [generalizeLoading, setGeneralizeLoading] = useState(false);
  const [generalizeError, setGeneralizeError] = useState<string | null>(null);
  const [truthContext, setTruthContext] = useState<TruthContext | null>(null);
  const [truthLoading, setTruthLoading] = useState(false);
  const [truthError, setTruthError] = useState<string | null>(null);
  const [progressLoaded, setProgressLoaded] = useState(false);
  const [progressStorageWarning, setProgressStorageWarning] = useState<string | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [apiStatus, setApiStatus] = useState<ApiKeyStatus>({
    configured: false,
    source: "none",
  });
  const [apiKeyDraft, setApiKeyDraft] = useState("");
  const [apiKeySaving, setApiKeySaving] = useState(false);
  const [apiKeyError, setApiKeyError] = useState<string | null>(null);
  const [projectPaths, setProjectPaths] = useState<ProjectPaths>({
    repoRoot: "",
    graphPath: "",
    configured: false,
    source: "desktop-required",
  });
  const [repoRootDraft, setRepoRootDraft] = useState("");
  const [graphPathDraft, setGraphPathDraft] = useState("");
  const [projectPathsSaving, setProjectPathsSaving] = useState(false);
  const [projectPathsError, setProjectPathsError] = useState<string | null>(null);
  const [state, setState] = useState<LoadState>({
    status: "loading",
    error: null,
    graph: null,
    issues: [],
    repoGitCommitHash: null,
  });

  const resetGraphInteractionState = useCallback(() => {
    setExplanation("");
    setGeneralizeResponse("");
    setFeedback(null);
    setFeedbackError(null);
    setGeneralizeFeedback(null);
    setGeneralizeConversation([]);
    setGeneralizeError(null);
    setTruthContext(null);
    setTruthError(null);
    setTruthLoading(false);
    dispatchDesign({ type: "resetLearn" });
    dispatchDesign({ type: "resetGeneralize" });
  }, []);

  const loadGraphIntoState = useCallback(
    async (shouldSkip?: () => boolean) => {
      setState({
        status: "loading",
        error: null,
        graph: null,
        issues: [],
        repoGitCommitHash: null,
      });
      resetGraphInteractionState();
      try {
        const data = await loadGraphData();
        if (shouldSkip?.()) return;
        setGraph(data.graph);
        setState({
          status: "ready",
          error: null,
          graph: data.graph,
          issues: data.issues,
          repoGitCommitHash: data.repoGitCommitHash,
        });
      } catch (error: unknown) {
        if (shouldSkip?.()) return;
        setState({
          status: "error",
          error: error instanceof Error ? error.message : String(error),
          graph: null,
          issues: [],
          repoGitCommitHash: null,
        });
      }
    },
    [resetGraphInteractionState, setGraph],
  );

  useEffect(() => {
    let cancelled = false;
    void loadGraphIntoState(() => cancelled);
    return () => {
      cancelled = true;
    };
  }, [loadGraphIntoState]);

  useEffect(() => {
    let cancelled = false;
    loadApiKeyStatus()
      .then((status) => {
        if (cancelled) return;
        setApiStatus(status);
        setApiKeyError(null);
      })
      .catch((error: unknown) => {
        if (cancelled) return;
        setApiKeyError(error instanceof Error ? error.message : String(error));
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    loadProjectPaths()
      .then((paths) => {
        if (cancelled) return;
        setProjectPaths(paths);
        setRepoRootDraft(paths.repoRoot);
        setGraphPathDraft(paths.graphPath);
        setProjectPathsError(null);
      })
      .catch((error: unknown) => {
        if (cancelled) return;
        setProjectPathsError(error instanceof Error ? error.message : String(error));
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    loadStoredProgress()
      .then((storedProgress) => {
        if (cancelled) return;
        setProgress(storedProgress);
        setProgressStorageWarning(null);
        setProgressLoaded(true);
      })
      .catch((error: unknown) => {
        if (cancelled) return;
        setProgressStorageWarning(
          `学习进度读取失败，本次先使用临时进度：${error instanceof Error ? error.message : String(error)}`,
        );
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!progressLoaded) return;
    saveStoredProgress(progress)
      .then(() => setProgressStorageWarning(null))
      .catch((error: unknown) => {
        setProgressStorageWarning(
          `学习进度保存失败，本次刷新后可能丢失：${error instanceof Error ? error.message : String(error)}`,
        );
      });
  }, [progress, progressLoaded]);

  const targetNode = state.graph ? nodeForLearning(state.graph, selectedNodeId, currentTourStep) : null;
  const targetNodeId = targetNode?.id ?? null;
  const commitWarning = state.graph
    ? resolveGraphWarning(state.graph.project.gitCommitHash, state.repoGitCommitHash)
    : null;

  useEffect(() => {
    if (!state.graph || !targetNodeId) {
      setTruthContext(null);
      setTruthLoading(false);
      setTruthError(null);
      return;
    }

    const controller = new AbortController();
    setTruthLoading(true);
    setTruthError(null);
    loadTruthContext(state.graph, targetNodeId, controller.signal)
      .then((context) => {
        if (controller.signal.aborted) return;
        setTruthContext(context);
      })
      .catch((error: unknown) => {
        if (controller.signal.aborted) return;
        setTruthContext(null);
        setTruthError(error instanceof Error ? error.message : String(error));
      })
      .finally(() => {
        if (controller.signal.aborted) return;
        setTruthLoading(false);
      });

    return () => controller.abort();
  }, [state.graph, targetNodeId]);

  const handleMode = (mode: AppMode) => {
    dispatchDesign({ type: "setMode", mode });
    if (mode === "learn") startTour();
  };

  const handleTourStep = (index: number) => {
    setTourStep(index);
  };

  const handleLearnSubmit = async () => {
    if (!targetNode) return;
    setFeedbackLoading(true);
    setFeedbackError(null);
    let nextFeedback: FeynmanFeedback;
    try {
      nextFeedback = await requestClaudeFeynmanFeedback(targetNode.id, explanation);
    } catch (error: unknown) {
      nextFeedback = buildLocalFeynmanFeedback(targetNode, explanation);
      const message = error instanceof Error ? error.message : String(error);
      setFeedbackError(`真 Claude 暂不可用，已先用本地草评：${message}`);
    }
    setFeedback(nextFeedback);
    setProgress((current) =>
      recordAttempt(
        current,
        targetNode.id,
        nextFeedback.convergence.aligned / nextFeedback.convergence.total,
        nextFeedback.weakPoints,
      ),
    );
    dispatchDesign({ type: "setSubmitted", submitted: true });
    setFeedbackLoading(false);
  };

  const handleMastered = () => {
    if (!targetNode || !feedback) return;
    setProgress((current) => recordMastery(current, targetNode.id, feedback.weakPoints));
  };

  const handleGeneralizeSubmit = async () => {
    setGeneralizeLoading(true);
    setGeneralizeError(null);
    const submittedResponse = generalizeResponse;
    const conversationSnapshot = designState.genVar === "Z" ? generalizeConversation : [];
    let nextFeedback: GeneralizeFeedback;
    try {
      nextFeedback = await requestClaudeGeneralizeFeedback(
        designState.genVar,
        submittedResponse,
        conversationSnapshot,
      );
    } catch (error: unknown) {
      nextFeedback = buildLocalGeneralizeFeedback(
        designState.genVar,
        submittedResponse,
        conversationSnapshot,
      );
      const message = error instanceof Error ? error.message : String(error);
      setGeneralizeError(`真 Claude 暂不可用，已先用本地泛化草评：${message}`);
    }
    setGeneralizeFeedback(nextFeedback);
    if (designState.genVar === "Z") {
      setGeneralizeConversation((current) =>
        appendGeneralizeConversation(current, submittedResponse, nextFeedback),
      );
      if (!nextFeedback.understood) {
        setGeneralizeResponse("");
      }
    }
    dispatchDesign({ type: "setGeneralizeSubmitted", genSubmitted: true });
    setGeneralizeLoading(false);
  };

  const handleSaveApiKey = async () => {
    setApiKeySaving(true);
    setApiKeyError(null);
    try {
      const nextStatus = await saveApiKey(apiKeyDraft);
      setApiStatus(nextStatus);
      setApiKeyDraft("");
    } catch (error: unknown) {
      setApiKeyError(error instanceof Error ? error.message : String(error));
    } finally {
      setApiKeySaving(false);
    }
  };

  const handleClearApiKey = async () => {
    setApiKeySaving(true);
    setApiKeyError(null);
    try {
      const nextStatus = await clearApiKey();
      setApiStatus(nextStatus);
      setApiKeyDraft("");
    } catch (error: unknown) {
      setApiKeyError(error instanceof Error ? error.message : String(error));
    } finally {
      setApiKeySaving(false);
    }
  };

  const handleSaveProjectPaths = async () => {
    setProjectPathsSaving(true);
    setProjectPathsError(null);
    try {
      const paths = await saveProjectPaths(repoRootDraft, graphPathDraft);
      setProjectPaths(paths);
      setRepoRootDraft(paths.repoRoot);
      setGraphPathDraft(paths.graphPath);
      await loadGraphIntoState();
    } catch (error: unknown) {
      setProjectPathsError(error instanceof Error ? error.message : String(error));
    } finally {
      setProjectPathsSaving(false);
    }
  };

  const settingsPanel = settingsOpen ? (
    <SettingsPanel
      status={apiStatus}
      projectPaths={projectPaths}
      draftKey={apiKeyDraft}
      repoRootDraft={repoRootDraft}
      graphPathDraft={graphPathDraft}
      saving={apiKeySaving}
      projectPathsSaving={projectPathsSaving}
      error={apiKeyError}
      projectPathsError={projectPathsError}
      onDraftKey={setApiKeyDraft}
      onRepoRootDraft={setRepoRootDraft}
      onGraphPathDraft={setGraphPathDraft}
      onSave={handleSaveApiKey}
      onClear={handleClearApiKey}
      onSaveProjectPaths={handleSaveProjectPaths}
      onClose={() => setSettingsOpen(false)}
    />
  ) : null;

  if (state.status === "loading") {
    return (
      <main className="flex h-screen w-screen items-center justify-center bg-root text-text-primary">
        <div className="rounded-lg border border-border-subtle bg-surface px-5 py-4 shadow-sm">
          <div className="text-sm font-semibold">费曼式代码导览</div>
          <div className="mt-1 text-xs text-text-secondary">正在加载图谱</div>
        </div>
      </main>
    );
  }

  if (state.status === "error") {
    return (
      <main className="relative flex h-screen w-screen items-center justify-center bg-root p-6 text-text-primary">
        <button
          type="button"
          onClick={() => setSettingsOpen((value) => !value)}
          className="absolute right-5 top-5 h-9 rounded-lg border border-border-subtle bg-white px-3 text-xs font-semibold text-text-secondary shadow-sm"
        >
          设置路径
        </button>
        {settingsPanel}
        <div className="max-w-xl rounded-lg border border-border-subtle bg-surface px-5 py-4 shadow-sm">
          <div className="text-sm font-semibold text-red-700">图谱加载失败</div>
          <div className="mt-2 font-mono text-xs leading-relaxed text-text-secondary">{state.error}</div>
        </div>
      </main>
    );
  }

  return (
    <main className="flex h-screen w-screen flex-col overflow-hidden bg-root text-text-primary">
      <header className="relative flex h-[72px] shrink-0 items-center gap-5 border-b border-border-subtle bg-white px-5">
        <div className="min-w-[220px]">
          <div className="text-sm font-semibold">费曼式代码导览</div>
          <div className="mt-1 font-mono text-[11px] text-text-muted">{state.graph.project.name}</div>
        </div>
        <ModeTabs mode={designState.mode} onMode={handleMode} />
        <div className="min-w-0 flex-1">
          <div className="truncate text-sm font-medium">{getModeHeading(designState.mode)}</div>
          <div className="mt-1 font-mono text-[11px] text-text-muted">
            {state.graph.nodes.length} nodes · {state.graph.edges.length} edges · {state.graph.layers.length} layers · {state.graph.tour.length} tour
          </div>
        </div>
        <div className="w-[340px] shrink-0">
          <SearchBar />
        </div>
        <button
          type="button"
          onClick={() => setSettingsOpen((value) => !value)}
          className={`h-9 shrink-0 rounded-lg border px-3 text-xs font-semibold ${
            apiStatus.configured
              ? "border-accent/20 bg-accent/5 text-accent"
              : "border-border-subtle bg-elevated text-text-secondary"
          }`}
        >
          API
        </button>
        {settingsPanel}
      </header>

      <WarningBanner issues={state.issues} />

      <section
        className={`grid min-h-0 flex-1 ${
          designState.mode === "overview"
            ? "grid-cols-[360px_minmax(0,1fr)_360px]"
            : "grid-cols-[minmax(0,1fr)_420px]"
        }`}
      >
        {designState.mode === "overview" && (
          <OverviewRail
            graph={state.graph}
            currentTourStep={currentTourStep}
            onStep={handleTourStep}
            onStart={() => handleMode("learn")}
          />
        )}

        <div className="relative min-h-0 min-w-0 bg-root">
          {designState.mode === "learn" && (
            <LearningPathBar graph={state.graph} currentTourStep={currentTourStep} onStep={handleTourStep} />
          )}
          {designState.mode === "generalize" && (
            <div className="absolute left-5 top-5 z-10 rounded-xl border border-border-subtle bg-white/90 px-4 py-3 shadow-sm backdrop-blur">
              <div className="text-xs font-semibold uppercase tracking-wide text-accent">
                {GENERALIZE_VARIANTS[designState.genVar].label}
              </div>
              <div className="mt-1 text-sm font-semibold">{GENERALIZE_VARIANTS[designState.genVar].prompt}</div>
            </div>
          )}
          <GraphView />
          <LearnOverlay
            variant={designState.variant}
            node={targetNode}
            truthContext={truthContext}
            truthLoading={truthLoading}
            truthError={truthError}
            feedbackLoading={feedbackLoading}
            feedbackError={feedbackError}
            explanation={explanation}
            feedback={feedback}
            submitted={designState.submitted}
            onExplanation={setExplanation}
            onSubmit={handleLearnSubmit}
            onReset={() => dispatchDesign({ type: "resetLearn" })}
            onMastered={handleMastered}
          />
        </div>

        {designState.mode === "overview" && (
          <ProgressRail
            graph={state.graph}
            progress={progress}
            commitWarning={commitWarning}
            storageWarning={progressStorageWarning}
          />
        )}

        {designState.mode === "learn" && (
          <FeynmanPanel
            node={targetNode}
            variant={designState.variant}
            truthContext={truthContext}
            truthLoading={truthLoading}
            truthError={truthError}
            feedbackLoading={feedbackLoading}
            feedbackError={feedbackError}
            submitted={designState.submitted}
            explanation={explanation}
            feedback={feedback}
            onVariant={(variant) => dispatchDesign({ type: "setVariant", variant })}
            onExplanation={setExplanation}
            onSubmit={handleLearnSubmit}
            onReset={() => dispatchDesign({ type: "resetLearn" })}
            onMastered={handleMastered}
          />
        )}

        {designState.mode === "generalize" && (
          <GeneralizePanel
            genVar={designState.genVar}
            submitted={designState.genSubmitted}
            response={generalizeResponse}
            conversation={generalizeConversation}
            feedback={generalizeFeedback}
            feedbackLoading={generalizeLoading}
            feedbackError={generalizeError}
            onGenVar={(genVar) => {
              setGeneralizeResponse("");
              setGeneralizeConversation([]);
              setGeneralizeFeedback(null);
              setGeneralizeError(null);
              dispatchDesign({ type: "setGeneralizeVariant", genVar });
            }}
            onResponse={setGeneralizeResponse}
            onSubmit={handleGeneralizeSubmit}
            onReset={() => {
              setGeneralizeResponse("");
              setGeneralizeConversation([]);
              setGeneralizeFeedback(null);
              setGeneralizeError(null);
              dispatchDesign({ type: "resetGeneralize" });
            }}
          />
        )}

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
