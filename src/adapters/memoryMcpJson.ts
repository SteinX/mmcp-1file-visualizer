import type { GraphEdge, GraphNode, GraphSnapshot } from "../types.js";

type RawRecord = Record<string, unknown>;

export type MemoryMcpRawDump = {
  memories?: RawRecord[];
  entities?: RawRecord[];
  relations?: RawRecord[];
  code_symbols?: RawRecord[];
  symbol_relation?: RawRecord[];
};

function normalizeRecordId(value: unknown, fallback: string): string {
  if (!value) {
    return fallback;
  }
  if (typeof value === "string") {
    return value;
  }
  if (typeof value === "object") {
    const record = value as { tb?: string; id?: string };
    if (record.tb && record.id) {
      return `${record.tb}:${record.id}`;
    }
  }
  return fallback;
}

function toNodeLabel(primary: unknown, fallback: string): string {
  if (typeof primary === "string" && primary.trim()) {
    return primary.trim();
  }
  return fallback;
}

function pushUniqueNode(bucket: Map<string, GraphNode>, node: GraphNode): void {
  if (!bucket.has(node.id)) {
    bucket.set(node.id, node);
  }
}

function pushUniqueEdge(bucket: Map<string, GraphEdge>, edge: GraphEdge): void {
  if (!bucket.has(edge.id)) {
    bucket.set(edge.id, edge);
  }
}

export function fromMemoryMcpDump(raw: MemoryMcpRawDump): GraphSnapshot {
  const nodes = new Map<string, GraphNode>();
  const edges = new Map<string, GraphEdge>();

  for (const memory of raw.memories ?? []) {
    const id = normalizeRecordId(memory.id, `memories:unknown_${nodes.size}`);
    const content = typeof memory.content === "string" ? memory.content : "";
    pushUniqueNode(nodes, {
      id,
      type: "memory",
      label: toNodeLabel(content.slice(0, 80), id),
      summary: content,
      createdAt: typeof memory.event_time === "string" ? memory.event_time : undefined,
      updatedAt: typeof memory.ingestion_time === "string" ? memory.ingestion_time : undefined,
      metadata: {
        memoryType: memory.memory_type,
        userId: memory.user_id,
        importanceScore: memory.importance_score,
      },
    });
  }

  for (const entity of raw.entities ?? []) {
    const id = normalizeRecordId(entity.id, `entities:unknown_${nodes.size}`);
    pushUniqueNode(nodes, {
      id,
      type: "entity",
      label: toNodeLabel(entity.name, id),
      summary: typeof entity.description === "string" ? entity.description : undefined,
      createdAt: typeof entity.created_at === "string" ? entity.created_at : undefined,
      metadata: {
        entityType: entity.entity_type,
        userId: entity.user_id,
      },
    });
  }

  for (const symbol of raw.code_symbols ?? []) {
    const id = normalizeRecordId(symbol.id, `code_symbols:unknown_${nodes.size}`);
    const symbolType = typeof symbol.symbol_type === "string" ? symbol.symbol_type : "symbol";
    const symbolName = typeof symbol.name === "string" ? symbol.name : id;
    pushUniqueNode(nodes, {
      id,
      type: "code_symbol",
      label: `${symbolType}: ${symbolName}`,
      summary: typeof symbol.signature === "string" ? symbol.signature : undefined,
      metadata: {
        filePath: symbol.file_path,
        projectId: symbol.project_id,
        symbolType,
      },
    });
  }

  for (const relation of raw.relations ?? []) {
    const source = normalizeRecordId(relation.in, `unknown:source_${edges.size}`);
    const target = normalizeRecordId(relation.out, `unknown:target_${edges.size}`);
    const relationType = typeof relation.relation_type === "string" ? relation.relation_type : "related_to";
    const id = normalizeRecordId(relation.id, `relations:${source}->${relationType}->${target}`);
    pushUniqueEdge(edges, {
      id,
      source,
      target,
      relation: relationType,
      createdAt: typeof relation.created_at === "string" ? relation.created_at : undefined,
      metadata: {
        rawType: "relations",
      },
    });
  }

  for (const relation of raw.symbol_relation ?? []) {
    const source = normalizeRecordId(relation.in, `unknown:source_${edges.size}`);
    const target = normalizeRecordId(relation.out, `unknown:target_${edges.size}`);
    const relationType = typeof relation.relation_type === "string" ? relation.relation_type : "related";
    const id = normalizeRecordId(relation.id, `symbol_relation:${source}->${relationType}->${target}`);
    pushUniqueEdge(edges, {
      id,
      source,
      target,
      relation: relationType,
      createdAt: typeof relation.created_at === "string" ? relation.created_at : undefined,
      metadata: {
        rawType: "symbol_relation",
        filePath: relation.file_path,
        projectId: relation.project_id,
      },
    });
  }

  return {
    version: "1.0.0",
    generatedAt: new Date().toISOString(),
    nodes: Array.from(nodes.values()),
    edges: Array.from(edges.values()),
  };
}
