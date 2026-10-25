import { useRef, useState } from "react";
import type { ServerNode } from "../types";
import type { CheckStatus } from "../checkConnection";
import { isFolder } from "../treeUtils";

interface ServerTreeProps {
  nodes: ServerNode[];
  expanded: Set<string>;
  selectedId: string | null;
  connectedIds: Set<string>;
  checkStatuses: Record<string, CheckStatus>;
  onToggle: (id: string) => void;
  onSelect: (id: string) => void;
  onDoubleClick: (id: string) => void;
  onContextMenu: (e: React.MouseEvent, nodeId: string) => void;
  onMoveNode: (nodeId: string, newParentId: string | null) => void;
}

const STATUS_TITLE: Record<CheckStatus, string> = {
  unknown: "Не проверен",
  checking: "Проверка...",
  ok: "Работает",
  error: "Недоступен",
};

export function ServerTree({
  nodes,
  expanded,
  selectedId,
  connectedIds,
  checkStatuses,
  onToggle,
  onSelect,
  onDoubleClick,
  onContextMenu,
  onMoveNode,
}: ServerTreeProps) {
  const [dragNodeId, setDragNodeId] = useState<string | null>(null);
  const [dragOverId, setDragOverId] = useState<string | null | "root">(null);
  const dragNodeIdRef = useRef<string | null>(null);

  const clearDrag = () => {
    dragNodeIdRef.current = null;
    setDragNodeId(null);
    setDragOverId(null);
  };

  const handleDragStart = (e: React.DragEvent, nodeId: string) => {
    dragNodeIdRef.current = nodeId;
    setDragNodeId(nodeId);
    e.dataTransfer.effectAllowed = "all";
    e.dataTransfer.setData("text/plain", nodeId);
  };

  const handleDragOverFolder = (e: React.DragEvent, folderId: string) => {
    if (!dragNodeIdRef.current) return;
    if (folderId === dragNodeIdRef.current) return;
    e.preventDefault();
    e.stopPropagation();
    e.dataTransfer.dropEffect = "move";
    if (dragOverId !== folderId) setDragOverId(folderId);
  };

  const handleDragLeaveFolder = (e: React.DragEvent, folderId: string) => {
    if (e.currentTarget.contains(e.relatedTarget as Node)) return;
    setDragOverId((cur) => (cur === folderId ? null : cur));
  };

  const handleDropOnFolder = (e: React.DragEvent, folderId: string) => {
    e.preventDefault();
    e.stopPropagation();
    const sourceId =
      e.dataTransfer.getData("text/plain") || dragNodeIdRef.current;
    clearDrag();
    if (!sourceId || sourceId === folderId) return;
    onMoveNode(sourceId, folderId);
  };

  const handleDragOverRoot = (e: React.DragEvent) => {
    if (!dragNodeIdRef.current) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    if (dragOverId !== "root") setDragOverId("root");
  };

  const handleDropOnRoot = (e: React.DragEvent) => {
    e.preventDefault();
    const sourceId =
      e.dataTransfer.getData("text/plain") || dragNodeIdRef.current;
    clearDrag();
    if (!sourceId) return;
    onMoveNode(sourceId, null);
  };

  const renderNodes = (
    list: ServerNode[],
    depth: number,
  ): React.ReactNode =>
    list.map((node) => {
      const isSelected = selectedId === node.id;

      if (isFolder(node)) {
        const isOpen = expanded.has(node.id);
        const isDragOver = dragOverId === node.id;
        return (
          <li key={node.id} style={{ listStyle: "none" }}>
            <div
              className={`server-item${isSelected ? " active" : ""}${
                isDragOver ? " drag-over" : ""
              }`}
              style={{ paddingLeft: 8 + depth * 16 }}
              onClick={() => {
                onToggle(node.id);
                onSelect(node.id);
              }}
              onContextMenu={(e) => onContextMenu(e, node.id)}
              onDragOver={(e) => handleDragOverFolder(e, node.id)}
              onDragLeave={(e) => handleDragLeaveFolder(e, node.id)}
              onDrop={(e) => handleDropOnFolder(e, node.id)}
            >
              <span className="server-chevron">
                {isOpen ? "▾" : "▸"}
              </span>
              <span className="server-name">{node.name || "(без имени)"}</span>
            </div>
            {isOpen && node.children.length > 0 && (
              <ul style={{ margin: 0, padding: 0 }}>
                {renderNodes(node.children, depth + 1)}
              </ul>
            )}
          </li>
        );
      }

      const status = checkStatuses[node.id] ?? "unknown";
      const isConnected = connectedIds.has(node.id);
      return (
        <li
          key={node.id}
          className={`server-item${isSelected ? " active" : ""}${
            dragNodeId === node.id ? " dragging" : ""
          }`}
          style={{ paddingLeft: 8 + depth * 16 }}
          onClick={() => onSelect(node.id)}
          onDoubleClick={() => onDoubleClick(node.id)}
          onContextMenu={(e) => onContextMenu(e, node.id)}
          draggable
          onDragStart={(e) => handleDragStart(e, node.id)}
          onDragEnd={clearDrag}
          title="Перетащите в папку; двойной щелчок — подключиться/отключиться; правый клик — меню"
        >
          <span className="server-chevron" style={{ visibility: "hidden" }}>
            •
          </span>
          <span className="server-name">{node.name || "(без имени)"}</span>
          <span
            className={`server-status ${status}`}
            title={STATUS_TITLE[status]}
          />
          {isConnected && (
            <span className="server-connected" title="Подключено">
              🔒
            </span>
          )}
        </li>
      );
    });

  return (
    <ul
      className={`server-list${dragOverId === "root" ? " drag-over" : ""}`}
      onDragOver={handleDragOverRoot}
      onDrop={handleDropOnRoot}
    >
      {renderNodes(nodes, 0)}
    </ul>
  );
}