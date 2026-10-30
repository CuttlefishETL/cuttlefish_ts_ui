export type NodeId = string;

export type TabId = "settings" | "connectors" | "plugins" | "metrics" | "scripts" | "cron"  | "security";

export type NodeKind = "folder" | "server";

interface BaseNode {
  id: NodeId;
  name: string;
}

export interface ServerLeaf extends BaseNode {
  kind: "server";
  url: string;
  port: number;
}

export interface ServerFolder extends BaseNode {
  kind: "folder";
  children: ServerNode[];
}

export type ServerNode = ServerFolder | ServerLeaf;

/** Alias для TabsPanel и SettingsTab. */
export type Server = ServerLeaf;

/** Описание под-вкладки. */
export interface SubTab {
  id: TabId;
  name: string;
}

export interface MetricLeaf {
  kind: "metric";
  id: string;
  name: string;
}

export interface MetricGroup {
  kind: "group";
  id: string;
  name: string;
  children: MetricNode[];
}

export type MetricNode = MetricLeaf | MetricGroup;

export type MetricCheckState = "checked" | "unchecked" | "indeterminate";