export type TabId = "settings" | "connectors" | "plugins" | "metrics";

export interface Server {
  id: string;
  name: string;
  url: string;
  port: number;
}

export interface SubTab {
  id: TabId;
  name: string;
}