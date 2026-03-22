export type GraphNode = {
  id: string;
  type: string;
  label: string;
  summary?: string;
  metadata?: Record<string, string>;
};

export type GraphEdge = {
  id: string;
  source: string;
  target: string;
  relation: string;
};

export type GraphSnapshot = {
  nodes: GraphNode[];
  edges: GraphEdge[];
};

export type GraphStats = {
  nodeCount: number;
  edgeCount: number;
  isolatedNodeCount: number;
  byNodeType: Record<string, number>;
  byRelation: Record<string, number>;
};
