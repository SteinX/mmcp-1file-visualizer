import express from "express";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { buildSubgraph, computeStats, searchNodes } from "./graph.js";
import type { GraphSnapshot } from "./types.js";

type ServeOptions = {
  snapshot?: GraphSnapshot;
  getSnapshot?: () => GraphSnapshot | undefined;
  getSnapshotError?: () => string | undefined;
  port: number;
};

export async function startServer(options: ServeOptions): Promise<void> {
  const app = express();
  app.use(express.json());

  const runtimeDir = path.dirname(fileURLToPath(import.meta.url));
  const projectRoot = path.resolve(runtimeDir, "..");
  const frontendDistDir = path.resolve(projectRoot, "frontend-dist");
  const frontendIndexPath = path.join(frontendDistDir, "index.html");

  app.use("/frontend", express.static(frontendDistDir));

  const resolveSnapshot = (): GraphSnapshot | undefined => {
    if (options.getSnapshot) {
      return options.getSnapshot();
    }
    if (options.snapshot) {
      return options.snapshot;
    }
    return undefined;
  };

  const sendGraphNotReady = (res: express.Response): void => {
    const detail = options.getSnapshotError?.();
    res.status(503).json({
      error: "graph_not_ready",
      message: detail ? `Graph is not ready: ${detail}` : "Graph is still loading. Retry shortly."
    });
  };

  const sendFrontendApp = (res: express.Response): void => {
    if (!fs.existsSync(frontendIndexPath)) {
      res.status(503).json({
        error: "frontend build not found",
        message: "Run `npm run build:web` before opening the web UI"
      });
      return;
    }
    res.sendFile(frontendIndexPath);
  };

  app.get("/api/stats", (_req, res) => {
    const snapshot = resolveSnapshot();
    if (!snapshot) {
      sendGraphNotReady(res);
      return;
    }
    res.json(computeStats(snapshot));
  });

  app.get("/api/search", (req, res) => {
    const snapshot = resolveSnapshot();
    if (!snapshot) {
      sendGraphNotReady(res);
      return;
    }
    const q = String(req.query.q ?? "");
    const type = req.query.type ? String(req.query.type) : undefined;
    const nodes = searchNodes(snapshot, q, type).slice(0, 100);
    res.json({ nodes });
  });

  app.get("/api/seeds", (_req, res) => {
    const snapshot = resolveSnapshot();
    if (!snapshot) {
      sendGraphNotReady(res);
      return;
    }
    const degree = new Map<string, number>();
    for (const edge of snapshot.edges) {
      degree.set(edge.source, (degree.get(edge.source) ?? 0) + 1);
      degree.set(edge.target, (degree.get(edge.target) ?? 0) + 1);
    }
    const top = snapshot.nodes
      .map((node) => ({ id: node.id, label: node.label, degree: degree.get(node.id) ?? 0 }))
      .sort((a, b) => b.degree - a.degree)
      .slice(0, 20);
    res.json({ seeds: top });
  });

  app.get("/api/graph", (_req, res) => {
    const snapshot = resolveSnapshot();
    if (!snapshot) {
      sendGraphNotReady(res);
      return;
    }
    res.json(snapshot);
  });

  app.get("/api/subgraph", (req, res) => {
    const snapshot = resolveSnapshot();
    if (!snapshot) {
      sendGraphNotReady(res);
      return;
    }
    const seed = String(req.query.seed ?? "");
    const depth = Math.min(Number(req.query.depth ?? 1), 5);
    const limit = Math.min(Number(req.query.limit ?? 500), 5000);
    if (!seed) {
      res.status(400).json({ error: "seed is required" });
      return;
    }
    res.json(buildSubgraph(snapshot, seed, depth, limit));
  });

  app.get("/", (_req, res) => {
    sendFrontendApp(res);
  });

  app.get("/next", (_req, res) => {
    sendFrontendApp(res);
  });

  await new Promise<void>((resolve) => {
    app.listen(options.port, () => resolve());
  });
}
