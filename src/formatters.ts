import type { GraphSnapshot, GraphStats } from "./types.js";

export function toDot(snapshot: GraphSnapshot): string {
  const lines = ["digraph MemoryGraph {"];
  lines.push("  rankdir=LR;");

  for (const node of snapshot.nodes) {
    const label = escapeString(node.label);
    lines.push(`  \"${escapeString(node.id)}\" [label=\"${label}\"];`);
  }

  for (const edge of snapshot.edges) {
    lines.push(
      `  \"${escapeString(edge.source)}\" -> \"${escapeString(edge.target)}\" [label=\"${escapeString(
        edge.relation
      )}\"];`
    );
  }

  lines.push("}");
  return `${lines.join("\n")}\n`;
}

export function toMermaid(snapshot: GraphSnapshot): string {
  const lines = ["graph LR"];
  for (const node of snapshot.nodes) {
    lines.push(`  ${safeId(node.id)}[\"${escapeString(node.label)}\"]`);
  }
  for (const edge of snapshot.edges) {
    lines.push(`  ${safeId(edge.source)} -- \"${escapeString(edge.relation)}\" --> ${safeId(edge.target)}`);
  }
  return `${lines.join("\n")}\n`;
}

export function printStats(stats: GraphStats): string {
  const lines: string[] = [];
  lines.push(`Nodes: ${stats.nodeCount}`);
  lines.push(`Edges: ${stats.edgeCount}`);
  lines.push(`Isolated nodes: ${stats.isolatedNodeCount}`);
  lines.push("Node types:");
  for (const [k, v] of Object.entries(stats.nodeTypeCounts).sort((a, b) => b[1] - a[1])) {
    lines.push(`  - ${k}: ${v}`);
  }
  lines.push("Relations:");
  for (const [k, v] of Object.entries(stats.relationCounts).sort((a, b) => b[1] - a[1])) {
    lines.push(`  - ${k}: ${v}`);
  }
  return lines.join("\n");
}

function safeId(value: string): string {
  return value.replace(/[^a-zA-Z0-9_]/g, "_");
}

function escapeString(value: string): string {
  return value.replace(/\\/g, "\\\\").replace(/\"/g, '\\\"');
}
