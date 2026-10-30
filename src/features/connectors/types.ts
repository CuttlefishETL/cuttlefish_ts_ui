export type Direction = "Source" | "Sink" | "Duplex";

export type DataType =
  | "string"
  | "integer"
  | "number"
  | "boolean"
  | "choice"
  | "secret"
  | "object"
  | "array"
  | "duration"
  | "uri"
  | "hostname";

export interface ParamMeta {
  description?: string;
  data_type: DataType;
  required: boolean;
  default?: unknown;
  choices?: unknown[];
  min?: number;
  max?: number;
  pattern?: string;
  format?: string;
  order: number;
}

export interface ConnectorTemplate {
  type: string;
  label: string;
  description?: string;
  builtin: boolean;
  plugin?: string;
  direction: Direction;
  params: Record<string, ParamMeta>;
}

export interface ConnectorInstance {
  name: string;
  type: string;
  enabled: boolean;
  description?: string;
  params: Record<string, unknown>;
  tags?: string[];
  metadata?: Record<string, string>;
  direction: Direction;
}

export interface ConnectorStatus {
  total_connectors: number;
  enabled_connectors: number;
  disabled_connectors: number;
}

export function directionLabel(d: Direction): string {
  switch (d) {
    case "Source":
      return "📥 Источник";
    case "Sink":
      return "📤 Приёмник";
    case "Duplex":
      return "🔄 Двунаправленный";
  }
}

export function directionShort(d: Direction): string {
  switch (d) {
    case "Source":
      return "📥";
    case "Sink":
      return "📤";
    case "Duplex":
      return "🔄";
  }
}

export interface ConnectorTreeNode {
  key: string;
  label: string;
  type: "folder" | "connector";
  children: ConnectorTreeNode[];
  path: string;
  connector?: ConnectorInstance;
}

export function getConnectorFolder(c: ConnectorInstance): string {
  return c.metadata?.folder ?? "";
}

export function isDescendantOrSelf(folder: string, ancestor: string): boolean {
  if (ancestor === "") return true;
  return folder === ancestor || folder.startsWith(ancestor + "/");
}

export function parentPath(path: string): string {
  const idx = path.lastIndexOf("/");
  return idx < 0 ? "" : path.slice(0, idx);
}

export function folderName(path: string): string {
  const idx = path.lastIndexOf("/");
  return idx < 0 ? path : path.slice(idx + 1);
}

export function validateFolderName(name: string): string | null {
  if (!name) return "Имя обязательно";
  if (name.includes("/")) return "Имя не должно содержать /";
  if (name === "." || name === "..") return "Недопустимое имя";
  if (name.length > 64) return "Не более 64 символов";
  return null;
}

export const CONNECTOR_TYPE_ICON: Record<string, string> = {
  rest: "🌐",
  rest_server: "🖥",
  sql: "🗄",
  redb: "💾",
};

export function connectorTypeIcon(type: string): string {
  return CONNECTOR_TYPE_ICON[type] ?? "📄";
}