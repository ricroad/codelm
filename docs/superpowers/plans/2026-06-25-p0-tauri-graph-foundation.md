# P0 Tauri Graph Foundation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the P0 desktop foundation: a Tauri + React app that loads the real `frontend-repo` Understand Anything graph, renders its 10 layers and 12-step tour, and can preview source files safely.

**Architecture:** The React renderer vendors the Understand Anything dashboard graph engine under `src/vendor/ua/` and wraps it with a small app shell. Tauri commands in `src-tauri/` own filesystem access: load graph/config, read source files inside the configured repo root, and report graph/source commit mismatch.

**Tech Stack:** Tauri 2, Rust, React 19, Vite 6, TypeScript, Tailwind CSS 4, Zustand, XYFlow, ELK, Vitest.

---

## File Structure

- Create `package.json`: npm scripts and renderer dependencies.
- Create `index.html`, `src/main.tsx`, `src/index.css`, `src/app/App.tsx`: renderer entry and app shell.
- Create `src/app/graphData.ts`: loads graph/config through Tauri when available, with a browser-dev fallback to `../画布项目/frontend-repo`.
- Create `src/app/source.ts`: calls Tauri `read_source` and exposes the source response shape.
- Create `src/app/config.ts`: default repo path and graph path constants.
- Create `src/vendor/ua/`: copied UA dashboard renderer files, adapted to local imports and Tauri source loading.
- Create `src/vendor/ua/core/`: copied UA `types.ts`, `schema.ts`, `search.ts`.
- Create `src-tauri/Cargo.toml`, `src-tauri/build.rs`, `src-tauri/tauri.conf.json`, `src-tauri/src/main.rs`, `src-tauri/src/lib.rs`: Tauri app and commands.
- Create `src-tauri/src/config.rs`: resolve default repo root and graph path.
- Create `src-tauri/src/graph.rs`: load and minimally inspect graph JSON metadata.
- Create `src-tauri/src/source.rs`: safe source-file reading inside repo root.
- Create `src-tauri/src/commands.rs`: Tauri command handlers.
- Create `src-tauri/tests/source_security.rs`: path traversal and graph whitelist tests.
- Modify `README.md`: add run instructions and current P0 scope.
- Modify `.gitignore`: ignore local Tauri build artifacts and local app config.

---

### Task 1: Tooling and Plan Baseline

**Files:**
- Create: `docs/superpowers/plans/2026-06-25-p0-tauri-graph-foundation.md`

- [ ] **Step 1: Confirm frontend graph baseline**

Run:

```bash
/Users/yufeng.he/.local/node/bin/node - <<'NODE'
const g=require('../画布项目/frontend-repo/.understand-anything/knowledge-graph.json');
console.log(g.nodes.length, g.edges.length, g.layers.length, g.tour.length, g.project.gitCommitHash);
NODE
```

Expected: `1523 2864 10 12 d7565bdde04bbddb3f4d1cfbcd742ce265186dbb`.

- [ ] **Step 2: Confirm local toolchain**

Run:

```bash
/Users/yufeng.he/.local/node/bin/node --version
/Users/yufeng.he/.local/node/bin/pnpm --version
command -v cargo || true
```

Expected: Node and pnpm print versions. If `cargo` is missing, continue with renderer validation and record that Rust/Tauri build verification is blocked until Rust is installed.

### Task 2: Scaffold React, Vite, and Tauri Files

**Files:**
- Create: `package.json`
- Create: `index.html`
- Create: `tsconfig.json`
- Create: `tsconfig.node.json`
- Create: `vite.config.ts`
- Create: `vitest.config.ts`
- Create: `src/main.tsx`
- Create: `src/index.css`
- Create: `src/app/App.tsx`
- Create: `src/app/config.ts`
- Create: `src-tauri/Cargo.toml`
- Create: `src-tauri/build.rs`
- Create: `src-tauri/tauri.conf.json`
- Create: `src-tauri/src/main.rs`
- Create: `src-tauri/src/lib.rs`

- [ ] **Step 1: Write the package and TypeScript/Vite configuration**

Create `package.json` with scripts:

```json
{
  "name": "code-reading",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "vite --host 127.0.0.1",
    "build": "tsc -b && vite build",
    "preview": "vite preview --host 127.0.0.1",
    "test": "vitest run",
    "test:watch": "vitest",
    "tauri": "tauri"
  }
}
```

Add the exact dependencies used by the vendored UA renderer plus Tauri API.

- [ ] **Step 2: Create minimal renderer entry**

Create `index.html`, `src/main.tsx`, `src/index.css`, and `src/app/App.tsx` so `pnpm dev` renders a loading shell before the vendor graph is connected.

- [ ] **Step 3: Create Tauri scaffold**

Create Tauri 2 config and Rust entry files. `src-tauri/src/lib.rs` must expose a `run()` function and register command handlers later in Task 5.

- [ ] **Step 4: Install dependencies**

Run:

```bash
/Users/yufeng.he/.local/node/bin/pnpm install
```

Expected: `pnpm-lock.yaml` is created and install exits 0.

### Task 3: Vendor UA Renderer and Core Display Contracts

**Files:**
- Create: `src/vendor/ua/` from UA dashboard `src/`
- Create: `src/vendor/ua/core/types.ts`
- Create: `src/vendor/ua/core/schema.ts`
- Create: `src/vendor/ua/core/search.ts`
- Create: `src/vendor/ua/README.md`
- Modify: `vite.config.ts`
- Modify: `tsconfig.json`

- [ ] **Step 1: Copy vendor sources mechanically**

Run:

```bash
mkdir -p src/vendor
cp -R /Users/yufeng.he/.claude/plugins/cache/understand-anything/understand-anything/2.8.1/packages/dashboard/src src/vendor/ua
mkdir -p src/vendor/ua/core
cp /Users/yufeng.he/.claude/plugins/cache/understand-anything/understand-anything/2.8.1/packages/core/src/types.ts src/vendor/ua/core/types.ts
cp /Users/yufeng.he/.claude/plugins/cache/understand-anything/understand-anything/2.8.1/packages/core/src/schema.ts src/vendor/ua/core/schema.ts
cp /Users/yufeng.he/.claude/plugins/cache/understand-anything/understand-anything/2.8.1/packages/core/src/search.ts src/vendor/ua/core/search.ts
```

- [ ] **Step 2: Add vendor README**

Create `src/vendor/ua/README.md` with:

```markdown
# Understand Anything Dashboard Vendor Snapshot

Source: Understand Anything plugin v2.8.1 (`@understand-anything`)
Local source path used for this snapshot:
`/Users/yufeng.he/.claude/plugins/cache/understand-anything/understand-anything/2.8.1/packages/dashboard/src`

This directory vendors the dashboard display engine for local modification inside
the `code-reading` Tauri app. Runtime analysis is not vendored; this app only
consumes an existing `.understand-anything/knowledge-graph.json`.
```

- [ ] **Step 3: Alias UA core imports**

Configure Vite and TypeScript path aliases:

```ts
"@understand-anything/core/types": ["src/vendor/ua/core/types.ts"],
"@understand-anything/core/schema": ["src/vendor/ua/core/schema.ts"],
"@understand-anything/core/search": ["src/vendor/ua/core/search.ts"]
```

- [ ] **Step 4: Run TypeScript to expose import errors**

Run:

```bash
/Users/yufeng.he/.local/node/bin/pnpm build
```

Expected: build may fail because `App.tsx` and `CodeViewer.tsx` still depend on UA server token endpoints. Import alias failures must be fixed before Task 4.

### Task 4: Replace UA Token Fetch with Local Graph Loader

**Files:**
- Create: `src/app/graphData.ts`
- Create: `src/app/graphData.test.ts`
- Modify: `src/app/App.tsx`
- Modify: `src/vendor/ua/App.tsx` or stop using it directly

- [ ] **Step 1: Write failing graph loader tests**

Create `src/app/graphData.test.ts`:

```ts
import { describe, expect, test } from "vitest";
import { graphSummary, resolveGraphWarning } from "./graphData";

describe("graphData helpers", () => {
  test("summarizes graph counts for the P0 status bar", () => {
    const summary = graphSummary({
      version: "1",
      project: {
        name: "storyboard-copilot",
        languages: [],
        frameworks: [],
        description: "",
        analyzedAt: "2026-06-23T06:43:22.788Z",
        gitCommitHash: "abc",
      },
      nodes: [{ id: "n1", type: "file", name: "A", summary: "", tags: [], complexity: "simple" }],
      edges: [],
      layers: [{ id: "l1", name: "Layer", description: "", nodeIds: ["n1"] }],
      tour: [{ order: 1, title: "Start", description: "", nodeIds: ["n1"] }],
    });
    expect(summary).toEqual({ nodes: 1, edges: 0, layers: 1, tourSteps: 1 });
  });

  test("warns when graph commit and repo commit differ", () => {
    expect(resolveGraphWarning("graph-sha", "repo-sha")).toContain("graph-sha");
    expect(resolveGraphWarning("same", "same")).toBeNull();
  });
});
```

- [ ] **Step 2: Run tests and verify RED**

Run:

```bash
/Users/yufeng.he/.local/node/bin/pnpm test src/app/graphData.test.ts
```

Expected: fail because `graphData.ts` does not exist.

- [ ] **Step 3: Implement graphData helpers and loader**

Create `src/app/graphData.ts` with exported `graphSummary`, `resolveGraphWarning`, and `loadGraphData`. `loadGraphData` first tries Tauri `invoke("load_graph")`; when not in Tauri, it reads `/knowledge-graph.json` from the Vite fallback plugin added in Task 6.

- [ ] **Step 4: Run tests and verify GREEN**

Run:

```bash
/Users/yufeng.he/.local/node/bin/pnpm test src/app/graphData.test.ts
```

Expected: 2 tests pass.

- [ ] **Step 5: Wire app shell**

Use the vendored UA components directly:

```tsx
<SearchBar />
<GraphView />
<NodeInfo />
<ProjectOverview />
<FileExplorer />
```

Keep P0 mode simple: a left sidebar with project/tour/file info, central graph, and a top status row with graph counts and commit warning.

### Task 5: Implement Tauri Graph and Source Commands

**Files:**
- Create: `src-tauri/src/config.rs`
- Create: `src-tauri/src/graph.rs`
- Create: `src-tauri/src/source.rs`
- Create: `src-tauri/src/commands.rs`
- Create: `src-tauri/tests/source_security.rs`
- Modify: `src-tauri/src/lib.rs`

- [ ] **Step 1: Write failing Rust source security tests**

Create `src-tauri/tests/source_security.rs` with tests for rejecting `../secret.ts`, rejecting files not listed in the graph, and accepting a whitelisted file.

- [ ] **Step 2: Run Rust tests and verify RED**

Run when `cargo` is available:

```bash
cargo test --manifest-path src-tauri/Cargo.toml
```

Expected: fail because source/config modules do not exist. If `cargo` is unavailable, record this as blocked and continue writing Rust code for later verification.

- [ ] **Step 3: Implement Rust commands**

Implement:

```rust
#[tauri::command]
pub fn load_graph() -> Result<GraphLoadResponse, String>

#[tauri::command]
pub fn read_source(path: String) -> Result<SourceFile, String>
```

`read_source` must normalize paths, reject absolute/traversal paths, require the file path to appear in graph node `filePath`, reject binary files, and cap previews at 1 MiB.

- [ ] **Step 4: Run Rust tests and verify GREEN**

Run when `cargo` is available:

```bash
cargo test --manifest-path src-tauri/Cargo.toml
```

Expected: source security tests pass.

### Task 6: Browser Dev Fallback for Graph and Source

**Files:**
- Modify: `vite.config.ts`
- Modify: `src/app/source.ts`
- Modify: `src/vendor/ua/components/CodeViewer.tsx`

- [ ] **Step 1: Add Vite dev fallback endpoints**

In `vite.config.ts`, add a local-only dev middleware for:

```text
/knowledge-graph.json
/file-content.json?path=...
```

Use the same safety rules as Rust for browser-only development.

- [ ] **Step 2: Write failing source helper test**

Create `src/app/source.test.ts` for `fallbackLanguage` and path parameter building.

- [ ] **Step 3: Implement source helper and adapt CodeViewer**

Create `src/app/source.ts` and modify vendored `CodeViewer.tsx` so it uses Tauri `invoke("read_source")` when available, otherwise fetches `/file-content.json?path=...`.

- [ ] **Step 4: Run source tests**

Run:

```bash
/Users/yufeng.he/.local/node/bin/pnpm test src/app/source.test.ts
```

Expected: tests pass.

### Task 7: Build, Run, and Visual Verify P0

**Files:**
- Modify: `README.md`
- Modify: `.gitignore`

- [ ] **Step 1: Run full renderer tests**

Run:

```bash
/Users/yufeng.he/.local/node/bin/pnpm test
```

Expected: all Vitest tests pass.

- [ ] **Step 2: Build renderer**

Run:

```bash
/Users/yufeng.he/.local/node/bin/pnpm build
```

Expected: TypeScript and Vite build exit 0.

- [ ] **Step 3: Start dev server**

Run:

```bash
/Users/yufeng.he/.local/node/bin/pnpm dev -- --port 5174
```

Expected: Vite serves at `http://127.0.0.1:5174/`.

- [ ] **Step 4: Verify graph in browser**

Open `http://127.0.0.1:5174/` and verify the first viewport shows `storyboard-copilot`, graph counts `1523 / 2864 / 10 / 12`, the 10 layer graph, and a commit mismatch warning if the repo checkout differs from `d7565bd...`.

- [ ] **Step 5: Verify Tauri build if Rust is available**

Run:

```bash
/Users/yufeng.he/.local/node/bin/pnpm tauri build
```

Expected: Tauri build exits 0. If `cargo` is unavailable, report that Tauri build is blocked by missing Rust.

- [ ] **Step 6: Update README**

Document:

```bash
/Users/yufeng.he/.local/node/bin/pnpm install
/Users/yufeng.he/.local/node/bin/pnpm dev
/Users/yufeng.he/.local/node/bin/pnpm tauri dev
```

Also document default repo path `../画布项目/frontend-repo`.

---

## Self-Review

- Spec coverage: This plan covers P0 only: Tauri scaffold, vendor UA graph display, real graph loading, source preview, config defaults, and graph/repo commit warning. It does not implement P1 Claude feedback, P2 generalization, or P3 progress.
- Placeholder scan: No task uses TBD/TODO/fill-later language. The only conditional is Rust verification, explicitly blocked if `cargo` is absent.
- Type consistency: Graph helper names are `graphSummary`, `resolveGraphWarning`, and `loadGraphData`; source command names are `load_graph` and `read_source`.
