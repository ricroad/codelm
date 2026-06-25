/// <reference types="vitest" />
import { defineConfig, type Plugin } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import path from "node:path";
import fs from "node:fs";
import { execFileSync } from "node:child_process";
import type { IncomingMessage, ServerResponse } from "node:http";

const repoRoot = path.resolve(__dirname, "../画布项目/frontend-repo");
const graphPath = path.join(repoRoot, ".understand-anything", "knowledge-graph.json");
const maxSourceFileBytes = 1024 * 1024;

function sendJson(res: ServerResponse, statusCode: number, payload: unknown) {
  res.statusCode = statusCode;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.end(JSON.stringify(payload));
}

function normalizeGraphPath(filePath: string): string | null {
  if (!filePath || filePath.includes("\0") || path.isAbsolute(filePath)) return null;
  const normalized = path.normalize(filePath);
  if (
    normalized === "." ||
    normalized === ".." ||
    normalized.startsWith(`..${path.sep}`) ||
    path.isAbsolute(normalized)
  ) {
    return null;
  }
  return normalized.split(path.sep).join("/");
}

function graphFilePathSet(): Set<string> {
  const allowed = new Set<string>();
  const raw = JSON.parse(fs.readFileSync(graphPath, "utf-8")) as {
    nodes?: Array<{ filePath?: unknown }>;
  };
  for (const node of raw.nodes ?? []) {
    if (typeof node.filePath !== "string") continue;
    const normalized = normalizeGraphPath(node.filePath);
    if (normalized) allowed.add(normalized);
  }
  return allowed;
}

function detectLanguage(filePath: string): string {
  const ext = path.extname(filePath).slice(1).toLowerCase();
  const byExt: Record<string, string> = {
    css: "css",
    go: "go",
    html: "markup",
    js: "javascript",
    jsx: "jsx",
    json: "json",
    md: "markdown",
    py: "python",
    rb: "ruby",
    rs: "rust",
    sh: "bash",
    ts: "typescript",
    tsx: "tsx",
    yaml: "yaml",
    yml: "yaml",
  };
  return byExt[ext] ?? "text";
}

function repoCommitHash(): string | null {
  try {
    return execFileSync("git", ["-C", repoRoot, "rev-parse", "HEAD"], {
      encoding: "utf-8",
      stdio: ["ignore", "pipe", "ignore"],
    }).trim();
  } catch {
    return null;
  }
}

function readSourceFile(url: URL) {
  const requestedPath = url.searchParams.get("path") ?? "";
  const safeRelativePath = normalizeGraphPath(requestedPath);
  if (!safeRelativePath) return { status: 400, payload: { error: "Path must stay inside the project" } };

  if (!fs.existsSync(graphPath)) {
    return { status: 404, payload: { error: "No knowledge graph found" } };
  }
  if (!graphFilePathSet().has(safeRelativePath)) {
    return { status: 404, payload: { error: "File is not in the knowledge graph" } };
  }

  const absoluteFile = path.resolve(repoRoot, safeRelativePath);
  const relativeToRoot = path.relative(repoRoot, absoluteFile);
  if (
    !relativeToRoot ||
    relativeToRoot === ".." ||
    relativeToRoot.startsWith(`..${path.sep}`) ||
    path.isAbsolute(relativeToRoot)
  ) {
    return { status: 400, payload: { error: "Path must stay inside the project" } };
  }

  let stat: fs.Stats;
  try {
    stat = fs.statSync(absoluteFile);
  } catch {
    return { status: 404, payload: { error: "File not found" } };
  }
  if (!stat.isFile()) return { status: 400, payload: { error: "Path is not a file" } };
  if (stat.size > maxSourceFileBytes) {
    return { status: 413, payload: { error: "File is too large to preview" } };
  }

  const buffer = fs.readFileSync(absoluteFile);
  if (buffer.includes(0)) {
    return { status: 415, payload: { error: "Binary files cannot be previewed" } };
  }
  const content = buffer.toString("utf8");
  return {
    status: 200,
    payload: {
      path: safeRelativePath,
      language: detectLanguage(safeRelativePath),
      content,
      sizeBytes: buffer.byteLength,
      lineCount: content.length === 0 ? 0 : content.split(/\r\n|\n|\r/).length,
    },
  };
}

function devGraphFallback(): Plugin {
  return {
    name: "code-reading-dev-graph-fallback",
    configureServer(server) {
      server.middlewares.use((req: IncomingMessage, res: ServerResponse, next) => {
        if (!req.url) {
          next();
          return;
        }
        const url = new URL(req.url, "http://127.0.0.1");
        if (url.pathname === "/knowledge-graph.json") {
          if (!fs.existsSync(graphPath)) {
            sendJson(res, 404, { error: "No knowledge graph found" });
            return;
          }
          res.statusCode = 200;
          res.setHeader("Content-Type", "application/json; charset=utf-8");
          fs.createReadStream(graphPath).pipe(res);
          return;
        }
        if (url.pathname === "/repo-meta.json") {
          sendJson(res, 200, { repoGitCommitHash: repoCommitHash() });
          return;
        }
        if (url.pathname === "/file-content.json") {
          const result = readSourceFile(url);
          sendJson(res, result.status, result.payload);
          return;
        }
        next();
      });
    },
  };
}

export default defineConfig({
  plugins: [react(), tailwindcss(), devGraphFallback()],
  resolve: {
    alias: {
      "@understand-anything/core/types": path.resolve(__dirname, "src/vendor/ua/core/types.ts"),
      "@understand-anything/core/schema": path.resolve(__dirname, "src/vendor/ua/core/schema.ts"),
      "@understand-anything/core/search": path.resolve(__dirname, "src/vendor/ua/core/search.ts"),
    },
  },
  define: {
    __DEFAULT_REPO_ROOT__: JSON.stringify(repoRoot),
  },
  test: {
    environment: "jsdom",
    include: ["src/**/*.test.ts", "src/**/*.test.tsx"],
  },
  server: {
    host: "127.0.0.1",
    port: 5174,
    strictPort: false,
  },
});
