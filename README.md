# mmgraph

English | [中文](./README.zh-CN.md)

`mmgraph` is a CLI + WebUI tool for exploring `memory-mcp-1file` data as a graph.

It helps you:
- convert raw dumps to normalized graph snapshots
- load data from a `db/` layout directly
- inspect and export subgraphs from CLI
- browse the graph in an interactive local web UI

## Upstream Reference (quoted)

The referenced upstream repository for this toolchain is:

> `https://github.com/pomazanbohdan/memory-mcp-1file`

## Requirements

- Node.js 18+
- npm

## Install

```bash
npm install
npm run build:all
```

Run from source without building:

```bash
npm run dev -- --help
```

## Quick Start

```bash
# Recommended: one-command entry
npm run dev -- visualize --data-dir ~/.local/share/opencode-mmcp-1file/my-project --open

# Or run built CLI
node dist/cli.js visualize --data-dir ~/.local/share/opencode-mmcp-1file/my-project --open
```

Default local URLs:
- `http://127.0.0.1:3939/`
- `http://127.0.0.1:3939/next`

## CLI Commands

- `sync`: convert raw dump (or direct DB data) to snapshot JSON
- `stats`: print graph statistics
- `search`: search nodes by keyword and optional type
- `inspect`: inspect a seed node neighborhood
- `export`: export subgraph to `json`, `dot`, or `mermaid`
- `serve`: start WebUI server
- `visualize` / `viz`: one-command visualization entry

## Common Usage

```bash
# 1) convert raw dump to snapshot
node dist/cli.js sync --source ./raw-dump.json --out ./out/snapshot.json

# 2) inspect data in CLI
node dist/cli.js stats --input ./out/snapshot.json
node dist/cli.js search --input ./out/snapshot.json --query auth --type entity
node dist/cli.js inspect --input ./out/snapshot.json --seed entities:oauth --depth 2

# 3) export a subgraph
node dist/cli.js export --input ./out/snapshot.json --seed entities:oauth --format mermaid --out ./out/oauth.mmd

# 4) start WebUI
node dist/cli.js serve --input ./out/snapshot.json --open
```

## Data Input Shape (`sync --source`)

Input JSON should include SurrealDB-like table arrays:

```json
{
  "memories": [],
  "entities": [],
  "relations": [],
  "code_symbols": [],
  "symbol_relation": []
}
```

## Auto Discovery Rules

When `--input` / `--source` is omitted, mmgraph checks `--data-dir` (or current directory) in this order:

- snapshot candidates: `snapshot.json`, `graph-snapshot.json`, `mmgraph.snapshot.json`, `out/snapshot.json`
- raw dump candidates: `raw-dump.json`, `memory-mcp-dump.json`, `memory_dump.json`, `dump.json`, `data.json`, `out/raw-dump.json`
- direct DB layout: directory containing `db/`

If both snapshot and raw dump exist, snapshot is preferred.

## Live Mode Notes

- `serve` and `visualize` enable live refresh by default
- use `--no-live` to disable it
- `--refresh-interval` default is `10` seconds
- in direct `--data-dir` mode, refresh interval is clamped to at least `30` seconds to reduce snapshot contention

## Web API

When running `serve`, the backend provides:

- `GET /api/stats`
- `GET /api/search?q=<keyword>&type=<nodeType>`
- `GET /api/seeds`
- `GET /api/graph`
- `GET /api/subgraph?seed=<id>&depth=<n>&limit=<n>`

## Frontend

```bash
# dev server for frontend only
npm run dev:web

# build frontend bundle
npm run build:web
```

## Scripts

- `npm run build`: compile TypeScript CLI/server
- `npm run build:web`: build Vite frontend bundle
- `npm run build:all`: build both backend and frontend
- `npm run dev`: run CLI from source (`tsx src/cli.ts`)
- `npm run dev:web`: run frontend dev server
- `npm run typecheck`: TypeScript type check without emit
- `npm run start`: run built CLI (`node dist/cli.js`)
