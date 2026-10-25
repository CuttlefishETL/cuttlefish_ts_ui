export type NodeId = string;

export type TabId = "settings" | "connectors" | "plugins" | "metrics" | "scripts";

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

export interface AppSettings {
  version: number;
  servers: ServerNode[];
}