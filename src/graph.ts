import type { GraphEdge, GraphNode, GraphSnapshot, GraphStats } from "./types.js";

type Adjacency = {
  byNode: Map<string, GraphEdge[]>;
};

function buildAdjacency(edges: GraphEdge[]): Adjacency {
  const byNode = new Map<string, GraphEdge[]>();
  for (const edge of edges) {
    const sourceEdges = byNode.get(edge.source) ?? [];
    sourceEdges.push(edge);
    byNode.set(edge.source, sourceEdges);

    const targetEdges = byNode.get(edge.target) ?? [];
    targetEdges.push(edge);
    byNode.set(edge.target, targetEdges);
  }
  return { byNode };
}

export function computeStats(snapshot: GraphSnapshot): GraphStats {
  const nodeTypeCounts: Record<string, number> = {};
  const relationCounts: Record<string, number> = {};

  for (const node of snapshot.nodes) {
    nodeTypeCounts[node.type] = (nodeTypeCounts[node.type] ?? 0) + 1;
  }

  for (const edge of snapshot.edges) {
    relationCounts[edge.relation] = (relationCounts[edge.relation] ?? 0) + 1;
  }

  const connectedIds = new Set<string>();
  for (const edge of snapshot.edges) {
    connectedIds.add(edge.source);
    connectedIds.add(edge.target);
  }

  const isolatedNodeCount = snapshot.nodes.filter((n) => !connectedIds.has(n.id)).length;

  return {
    nodeCount: snapshot.nodes.length,
    edgeCount: snapshot.edges.length,
    nodeTypeCounts,
    relationCounts,
    isolatedNodeCount,
  };
}

export function searchNodes(snapshot: GraphSnapshot, query: string, type?: string): GraphNode[] {
  const q = query.trim().toLowerCase();
  if (!q) {
    return [];
  }
  return snapshot.nodes.filter((node) => {
    if (type && node.type !== type) {
      return false;
    }
    const haystack = `${node.label} ${node.summary ?? ""} ${JSON.stringify(node.metadata ?? {})}`.toLowerCase();
    return haystack.includes(q);
  });
}

export function buildSubgraph(snapshot: GraphSnapshot, seedId: string, depth: number, limit: number): GraphSnapshot {
  const nodeById = new Map(snapshot.nodes.map((n) => [n.id, n]));
  if (!nodeById.has(seedId)) {
    return {
      version: snapshot.version,
      generatedAt: new Date().toISOString(),
      nodes: [],
      edges: [],
    };
  }

  const adjacency = buildAdjacency(snapshot.edges);
  const visited = new Set<string>([seedId]);
  const queue: Array<{ id: string; depth: number }> = [{ id: seedId, depth: 0 }];
  const subEdges = new Map<string, GraphEdge>();

  while (queue.length > 0 && visited.size < limit) {
    const current = queue.shift();
    if (!current) {
      continue;
    }
    if (current.depth >= depth) {
      continue;
    }

    const edges = adjacency.byNode.get(current.id) ?? [];
    for (const edge of edges) {
      subEdges.set(edge.id, edge);
      const neighbor = edge.source === current.id ? edge.target : edge.source;
      if (!visited.has(neighbor) && visited.size < limit) {
        visited.add(neighbor);
        queue.push({ id: neighbor, depth: current.depth + 1 });
      }
    }
  }

  const subNodes: GraphNode[] = [];
  for (const id of visited) {
    const node = nodeById.get(id);
    if (node) {
      subNodes.push(node);
    }
  }

  const allowed = new Set(subNodes.map((n) => n.id));
  const filteredEdges = Array.from(subEdges.values()).filter(
    (edge) => allowed.has(edge.source) && allowed.has(edge.target)
  );

  return {
    version: snapshot.version,
    generatedAt: new Date().toISOString(),
    nodes: subNodes,
    edges: filteredEdges,
  };
}
