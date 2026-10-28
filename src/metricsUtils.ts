import type {
  MetricCheckState,
  MetricGroup,
  MetricNode,
} from "./types";

export function isMetricGroup(n: MetricNode): n is MetricGroup {
  return n.kind === "group";
}

export function collectLeafIds(node: MetricNode): string[] {
  if (isMetricGroup(node)) {
    return node.children.flatMap(collectLeafIds);
  }
  return [node.id];
}

export function collectGroupIds(nodes: MetricNode[]): string[] {
  const out: string[] = [];
  for (const n of nodes) {
    if (isMetricGroup(n)) {
      out.push(n.id);
      out.push(...collectGroupIds(n.children));
    }
  }
  return out;
}

export function computeGroupState(
  group: MetricGroup,
  enabled: Set<string>,
): MetricCheckState {
  const leaves = collectLeafIds(group);
  if (leaves.length === 0) return "unchecked";
  let on = 0;
  for (const id of leaves) if (enabled.has(id)) on++;
  if (on === 0) return "unchecked";
  if (on === leaves.length) return "checked";
  return "indeterminate";
}

export function toggleGroupLeaves(
  group: MetricGroup,
  enabled: Set<string>,
): { ids: string[]; turnOn: boolean } {
  const state = computeGroupState(group, enabled);
  const turnOn = state !== "checked";
  return { ids: collectLeafIds(group), turnOn };
}

function sortNodes(nodes: MetricNode[]): MetricNode[] {
  return [...nodes]
    .sort((a, b) => {
      if (a.kind !== b.kind) return a.kind === "group" ? -1 : 1;
      return a.name.localeCompare(b.name);
    })
    .map((n) =>
      isMetricGroup(n) ? { ...n, children: sortNodes(n.children) } : n,
    );
}

function insertPath(
  nodes: MetricNode[],
  segments: string[],
  index: number,
  fullPath: string,
): void {
  const isLeaf = index === segments.length - 1;
  const name = segments[index];

  if (isLeaf) {
    if (nodes.some((n) => n.id === fullPath)) return;
    nodes.push({ kind: "metric", id: fullPath, name });
    return;
  }

  const groupId = segments.slice(0, index + 1).join(".");
  let group = nodes.find(
    (n): n is MetricGroup => n.kind === "group" && n.id === groupId,
  );

  if (!group) {
    const leafConflict = nodes.find(
      (n) => n.kind === "metric" && n.id === groupId,
    );
    if (leafConflict) {
      // Метрика `a.b` уже есть как лист, а `a.b.c` требует группу `a.b`.
      // В Prometheus такого не бывает (имя метрики не может быть префиксом
      // другой метрики), но защищаемся от падения и предупреждаем.
      console.warn(
        `[metrics] conflict: "${groupId}" is both leaf and group; skipping "${fullPath}"`,
      );
      return;
    }
    group = { kind: "group", id: groupId, name, children: [] };
    nodes.push(group);
  }

  insertPath(group.children, segments, index + 1, fullPath);
}

/**
 * Разбирает плоский список имён метрик Prometheus (`Group.Group.Name`)
 * в иерархическое дерево. Группы сортируются по имени, листья — по имени
 * внутри группы; группы всегда идут до листьев.
 */
export function parseMetrics(names: string[]): MetricNode[] {
  const roots: MetricNode[] = [];
  const seen = new Set<string>();

  for (const raw of names) {
    const full = raw.trim();
    if (!full) continue;
    if (seen.has(full)) continue;
    seen.add(full);

    const segments = full.split(".").filter(Boolean);
    if (segments.length === 0) continue;

    insertPath(roots, segments, 0, full);
  }

  return sortNodes(roots);
}