export type PluginState = "Active" | "Inactive" | "Failed" | "Unloaded";

export interface PluginExtensions {
  connectors: number;
  metrics: number;
  config_params: number;
  lua_functions: number;
}

export interface PluginListItem {
  id: string;
  name: string;
  version: string;
  filename: string;
  state: PluginState;
  enabled: boolean;
  extensions: PluginExtensions;
}

export interface PluginStatus {
  total: number;
  active: number;
  api_version: number;
  core_version: string;
}

export interface PluginMetadata {
  author?: string;
  created?: string;
  description?: string;
  enabled: boolean;
  filename: string;
  name: string;
  note?: string;
  version: string;
  extensions: PluginExtensions;
}

export type PluginType = "Lua" | "C++" | "Python" | "Unknown";

export function pluginTypeFromFilename(filename: string): PluginType {
  const ext = filename.toLowerCase().split(".").pop() ?? "";
  if (ext === "lua") return "Lua";
  if (ext === "so" || ext === "dll" || ext === "dylib") return "C++";
  if (ext === "py") return "Python";
  return "Unknown";
}

export interface PluginTreeNode {
  key: string;
  label: string;
  type: "folder" | "plugin";
  children: PluginTreeNode[];
  plugin?: PluginListItem;
  path: string;
}