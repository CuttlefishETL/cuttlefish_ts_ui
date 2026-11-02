import type { Server, SubTab, TabId } from "../types";
import { SettingsTab } from "./tabs/SettingsTab";
import { ConnectorsTab } from "./tabs/ConnectorsTab";
import { PluginsTab } from "./tabs/PluginsTab";
import { MetricsTab } from "./tabs/MetricsTab";
import { ScriptsTab } from "./tabs/ScriptsTab";
import { CronTab } from "./tabs/CronTab";
import { SecurityTab } from "./tabs/SecurityTab";
import { TabView } from "./tabs/TabView";

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

  const visibleTabs = isConnected
    ? subTabs
    : subTabs.filter((t) => t.id === "settings");
  const renderedTab: TabId = isConnected ? activeSubTab : "settings";

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

          {/*
            key={activeServer.id} — при смене сервера вся оболочка
            перемонтируется, состояние предыдущего сервера не переносится.
            При переключении сабтабов внутри одного сервера — состояние
            каждого таба сохраняется (keep-alive через TabView).
          */}
          <div className="sub-tab-content" key={activeServer.id}>
            <TabView active={renderedTab === "settings"}>
              <SettingsTab
                server={activeServer}
                readonly={savedServers.has(activeServer.id)}
                onChange={(patch) => onChange(activeServer.id, patch)}
                onSave={() => onSave(activeServer.id)}
                onEdit={() => onEdit(activeServer.id)}
              />
            </TabView>

            <TabView active={renderedTab === "connectors"}>
              <ConnectorsTab server={activeServer} />
            </TabView>

            <TabView active={renderedTab === "plugins"}>
              <PluginsTab server={activeServer} />
            </TabView>

            <TabView active={renderedTab === "metrics"}>
              <MetricsTab />
            </TabView>

            {/*
              Scripts — tight: внутри уже свои рамки (дерево, редактор,
              панели отладки), внешняя карточка дала бы двойную рамку.
            */}
            <TabView active={renderedTab === "scripts"} tight>
              <ScriptsTab server={activeServer} />
            </TabView>

            <TabView active={renderedTab === "cron"}>
              <CronTab server={activeServer} />
            </TabView>

            <TabView active={renderedTab === "security"}>
              <SecurityTab server={activeServer} />
            </TabView>
          </div>
        </div>
      ) : (
        <div className="empty-state">
          <p>Выберите сервер в списке слева</p>
        </div>
      )}
    </section>
  );
}