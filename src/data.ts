import type { ServerFolder, ServerLeaf, ServerNode, SubTab } from "./types";

export const SETTINGS_TABS: SubTab[] = [
  { id: "settings", name: "Настройка" },
  { id: "connectors", name: "Коннекторы" },
  { id: "plugins", name: "Плагины" },
  { id: "metrics", name: "Метрики" },
  { id: "scripts", name: "Scripts" },
];

export const INITIAL_SERVERS: ServerNode[] = [
  {
    id: "folder-prod",
    kind: "folder",
    name: "Production",
    children: [
      { id: "server1", kind: "server", name: "Сервер 1", url: "http://localhost", port: 8080 },
      { id: "server2", kind: "server", name: "Сервер 2", url: "http://localhost", port: 8081 },
    ],
  },
  {
    id: "folder-dev",
    kind: "folder",
    name: "Development",
    children: [
      { id: "server3", kind: "server", name: "Сервер 3", url: "http://localhost", port: 8082 },
    ],
  },
];

export function createServer(): ServerLeaf {
  return {
    id: `server-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
    kind: "server",
    name: "Новый сервер",
    url: "http://localhost",
    port: 8080,
  };
}

export function createFolder(): ServerFolder {
  return {
    id: `folder-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
    kind: "folder",
    name: "Новая папка",
    children: [],
  };
}