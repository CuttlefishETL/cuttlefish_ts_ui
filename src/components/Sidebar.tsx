import { useState } from "react";
import type { Server } from "../types";
import type { CheckStatus } from "../checkConnection";
import { ContextMenu, type AnchorRect } from "./ContextMenu";

interface SidebarProps {
  servers: Server[];
  selectedId: string | null;
  connectedIds: Set<string>;
  checkStatuses: Record<string, CheckStatus>;
  refreshing: boolean;
  onSelect: (id: string) => void;
  onDoubleClick: (id: string) => void;
  onConnect: (id: string) => void;
  onDisconnect: (id: string) => void;
  onReconnect: (id: string) => void;
  onAdd: () => void;
  onDelete: () => void;
  onRefresh: () => void;
}

const STATUS_TITLE: Record<CheckStatus, string> = {
  unknown: "Не проверен",
  checking: "Проверка...",
  ok: "Работает",
  error: "Недоступен",
};

interface ContextState {
  anchor: AnchorRect;
  serverId: string;
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
  onAdd,
  onDelete,
  onRefresh,
}: SidebarProps) {
  const [context, setContext] = useState<ContextState | null>(null);

  const contextServer = context
    ? servers.find((s) => s.id === context.serverId)
    : undefined;
  const contextStatus: CheckStatus = contextServer
    ? checkStatuses[contextServer.id] ?? "unknown"
    : "unknown";
  const contextIsConnected = contextServer
    ? connectedIds.has(contextServer.id)
    : false;
  const menuAvailable = contextStatus === "ok";

  return (
    <aside className="sidebar">
      <div className="sidebar-toolbar">
        <button className="toolbar-btn" onClick={onAdd}>
          + Добавить
        </button>
        <button
          className="toolbar-btn danger"
          onClick={onDelete}
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

      <ul className="server-list">
        {servers.map((server) => {
          const status = checkStatuses[server.id] ?? "unknown";
          const isConnected = connectedIds.has(server.id);
          return (
            <li
              key={server.id}
              className={`server-item ${
                selectedId === server.id ? "active" : ""
              }`}
              onClick={() => onSelect(server.id)}
              onDoubleClick={() => onDoubleClick(server.id)}
              onContextMenu={(e) => {
                e.preventDefault();
                const r = (e.currentTarget as HTMLElement).getBoundingClientRect();
                setContext({
                  anchor: {
                    left: r.left,
                    top: r.top,
                    bottom: r.bottom,
                    right: r.right,
                  },
                  serverId: server.id,
                });
              }}
              title="Двойной щелчок — подключиться / отключиться; правый клик — меню"
            >
              <span className="server-name">
                {server.name || "(без имени)"}
              </span>
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
        })}
        {servers.length === 0 && (
          <li className="server-list-empty">Нет серверов</li>
        )}
      </ul>

      {context && (
        <ContextMenu
          anchor={context.anchor}
          items={[
            {
              label: "Подключиться",
              action: () => onConnect(context.serverId),
              disabled: !menuAvailable || contextIsConnected,
            },
            {
              label: "Отключиться",
              action: () => onDisconnect(context.serverId),
              disabled: !menuAvailable || !contextIsConnected,
            },
            {
              label: "Переподключиться",
              action: () => onReconnect(context.serverId),
              disabled: !menuAvailable || !contextIsConnected,
            },
          ]}
          onClose={() => setContext(null)}
        />
      )}
    </aside>
  );
}