import { NodeId, ServerLeaf, ServerNode } from "../types";
import { isFolder } from "../treeUtils";
import { CheckStatus } from "../checkConnection";

interface Props {
  nodes: ServerNode[];
  depth?: number;
  expanded: Set<NodeId>;
  selectedId: NodeId | null;
  statusById: Record<NodeId, CheckStatus>;
  onToggle: (id: NodeId) => void;
  onSelect: (leaf: ServerLeaf) => void;
  onContext: (id: NodeId, x: number, y: number) => void;
}

export function ServerTree(props: Props) {
  const {
    nodes,
    depth = 0,
    expanded,
    selectedId,
    statusById,
    onToggle,
    onSelect,
    onContext,
  } = props;

  return (
    <ul className="tree" role="tree">
      {nodes.map((n) => {
        const isOpen = isFolder(n) && expanded.has(n.id);
        return (
          <li key={n.id} role="treeitem" aria-expanded={isFolder(n) ? isOpen : undefined}>
            <div
              className={`tree-row${selectedId === n.id ? " is-selected" : ""}`}
              style={{ paddingLeft: 8 + depth * 14 }}
              onClick={() => (isFolder(n) ? onToggle(n.id) : onSelect(n))}
              onContextMenu={(e) => {
                e.preventDefault();
                onContext(n.id, e.clientX, e.clientY);
              }}
            >
              <span className="tree-chevron">
                {isFolder(n) ? (isOpen ? "▾" : "▸") : "•"}
              </span>
              <span className="tree-name">{n.name}</span>
              {!isFolder(n) && (
                <span className={`tree-status status-${statusById[n.id] ?? "idle"}`} />
              )}
            </div>
            {isOpen && n.children.length > 0 && (
              <ServerTree {...props} nodes={n.children} depth={depth + 1} />
            )}
          </li>
        );
      })}
    </ul>
  );
}
