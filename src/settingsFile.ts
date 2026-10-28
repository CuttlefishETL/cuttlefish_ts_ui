import type { ServerNode } from "./types";

export interface SettingsFile {
  version: 2;
  servers: ServerNode[];
}

export function serialize(servers: ServerNode[]): string {
  const data: SettingsFile = { version: 2, servers };
  return JSON.stringify(data, null, 2);
}

export function normalizeNode(raw: unknown, index: number): ServerNode {
  const r = raw as Record<string, unknown> | null;
  const id = String(
    r?.id ??
      `${r?.kind === "folder" ? "folder" : "server"}-${Date.now()}-${index}-${Math.floor(Math.random() * 1000)}`,
  );
  const name = String(r?.name ?? "");
  if (r && r.kind === "folder") {
    const children = Array.isArray(r.children)
      ? (r.children as unknown[]).map((c, i) => normalizeNode(c, i))
      : [];
    return { id, kind: "folder", name, children };
  }
  return {
    id,
    kind: "server",
    name,
    url: String(r?.url ?? ""),
    port: Number(r?.port) || 0,
  };
}

export function parseSettings(text: string): ServerNode[] {
  const data = JSON.parse(text);
  if (!data || !Array.isArray(data.servers)) {
    throw new Error("Некорректный формат файла настроек");
  }
  return (data.servers as unknown[]).map((n, i) => normalizeNode(n, i));
}
