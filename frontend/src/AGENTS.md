# FRONTEND KNOWLEDGE BASE

## OVERVIEW
`frontend/src/` contains a single-page React + Sigma graph client with URL-synced controls, node focus workflows, and responsive dual-theme styling.

## WHERE TO LOOK
| Task | Location | Notes |
|------|----------|-------|
| Main interaction/state flow | `frontend/src/App.tsx` | Seed/subgraph/search/theme/query-state orchestration |
| API integration + HTTP errors | `frontend/src/api.ts` | Centralized `fetchJson` + `HttpError` behavior |
| Shared graph data types | `frontend/src/types.ts` | Keep keys aligned with `/api/*` payloads |
| App bootstrap | `frontend/src/main.tsx` | Mounting + global stylesheet import |
| Visual system + responsive layout | `frontend/src/styles.css` | Color tokens, panel/grid layout, breakpoints |

## CONVENTIONS
- `App.tsx` is the orchestration layer: API fetch, Sigma lifecycle, filtering, and URL sync stay coherent.
- Query params are stateful UX (`seed`, `depth`, `q`, `type`, `node`); preserve compatibility when adding controls.
- Theme mode is persisted with `localStorage` key `mmgraph-theme` and reflected via root classes.
- For large graphs, keep degraded rendering paths (`labelDensity`, `edge labels`, node sizes) to protect interactivity.

## ANTI-PATTERNS
- Do not duplicate API call logic in components; use `api.ts` helpers.
- Do not mutate payload key expectations (`nodeCount`, `edgeCount`, `nodes`, `edges`, `seeds`) without backend alignment.
- Do not remove reduced-motion and keyboard accessibility hooks (skip link, focus-visible, aria labels).
- Do not bypass node/edge reducers for type visibility or focus context; that breaks graph readability.

## HOTSPOT NOTES
- `frontend/src/App.tsx` is intentionally broad today (graph lifecycle + UI controls + state sync).
- Prefer incremental extraction to focused components/hooks when touching adjacent concerns:
  - panel controls/search state
  - Sigma renderer lifecycle
  - URL query synchronization
  - status and error messaging
