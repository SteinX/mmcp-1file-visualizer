# mmgraph

[English](./README.md) | 中文

`mmgraph` 是一个用于探索 `memory-mcp-1file` 数据图谱的 CLI + WebUI 工具。

它支持：
- 将 raw dump 转换为标准 graph snapshot
- 从 `db/` 目录布局直接读取数据
- 通过 CLI 检索、分析、导出子图
- 在本地 WebUI 中交互式浏览图谱

## 上游仓库引用（quoted）

本工具链引用的 `memory-mcp-1file` 上游仓库地址为：

> `https://github.com/pomazanbohdan/memory-mcp-1file`

## 环境要求

- Node.js 18+
- npm

## 安装

```bash
npm install
npm run build:all
```

不构建直接运行源码：

```bash
npm run dev -- --help
```

## 快速开始

```bash
# 推荐：一条命令启动可视化
npm run dev -- visualize --data-dir ~/.local/share/opencode-mmcp-1file/my-project --open

# 或使用构建后的 CLI
node dist/cli.js visualize --data-dir ~/.local/share/opencode-mmcp-1file/my-project --open
```

默认本地地址：
- `http://127.0.0.1:3939/`
- `http://127.0.0.1:3939/next`

## CLI 命令

- `sync`：将 raw dump（或 direct DB 数据）转换为 snapshot JSON
- `stats`：输出图谱统计信息
- `search`：按关键词和类型搜索节点
- `inspect`：查看 seed 节点邻域子图
- `export`：导出子图（`json` / `dot` / `mermaid`）
- `serve`：启动 WebUI 服务
- `visualize` / `viz`：一键可视化入口

## 常见使用方式

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

## 输入数据格式（`sync --source`）

输入 JSON 建议包含以下数组字段：

```json
{
  "memories": [],
  "entities": [],
  "relations": [],
  "code_symbols": [],
  "symbol_relation": []
}
```

## 自动发现规则

当未显式传入 `--input` / `--source` 时，`mmgraph` 会在 `--data-dir`（或当前目录）按顺序查找：

- snapshot 候选：`snapshot.json`、`graph-snapshot.json`、`mmgraph.snapshot.json`、`out/snapshot.json`
- raw dump 候选：`raw-dump.json`、`memory-mcp-dump.json`、`memory_dump.json`、`dump.json`、`data.json`、`out/raw-dump.json`
- direct DB 布局：包含 `db/` 子目录

若 snapshot 与 raw dump 同时存在，优先使用 snapshot。

## Live 模式说明

- `serve` 与 `visualize` 默认开启 live refresh
- 可通过 `--no-live` 关闭
- `--refresh-interval` 默认 `10s`
- 在 direct `--data-dir` 模式下，最小刷新间隔会被提升到 `30s`，以降低 snapshot 竞争

## Web API

执行 `serve` 后可用：

- `GET /api/stats`
- `GET /api/search?q=<keyword>&type=<nodeType>`
- `GET /api/seeds`
- `GET /api/graph`
- `GET /api/subgraph?seed=<id>&depth=<n>&limit=<n>`

## 前端开发

```bash
# 仅启动前端开发服务
npm run dev:web

# 构建前端 bundle
npm run build:web
```

## Scripts

- `npm run build`：编译 TypeScript CLI/server
- `npm run build:web`：构建 Vite 前端
- `npm run build:all`：同时构建后端与前端
- `npm run dev`：从源码运行 CLI（`tsx src/cli.ts`）
- `npm run dev:web`：前端开发模式
- `npm run typecheck`：TypeScript 类型检查（不产物）
- `npm run start`：运行构建后的 CLI（`node dist/cli.js`）
