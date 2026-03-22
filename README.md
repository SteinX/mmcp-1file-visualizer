# mmgraph

`mmgraph` 是一个面向 `memory-mcp-1file` 数据的图谱可视化工具，提供：
- CLI（同步、检索、导出、统计）
- 本地 WebUI（交互式图谱浏览）

适用于快速理解 memory 数据中的 `memories / entities / relations / code symbols` 关系结构。

## MCP Server（quoted）

本仓库当前配置的 MCP server 标识为：

> `"memory-visualizer"`

来源：`opencode-mmcp-1file.jsonc` 中 `mcpServer.tag`。

## 功能概览

- `sync`：将 raw dump 或直接 DB 数据转换为标准 snapshot
- `stats`：输出图谱统计信息
- `search`：按关键词和类型搜索节点
- `inspect`：查看某个 seed 节点的邻域子图
- `export`：导出子图（`json` / `dot` / `mermaid`）
- `serve`：启动本地 WebUI 服务
- `visualize` / `viz`：一键可视化入口（自动加载 + 起服务）

## 环境要求

- Node.js 18+
- npm

## 安装

```bash
npm install
npm run build:all
```

不构建直接从源码运行：

```bash
npm run dev -- --help
```

## 快速开始

```bash
# 推荐：直接读取 memory data-dir 并启动可视化
npm run dev -- visualize --data-dir ~/.local/share/opencode-mmcp-1file/my-project --open

# 或使用构建后的 CLI
node dist/cli.js visualize --data-dir ~/.local/share/opencode-mmcp-1file/my-project --open
```

启动后默认地址：
- `http://127.0.0.1:3939/`
- `http://127.0.0.1:3939/next`

## 常见使用流程

```bash
# 1) raw dump -> snapshot
node dist/cli.js sync --source ./raw-dump.json --out ./out/snapshot.json

# 2) CLI 分析
node dist/cli.js stats --input ./out/snapshot.json
node dist/cli.js search --input ./out/snapshot.json --query auth --type entity
node dist/cli.js inspect --input ./out/snapshot.json --seed entities:oauth --depth 2

# 3) 导出子图
node dist/cli.js export --input ./out/snapshot.json --seed entities:oauth --format mermaid --out ./out/oauth.mmd

# 4) 启动 WebUI
node dist/cli.js serve --input ./out/snapshot.json --open
```

## CLI 命令

### `sync`

将 raw dump 转为 graph snapshot。

常用参数：
- `--source <path>`：输入 raw dump JSON
- `--data-dir <path>`：自动发现数据目录
- `--force-snapshot`：direct DB 模式时使用临时快照
- `--out <path>`：输出 snapshot 文件

### `stats`

输出图谱统计信息。

常用参数：
- `--input <path>`
- `--data-dir <path>`
- `--force-snapshot`

### `search`

按关键词搜索节点。

常用参数：
- `--query <text>`（必填）
- `--type <type>`
- `--limit <n>`

### `inspect`

查看 seed 节点周边子图。

常用参数：
- `--seed <id>`（必填）
- `--depth <n>`
- `--limit <n>`

### `export`

导出 seed 子图。

常用参数：
- `--seed <id>`（必填）
- `--format <fmt>`（`json|dot|mermaid`）
- `--out <path>`（必填）
- `--depth <n>`
- `--limit <n>`

### `serve`

启动 WebUI 服务。

常用参数：
- `--input <path>` / `--data-dir <path>`
- `--no-live`
- `--refresh-interval <sec>`
- `--port <n>`（默认 `3939`）
- `--open`

### `visualize` / `viz`

一键启动可视化（自动加载数据 + WebUI）。

## 输入数据格式与自动发现

### 1) raw dump 格式（`sync --source`）

```json
{
  "memories": [],
  "entities": [],
  "relations": [],
  "code_symbols": [],
  "symbol_relation": []
}
```

### 2) 自动发现顺序

当未传 `--input` / `--source` 时，工具会在 `--data-dir`（或当前目录）按顺序查找：

1. snapshot 候选：
   - `snapshot.json`
   - `graph-snapshot.json`
   - `mmgraph.snapshot.json`
   - `out/snapshot.json`
2. raw dump 候选：
   - `raw-dump.json`
   - `memory-mcp-dump.json`
   - `memory_dump.json`
   - `dump.json`
   - `data.json`
   - `out/raw-dump.json`
3. direct DB 布局：目录包含 `db/`

若 snapshot 与 raw dump 同时存在，优先使用 snapshot。

## Live Refresh 说明

- `serve` / `visualize` 默认开启 live refresh
- 可用 `--no-live` 关闭
- `--refresh-interval` 默认 `10s`
- direct `--data-dir` 模式下，为避免频繁 snapshot 竞争，最小刷新间隔会提升到 `30s`

## Web API（由 `serve` 提供）

- `GET /api/stats`
- `GET /api/search?q=<keyword>&type=<nodeType>`
- `GET /api/seeds`
- `GET /api/graph`
- `GET /api/subgraph?seed=<id>&depth=<n>&limit=<n>`

## 前端开发

```bash
# 仅启动前端开发服务
npm run dev:web

# 构建前端 bundle（输出到 frontend-dist）
npm run build:web
```

## Scripts

- `npm run build`：编译 TypeScript（CLI/server）
- `npm run build:web`：构建 Vite 前端
- `npm run build:all`：构建后端 + 前端
- `npm run dev`：以 `tsx src/cli.ts` 运行 CLI
- `npm run dev:web`：前端开发服务
- `npm run typecheck`：类型检查（不产物）
- `npm run start`：运行 `dist/cli.js`
