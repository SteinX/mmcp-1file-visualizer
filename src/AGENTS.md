# BACKEND KNOWLEDGE BASE

## OVERVIEW
`src/` hosts CLI command routing, graph compute/search logic, data normalization, and HTTP API serving.

## STRUCTURE
```text
src/
├── cli.ts                 # Commander command tree + auto-discovery + live server mode
├── server.ts              # Express API and frontend static serving
├── graph.ts               # Stats/search/subgraph algorithms
├── directDb.ts            # Direct SurrealKV export orchestration (Rust helper invocation)
├── io.ts                  # JSON read/write + snapshot guard
├── formatters.ts          # DOT/Mermaid/stats formatting
├── types.ts               # Shared graph types
└── adapters/
    └── memoryMcpJson.ts   # Raw dump -> normalized graph snapshot
```

## WHERE TO LOOK
| Task | Location | Notes |
|------|----------|-------|
| Add a CLI command | `src/cli.ts` | Keep option naming and error handling style consistent |
| Adjust load/autodiscovery rules | `src/cli.ts` | Snapshot > raw dump > direct db ordering is intentional |
| Change API endpoint behavior | `src/server.ts` | Keep payload keys backward-compatible for frontend |
| Tune graph traversal/search | `src/graph.ts` | Reuse existing BFS/contains logic; avoid frontend duplication |
| Change direct DB extraction | `src/directDb.ts` | Preserve lock detection and snapshot copy safeguards |
| Extend dump normalization | `src/adapters/memoryMcpJson.ts` | Ensure node/edge ID normalization stays stable |

## CONVENTIONS
- Keep ESM imports with `.js` suffixes in TS sources.
- Preserve `GraphSnapshot` shape contract: `version`, `generatedAt`, `nodes`, `edges`.
- Use bounded API responses (`/api/search` slice, `/api/subgraph` caps) to avoid UI overload.
- Prefer small pure helpers in algorithm files (`graph.ts`, formatter helpers).

## ANTI-PATTERNS
- Do not bypass lock checks in `directDb.ts` when reading active `db/` directories.
- Do not move traversal/statistics logic into frontend code.
- Do not silently change candidate filename lists used by autodiscovery without updating docs.
- Do not add command output formats without wiring through `formatters.ts` and CLI validation.
