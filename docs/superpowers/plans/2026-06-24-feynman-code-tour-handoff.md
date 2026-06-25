# 费曼式代码导览 — 项目交接（给下一个 LLM）

> 日期：2026-06-24
> 性质：**冷启动交接文档**。你（接手的 LLM）读完这一份 + 设计文档，就能接着干，不需要前一段对话。
> 权威设计文档：`docs/superpowers/specs/2026-06-24-feynman-code-tour-design.md`（有任何冲突以它为准）

---

## 0. 你的任务（TL;DR）

把一个 claude.ai 设计稿 `费曼式代码导览.dc.html` 实现成一个**本地桌面 App（Tauri + React）**：
读 Understand Anything 已生成的代码知识图谱，用**费曼学习法**带人学懂 `frontend-repo` 这个真实代码库（看真相→自己讲→**真 Claude API 对齐打分**→往复学会），并能把模式**泛化**到新场景。

**已完成**：需求对齐 + 设计文档（brainstorming 阶段全部走完，用户已口头批准设计："先按这个走吧"）。
**下一步**：用 `writing-plans` skill 把 **P0（地基）** 拆成实现计划，然后实现。

⚠️ 接手须知：本项目用户的 CLAUDE.md 强制 Superpowers 流程（每个新任务先 `using-superpowers`，写代码前 TDD，验证后再说完成）。**对用户汇报一律用大白话**（现象/原因/影响/怎么处理），技术细节让位到末尾或代码里。

---

## 1. 已拍板的决策（不要重新征求，除非用户改口）

| 决策点 | 结论 |
|---|---|
| 形态 | **Tauri 桌面软件**（可双击 .app，Rust 外壳 + React 渲染） |
| 渲染层来源 | **拿来改装**：vendor UA dashboard 的"看图引擎+数据层"，外壳按设计稿重画成 Apple 浅色 |
| AI 反馈 | **接真 Claude API**；**API key 只存 Rust 侧**（OS keychain 优先），渲染层拿不到 |
| v1 范围 | **全部还原**：3 模式（概览/学习/泛化）× 6 变体（A/B/C + X/Y/Z） |
| 重新分析代码库 | **不做**（UA 重跑需 AI 在场、无 CLI）。更新图谱=用户重跑 `/understand`，App 重读 JSON |
| 移动端/响应式 | 不做（用户既定偏好：纯 Web 桌面端） |
| 项目落位 | **本仓库 `codelm` 根即 App**（本地 `画布项目/codelm/`，远端 `github.com/ricroad/codelm`），含 `src/`(React) + `src-tauri/`(Rust) + `docs/` |

待定小决策（有默认值，不阻塞）：API key 存法（默认 keychain）；默认模型 `claude-opus-4-8`（可切 sonnet 省钱）；默认变体 A/X；repo 根默认 `../frontend-repo`。

---

## 2. 底座 = Understand Anything（必懂）

UA = **「AI 画地图」+「看地图的网页」**：
- **分析端**：`/understand` 由 Claude 带子 agent 分 8 步产出 `knowledge-graph.json`，所有语义字段（summary/tags/complexity/类型/edges/layers/tour）都是 **AI 写的**。
- **看图端**：`packages/dashboard` 是 Vite+React19+XYFlow+elkjs+Zustand+Tailwind v4，**运行时不调 AI**，只把 JSON 画成图。
- **致命约束**：UA **没有 CLI、没有 HTTP API**。外部程序只能**直接读 `knowledge-graph.json`**；"解释/提问/重新分析"都要 AI 在场（只存在于 skill 里）。→ 所以本项目的 AI 能力**必须我们自己接 Claude API**。

**数据契约**（来自 `@understand-anything/core` types.ts）：
```ts
KnowledgeGraph = { version, kind?, project, nodes[], edges[], layers[], tour[] }
GraphNode = { id, type, name, filePath?, lineRange?, summary, tags[], complexity, ... }
GraphEdge = { source, target, type, direction, description?, weight /*0-1*/ }
Layer     = { id, name, description, nodeIds[] }
TourStep  = { order, title, description, nodeIds[], languageLesson? }
```
本仓库快照：**585 文件 / 1523 nodes / 2864 edges / 10 layers / 12 tour steps**，对应 commit `d7565bd`。

**设计稿 ↔ UA 复用清单**（详见设计文档 §1.2）：
- 直接复用：`GraphView`+布局(elkjs)+分层节点(LayerCluster/Container/Portal)、`FileExplorer`、`Breadcrumb`、`ProjectOverview`、tour 状态机、`NodeInfo`+`CodeViewer`、`SearchBar`/`FilterPanel`/`ExportMenu`、`themes/`(自带 `light-minimal` 浅色)。
- **必须新建**（UA 完全没有）：① 费曼"讲→AI 对齐打分"闭环（扩 `LearnPanel`）② 泛化三模式 ③ 进度系统（掌握度/薄弱点/连续天数）。三者都要调 Claude API。
- 注意陷阱：`PathFinderModal`/`StepNode` **不是**导览（前者是两点间 BFS 找依赖路径，后者属 domain 视图）；真正的导览是 `graph.tour` + store 的 tour slice。

---

## 3. 当前工作区状态 + 先跑这些验证

工作区：`/Users/yufeng.he/Desktop/yanzu/画布项目`（这个外层目录**不是** git 仓库；frontend-repo / ai-canvas-repo 各自是独立 repo）。**本 App 的 git 仓库是 `画布项目/codelm/`**（远端 `github.com/ricroad/codelm`，SSH 推送），设计文档/交接都在其中 `docs/superpowers/` 下。

**接手先跑（只读，别重跑分析）**：
```bash
NODE=/Users/yufeng.he/.local/node/bin/node      # node 不在默认 PATH！
cd /Users/yufeng.he/Desktop/yanzu/画布项目/frontend-repo
git rev-parse --abbrev-ref HEAD                  # 期望 feat/midjourney-image-model
git rev-parse HEAD                               # 期望 d7565bdde04bbddb3f4d1cfbcd742ce265186dbb
git status --short                               # 期望仅  ?? .understand-anything/
ls -lh .understand-anything/knowledge-graph.json # 期望 ~1.4M
$NODE -e 'const g=require("./.understand-anything/knowledge-graph.json");console.log(g.nodes.length,g.edges.length,g.layers.length,g.tour.length)'  # 期望 1523 2864 10 12
```

**已有产物**：
- 知识图谱：`frontend-repo/.understand-anything/`（`knowledge-graph.json` 1.4M、`meta.json`、`fingerprints.json` 804K、`intermediate/scan-result.json`）。analyzedAt 2026-06-23。**`.understand-anything/` 未跟踪，别删。**
- 设计文档：`docs/superpowers/specs/2026-06-24-feynman-code-tour-design.md`（权威）。
- 本交接文档：`docs/superpowers/plans/2026-06-24-feynman-code-tour-handoff.md`。
- git 仓库 `codelm` 已建好并推到 `github.com/ricroad/codelm`（目前只含这两份 docs + README + .gitignore）。
- **尚不存在**：App 代码（`codelm` 根下的 `src/` + `src-tauri/`）——从零搭，这是你的活。

**UA dashboard 现状**：有个 `screen` 会话 `ua-dashboard` 在跑 Vite :5173（node pid 见 `lsof -nP -iTCP:5173`），但根路径返回 **404**（token 在 `.understand-anything/dashboard.url`，当前 `6ba7980d768cca6b149d9d16e79a1a01`；旧 token `4a40c938...` 已死别用）。**这个 dashboard 是 UA 自带查看器，跟我们要做的 App 是两回事，不影响**；想参考它长啥样可修好它（看 `understand-dashboard` skill：它用 `GRAPH_DIR=<repo> npx vite` 起，数据走 token-gated 的 Vite 中间件，见 `packages/dashboard/vite.config.ts`）。要停：`screen -S ua-dashboard -X quit`。

**UA 源码（要 vendor 的对象）**：`/Users/yufeng.he/.claude/plugins/cache/understand-anything/understand-anything/2.8.1/`
- `packages/dashboard/`（要 fork 的 Vite+React app）`packages/core/`（@understand-anything/core，类型/校验/搜索/prompt 工具）`skills/*/SKILL.md`、`agents/*`、`src/*`。
- ⚠️ plugin cache 副本若要本地编译/运行需手动 `pnpm install` + `tsc`（见用户记忆 understand-anything-install 的坑）。我们 vendor 时是**拷源码进自己项目自管**，不依赖这个 cache 路径。

**设计稿原件**：claude.ai/design 项目 `574f6025-9925-46d2-a7c5-289d1ed8a112` 里的 `费曼式代码导览.dc.html`，用 `DesignSync` MCP 读（method=get_file；需先 `/design-login` 授权）。设计稿的**全部文案/状态机/三模式六变体行为已抄进设计文档 §5/§6/§7**，实现以设计文档为准即可，不必每次回去 fetch。

---

## 4. 架构与核心机制（精简版，全本在设计文档 §3–§8）

```
Tauri(.app)
├─ React 渲染层(fork UA dashboard + 改装)
│   ├─ 看图引擎(vendor，复用)  ├─ 费曼层(新)  ├─ 泛化层(新)  ├─ 进度层(新)
│   └─ 调 AI：Tauri invoke → Rust 命令(前端不持 key)
├─ src-tauri (Rust)
│   ├─ ai_feynman_feedback(payload) → 调 Anthropic API → 结构化结果
│   ├─ read_source(filePath,lineRange) → 读真实源码("真相")；路径须在 repoRoot 内(防越权)
│   ├─ load_graph() → 读 knowledge-graph.json(+ core schema 校验)
│   └─ load/save_progress() → 本地 progress.json
└─ 配置：repo 根 + 图谱路径 + Anthropic key(Rust 侧/keychain)
```

**费曼闭环**：节点点"讲一遍" → 前端发 `{nodeId,mode,variant,userExplanation}` → Rust 组装"真相"(node.summary+tags+相关 edges+真实源码片段+layer 描述+评分量规) → 调 Claude → 返回结构化：
```ts
FeynmanFeedback = {
  verdict, convergence:{aligned,total},
  points: {kind:'hit'|'deviation'|'miss', text, nodeRef?}[],
  mentorComment, followUp:{question,targetConcept}, weakPoints[]
}
```
A/B/C 三变体 = 同一份 feedback 的三种展示皮（B/C 是图谱上的 overlay，`showOverlay=variant!=='A'`）。泛化 X/Y/Z 类似，X 看每跳覆盖、Y 看后果链、Z 多轮对话至 `understood=true`。

---

## 5. 分期计划（v1 全量，分 4 期，每期独立可跑）

- **P0 地基**：Tauri 壳 + vendor UA 看图引擎 + 浅色改装 + 读真实图谱渲染 + repo/key 配置。
  验收：打开 .app 看到 frontend-repo 的 10 层图谱 + 12 步导览。
- **P1 学习闭环**：扩 LearnPanel + Rust 接 Claude + A/B/C + 对齐卡/收敛度。
  验收：选节点讲一遍 → 拿到真模型逐点对齐反馈。
- **P2 泛化**：X/Y/Z（情景推演/反事实/教新人，Z 多轮）。
- **P3 进度系统**：掌握度/薄弱点/连续天数 + 本地持久化（拉伸：动态支线 tour）。

---

## 6. 坑 / 约束（必读，踩了费时间）

1. **node 不在默认 PATH**：用 `/Users/yufeng.he/.local/node/bin/node`（v24.16.0）。整套工具链在 `~/.local`。
2. **只在 `codelm/` 这个 repo 里提交**：外层 `画布项目` 不是 git 仓库,且其下 frontend-repo/ai-canvas-repo 是独立 repo——别在外层 `git init`,会把它们和大文件全卷进去。本项目一切提交都在 `画布项目/codelm/`。
3. **别重跑 `/understand`**：分析已完成且昂贵；图谱直接读快照。`.understand-anything/` 未跟踪、别删。
4. **UA 无 CLI/API**：所有 AI 能力(费曼/泛化)必须自接 Claude API，不能指望 UA 跑时给你算。
5. **API key 不进 git、不进渲染层**：只在 Rust 侧/keychain。
6. **读源码要防越权**：`read_source` 必须校验路径落在 repoRoot 内。
7. **LAYER_PALETTE 只有 7 色但有 10 层**(会回卷)：按设计稿层色补足/指定。
8. **vendor 出处与许可**：UA 是第三方 plugin(@understand-anything，v2.8.1)，拷源码进项目要在 README 注明出处/版本/许可。
9. **ai-canvas-repo(后端)还没跑 UA**：如要给后端也出图谱，是另一个独立任务。
10. **Tauri 环境**：本机可能未装 Rust 工具链;P0 第一步先确认 `cargo`/`rustc`/`@tauri-apps/cli` 可用，缺了先装。

---

## 7. 你从这里开始

1. 先按 §3 跑验证命令，确认状态与本文一致。
2. 读权威设计文档 `docs/superpowers/specs/2026-06-24-feynman-code-tour-design.md`。
3. 用 `writing-plans` skill 把 **P0** 拆成实现计划（建议 P0 第一步：确认 Tauri/Rust 工具链 → 在 `codelm/` 仓库根初始化 Tauri 脚手架(`src/` + `src-tauri/`) → vendor UA dashboard 最小可渲染子集 → 读真实图谱画出 10 层）。
4. 按 `executing-plans` / TDD 推进，每步验证后再说完成，向用户用大白话汇报。
