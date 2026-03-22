#!/usr/bin/env node
import { Command } from "commander";
import chalk from "chalk";
import open from "open";
import os from "node:os";
import { promises as fs } from "node:fs";
import path from "node:path";
import { fromMemoryMcpDump } from "./adapters/memoryMcpJson.js";
import { extractRawDumpFromDataDirDirect, hasDirectDbLayout } from "./directDb.js";
import { buildSubgraph, computeStats, searchNodes } from "./graph.js";
import { toDot, toMermaid, printStats } from "./formatters.js";
import { ensureSnapshot, readJsonFile, writeJsonFile } from "./io.js";
import { startServer } from "./server.js";
import type { GraphSnapshot } from "./types.js";

const program = new Command();

program.name("mmgraph").description("memory-mcp-1file graph visualizer CLI").version("0.1.0");

program
  .command("sync")
  .description("Convert memory-mcp dump into graph snapshot")
  .option("-s, --source <path>", "Path to JSON dump with memories/entities/relations")
  .option("--data-dir <path>", "Directory to auto-discover raw dump (defaults to CWD)")
  .option("--force-snapshot", "When reading direct DB, use a temporary filesystem snapshot", false)
  .option("-o, --out <path>", "Output snapshot json path (defaults to temp file)")
  .action(async (opts: { source?: string; dataDir?: string; forceSnapshot: boolean; out?: string }) => {
    const raw = await loadRawDump(opts.source, opts.dataDir, opts.forceSnapshot);
    const snapshot = fromMemoryMcpDump(raw);
    const outPath = await resolveSyncOutputPath(opts.out);
    await writeJsonFile(outPath, snapshot);
    console.log(chalk.green(`snapshot written: ${outPath}`));
    console.log(chalk.gray(`nodes=${snapshot.nodes.length}, edges=${snapshot.edges.length}`));
  });

program
  .command("stats")
  .description("Show graph stats")
  .option("-i, --input <path>", "Input graph snapshot JSON")
  .option("--data-dir <path>", "Directory to auto-discover data (defaults to CWD)")
  .option("--force-snapshot", "When reading direct DB, use a temporary filesystem snapshot", false)
  .action(async (opts: { input?: string; dataDir?: string; forceSnapshot: boolean }) => {
    const snapshot = await loadGraph(opts.input, opts.dataDir, opts.forceSnapshot);
    console.log(printStats(computeStats(snapshot)));
  });

program
  .command("search")
  .description("Search nodes by keyword")
  .option("-i, --input <path>", "Input graph snapshot JSON")
  .option("--data-dir <path>", "Directory to auto-discover data (defaults to CWD)")
  .option("--force-snapshot", "When reading direct DB, use a temporary filesystem snapshot", false)
  .requiredOption("-q, --query <text>", "Search keyword")
  .option("-t, --type <type>", "Optional node type filter")
  .option("-l, --limit <n>", "Result limit", "20")
  .action(async (opts: { input?: string; dataDir?: string; forceSnapshot: boolean; query: string; type?: string; limit: string }) => {
    const snapshot = await loadGraph(opts.input, opts.dataDir, opts.forceSnapshot);
    const limit = Number(opts.limit);
    const result = searchNodes(snapshot, opts.query, opts.type).slice(0, limit);
    if (result.length === 0) {
      console.log(chalk.yellow("no nodes found"));
      return;
    }
    for (const node of result) {
      console.log(`${node.id} | ${node.type} | ${node.label}`);
    }
  });

program
  .command("inspect")
  .description("Inspect seed neighborhood subgraph")
  .option("-i, --input <path>", "Input graph snapshot JSON")
  .option("--data-dir <path>", "Directory to auto-discover data (defaults to CWD)")
  .option("--force-snapshot", "When reading direct DB, use a temporary filesystem snapshot", false)
  .requiredOption("-s, --seed <id>", "Seed node id")
  .option("-d, --depth <n>", "Traversal depth", "2")
  .option("-l, --limit <n>", "Node limit", "500")
  .action(async (opts: { input?: string; dataDir?: string; forceSnapshot: boolean; seed: string; depth: string; limit: string }) => {
    const snapshot = await loadGraph(opts.input, opts.dataDir, opts.forceSnapshot);
    const subgraph = buildSubgraph(snapshot, opts.seed, Number(opts.depth), Number(opts.limit));
    console.log(chalk.cyan(`nodes=${subgraph.nodes.length} edges=${subgraph.edges.length}`));
    for (const node of subgraph.nodes.slice(0, 40)) {
      console.log(`${node.id} | ${node.type} | ${node.label}`);
    }
    if (subgraph.nodes.length > 40) {
      console.log(chalk.gray(`... and ${subgraph.nodes.length - 40} more nodes`));
    }
  });

program
  .command("export")
  .description("Export seed subgraph to json/dot/mermaid")
  .option("-i, --input <path>", "Input graph snapshot JSON")
  .option("--data-dir <path>", "Directory to auto-discover data (defaults to CWD)")
  .option("--force-snapshot", "When reading direct DB, use a temporary filesystem snapshot", false)
  .requiredOption("-s, --seed <id>", "Seed node id")
  .requiredOption("-f, --format <fmt>", "json|dot|mermaid")
  .requiredOption("-o, --out <path>", "Output file path")
  .option("-d, --depth <n>", "Traversal depth", "2")
  .option("-l, --limit <n>", "Node limit", "500")
  .action(
    async (opts: {
      input?: string;
      dataDir?: string;
      forceSnapshot: boolean;
      seed: string;
      format: string;
      out: string;
      depth: string;
      limit: string;
    }) => {
      const snapshot = await loadGraph(opts.input, opts.dataDir, opts.forceSnapshot);
    const subgraph = buildSubgraph(snapshot, opts.seed, Number(opts.depth), Number(opts.limit));

    if (opts.format === "json") {
      await writeJsonFile(opts.out, subgraph);
    } else if (opts.format === "dot") {
      await BunLikeWrite.writeText(opts.out, toDot(subgraph));
    } else if (opts.format === "mermaid") {
      await BunLikeWrite.writeText(opts.out, toMermaid(subgraph));
    } else {
      throw new Error(`unsupported format: ${opts.format}`);
    }

    console.log(chalk.green(`exported ${opts.format} to ${opts.out}`));
    }
  );

program
  .command("serve")
  .description("Start local WebUI server")
  .option("-i, --input <path>", "Input graph snapshot JSON")
  .option("--data-dir <path>", "Directory to auto-discover data (defaults to CWD)")
  .option("--force-snapshot", "When reading direct DB, use a temporary filesystem snapshot", false)
  .option("--no-live", "Disable periodic live refresh")
  .option("--refresh-interval <sec>", "Live refresh interval in seconds", "10")
  .option("-p, --port <n>", "Port", "3939")
  .option("--open", "Open browser automatically", false)
  .action(
    async (opts: {
      input?: string;
      dataDir?: string;
      forceSnapshot: boolean;
      live: boolean;
      refreshInterval: string;
      port: string;
      open: boolean;
    }) => {
      await runServe(opts.input, opts.dataDir, opts.forceSnapshot, opts.port, opts.open, opts.live, opts.refreshInterval);
    }
  );

program
  .command("visualize")
  .alias("viz")
  .description("One-command visualization entry (auto-load + start WebUI)")
  .option("--data-dir <path>", "memory-mcp data directory (defaults to CWD)")
  .option("-i, --input <path>", "Optional snapshot input path")
  .option("--force-snapshot", "When reading direct DB, use a temporary filesystem snapshot", false)
  .option("--no-live", "Disable periodic live refresh")
  .option("--refresh-interval <sec>", "Live refresh interval in seconds", "10")
  .option("-p, --port <n>", "Port", "3939")
  .option("--open", "Open browser automatically", false)
  .action(
    async (opts: {
      dataDir?: string;
      input?: string;
      forceSnapshot: boolean;
      live: boolean;
      refreshInterval: string;
      port: string;
      open: boolean;
    }) => {
      await runServe(opts.input, opts.dataDir, opts.forceSnapshot, opts.port, opts.open, opts.live, opts.refreshInterval);
    }
  );

async function loadSnapshot(filePath: string): Promise<GraphSnapshot> {
  return ensureSnapshot(await readJsonFile<unknown>(filePath));
}

async function loadGraph(inputPath?: string, dataDir?: string, forceSnapshot = false): Promise<GraphSnapshot> {
  if (inputPath) {
    return loadSnapshot(inputPath);
  }

  const baseDir = dataDir ? path.resolve(dataDir) : process.cwd();
  const snapshotPath = await findSnapshotPath(baseDir);
  if (snapshotPath) {
    console.log(chalk.gray(`auto-detected snapshot: ${snapshotPath}`));
    return loadSnapshot(snapshotPath);
  }

  const rawPath = await findRawDumpPath(baseDir);
  if (rawPath) {
    console.log(chalk.gray(`auto-detected raw dump: ${rawPath}`));
    const raw = await readJsonFile<Record<string, unknown>>(rawPath);
    return fromMemoryMcpDump(raw);
  }

  if (await hasDirectDbLayout(baseDir)) {
    console.log(chalk.gray(`auto-detected direct DB layout in: ${baseDir}`));
    console.log(chalk.gray("reading records directly from SurrealKV storage..."));
    const raw = await extractRawDumpFromDataDirDirect(baseDir, { forceSnapshot });
    return fromMemoryMcpDump(raw);
  }

  throw new Error(
    `No graph input found in ${baseDir}. Provide --input, or place one of ${SNAPSHOT_CANDIDATES.join(
      ", "
    )} / ${RAW_DUMP_CANDIDATES.join(", ")}, or point --data-dir to a memory-mcp data directory containing db/`
  );
}

async function loadRawDump(sourcePath?: string, dataDir?: string, forceSnapshot = false): Promise<Record<string, unknown>> {
  if (sourcePath) {
    return readJsonFile<Record<string, unknown>>(sourcePath);
  }

  const baseDir = dataDir ? path.resolve(dataDir) : process.cwd();
  const rawPath = await findRawDumpPath(baseDir);
  if (rawPath) {
    console.log(chalk.gray(`auto-detected raw dump: ${rawPath}`));
    return readJsonFile<Record<string, unknown>>(rawPath);
  }

  if (await hasDirectDbLayout(baseDir)) {
    console.log(chalk.gray(`auto-detected direct DB layout in: ${baseDir}`));
    console.log(chalk.gray("reading records directly from SurrealKV storage..."));
    return extractRawDumpFromDataDirDirect(baseDir, { forceSnapshot });
  }

  throw new Error(
    `No raw dump found in ${baseDir}. Provide --source, or place one of: ${RAW_DUMP_CANDIDATES.join(
      ", "
    )}, or point --data-dir to a memory-mcp data directory containing db/`
  );
}

async function findExistingPath(baseDir: string, candidates: string[]): Promise<string | undefined> {
  for (const candidate of candidates) {
    const fullPath = path.resolve(baseDir, candidate);
    if (await isRegularFile(fullPath)) {
      return fullPath;
    }
  }
  return undefined;
}

async function findSnapshotPath(baseDir: string): Promise<string | undefined> {
  const byName = await findExistingPath(baseDir, SNAPSHOT_CANDIDATES);
  if (byName) {
    return byName;
  }
  const byShape = await findJsonByPredicate(baseDir, isSnapshotJson);
  return byShape;
}

async function findRawDumpPath(baseDir: string): Promise<string | undefined> {
  const byName = await findExistingPath(baseDir, RAW_DUMP_CANDIDATES);
  if (byName) {
    return byName;
  }
  const byShape = await findJsonByPredicate(baseDir, isRawDumpJson);
  return byShape;
}

async function findJsonByPredicate(
  baseDir: string,
  predicate: (payload: unknown) => boolean
): Promise<string | undefined> {
  let entries: string[] = [];
  try {
    const dirEntries = await fs.readdir(baseDir, { withFileTypes: true });
    entries = dirEntries.filter((entry) => entry.isFile() && entry.name.endsWith(".json")).map((entry) => entry.name);
  } catch {
    return undefined;
  }

  for (const fileName of entries.sort()) {
    const fullPath = path.resolve(baseDir, fileName);
    try {
      const payload = await readJsonFile<unknown>(fullPath);
      if (predicate(payload)) {
        return fullPath;
      }
    } catch {
      continue;
    }
  }

  return undefined;
}

function isRawDumpJson(payload: unknown): boolean {
  if (!payload || typeof payload !== "object") {
    return false;
  }
  const record = payload as Record<string, unknown>;
  const rawKeys = ["memories", "entities", "relations", "code_symbols", "symbol_relation"];
  const presentKeys = rawKeys.filter((key) => Array.isArray(record[key]));
  return presentKeys.length >= 2;
}

function isSnapshotJson(payload: unknown): boolean {
  if (!payload || typeof payload !== "object") {
    return false;
  }
  const record = payload as Record<string, unknown>;
  return Array.isArray(record.nodes) && Array.isArray(record.edges);
}

async function isRegularFile(filePath: string): Promise<boolean> {
  try {
    const stat = await fs.stat(filePath);
    return stat.isFile();
  } catch {
    return false;
  }
}

async function resolveSyncOutputPath(explicitPath?: string): Promise<string> {
  if (explicitPath && explicitPath.trim()) {
    return explicitPath;
  }
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "mmgraph-sync-"));
  return path.join(tempDir, "snapshot.json");
}

async function runServe(
  inputPath: string | undefined,
  dataDir: string | undefined,
  forceSnapshot: boolean,
  portRaw: string,
  shouldOpen: boolean,
  live: boolean,
  refreshIntervalRaw: string
): Promise<void> {
  const snapshotRef: { current: GraphSnapshot | null; inFlight: boolean; lastError?: string } = {
    current: null,
    inFlight: false,
    lastError: undefined,
  };

  const initialLoad = refreshSnapshot(snapshotRef, inputPath, dataDir, forceSnapshot, true);

  const parsedPort = Number(portRaw);
  const port = Number.isFinite(parsedPort) && parsedPort > 0 ? parsedPort : 3939;
  await startServer({
    getSnapshot: () => snapshotRef.current ?? undefined,
    getSnapshotError: () => snapshotRef.lastError,
    port,
  });

  if (live) {
    const parsed = Number(refreshIntervalRaw);
    const requestedInterval = Number.isFinite(parsed) && parsed > 0 ? parsed : 10;
    const usesDirectDataDir = !inputPath && Boolean(dataDir);
    const minInterval = usesDirectDataDir ? 30 : 1;
    const intervalSec = Math.max(requestedInterval, minInterval);
    const intervalMs = Math.floor(intervalSec * 1000);
    setInterval(() => {
      void refreshSnapshot(snapshotRef, inputPath, dataDir, forceSnapshot, false);
    }, intervalMs);
    if (usesDirectDataDir && intervalSec !== requestedInterval) {
      console.log(
        chalk.gray(
          `live refresh interval bumped to ${intervalSec}s for direct data-dir mode (requested ${requestedInterval}s)`
        )
      );
    }
    console.log(chalk.gray(`live refresh enabled (interval=${intervalSec}s)`));
  }

  const url = `http://127.0.0.1:${port}`;
  console.log(chalk.green(`mmgraph webui running at ${url}`));
  if (shouldOpen) {
    await open(url);
  }

  if (!live) {
    const initialLoaded = await initialLoad;
    if (!initialLoaded) {
      throw new Error(snapshotRef.lastError ?? "Initial graph load failed");
    }
  }
}

async function refreshSnapshot(
  snapshotRef: { current: GraphSnapshot | null; inFlight: boolean; lastError?: string },
  inputPath: string | undefined,
  dataDir: string | undefined,
  forceSnapshot: boolean,
  isInitialLoad: boolean
): Promise<boolean> {
  if (snapshotRef.inFlight) {
    return false;
  }

  snapshotRef.inFlight = true;
  try {
    const next = await loadGraph(inputPath, dataDir, forceSnapshot);
    snapshotRef.current = next;
    snapshotRef.lastError = undefined;
    if (isInitialLoad) {
      console.log(chalk.gray(`initial graph load ok: nodes=${next.nodes.length}, edges=${next.edges.length}`));
      return true;
    }
    console.log(chalk.gray(`live refresh ok: nodes=${next.nodes.length}, edges=${next.edges.length}`));
    return true;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    snapshotRef.lastError = message;
    if (isInitialLoad) {
      console.error(chalk.yellow(`initial graph load failed: ${message}`));
      return false;
    }
    console.error(chalk.yellow(`live refresh failed: ${message}`));
    return false;
  } finally {
    snapshotRef.inFlight = false;
  }
}

const SNAPSHOT_CANDIDATES = [
  "snapshot.json",
  "graph-snapshot.json",
  "mmgraph.snapshot.json",
  "out/snapshot.json",
];

const RAW_DUMP_CANDIDATES = [
  "raw-dump.json",
  "memory-mcp-dump.json",
  "memory_dump.json",
  "dump.json",
  "data.json",
  "out/raw-dump.json",
];

const BunLikeWrite = {
  async writeText(filePath: string, content: string): Promise<void> {
    const { promises: fs } = await import("node:fs");
    const { dirname } = await import("node:path");
    await fs.mkdir(dirname(filePath), { recursive: true });
    await fs.writeFile(filePath, content, "utf8");
  },
};

program.parseAsync().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(chalk.red(message));
  process.exit(1);
});
