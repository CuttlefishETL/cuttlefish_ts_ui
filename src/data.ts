import type { Server, SubTab } from "./types";

export const SETTINGS_TABS: SubTab[] = [
  { id: "settings", name: "Настройка" },
  { id: "connectors", name: "Коннекторы" },
  { id: "plugins", name: "Плагины" },
  { id: "metrics", name: "Метрики" },
];

export const INITIAL_SERVERS: Server[] = [
  { id: "server1", name: "Сервер 1", url: "http://localhost", port: 8080 },
  { id: "server2", name: "Сервер 2", url: "http://localhost", port: 8081 },
];

export function createServer(): Server {
  return {
    id: `server-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
    name: "Новый сервер",
    url: "http://localhost",
    port: 8080,
  };
}