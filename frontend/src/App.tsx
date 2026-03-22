import { useEffect, useMemo, useRef, useState } from "react";
import type { ReactNode } from "react";
import Graph from "graphology";
import Sigma from "sigma";
import {
  fetchFullGraph,
  fetchSeeds,
  fetchStats,
  HttpError,
  fetchSubgraph,
  searchNodes as searchNodesApi
} from "./api";
import type { GraphNode, GraphSnapshot, GraphStats } from "./types";

type NodeKind = "memory" | "entity" | "code_symbol";

const COLORS: Record<NodeKind, string> = {
  memory: "#1f7a8c",
  entity: "#d17c2f",
  code_symbol: "#1d5f89"
};

const NODE_KINDS: NodeKind[] = ["memory", "entity", "code_symbol"];

type StatusTone = "ok" | "warn" | "error";
type ThemeMode = "dark" | "light";

const THEME_COLORS: Record<ThemeMode, string> = {
  dark: "#0f1720",
  light: "#f4f8fc"
};

function disableSigmaNodeHover() {
  return;
}

function isKnownNodeKind(value: string): value is NodeKind {
  return NODE_KINDS.includes(value as NodeKind);
}

function isTypeVisible(type: string, visibleTypes: Record<NodeKind, boolean>): boolean {
  if (!isKnownNodeKind(type)) {
    return true;
  }
  return visibleTypes[type];
}

function colorForNodeType(type: string): string {
  if (isKnownNodeKind(type)) {
    return COLORS[type];
  }
  return "#4f6e8f";
}

type SeedOption = { id: string; label: string; degree: number };

type PanelSectionProps = {
  title: string;
  children: ReactNode;
};

type LeftPanelProps = {
  seedInput: string;
  depth: number;
  searchQ: string;
  searchType: string;
  seeds: SeedOption[];
  searchResults: GraphNode[];
  visibleTypes: Record<NodeKind, boolean>;
  activeSearchIndex: number;
  setSeedInput: (value: string) => void;
  setDepth: (value: number) => void;
  setSearchQ: (value: string) => void;
  setSearchType: (value: string) => void;
  setActiveSearchIndex: (updater: (prev: number) => number) => void;
  toggleTypeVisibility: (type: NodeKind) => void;
  loadSubgraph: (seed: string, nextDepth: number) => Promise<void>;
  loadFullGraph: () => Promise<void>;
  runSearch: () => Promise<void>;
  resetCamera: () => void;
  chooseSearchResult: (index: number) => void;
};

type RightPanelProps = {
  selectedNode: GraphNode | null;
  metadataEntries: Array<[string, unknown]>;
  neighborIds: string[];
  stats: GraphStats | null;
};

function getInitialTheme(): ThemeMode {
  if (typeof window === "undefined") {
    return "dark";
  }

  const stored = window.localStorage.getItem("mmgraph-theme");
  if (stored === "dark" || stored === "light") {
    return stored;
  }

  return window.matchMedia("(prefers-color-scheme: light)").matches ? "light" : "dark";
}

function PanelSection({ title, children }: PanelSectionProps) {
  return (
    <section className="card glass">
      <h3>{title}</h3>
      {children}
    </section>
  );
}

function LeftPanel({
  seedInput,
  depth,
  searchQ,
  searchType,
  seeds,
  searchResults,
  visibleTypes,
  activeSearchIndex,
  setSeedInput,
  setDepth,
  setSearchQ,
  setSearchType,
  setActiveSearchIndex,
  toggleTypeVisibility,
  loadSubgraph,
  loadFullGraph,
  runSearch,
  resetCamera,
  chooseSearchResult
}: LeftPanelProps) {
  return (
    <aside className="leftPanel" aria-label="Graph controls panel">
      <PanelSection title="Explore">
        <label htmlFor="seed-node-input">Seed node</label>
        <input
          id="seed-node-input"
          name="seedNode"
          autoComplete="off"
          value={seedInput}
          onChange={(e) => setSeedInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              void loadSubgraph(seedInput.trim(), depth);
            }
          }}
          placeholder="entities:oauth…"
        />
        <label htmlFor="depth-input">Depth</label>
        <input
          id="depth-input"
          name="depth"
          type="number"
          inputMode="numeric"
          autoComplete="off"
          min={1}
          max={5}
          value={depth}
          onChange={(e) => setDepth(Number(e.target.value || 2))}
        />
        <div className="buttonRow">
          <button onClick={() => void loadSubgraph(seedInput.trim(), depth)}>Load subgraph</button>
          <button className="secondary" onClick={() => void loadFullGraph()}>
            Full graph
          </button>
        </div>
        <button className="secondary" onClick={resetCamera}>
          Reset camera
        </button>
      </PanelSection>

      <PanelSection title="Hot seeds">
        <div className="seedList">
          {seeds.map((seed) => (
            <button
              key={seed.id}
              className="seedItem"
              title={seed.id}
              onClick={() => {
                setSeedInput(seed.id);
                void loadSubgraph(seed.id, depth);
              }}
            >
              {seed.label} <span>deg {seed.degree}</span>
            </button>
          ))}
        </div>
      </PanelSection>

      <PanelSection title="Search">
        <label htmlFor="search-keyword-input">Keyword</label>
        <input
          id="search-keyword-input"
          name="keyword"
          autoComplete="off"
          value={searchQ}
          onChange={(e) => setSearchQ(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "ArrowDown" && searchResults.length > 0) {
              e.preventDefault();
              setActiveSearchIndex((prev) => (prev + 1) % searchResults.length);
              return;
            }
            if (e.key === "ArrowUp" && searchResults.length > 0) {
              e.preventDefault();
              setActiveSearchIndex((prev) => (prev <= 0 ? searchResults.length - 1 : prev - 1));
              return;
            }
            if (e.key === "Enter" && activeSearchIndex >= 0 && searchResults[activeSearchIndex]) {
              e.preventDefault();
              chooseSearchResult(activeSearchIndex);
              return;
            }
            if (e.key === "Enter") {
              void runSearch();
            }
          }}
          placeholder="oauth…"
        />
        <label htmlFor="search-type-input">Type (optional)</label>
        <input
          id="search-type-input"
          name="nodeType"
          autoComplete="off"
          spellCheck={false}
          value={searchType}
          onChange={(e) => setSearchType(e.target.value)}
          placeholder="entity…"
        />
        <button onClick={() => void runSearch()}>Search</button>
        <div className="results">
          {searchResults.map((node, index) => (
            <button
              key={node.id}
              className={`resultItem ${searchResults[activeSearchIndex]?.id === node.id ? "active" : ""}`}
              onClick={() => {
                chooseSearchResult(index);
              }}
            >
              {node.label} ({node.type})
            </button>
          ))}
        </div>
      </PanelSection>

      <PanelSection title="Legend">
        {NODE_KINDS.map((kind) => (
          <button
            key={kind}
            type="button"
            className={`legendFilterItem ${visibleTypes[kind] ? "" : "inactive"}`}
            aria-pressed={visibleTypes[kind]}
            onClick={() => toggleTypeVisibility(kind)}
          >
            <span className="legendDot" style={{ background: COLORS[kind] }} /> {kind}
          </button>
        ))}
      </PanelSection>
    </aside>
  );
}

function RightPanel({ selectedNode, metadataEntries, neighborIds, stats }: RightPanelProps) {
  return (
    <aside className="rightPanel card glass" aria-label="Node details panel">
      <h3>Node inspector</h3>
      {!selectedNode ? (
        <p className="empty detailState">Hover node for popover details. Click node to pin graph focus.</p>
      ) : (
        <div className="detailState open">
          <p>
            <strong>ID:</strong> {selectedNode.id}
          </p>
          <p>
            <strong>Type:</strong> {selectedNode.type}
          </p>
          <p>
            <strong>Label:</strong> {selectedNode.label}
          </p>
          <p>
            <strong>Summary:</strong> {(selectedNode.summary || "-").slice(0, 220)}
          </p>
          <p>
            <strong>Metadata:</strong>
          </p>
          {metadataEntries.length === 0 ? (
            <p className="empty">none</p>
          ) : (
            <ul>
              {metadataEntries.map(([key, value]) => (
                <li key={key}>
                  <strong>{key}:</strong> {String(value)}
                </li>
              ))}
            </ul>
          )}
          <p>
            <strong>Neighbors:</strong>
          </p>
          <ul>
            {neighborIds.map((id) => (
              <li key={id}>{id}</li>
            ))}
          </ul>
        </div>
      )}

      <h3>Stats</h3>
      <p>{stats ? `${stats.nodeCount} nodes · ${stats.edgeCount} edges` : "Loading stats…"}</p>
    </aside>
  );
}

function getInitialQueryState(): {
  seedInput: string;
  depth: number;
  searchQ: string;
  searchType: string;
  selectedNodeId: string;
} {
  if (typeof window === "undefined") {
    return {
      seedInput: "",
      depth: 2,
      searchQ: "",
      searchType: "",
      selectedNodeId: ""
    };
  }

  const params = new URLSearchParams(window.location.search);
  const depthRaw = Number(params.get("depth") || "2");
  const safeDepth = Number.isFinite(depthRaw) ? Math.min(5, Math.max(1, Math.floor(depthRaw))) : 2;

  return {
    seedInput: params.get("seed") || "",
    depth: safeDepth,
    searchQ: params.get("q") || "",
    searchType: params.get("type") || "",
    selectedNodeId: params.get("node") || ""
  };
}

function ringPositions(snapshot: GraphSnapshot): Map<string, { x: number; y: number }> {
  const byType = new Map<string, string[]>();
  for (const node of snapshot.nodes) {
    const key = node.type || "node";
    const list = byType.get(key);
    if (list) {
      list.push(node.id);
    } else {
      byType.set(key, [node.id]);
    }
  }

  const order = ["memory", "entity", "code_symbol"];
  const sorted = [...byType.entries()].sort((a, b) => {
    const ia = order.indexOf(a[0]);
    const ib = order.indexOf(b[0]);
    return (ia === -1 ? 99 : ia) - (ib === -1 ? 99 : ib);
  });

  const result = new Map<string, { x: number; y: number }>();
  sorted.forEach(([, ids], ring) => {
    const radius = 2 + ring * 1.7;
    ids.forEach((id, index) => {
      const angle = (Math.PI * 2 * index) / Math.max(ids.length, 1);
      result.set(id, { x: Math.cos(angle) * radius, y: Math.sin(angle) * radius });
    });
  });
  return result;
}

export function App() {
  const initialQuery = useMemo(() => getInitialQueryState(), []);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const rendererRef = useRef<Sigma | null>(null);
  const graphRef = useRef<Graph | null>(null);

  const [snapshot, setSnapshot] = useState<GraphSnapshot>({ nodes: [], edges: [] });
  const [stats, setStats] = useState<GraphStats | null>(null);
  const [seeds, setSeeds] = useState<Array<{ id: string; label: string; degree: number }>>([]);
  const [searchResults, setSearchResults] = useState<GraphNode[]>([]);
  const [activeSearchIndex, setActiveSearchIndex] = useState(-1);
  const [selectedNodeId, setSelectedNodeId] = useState<string>(initialQuery.selectedNodeId);
  const [hoveredNodeId, setHoveredNodeId] = useState<string>("");
  const [pointer, setPointer] = useState({ x: 0, y: 0 });
  const [stageBounds, setStageBounds] = useState({ width: 0, height: 0 });
  const [seedInput, setSeedInput] = useState(initialQuery.seedInput);
  const [depth, setDepth] = useState(initialQuery.depth);
  const [searchQ, setSearchQ] = useState(initialQuery.searchQ);
  const [searchType, setSearchType] = useState(initialQuery.searchType);
  const [visibleTypes, setVisibleTypes] = useState<Record<NodeKind, boolean>>({
    memory: true,
    entity: true,
    code_symbol: false
  });
  const [themeMode, setThemeMode] = useState<ThemeMode>(() => getInitialTheme());
  const [status, setStatus] = useState<{ tone: StatusTone; text: string; meta: string }>({
    tone: "warn",
    text: "Initializing",
    meta: "Loading graph resources"
  });

  const isLargeGraph = snapshot.nodes.length > 300 || snapshot.edges.length > 1200;

  const relatedNodeIds = useMemo(() => {
    const focusId = selectedNodeId || hoveredNodeId;
    if (!focusId) {
      return new Set<string>();
    }
    const ids = new Set<string>([focusId]);
    for (const edge of snapshot.edges) {
      if (edge.source === focusId) {
        ids.add(edge.target);
      }
      if (edge.target === focusId) {
        ids.add(edge.source);
      }
    }
    return ids;
  }, [hoveredNodeId, selectedNodeId, snapshot.edges]);

  function focusNode(nodeId: string): void {
    const renderer = rendererRef.current;
    const graph = graphRef.current;
    if (!renderer || !graph || !graph.hasNode(nodeId)) {
      return;
    }
    const attrs = graph.getNodeAttributes(nodeId) as { x: number; y: number };
    renderer.getCamera().animate({ x: attrs.x, y: attrs.y, ratio: 0.24 }, { duration: 280 });
  }

  useEffect(() => {
    void (async () => {
      try {
        const fullGraph = await waitForGraphReady();
        const [loadedStats, loadedSeeds] = await Promise.all([fetchStats(), fetchSeeds()]);
        setStats(loadedStats);
        setSeeds(loadedSeeds.seeds.slice(0, 15));
        if (!initialQuery.seedInput && loadedSeeds.seeds[0]) {
          setSeedInput(loadedSeeds.seeds[0].id);
        }
        setSnapshot(fullGraph);
        setStatus({
          tone: "ok",
          text: "Ready",
          meta: `${fullGraph.nodes.length} nodes, ${fullGraph.edges.length} edges`
        });
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        setStatus({ tone: "error", text: "Initialization failed", meta: message });
      }
    })();
  }, [initialQuery.seedInput]);

  useEffect(() => {
    const root = document.documentElement;
    root.classList.toggle("theme-light", themeMode === "light");
    root.classList.toggle("theme-dark", themeMode === "dark");
    const themeColorMeta = document.querySelector<HTMLMetaElement>("#theme-color-meta");
    if (themeColorMeta) {
      themeColorMeta.setAttribute("content", THEME_COLORS[themeMode]);
    }
    window.localStorage.setItem("mmgraph-theme", themeMode);
  }, [themeMode]);

  useEffect(() => {
    const url = new URL(window.location.href);
    const params = url.searchParams;

    const setOrDelete = (key: string, value: string) => {
      if (value) {
        params.set(key, value);
      } else {
        params.delete(key);
      }
    };

    setOrDelete("seed", seedInput.trim());
    setOrDelete("q", searchQ.trim());
    setOrDelete("type", searchType.trim());
    setOrDelete("node", selectedNodeId);

    if (depth === 2) {
      params.delete("depth");
    } else {
      params.set("depth", String(depth));
    }

    const nextSearch = params.toString();
    const nextUrl = `${url.pathname}${nextSearch ? `?${nextSearch}` : ""}${url.hash}`;
    const currentUrl = `${window.location.pathname}${window.location.search}${window.location.hash}`;

    if (nextUrl !== currentUrl) {
      window.history.replaceState(null, "", nextUrl);
    }
  }, [depth, searchQ, searchType, seedInput, selectedNodeId]);

  async function waitForGraphReady(): Promise<GraphSnapshot> {
    const startedAt = Date.now();
    const timeoutMs = 60_000;
    let lastGraphWaitMessage = "Waiting for backend snapshot";

    while (true) {
      try {
        const graph = await fetchFullGraph();
        return graph;
      } catch (error) {
        if (error instanceof HttpError && error.status === 503) {
          lastGraphWaitMessage = error.message || lastGraphWaitMessage;
          setStatus({ tone: "warn", text: "Loading graph", meta: lastGraphWaitMessage });
          if (Date.now() - startedAt >= timeoutMs) {
            throw new Error(`Graph initialization timed out: ${lastGraphWaitMessage}`);
          }
          await sleep(800);
          continue;
        }
        throw error;
      }
    }
  }

  useEffect(() => {
    if (!containerRef.current) {
      return;
    }

    const graph = new Graph({ multi: true, type: "directed" });
    const large = isLargeGraph;
    const positions = ringPositions(snapshot);

    for (const node of snapshot.nodes) {
      const pos = positions.get(node.id) ?? { x: Math.random(), y: Math.random() };
      graph.addNode(node.id, {
        x: pos.x,
        y: pos.y,
        size: large ? 3 : 5,
        label: node.label,
        color: colorForNodeType(node.type),
        type: node.type
      });
    }

    for (const edge of snapshot.edges) {
      if (!graph.hasNode(edge.source) || !graph.hasNode(edge.target)) {
        continue;
      }
      graph.addEdgeWithKey(edge.id, edge.source, edge.target, {
        size: large ? 0.4 : 0.8,
        color: "#8ea8bf",
        label: large ? "" : edge.relation
      });
    }

    rendererRef.current?.kill();
    const renderer = new Sigma(graph, containerRef.current, {
      renderEdgeLabels: !large,
      labelDensity: large ? 0.02 : 0.08,
      labelGridCellSize: large ? 140 : 100,
      labelColor: { color: "#d8e8f8" },
      defaultDrawNodeHover: disableSigmaNodeHover,
      zIndex: true
    });

    renderer.on("clickNode", (event: { node: string }) => {
      setSelectedNodeId(event.node);
      focusNode(event.node);
    });
    renderer.on("enterNode", (event: { node: string }) => {
      setHoveredNodeId(event.node);
    });
    renderer.on("leaveNode", () => {
      setHoveredNodeId("");
    });
    renderer.on("clickStage", () => {
      setSelectedNodeId("");
      setHoveredNodeId("");
    });

    rendererRef.current = renderer;
    graphRef.current = graph;
    renderer.getCamera().animatedReset({ duration: 250 });

    return () => {
      renderer.kill();
    };
  }, [isLargeGraph, snapshot]);

  useEffect(() => {
    const renderer = rendererRef.current;
    const graph = graphRef.current;
    if (!renderer || !graph) {
      return;
    }

    const hasFocus = relatedNodeIds.size > 0;

    renderer.setSetting("nodeReducer", (node: string, data: Record<string, unknown>) => {
      const nodeType = String(data.type ?? "");
      if (!isTypeVisible(nodeType, visibleTypes)) {
        return {
          ...data,
          hidden: true,
          label: ""
        };
      }

      if (!hasFocus || relatedNodeIds.has(node)) {
        return data;
      }
      return {
        ...data,
        color: "#304458",
        label: ""
      };
    });

    renderer.setSetting("edgeReducer", (edge: string, data: Record<string, unknown>) => {
      if (!hasFocus) {
        const [source, target] = graph.extremities(edge);
        const sourceType = String(graph.getNodeAttribute(source, "type") || "");
        const targetType = String(graph.getNodeAttribute(target, "type") || "");
        if (!isTypeVisible(sourceType, visibleTypes) || !isTypeVisible(targetType, visibleTypes)) {
          return {
            ...data,
            hidden: true,
            label: ""
          };
        }
        return data;
      }
      const [source, target] = graph.extremities(edge);
      const sourceType = String(graph.getNodeAttribute(source, "type") || "");
      const targetType = String(graph.getNodeAttribute(target, "type") || "");
      if (!isTypeVisible(sourceType, visibleTypes) || !isTypeVisible(targetType, visibleTypes)) {
        return {
          ...data,
          hidden: true,
          label: ""
        };
      }
      const keep = relatedNodeIds.has(source) && relatedNodeIds.has(target);
      if (keep) {
        return {
          ...data,
          color: "#77b2df",
          size: Math.max(Number(data.size ?? 1), 1)
        };
      }
      return {
        ...data,
        color: "#273746",
        hidden: false,
        size: 0.2,
        label: ""
      };
    });

    renderer.refresh();
  }, [relatedNodeIds, visibleTypes]);

  const selectedNode = useMemo(
    () => snapshot.nodes.find((node) => node.id === selectedNodeId) ?? null,
    [snapshot.nodes, selectedNodeId]
  );

  useEffect(() => {
    if (selectedNodeId && !selectedNode) {
      setSelectedNodeId("");
    }
  }, [selectedNode, selectedNodeId]);

  const hoveredNode = useMemo(
    () => snapshot.nodes.find((node) => node.id === hoveredNodeId) ?? null,
    [hoveredNodeId, snapshot.nodes]
  );

  useEffect(() => {
    if (selectedNode && !isTypeVisible(selectedNode.type, visibleTypes)) {
      setSelectedNodeId("");
    }
    if (hoveredNode && !isTypeVisible(hoveredNode.type, visibleTypes)) {
      setHoveredNodeId("");
    }
  }, [hoveredNode, selectedNode, visibleTypes]);

  const neighborIds = useMemo(() => {
    if (!selectedNodeId) {
      return [];
    }
    const list = snapshot.edges
      .filter((edge) => edge.source === selectedNodeId || edge.target === selectedNodeId)
      .map((edge) => (edge.source === selectedNodeId ? edge.target : edge.source));
    return [...new Set(list)].slice(0, 10);
  }, [snapshot.edges, selectedNodeId]);

  const metadataEntries = useMemo(
    () => (selectedNode?.metadata ? Object.entries(selectedNode.metadata).slice(0, 8) : []),
    [selectedNode]
  );

  const hoveredMetadataEntries = useMemo(
    () => (hoveredNode?.metadata ? Object.entries(hoveredNode.metadata).slice(0, 4) : []),
    [hoveredNode]
  );

  const nodePopoverStyle = useMemo(() => {
    const margin = 16;
    const popoverMaxWidth = 320;
    const popoverEstimatedHeight = 240;
    const maxLeft = Math.max(margin, stageBounds.width - popoverMaxWidth - margin);
    const maxTop = Math.max(margin, stageBounds.height - popoverEstimatedHeight - margin);

    return {
      left: Math.min(Math.max(pointer.x + 14, margin), maxLeft),
      top: Math.min(Math.max(pointer.y - 10, margin), maxTop)
    };
  }, [pointer.x, pointer.y, stageBounds.height, stageBounds.width]);

  async function loadFullGraphHandler(): Promise<void> {
    try {
      setStatus({ tone: "warn", text: "Loading full graph", meta: "Fetching /api/graph" });
      const graph = await fetchFullGraph();
      setSnapshot(graph);
      const large = graph.nodes.length > 300 || graph.edges.length > 1200;
      setStatus({
        tone: large ? "warn" : "ok",
        text: large ? "Large graph optimization" : "Full graph loaded",
        meta: `${graph.nodes.length} nodes, ${graph.edges.length} edges`
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      setStatus({ tone: "error", text: "Load failed", meta: message });
    }
  }

  async function loadSubgraphHandler(seed: string, nextDepth: number): Promise<void> {
    if (!seed) {
      return;
    }
    try {
      setStatus({ tone: "warn", text: "Loading subgraph", meta: `${seed}, depth ${nextDepth}` });
      const graph = await fetchSubgraph(seed, nextDepth);
      setSnapshot(graph);
      setStatus({ tone: "ok", text: "Subgraph loaded", meta: `${graph.nodes.length} nodes, ${graph.edges.length} edges` });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      setStatus({ tone: "error", text: "Subgraph failed", meta: message });
    }
  }

  async function runSearch(): Promise<void> {
    try {
      const payload = await searchNodesApi(searchQ, searchType || undefined);
      setSearchResults(payload.nodes.slice(0, 25));
      setActiveSearchIndex(payload.nodes.length > 0 ? 0 : -1);
      setStatus({ tone: "ok", text: "Search complete", meta: `${payload.nodes.length} matched` });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      setStatus({ tone: "error", text: "Search failed", meta: message });
    }
  }

  function toggleTypeVisibility(type: NodeKind): void {
    setVisibleTypes((prev) => ({
      ...prev,
      [type]: !prev[type]
    }));
  }

  function chooseSearchResult(index: number): void {
    const node = searchResults[index];
    if (!node) {
      return;
    }
    setActiveSearchIndex(index);
    setSelectedNodeId(node.id);
    setSeedInput(node.id);
    void loadSubgraphHandler(node.id, depth);
  }

  function resetCamera(): void {
    rendererRef.current?.getCamera().animatedReset({ duration: 250 });
  }

  function sleep(ms: number): Promise<void> {
    return new Promise((resolve) => {
      setTimeout(resolve, ms);
    });
  }

  return (
    <div className={`app theme-${themeMode}`}>
      <a className="skipLink" href="#main-content">
        Skip to main content
      </a>
      <header className="topbar">
        <div>
          <h1>Mmgraph Next</h1>
          <p>graph-first layout with modular controls</p>
          <div className="chips">
            <span className="chip">Live topology</span>
            <span className="chip">Seed expansion</span>
            <span className="chip">Detail inspector</span>
          </div>
        </div>
        <div className="topbarActions">
          <button
            className="themeToggle secondary"
            type="button"
            onClick={() => setThemeMode((prev) => (prev === "dark" ? "light" : "dark"))}
            aria-label={themeMode === "dark" ? "Switch to light theme" : "Switch to dark theme"}
          >
            {themeMode === "dark" ? "Light mode" : "Dark mode"}
          </button>
          <div className={`status ${status.tone}`} role="status" aria-live="polite" aria-atomic="true">
            <strong>{status.text}</strong>
            <span>{status.meta}</span>
          </div>
        </div>
      </header>

      <main className="layout" id="main-content">
        <LeftPanel
          seedInput={seedInput}
          depth={depth}
          searchQ={searchQ}
          searchType={searchType}
          seeds={seeds}
          searchResults={searchResults}
          visibleTypes={visibleTypes}
          activeSearchIndex={activeSearchIndex}
          setSeedInput={setSeedInput}
          setDepth={setDepth}
          setSearchQ={setSearchQ}
          setSearchType={setSearchType}
          setActiveSearchIndex={setActiveSearchIndex}
          toggleTypeVisibility={toggleTypeVisibility}
          loadSubgraph={loadSubgraphHandler}
          loadFullGraph={loadFullGraphHandler}
          runSearch={runSearch}
          resetCamera={resetCamera}
          chooseSearchResult={chooseSearchResult}
        />

        <section
          className="graphStage"
          role="region"
          aria-label="Interactive graph view"
          onMouseMove={(event) => {
            const bounds = event.currentTarget.getBoundingClientRect();
            setPointer({ x: event.clientX - bounds.left, y: event.clientY - bounds.top });
            setStageBounds({ width: bounds.width, height: bounds.height });
          }}
        >
          <div className="graphTools" role="group" aria-label="Graph actions">
            <button onClick={resetCamera} aria-label="Fit graph to viewport">
              Fit
            </button>
            <button onClick={() => void loadFullGraphHandler()} aria-label="Reload full graph data">
              Reload graph
            </button>
          </div>
          <div ref={containerRef} className="graphCanvas" role="img" aria-label="Graph canvas" tabIndex={0} />
          {hoveredNode ? (
            <div className="nodePopover" style={nodePopoverStyle}>
              <div className="nodePopoverTitle">{hoveredNode.label}</div>
              <div className="nodePopoverMeta">{hoveredNode.type}</div>
              <div className="nodePopoverBody">{(hoveredNode.summary || "-").slice(0, 140)}</div>
              {hoveredMetadataEntries.length > 0 ? (
                <ul>
                  {hoveredMetadataEntries.map(([key, value]) => (
                    <li key={key}>
                      <strong>{key}:</strong> {value}
                    </li>
                  ))}
                </ul>
              ) : null}
            </div>
          ) : null}
        </section>

        <RightPanel selectedNode={selectedNode} metadataEntries={metadataEntries} neighborIds={neighborIds} stats={stats} />
      </main>
    </div>
  );
}
