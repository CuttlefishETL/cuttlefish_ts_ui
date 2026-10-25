import { NodeId, ServerLeaf, ServerNode } from "../types";
import { CheckStatus } from "../checkConnection";
import { ServerTree } from "./ServerTree";

interface Props {
  width: number;
  nodes: ServerNode[];
  expanded: Set<NodeId>;
  selectedId: NodeId | null;
  statusById: Record<NodeId, CheckStatus>;
  onToggle: (id: NodeId) => void;
  onSelect: (leaf: ServerLeaf) => void;
  onContext: (id: NodeId, x: number, y: number) => void;
  onRootContext: (x: number, y: number) => void;
  onAdd: () => void;
}

export function Sidebar({
  width,
  nodes,
  expanded,
  selectedId,
  statusById,
  onToggle,
  onSelect,
  onContext,
  onRootContext,
  onAdd,
}: Props) {
  return (
    <aside
      className="sidebar"
      style={{ width }}
      onContextMenu={(e) => {
        e.preventDefault();
        onRootContext(e.clientX, e.clientY);
      }}
    >
      <div className="sidebar-header">
        <span>Серверы</span>
        <button className="icon-button" onClick={onAdd} title="Добавить">
          +
        </button>
      </div>
      {nodes.length === 0 ? (
        <div className="sidebar-empty">Нет серверов</div>
      ) : (
        <ServerTree
          nodes={nodes}
          expanded={expanded}
          selectedId={selectedId}
          statusById={statusById}
          onToggle={onToggle}
          onSelect={onSelect}
          onContext={onContext}
        />
      )}
    </aside>
  );
}