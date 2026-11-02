export type ConfigDataType =
  | "string"
  | "number"
  | "boolean"
  | "choice"
  | "date"
  | "duration"
  | "json";

export interface ParamMeta {
  description?: string | null;
  type: ConfigDataType;
  required: boolean;
  default?: unknown;
  choices?: unknown[] | null;
  min?: number | null;
  max?: number | null;
  pattern?: string | null;
  format?: string | null;
  order: number;
  section?: string | null;
  read_only: boolean;
  restart_required: boolean;
}

export interface ConfigParam {
  path: string;
  meta: ParamMeta;
  value: unknown;
  pending_restart: boolean;
}

export type ConfigSections = Record<string, ConfigParam[]>;