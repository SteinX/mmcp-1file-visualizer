# RUST EXPORTER KNOWLEDGE BASE

## OVERVIEW
`tools/mmgraph-surreal-export/` is a small Rust utility invoked by the Node CLI to export SurrealKV (`db/` layout) into a JSON dump compatible with the graph normalizer.

## STRUCTURE
```text
tools/mmgraph-surreal-export/
├── Cargo.toml
├── Cargo.lock
├── src/
│   └── main.rs
└── target/                 # build artifacts (should not be committed)
```

## WHERE TO LOOK
| Task | Location | Notes |
|------|----------|-------|
| Exporter invocation + safety | `src/directDb.ts` | lock detection, optional snapshot copy, cargo command resolution |
| What data is exported | `tools/mmgraph-surreal-export/src/main.rs` | selects tables + prints a single JSON payload |
| Dependency/features | `tools/mmgraph-surreal-export/Cargo.toml` | surrealdb local engine + `kv-surrealkv` + `rustls` |

## CONVENTIONS
- CLI contract: exporter prints exactly one JSON object to stdout (no extra logs).
- Input contract: argument is the memory-mcp data dir; exporter reads `${dataDir}/db`.
- Namespace/DB: uses `ns=memory` and `db=main`.
- Table set is explicit and stable: `memories`, `entities`, `relations`, `code_symbols`, `symbol_relation`.

## ANTI-PATTERNS
- Do not add stdout logging (breaks JSON parsing in `src/directDb.ts`).
- Do not change table names or payload keys without updating the TS normalizer/graph shape.
- Do not rely on live DB reads being safe; the Node side is responsible for lock detection and snapshot mode.
- Do not commit `target/` outputs; they are large and platform-specific.

## COMMANDS
```bash
# run exporter directly (expects <memory-mcp-data-dir> containing db/)
cargo run --quiet --manifest-path tools/mmgraph-surreal-export/Cargo.toml -- <memory-mcp-data-dir>
```
