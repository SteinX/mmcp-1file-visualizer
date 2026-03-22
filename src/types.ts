export type GraphNode = {
  id: string;
  type: string;
  label: string;
  summary?: string;
  createdAt?: string;
  updatedAt?: string;
  metadata?: Record<string, unknown>;
};

export type GraphEdge = {
  id: string;
  source: string;
  target: string;
  relation: string;
  weight?: number;
  createdAt?: string;
  metadata?: Record<string, unknown>;
};

export type GraphSnapshot = {
  version: string;
  generatedAt: string;
  nodes: GraphNode[];
  edges: GraphEdge[];
};

export type GraphStats = {
  nodeCount: number;
  edgeCount: number;
  nodeTypeCounts: Record<string, number>;
  relationCounts: Record<string, number>;
  isolatedNodeCount: number;
};
