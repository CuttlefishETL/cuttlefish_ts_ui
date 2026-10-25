import { AppSettings, ServerNode } from "./types";

export const CURRENT_VERSION = 2;

const makeId = () =>
  crypto.randomUUID?.() ??
  `id-${Date.now()}-${Math.random().toString(36).slice(2)}`;

function normalizeNode(raw: any, seen: Set<string>): ServerNode | null {
  if (!raw || typeof raw !== "object") return null;

  let id = typeof raw.id === "string" && raw.id ? raw.id : makeId();
  if (seen.has(id)) id = makeId();
  seen.add(id);

  const name =
    typeof raw.name === "string" && raw.name.trim() ? raw.name.trim() : "Unnamed";

  const rawChildren = Array.isArray(raw.children) ? raw.children : null;
  const looksLikeFolder = raw.kind === "folder" || rawChildren !== null;

  if (looksLikeFolder) {
    const children: ServerNode[] = (rawChildren ?? [])
      .map((c: any) => normalizeNode(c, seen))
      .filter((c: ServerNode | null): c is ServerNode => c !== null);
    return { id, name, kind: "folder", children };
  }

  return {
    id,
    name,
    kind: "server",
    url: typeof raw.url === "string" && raw.url ? raw.url : "localhost",
    port: Number.isFinite(Number(raw.port)) ? Number(raw.port) : 8080,
  };
}

export function parseSettings(text: string): AppSettings {
  const raw = JSON.parse(text);

  if (raw?.version !== undefined && raw.version !== 1 && raw.version !== 2) {
    throw new Error(`Unsupported config version: ${raw.version}`);
  }

  const seen = new Set<string>();
  const servers: ServerNode[] = Array.isArray(raw?.servers)
    ? raw.servers
        .map((n: any) => normalizeNode(n, seen))
        .filter((n: ServerNode | null): n is ServerNode => n !== null)
    : [];

  return { version: CURRENT_VERSION, servers };
}

export function serializeSettings(s: AppSettings): string {
  return JSON.stringify(
    { version: CURRENT_VERSION, servers: s.servers },
    null,
    2,
  );
}