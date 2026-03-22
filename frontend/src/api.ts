import type { GraphSnapshot, GraphStats, GraphNode } from "./types";

type SeedItem = { id: string; label: string; degree: number };

export class HttpError extends Error {
  status: number;

  constructor(status: number, message: string) {
    super(message);
    this.name = "HttpError";
    this.status = status;
  }
}

async function fetchJson<T>(url: string): Promise<T> {
  const response = await fetch(url);
  if (!response.ok) {
    let message = `Request failed: ${response.status}`;
    try {
      const payload = (await response.json()) as { message?: string; error?: string };
      if (payload.message) {
        message = payload.message;
      } else if (payload.error) {
        message = payload.error;
      }
    } catch {}
    throw new HttpError(response.status, message);
  }
  return (await response.json()) as T;
}

export function fetchStats(): Promise<GraphStats> {
  return fetchJson<GraphStats>("/api/stats");
}

export function fetchSeeds(): Promise<{ seeds: SeedItem[] }> {
  return fetchJson<{ seeds: SeedItem[] }>("/api/seeds");
}

export function fetchFullGraph(): Promise<GraphSnapshot> {
  return fetchJson<GraphSnapshot>("/api/graph");
}

export function fetchSubgraph(seed: string, depth: number): Promise<GraphSnapshot> {
  const q = new URLSearchParams({ seed, depth: String(depth), limit: "1500" });
  return fetchJson<GraphSnapshot>(`/api/subgraph?${q.toString()}`);
}

export function searchNodes(query: string, type?: string): Promise<{ nodes: GraphNode[] }> {
  const q = new URLSearchParams({ q: query });
  if (type) {
    q.set("type", type);
  }
  return fetchJson<{ nodes: GraphNode[] }>(`/api/search?${q.toString()}`);
}
