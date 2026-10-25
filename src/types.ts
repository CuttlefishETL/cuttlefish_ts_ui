export type TabId = "settings" | "connectors" | "plugins" | "metrics" | "scripts";

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