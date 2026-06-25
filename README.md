# code-reading — 费曼式代码导览（Feynman Code Tour）

> 本地文件夹 `code-reading`；GitHub 远端仓库名 `ricroad/codelm`（两者不同名,正常）。

一个**本地桌面应用（Tauri + React）**：读取 [Understand Anything](https://github.com/) 为某个真实代码库生成的知识图谱，用**费曼学习法**带人学懂这套代码——
图谱里挑一条线 → 看真相（文件摘要 + 真实源码）→ 用自己的话讲回去 → **真 Claude API 对照打分、对齐、追问** → 往复直到学会；并能把学到的模式**泛化**到新场景。

> 首个目标代码库：`storyboard-copilot`（ReelForce 画布前端）。
> 设计源自 claude.ai/design 的 `费曼式代码导览.dc.html`。

## 状态

- ✅ 需求与设计已对齐（brainstorming 完成）。
- ⬜ App 代码（`src/` + `src-tauri/`）尚未开始——下一步从 P0 地基起。

## 从哪开始读

1. **`docs/superpowers/plans/2026-06-24-feynman-code-tour-handoff.md`** — 冷启动交接文档（接手者先读这份）。
2. **`docs/superpowers/specs/2026-06-24-feynman-code-tour-design.md`** — 权威设计文档（冲突以它为准）。

## 架构一句话

```
Tauri(.app)
├─ React 渲染层：fork 自 UA dashboard 的"看图引擎"(图谱/布局/分层/文件树/导览) + 新建(费曼/泛化/进度)层
└─ Rust 侧：调 Claude API(key 只存这里) · 读真实源码("真相") · 读 knowledge-graph.json · 存学习进度
```

## 外部依赖（不在本仓库内）

- 被导览的代码库及其知识图谱：默认 `../画布项目/frontend-repo`（含 `.understand-anything/knowledge-graph.json`，由 `/understand` 生成）。本仓库本地在 `~/Desktop/yanzu/code-reading/`，frontend-repo 在隔壁 `~/Desktop/yanzu/画布项目/frontend-repo/`。路径可在设置里改。
- 重新分析代码库需 Understand Anything（要 AI 在场，无 CLI）；本 App 只**消费**图谱快照。

## 第三方出处与许可

`src/vendor/ua/` 下的看图引擎将快照自 **Understand Anything 插件 v2.8.1**（`@understand-anything`）。落地 vendor 时在该目录注明出处、版本与原许可证。

## 安全

- Anthropic API key **只存 Rust 侧 / OS keychain**，绝不进 git、不进渲染层。
- 读真实源码的 Rust 命令必须校验路径落在配置的 repo 根内，防越权读盘。
