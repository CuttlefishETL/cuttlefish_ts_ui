import type { Server } from "../types";
import type { CheckStatus } from "../checkConnection";

interface SidebarProps {
  servers: Server[];
  selectedId: string | null;
  connectedIds: Set<string>;
  checkStatuses: Record<string, CheckStatus>;
  refreshing: boolean;
  onSelect: (id: string) => void;
  onDoubleClick: (id: string) => void;
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

export function Sidebar({
  servers,
  selectedId,
  connectedIds,
  checkStatuses,
  refreshing,
  onSelect,
  onDoubleClick,
  onAdd,
  onDelete,
  onRefresh,
}: SidebarProps) {
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
              title="Двойной щелчок — подключиться / отключиться"
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
    </aside>
  );
}