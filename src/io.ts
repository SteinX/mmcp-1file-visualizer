import { promises as fs } from "node:fs";
import path from "node:path";
import type { GraphSnapshot } from "./types.js";

export async function readJsonFile<T>(filePath: string): Promise<T> {
  const raw = await fs.readFile(filePath, "utf8");
  return JSON.parse(raw) as T;
}

export async function writeJsonFile(filePath: string, value: unknown): Promise<void> {
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  await fs.writeFile(filePath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

export function ensureSnapshot(value: unknown): GraphSnapshot {
  if (!value || typeof value !== "object") {
    throw new Error("Snapshot must be an object");
  }
  const s = value as Partial<GraphSnapshot>;
  if (!Array.isArray(s.nodes) || !Array.isArray(s.edges)) {
    throw new Error("Snapshot must contain nodes and edges arrays");
  }
  return {
    version: s.version ?? "1.0.0",
    generatedAt: s.generatedAt ?? new Date().toISOString(),
    nodes: s.nodes,
    edges: s.edges,
  };
}
