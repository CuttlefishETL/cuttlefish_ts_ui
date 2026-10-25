import type { Server, SubTab, TabId } from "../types";
import { SettingsTab } from "./tabs/SettingsTab";
import { ConnectorsTab } from "./tabs/ConnectorsTab";
import { PluginsTab } from "./tabs/PluginsTab";
import { MetricsTab } from "./tabs/MetricsTab";
import { ScriptsTab } from "./tabs/ScriptsTab";

interface TabsPanelProps {
  servers: Server[];
  subTabs: SubTab[];
  openTabs: string[];
  activeTab: string | null;
  activeSubTab: TabId;
  connectedIds: Set<string>;
  savedServers: Set<string>;
  onTabSelect: (serverId: string) => void;
  onTabClose: (serverId: string) => void;
  onSubTabSelect: (tabId: TabId) => void;
  onChange: (serverId: string, patch: Partial<Server>) => void;
  onSave: (serverId: string) => void;
  onEdit: (serverId: string) => void;
}

export function TabsPanel({
  servers,
  subTabs,
  openTabs,
  activeTab,
  activeSubTab,
  connectedIds,
  savedServers,
  onTabSelect,
  onTabClose,
  onSubTabSelect,
  onChange,
  onSave,
  onEdit,
}: TabsPanelProps) {
  const activeServer = servers.find((s) => s.id === activeTab);
  const isConnected = !!activeServer && connectedIds.has(activeServer.id);

  // Если сервер не подключён — доступна только «Настройка»
  const visibleTabs = isConnected
    ? subTabs
    : subTabs.filter((t) => t.id === "settings");
  const renderedTab: TabId = isConnected ? activeSubTab : "settings";

  const renderContent = (server: Server) => {
    switch (renderedTab) {
      case "settings":
        return (
          <SettingsTab
            key={server.id}
            server={server}
            readonly={savedServers.has(server.id)}
            onChange={(patch) => onChange(server.id, patch)}
            onSave={() => onSave(server.id)}
            onEdit={() => onEdit(server.id)}
          />
        );
      case "connectors":
        return <ConnectorsTab />;
      case "plugins":
        return <PluginsTab />;
      case "metrics":
        return <MetricsTab />;
      case "scripts":
        return <ScriptsTab />;
    }
  };

  return (
    <section className="tabs-panel">
      <div className="tabs-bar">
        {openTabs.map((id) => {
          const server = servers.find((s) => s.id === id);
          if (!server) return null;
          return (
            <div
              key={id}
              className={`tab ${activeTab === id ? "active" : ""}`}
              onClick={() => onTabSelect(id)}
            >
              <span>{server.name || "(без имени)"}</span>
              <button
                type="button"
                className="tab-close"
                onClick={(e) => {
                  e.stopPropagation();
                  onTabClose(id);
                }}
              >
                ×
              </button>
            </div>
          );
        })}
        {openTabs.length === 0 && (
          <div className="tabs-empty">Нет открытых вкладок</div>
        )}
      </div>

      {activeServer ? (
        <div className="tab-content">
          <div className="sub-tabs">
            {visibleTabs.map((tab) => (
              <button
                type="button"
                key={tab.id}
                className={`sub-tab ${
                  renderedTab === tab.id ? "active" : ""
                }`}
                onClick={() => onSubTabSelect(tab.id)}
              >
                {tab.name}
              </button>
            ))}
          </div>

          <div className="sub-tab-content">{renderContent(activeServer)}</div>
        </div>
      ) : (
        <div className="empty-state">
          <p>Выберите сервер в списке слева</p>
        </div>
      )}
    </section>
  );
}