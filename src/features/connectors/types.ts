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
  type: "group" | "connector";
  children: ConnectorTreeNode[];
  connector?: ConnectorInstance;
  templateType?: string;
}
