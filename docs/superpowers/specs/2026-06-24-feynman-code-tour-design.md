# 费曼式代码导览 — 设计文档（Design Spec）

> 日期：2026-06-24
> 状态：已与用户对齐主干，待用户复核本文档
> 设计稿来源：claude.ai/design 项目 `574f6025-9925-46d2-a7c5-289d1ed8a112` 中的 `费曼式代码导览.dc.html`
> 底座：Understand Anything skill（v2.8.1）生成的知识图谱

---

## 0. 一句话

把 Understand Anything 已经生成的代码知识图谱，做成一个**可双击打开的本地桌面 App（Tauri）**，用**费曼学习法**带人学懂一个真实代码库：图谱里挑一条线 → 看真相（摘要 + 真实源码）→ 用自己的话讲回去 → **真 Claude API 对照打分、对齐、追问** → 往复直到学会；并能把学到的模式**泛化**到新场景。

目标代码库：`frontend-repo`（`storyboard-copilot` / ReelForce 画布前端）。

---

## 1. 背景与底座（Understand Anything 的逻辑）

UA = **「AI 画地图」+「一个看地图的网页」**，两端分开：

- **分析端**：`/understand` 由 Claude 带子 agent 分 8 步产出 `knowledge-graph.json`。所有语义字段（summary / tags / complexity / node.type / edges / layers / tour）都是 **LLM 写的**；确定性核心（tree-sitter 扫结构、fingerprint 增量、schema 校验、搜索、拼 prompt/解析回复）在 npm 包 `@understand-anything/core`，**但该包自身不调模型，需自带 AI**。
- **看图端**：`packages/dashboard` 是 Vite + React 19 + XYFlow(react-flow) + elkjs + Zustand + Tailwind v4。运行时 **完全不调 AI**，只把 JSON 画成图。

**关键约束（决定本项目形态）**：UA **没有 CLI、没有 HTTP API**，无法让外部程序「重新分析 / 解释文件 / 提问」——这些能力只存在于 Claude 的 skill 里（要 AI 在场）。外部程序能直接做的只有 **读 `knowledge-graph.json`**。

### 1.1 数据契约（`@understand-anything/core` types.ts / schema.ts）

```ts
KnowledgeGraph = { version, kind?, project, nodes[], edges[], layers[], tour[] }
GraphNode = { id, type, name, filePath?, lineRange?:[number,number],
              summary, tags[], complexity:'simple'|'moderate'|'complex',
              languageNotes?, domainMeta?, knowledgeMeta? }
GraphEdge = { source, target, type, direction:'forward'|'backward'|'bidirectional',
              description?, weight /*0-1*/ }
Layer     = { id, name, description, nodeIds[] }
TourStep  = { order, title, description, nodeIds[], languageLesson? }
ProjectMeta = { name, languages[], frameworks[], description, analyzedAt, gitCommitHash }
```

本仓库当前快照（`frontend-repo/.understand-anything/knowledge-graph.json`）：585 文件 / 1523 nodes / 2864 edges / **10 layers** / **12 tour steps**，commit `d7565bd`。

### 1.2 设计稿 ↔ UA 能力对照（"匹配我们的逻辑"）

| 设计稿元素 | UA 对应 | 处理 |
|---|---|---|
| 图谱 + 彩色分层块 | `GraphView` + LayerClusterNode/Container/Portal + elkjs 布局 + `LAYER_PALETTE` | 复用 |
| 左侧文件树 | `FileExplorer` | 复用 |
| 顶部面包屑（项目 › 层）| `Breadcrumb` | 复用 |
| 概览模式 | `ProjectOverview`（含"开始导览"）| 复用 |
| 学习路径 · 5/12 | `graph.tour`（真实 12 步）+ store 的 tour 状态机 | 复用 |
| 聚焦路径 / 无关簇淡出 | `setFocusNode`(1 跳邻居) + tour 高亮 | 复用 + 微调 |
| 筛选 / 导出 / 主题 | FilterPanel / ExportMenu / ThemePicker（自带 `light-minimal` 浅色）| 复用 |
| 节点详情 / 看源码 | `NodeInfo` + `CodeViewer` | 复用（费曼"真相卡"靠它）|
| 学习 A/B/C | `LearnPanel`（**现仅顺序念讲解，无"你讲+AI 打分"**）| **扩建：费曼闭环** |
| 泛化 X/Y/Z | 无 | **新建** |
| 掌握度 / 薄弱点 / 连续天数 | 无（UA 不存学习进度）| **新建：进度系统** |
| AI 点评 / 对齐卡 / 收敛度 | 无（运行时不调 AI）| **新建：自接 Claude API** |

**结论**：设计稿 ≈ UA dashboard 的「教学增强版」。UA 已做好最难的看图引擎（约 70–80% 壳可复用）；本项目真正新建三件事——① 费曼"讲→AI 对齐"闭环 ②泛化三模式 ③进度系统，三者都必须**我们自己调 Claude API**。

---

## 2. 复用策略：拿来改装（hybrid fork-and-reskin）

- **整块 vendor 进来**：UA dashboard 的「看图引擎 + 数据层」——`GraphView` 及各 react-flow 节点、`utils/`(elkjs 布局/containers/louvain)、`store.ts`、`NodeInfo`/`FileExplorer`/`Breadcrumb`/`CodeViewer`/`SearchBar`/`FilterPanel`/`ExportMenu`、`themes/`、以及 `@understand-anything/core` 的类型/校验/搜索。
- **外壳重画**：顶栏、模式切换、面板按设计稿改成 Apple 浅色（以 `light-minimal` 打底，按 `费曼式代码导览.dc.html` 的视觉细化）。
- **新建三层**：费曼层、泛化层、进度层。

> vendor 即把 `packages/dashboard` 在 commit `d7565bd` 对应的 UA v2.8.1 源码**快照拷入本项目自管**（不依赖 plugin cache 路径）。许可证与出处在项目 README 注明。

---

## 3. 整体架构

```
Tauri（Rust 外壳，产出可双击的 .app）
├─ 渲染层 = React（fork 自 UA dashboard + 改装）
│   ├─ 看图引擎（vendor，复用）：图谱 / 布局 / 分层 / 文件树 / 导览 / 看源码 / 搜索
│   ├─ 费曼层（新）：讲解输入 → 对齐卡 / 收敛度 / 追问（A/B/C 三皮）
│   ├─ 泛化层（新）：情景推演 / 反事实 / 教新人（X/Y/Z 三皮）
│   ├─ 进度层（新）：掌握度 / 薄弱点 / 连续天数
│   └─ 调 AI：通过 Tauri invoke 走 Rust 命令（前端不持有 key）
├─ Rust 侧（src-tauri）
│   ├─ command: ai_feynman_feedback(payload) → 调 Anthropic API → 结构化结果
│   ├─ command: read_source(filePath, lineRange) → 读真实源码（"真相"）
│   ├─ command: load_graph() → 读 knowledge-graph.json（+ core schema 校验）
│   └─ command: load/save_progress() → 本地进度文件
└─ 配置：repo 根路径 + 图谱路径 + Anthropic API key（存 Rust 侧/OS keychain）
```

**安全要点**：Anthropic API key **只存在 Rust 侧**（优先 OS keychain，回退本地配置文件，**不进 git、不进渲染层**）。渲染层只发"讲解+节点id"，由 Rust 组装真相并调模型。

**数据来源**：
- 图谱：读 `<repoRoot>/.understand-anything/knowledge-graph.json`（默认指向 `frontend-repo`，可配置）。
- "真相"源码：按 `node.filePath` + `lineRange` 从 `<repoRoot>` 读真实文件片段（Rust fs；路径必须在 repoRoot 内，防越权读盘）。

---

## 4. 费曼闭环（核心机制）

**触发**：在某节点/导览步点"讲一遍"。

**请求**（渲染层 → Rust）：`{ nodeId, mode, variant, userExplanation }`
**Rust 组装**：节点 `summary` + `tags` + 相关 edges（它依赖谁/被谁依赖）+ 真实源码片段 + 所在 layer 描述 + 评分量规 → 调 Claude。

**Claude 返回结构化 JSON（对齐卡数据模型）**：
```ts
FeynmanFeedback = {
  verdict: string,                  // 例:"基本到位 · 还差 1 个关键点"
  convergence: { aligned: number, total: number },  // 收敛度 4/7
  points: Array<{
    kind: 'hit' | 'deviation' | 'miss',   // 命中 / 偏差 / 遗漏
    text: string,
    nodeRef?: string                       // 可点回图谱的节点
  }>,
  mentorComment: string,            // 导师点评(一段话)
  followUp: { question: string, targetConcept: string },  // 快问 + 它对齐哪个点
  weakPoints: string[]              // 计入薄弱点的概念
}
```
**前端渲染**：A/B/C 三变体 = 同一份 `FeynmanFeedback` 的三种展示皮（见 §6）。"再讲一遍"→ 清空 submitted 重来；"标记学会"→ 写进度。

**评分量规（喂给模型的 rubric，要点）**：对照真相判断用户是否讲清了——① 该节点职责；② 它在分层里的位置（最常见错误：把"命令层隔离"讲成"hook 直接调模型"）；③ 关键依赖流向。命中/偏差/遗漏逐条给，鼓励"用自己的话"，不奖励照抄源码。

---

## 5. 三个模式（设计稿原样）

顶栏切换 `概览 / 学习 / 泛化`。状态机沿用设计稿 `.dc.html` 的 `<script>`：

```
state = { mode:'learn'|'overview'|'generalize',
          variant:'A'|'B'|'C',           // 学习三变体
          genVar:'X'|'Y'|'Z',            // 泛化三变体
          collapsed, submitted, genSubmitted }
```

文案（来自设计稿，作为实现的 copy 真相源）：
- headings：learn=「讲解 → 理解 → 讲回去 → 对齐，往复直至学会」；overview=「主干据依赖图生成，支线据你的薄弱点动态生长」；generalize=「泛化 · 把学过的模式用到新场景，串讲整条链路」。
- 概览 caption：「学习路径的家：左侧大纲讲『学什么、什么顺序、走到哪』，右侧把图谱画成一条可走的路线图。」

### 5.1 概览（overview）
复用 `ProjectOverview` + tour 列表，按设计稿改装：左大纲（学什么/顺序/进度）+ 右把 `graph.tour` 画成路线图。

### 5.2 学习（learn）
图谱主视图 + 顶部学习路径条（`graph.tour`，"当前 5/12"）。点节点弹费曼面板，三变体 A/B/C。

### 5.3 泛化（generalize）
不再考"复述单点"，而是**串讲整条链路并迁移到新场景**。三变体 X/Y/Z，AI 出题（见 §7）。

---

## 6. 学习三变体 A/B/C（同数据，三皮）

来自设计稿 caps：
- **A · 对话式**：右栏像和导师聊天，AI 把「点评+逐点对照+追问」作为一条结构化消息返回。（A 是基础视图，图谱在，无遮罩）
- **B · 专注讲台**：图谱暂退，中央亮色弹层让你对着真实源码专心讲；反馈是一张**逐点评分对齐卡**（命中✓/偏差!/遗漏✗ + 快问 + 再讲一遍/标记学会）。
- **C · 实时对齐**：你的讲解与代码"真相清单"**并排逐点 diff**，顶部**收敛度条**（已对齐 4/7，57%）；补一句即 +2，往复至填满。

实现：B/C 是覆盖在图谱上的 overlay（`showOverlay = variant!=='A'`）。

---

## 7. 泛化三变体 X/Y/Z（同数据，三皮）

来自设计稿 genCaps / genPrompts：
- **X · 情景推演**：AI 出一个没学过的新场景（例：拖参考图+提示词点"生成视频"，把链路从点击到出片串讲），按**每一跳核对覆盖**，没讲到的高亮。
- **Y · 反事实**：AI 抽掉链路一层问"会怎样"（例：删掉 commands 层让 hook 直接 fetch 模型会坏在哪），你讲清后果证明你懂分层。
- **Z · 教新人**：AI 扮演困惑新人不停追问（例：为什么不直接在按钮点击里调模型 API），你得讲到他能复述——终极费曼检验。

AI 返回结构与 §4 类似，但 X 侧重"每跳覆盖率"，Y 侧重"后果链是否成立"，Z 是**多轮对话**（新人追问直到 understood=true）。

---

## 8. 进度系统（新建）

- 指标：掌握度 %（已对齐节点/路径占比）、薄弱点列表（费曼遗漏/偏差累积）、连续学习天数。
- 存储：Tauri 本地文件（`progress.json`），按 `nodeId` 记 `{attempts, bestConvergence, status:'unseen'|'attempted'|'mastered', weakConcepts[]}`。
- 支线：设计稿"据你薄弱点动态生长支线"——v1 先做**静态展示薄弱点**；动态生成支线 tour 列为 P3 拉伸目标。

---

## 9. 主题与视觉

桌面端、不做移动端/响应式（沿用用户既定偏好）。以 UA `light-minimal` 浅色主题打底，按 `费曼式代码导览.dc.html` 细化为 Apple 风：底 `#e8e8ed`、卡片白、主文字 `#1d1d1f`、强调蓝 `#0066cc`、字体 SF/Inter + JetBrains Mono。LAYER_PALETTE 按设计稿层色校准（注意 UA 调色板仅 7 色、10 层会回卷，需补足到 ≥10 或按层语义指定）。

---

## 10. 范围（v1 = 全部还原）与分期

每期独立可跑：

- **P0 地基**：Tauri 壳 + vendor UA 看图引擎 + 浅色改装 + 读真实图谱渲染出代码地图 + repo/key 配置。验收：能打开 .app 看到 `frontend-repo` 的 10 层图谱与 12 步导览。
- **P1 学习闭环**：扩 LearnPanel + Rust 接 Claude API + A/B/C 三变体 + 对齐卡/收敛度。验收：选一节点讲一遍，拿到真模型的逐点对齐反馈。
- **P2 泛化**：X/Y/Z（情景推演/反事实/教新人，Z 多轮）。
- **P3 进度系统**：掌握度/薄弱点/连续天数 + 本地持久化（+ 拉伸：动态支线）。

---

## 11. 非目标（Out of scope）

- **运行时重新分析代码库**（UA 重跑需 AI 在场、无 CLI）。更新图谱 = 用户在 Claude Code 重跑 `/understand`，App 重读 JSON。
- 移动端 / 响应式。
- 多人 / 云端 / 账号体系（纯本地单机）。
- 对 `ai-canvas-repo`（后端）出图谱（其尚未跑 UA；如需另立任务）。

---

## 12. 项目落位与结构

本项目本地文件夹 **`code-reading`**（`~/Desktop/yanzu/code-reading/`），远端 git 仓库 `github.com/ricroad/codelm`（本地名与远端名不同,正常）。**仓库根就是 App**：
```
code-reading/            # = 本 App 仓库根（远端 codelm）
├─ src/                  # React 渲染层（vendor 的看图引擎 + 新建三层）
│   ├─ vendor/ua/        # 自 UA dashboard 快照(标注出处/版本/许可)
│   ├─ feynman/          # 费曼层
│   ├─ generalize/       # 泛化层
│   └─ progress/         # 进度层
├─ src-tauri/            # Rust 外壳 + AI/源码/图谱/进度命令
├─ docs/                 # 设计文档与交接(docs/superpowers/...)
├─ public/
└─ README.md             # 出处、许可、运行方式、配置(repo 根/图谱/key)
```
外部依赖（在仓库之外、**不纳入本 repo**）：`../画布项目/frontend-repo`（被导览的代码库 + 其 `.understand-anything/knowledge-graph.json`）。code-reading 与 画布项目 同级于 `~/Desktop/yanzu/`，故从仓库根看 frontend-repo 即 `../画布项目/frontend-repo`，与 §14 默认路径一致。

---

## 13. 测试策略

- **确定性逻辑**单测优先（TDD）：图谱加载/校验适配、真相组装、`FeynmanFeedback` 解析、进度计算、路径内源码读取的越权防护。
- **Claude API 调用**：对 Rust 命令做契约测试（mock 模型回复，校验 prompt 组装与结构化解析）；真实联调走手动/少量 e2e。
- **看图引擎**沿用/保留 UA 既有测试；改装的外壳组件加渲染测试。
- 验证口径：能跑起来 + 关键链路绿，再说完成（遵循 verification-before-completion）。

---

## 14. 待定的小决策（实现前可快速敲定，不阻塞写计划）

1. API key 配置 UX：首次启动引导填入并存 OS keychain（默认）vs 读环境变量。
2. 默认模型：建议 `claude-opus-4-8`（点评质量），可在设置里切 sonnet 省钱。
3. 学习/泛化的"默认变体"：设计稿默认 A / X；保留切换。
4. 图谱/repo 根路径：默认 `../画布项目/frontend-repo`，设置里可改（为日后导览别的库留口）。
