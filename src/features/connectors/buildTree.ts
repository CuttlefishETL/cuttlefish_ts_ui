import type {
  ConnectorInstance,
  ConnectorTemplate,
  ConnectorTreeNode,
} from "./types";

/**
 * Группирует коннекторы по label шаблона.
 * Показываются только непустые группы — если коннекторов нет,
 * дерево будет пустым, а виджет покажет подсказку.
 */
export function buildConnectorTree(
  items: ConnectorInstance[],
  templates: ConnectorTemplate[],
): ConnectorTreeNode[] {
  const templateByType = Object.fromEntries(templates.map((t) => [t.type, t]));
  const groups = new Map<string, ConnectorTreeNode>();

  for (const item of items) {
    const tpl = templateByType[item.type];
    const groupLabel = tpl?.label ?? `Тип: ${item.type}`;

    let group = groups.get(item.type);
    if (!group) {
      group = {
        key: `group:${item.type}`,
        label: groupLabel,
        type: "group",
        children: [],
        templateType: item.type,
      };
      groups.set(item.type, group);
    }

    group.children.push({
      key: `conn:${item.name}`,
      label: item.name,
      type: "connector",
      children: [],
      connector: item,
    });
  }

  const result = Array.from(groups.values());
  result.sort((a, b) => a.label.localeCompare(b.label));
  for (const g of result) {
    g.children.sort((a, b) => a.label.localeCompare(b.label));
  }
  return result;
}

export interface FlatRow {
  node: ConnectorTreeNode;
  depth: number;
}

export function flattenTree(
  nodes: ConnectorTreeNode[],
  expanded: Set<string>,
  depth = 0,
): FlatRow[] {
  const out: FlatRow[] = [];
  for (const n of nodes) {
    out.push({ node: n, depth });
    if (n.type === "group" && expanded.has(n.key)) {
      out.push(...flattenTree(n.children, expanded, depth + 1));
    }
  }
  return out;
}

export function allGroupKeys(nodes: ConnectorTreeNode[]): Set<string> {
  const set = new Set<string>();
  for (const n of nodes) {
    if (n.type === "group") set.add(n.key);
  }
  return set;
}
