import { ServerNode, TabId } from "./types";

export interface TabDef {
  id: TabId;
  label: string;
}

export const SETTINGS_TABS: TabDef[] = [
  { id: "settings", label: "Настройки" },
  { id: "connectors", label: "Коннекторы" },
  { id: "plugins", label: "Плагины" },
  { id: "metrics", label: "Метрики" },
  { id: "scripts", label: "Скрипты" },
];

export const INITIAL_SERVERS: ServerNode[] = [
  {
    id: "folder-prod",
    kind: "folder",
    name: "Production",
    children: [
      { id: "srv-prod-eu", kind: "server", name: "prod-eu", url: "etl-eu.example.com", port: 8080 },
      { id: "srv-prod-us", kind: "server", name: "prod-us", url: "etl-us.example.com", port: 8080 },
    ],
  },
  {
    id: "folder-stage",
    kind: "folder",
    name: "Staging",
    children: [
      { id: "srv-stage", kind: "server", name: "stage", url: "localhost", port: 8081 },
    ],
  },
  { id: "srv-local", kind: "server", name: "Local dev", url: "localhost", port: 8080 },
];