import { useState } from "react";
import type { ServerNode } from "../types";
import type { CheckStatus } from "../checkConnection";
import {
  ContextMenu,
  type AnchorRect,
  type ContextMenuItem,
} from "./ContextMenu";
import { isFolder, findNodeById, collectFolderIds } from "../treeUtils";
import { ServerTree } from "./ServerTree";

interface SidebarProps {
  servers: ServerNode[];
  selectedId: string | null;
  connectedIds: Set<string>;
  checkStatuses: Record<string, CheckStatus>;
  refreshing: boolean;
  onSelect: (id: string) => void;
  onDoubleClick: (id: string) => void;
  onConnect: (id: string) => void;
  onDisconnect: (id: string) => void;
  onReconnect: (id: string) => void;
  onAddServer: (parentId: string | null) => void;
  onAddFolder: (parentId: string | null) => void;
  onRename: (id: string, currentName: string) => void;
  onDeleteNode: (id: string) => void;
  onRefresh: () => void;
  onMoveNode: (nodeId: string, newParentId: string | null) => void;
}

interface ContextState {
  anchor: AnchorRect;
  nodeId: string;
}

export function Sidebar({
  servers,
  selectedId,
  connectedIds,
  checkStatuses,
  refreshing,
  onSelect,
  onDoubleClick,
  onConnect,
  onDisconnect,
  onReconnect,
  onAddServer,
  onAddFolder,
  onRename,
  onDeleteNode,
  onRefresh,
  onMoveNode,
}: SidebarProps) {
  const [context, setContext] = useState<ContextState | null>(null);
  const [expanded, setExpanded] = useState<Set<string>>(
    () => new Set(collectFolderIds(servers)),
  );

  const selectedNode = selectedId ? findNodeById(servers, selectedId) : null;
  const selectedFolderId =
    selectedNode && isFolder(selectedNode) ? selectedNode.id : null;

  const toggle = (id: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const openContextMenu = (e: React.MouseEvent, nodeId: string) => {
    e.preventDefault();
    const r = (e.currentTarget as HTMLElement).getBoundingClientRect();
    setContext({
      anchor: { left: r.left, top: r.top, bottom: r.bottom, right: r.right },
      nodeId,
    });
  };

  const buildContextItems = (nodeId: string): ContextMenuItem[] => {
    const node = findNodeById(servers, nodeId);
    if (!node) return [];
    if (isFolder(node)) {
      return [
        { label: "Добавить сервер", action: () => onAddServer(node.id) },
        { label: "Добавить папку", action: () => onAddFolder(node.id) },
        { label: "Переименовать", action: () => onRename(node.id, node.name) },
        { label: "Удалить", action: () => onDeleteNode(node.id) },
      ];
    }
    const status = checkStatuses[node.id] ?? "unknown";
    const isConnected = connectedIds.has(node.id);
    const available = status === "ok";
    return [
      {
        label: "Подключиться",
        action: () => onConnect(node.id),
        disabled: !available || isConnected,
      },
      {
        label: "Отключиться",
        action: () => onDisconnect(node.id),
        disabled: !available || !isConnected,
      },
      {
        label: "Переподключиться",
        action: () => onReconnect(node.id),
        disabled: !available || !isConnected,
      },
      { label: "Переименовать", action: () => onRename(node.id, node.name) },
      { label: "Удалить", action: () => onDeleteNode(node.id) },
    ];
  };

  return (
    <aside className="sidebar">
      <div className="sidebar-toolbar">
        <button
          className="toolbar-btn"
          onClick={() => onAddServer(selectedFolderId)}
        >
          + Сервер
        </button>
        <button
          className="toolbar-btn"
          onClick={() => onAddFolder(selectedFolderId)}
        >
          + Папка
        </button>
        <button
          className="toolbar-btn danger"
          onClick={() => selectedId && onDeleteNode(selectedId)}
          disabled={!selectedId}
        >
          Удалить
        </button>
        <button
          className="toolbar-btn"
          onClick={onRefresh}
          disabled={refreshing || servers.length === 0}
          title="Перепроверить все серверы"
        >
          {refreshing ? "⟳" : "Обновить"}
        </button>
      </div>

      <ServerTree
        nodes={servers}
        expanded={expanded}
        selectedId={selectedId}
        connectedIds={connectedIds}
        checkStatuses={checkStatuses}
        onToggle={toggle}
        onSelect={onSelect}
        onDoubleClick={onDoubleClick}
        onContextMenu={openContextMenu}
        onMoveNode={onMoveNode}
      />

      {servers.length === 0 && (
        <div className="server-list-empty" style={{ padding: "8px 12px" }}>
          Нет серверов
        </div>
      )}

      {context && (
        <ContextMenu
          anchor={context.anchor}
          items={buildContextItems(context.nodeId)}
          onClose={() => setContext(null)}
        />
      )}
    </aside>
  );
}