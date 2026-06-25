# code-reading — 费曼式代码导览（Feynman Code Tour）

> 本地文件夹 `code-reading`；GitHub 远端仓库名 `ricroad/codelm`（两者不同名,正常）。

一个**本地桌面应用（Tauri + React）**：读取 [Understand Anything](https://github.com/) 为某个真实代码库生成的知识图谱，用**费曼学习法**带人学懂这套代码——
图谱里挑一条线 → 看真相（文件摘要 + 真实源码）→ 用自己的话讲回去 → **真 Claude API 对照打分、对齐、追问** → 往复直到学会；并能把学到的模式**泛化**到新场景。

> 首个目标代码库：`storyboard-copilot`（ReelForce 画布前端）。
> 设计源自 claude.ai/design 的 `费曼式代码导览.dc.html`。

## 状态

- ✅ 需求与设计已对齐（brainstorming 完成）。
- ✅ P0 地基已起：Tauri + React + vendored UA 看图引擎 + 真实图谱加载 + 安全源码读取。
- ⬜ P1 待做：费曼讲解输入、Claude API 对齐打分、A/B/C 三变体。

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

## 本地运行

> Node 在本机路径：`/Users/yufeng.he/.local/node/bin/`。Rust 工具链通过 rustup 安装后，当前 shell 需先 `. "$HOME/.cargo/env"`。

```bash
/Users/yufeng.he/.local/node/bin/pnpm install
/Users/yufeng.he/.local/node/bin/pnpm dev
```

浏览器开发地址：`http://127.0.0.1:5174/`。

Tauri:

```bash
. "$HOME/.cargo/env"
/Users/yufeng.he/.local/node/bin/pnpm tauri dev
/Users/yufeng.he/.local/node/bin/pnpm tauri build
```

当前默认读取 `../画布项目/frontend-repo/.understand-anything/knowledge-graph.json`。如果该 repo 当前 commit 与图谱记录的 commit 不一致，界面会显示黄色提示；图谱仍可看，但源码预览可能和图谱摘要不完全一致。

## P0 已有能力

- 读取真实 `storyboard-copilot` 图谱：1523 nodes / 2864 edges / 10 layers / 12 tour steps。
- 渲染 UA dashboard 的层级图谱、搜索、文件树、节点详情和源码面板。
- React 开发模式下通过 Vite 本地中间件读取图谱/源码。
- Tauri 模式下通过 Rust command 读取图谱/源码。
- Rust `read_source` 会拒绝绝对路径、`..` 越权、图谱外文件、二进制文件和超过 1 MiB 的文件。

## 第三方出处与许可

`src/vendor/ua/` 下的看图引擎快照自 **Understand Anything 插件 v2.8.1**（`@understand-anything`）。vendor 目录内的 `README.md` 注明了来源与版本。

## 安全

- Anthropic API key **只存 Rust 侧 / OS keychain**，绝不进 git、不进渲染层。
- 读真实源码的 Rust 命令必须校验路径落在配置的 repo 根内，防越权读盘。
