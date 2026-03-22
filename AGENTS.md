# PROJECT KNOWLEDGE BASE

**Generated:** 2026-03-22T15:22:37Z  
**Commit:** unborn (no commits yet)  
**Branch:** main

## OVERVIEW
`mmgraph` is a Node.js CLI + WebUI for browsing `memory-mcp-1file` graph data from raw dumps, snapshots, or direct SurrealKV layout.
The repository is split into backend TypeScript (`src/`), frontend React/Vite (`frontend/src/`), and a Rust helper used for direct DB export (`tools/mmgraph-surreal-export/`).

## STRUCTURE
```text
.
├── src/                          # CLI commands, graph logic, server API
├── frontend/src/                 # React/Sigma graph UI
├── tools/mmgraph-surreal-export/ # Rust exporter for direct SurrealKV reads
├── examples/                     # Sample graph artifacts
├── package.json                  # Build/dev command source of truth
├── tsconfig.json                 # Backend TS config (NodeNext)
└── frontend/vite.config.ts       # Frontend build/dev/proxy config
```

## WHERE TO LOOK
| Task | Location | Notes |
|------|----------|-------|
| Add CLI command | `src/cli.ts` | Commander wiring + options + flow |
| Change API shape | `src/server.ts` | `/api/*` routes + limits + errors |
| Graph traversal or search | `src/graph.ts` | BFS subgraph, stats, node search |
| Normalize memory dump input | `src/adapters/memoryMcpJson.ts` | Raw records -> `GraphSnapshot` |
| Direct DB extraction behavior | `src/directDb.ts` | Cargo invocation, lock handling, snapshots |
| Web UI interaction/state | `frontend/src/App.tsx` | Sigma renderer, panels, query-sync |
| UI data fetching | `frontend/src/api.ts` | API client and `HttpError` handling |
| UI look and responsive behavior | `frontend/src/styles.css` | Theme tokens + layout breakpoints |

## CODE MAP
| Symbol | Type | Location | Refs | Role |
|--------|------|----------|------|------|
| `program` | constant | `src/cli.ts` | high | CLI command entry and dispatch |
| `runServe` | function | `src/cli.ts` | high | Live-refresh bootstrap for server mode |
| `startServer` | function | `src/server.ts` | medium | HTTP API + static frontend serving |
| `buildSubgraph` | function | `src/graph.ts` | medium | Seed-based neighborhood extraction |
| `fromMemoryMcpDump` | function | `src/adapters/memoryMcpJson.ts` | medium | Raw dump normalization pipeline |
| `App` | function component | `frontend/src/App.tsx` | high | Main UI orchestration + Sigma lifecycle |

## CONVENTIONS
- Backend TS uses ESM + NodeNext; keep `.js` import suffixes in TS source.
- Frontend build is rooted at `frontend/`, emitted to `frontend-dist/`, and served from `/frontend`.
- `serve`/`visualize` default to live refresh; direct `--data-dir` mode enforces a minimum interval.
- Auto-discovery order matters: snapshot -> raw dump -> direct `db/` layout.

## ANTI-PATTERNS (THIS PROJECT)
- Do not assume direct DB reads are always safe; honor lock detection and snapshot mode logic.
- Do not change API response keys casually; frontend client expects stable `/api/*` payload shapes.
- Do not duplicate graph algorithms in frontend; keep traversal/stat/search logic backend-side.
- Do not commit generated artifacts (`dist/`, `frontend-dist/`, `out/`, Rust `target/`) as source-of-truth docs.

## UNIQUE STYLES
- Single-command UX is first-class (`visualize`/`viz`) with autodetection and optional browser open.
- UI prioritizes graph-first interaction with left control panel and right inspector panel.
- Theme strategy is dual-mode (dark/light) with CSS custom properties and URL query-state sync.

## COMMANDS
```bash
npm install
npm run build:all
npm run dev -- --help
npm run dev -- visualize --data-dir <memory-data-dir> --open
npm run build:web
npm run typecheck
```

## NOTES
- No committed CI workflow files are present; local npm scripts are the operative build contract.
- Test runner/layout is not currently defined in `package.json` (no `test` script).
- If adding scoped guidance for backend or frontend internals, use child AGENTS files below this root.
