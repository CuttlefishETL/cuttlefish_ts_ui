import type { AxiosError } from "axios";
import { createApiClient } from "../../api/http";
import type {
  ConnectorInstance,
  ConnectorStatus,
  ConnectorTemplate,
  DataType,
  Direction,
  ParamMeta,
} from "./types";

const ADMIN_PREFIX = "/admin";
const CONNECTORS = `${ADMIN_PREFIX}/connectors`;

export interface ConnectorInput {
  name: string;
  type: string;
  enabled: boolean;
  description?: string;
  params: Record<string, unknown>;
  tags?: string[];
  direction: Direction;
  metadata?: Record<string, string>;
}

/** На сервере direction в нижнем регистре. */
type ServerDirection = "source" | "sink" | "duplex";

function toServerDirection(d: Direction): ServerDirection {
  return d.toLowerCase() as ServerDirection;
}

function fromServerDirection(d: unknown): Direction {
  if (typeof d !== "string") return "Duplex";
  switch (d.toLowerCase()) {
    case "source":
      return "Source";
    case "sink":
      return "Sink";
    case "duplex":
      return "Duplex";
    default:
      return "Duplex";
  }
}

/** Приводим возможные варианты ("String", "INTEGER", "uri") к клиентскому union. */
function normalizeDataType(v: unknown): DataType {
  if (typeof v !== "string") return "string";
  const lower = v.toLowerCase();
  switch (lower) {
    case "string":
    case "integer":
    case "number":
    case "boolean":
    case "choice":
    case "secret":
    case "object":
    case "array":
    case "duration":
    case "uri":
    case "hostname":
      return lower as DataType;
    default:
      return "string";
  }
}

/** Нормализуем одну запись ParamMeta. */
function normalizeParamMeta(raw: unknown): ParamMeta | null {
  if (!raw || typeof raw !== "object") return null;
  const m = raw as Record<string, unknown>;

  const description =
    typeof m.description === "string" ? m.description : undefined;
  const data_type = normalizeDataType(m.data_type);
  const required = m.required === true;
  const def = m.default;
  const choices = Array.isArray(m.choices) ? m.choices : undefined;
  const min = typeof m.min === "number" ? m.min : undefined;
  const max = typeof m.max === "number" ? m.max : undefined;
  const pattern = typeof m.pattern === "string" ? m.pattern : undefined;
  const format = typeof m.format === "string" ? m.format : undefined;
  const order = typeof m.order === "number" ? m.order : 0;

  return {
    description,
    data_type,
    required,
    default: def,
    choices,
    min,
    max,
    pattern,
    format,
    order,
  };
}

/** Нормализуем шаблон. `fallbackType` подставляется, если сервер не прислал
 *  поле `type` (а он его не присылает: тип — это ключ HashMap). */
function normalizeTemplate(
  raw: unknown,
  fallbackType: string,
): ConnectorTemplate | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;

  const paramsRaw =
    o.params && typeof o.params === "object"
      ? (o.params as Record<string, unknown>)
      : {};
  const params: Record<string, ParamMeta> = {};
  for (const [name, metaRaw] of Object.entries(paramsRaw)) {
    const meta = normalizeParamMeta(metaRaw);
    if (meta) params[name] = meta;
  }

  return {
    type: typeof o.type === "string" ? o.type : fallbackType,
    label:
      typeof o.label === "string"
        ? o.label
        : typeof o.type === "string"
          ? (o.type as string)
          : fallbackType,
    description: typeof o.description === "string" ? o.description : undefined,
    builtin: o.builtin === true,
    plugin: typeof o.plugin === "string" ? o.plugin : undefined,
    direction: fromServerDirection(o.direction),
    params,
  };
}

/** Серверное представление коннектора (поля опциональны — as is). */
interface ServerConnector {
  name?: string;
  type?: string;
  enabled?: boolean;
  description?: string | null;
  params?: Record<string, unknown>;
  tags?: string[] | null;
  direction?: string;
  metadata?: Record<string, string> | null;
}

function toClient(c: ServerConnector): ConnectorInstance {
  return {
    name: c.name ?? "",
    type: c.type ?? "",
    enabled: c.enabled ?? false,
    description: c.description ?? undefined,
    params: c.params ?? {},
    tags: c.tags ?? undefined,
    direction: fromServerDirection(c.direction),
    metadata: c.metadata ?? undefined,
  };
}

function toServer(input: ConnectorInput): ServerConnector {
  return {
    name: input.name,
    type: input.type,
    enabled: input.enabled,
    description: input.description ?? null,
    params: input.params,
    tags: input.tags ?? null,
    direction: toServerDirection(input.direction),
    metadata: input.metadata ?? null,
  };
}

function unwrapList(data: unknown): ServerConnector[] {
  if (Array.isArray(data)) return data as ServerConnector[];
  if (data && typeof data === "object") {
    const obj = data as Record<string, unknown>;
    for (const key of ["connectors", "items", "data"]) {
      if (Array.isArray(obj[key])) return obj[key] as ServerConnector[];
    }
  }
  return [];
}

/**
 * Универсальный разбор ответа GET /admin/connectors/templates.
 * Поддерживает:
 *  - массив шаблонов ([{...}, {...}]);
 *  - объекты-обёртки ({ templates: [...] }, { items: [...] }, { data: [...] });
 *  - HashMap-формат сервера: { "redb": {...}, "sql_executor": {...} }
 *    (ключ = type, внутри нет поля `type`).
 */
function unwrapTemplates(data: unknown): ConnectorTemplate[] {
  if (Array.isArray(data)) {
    const out: ConnectorTemplate[] = [];
    for (const item of data) {
      const t = normalizeTemplate(item, "");
      if (t && t.type) out.push(t);
    }
    return out;
  }

  if (data && typeof data === "object") {
    const obj = data as Record<string, unknown>;

    // Обёртки-массивы
    for (const key of ["templates", "items", "data"]) {
      if (Array.isArray(obj[key])) {
        const out: ConnectorTemplate[] = [];
        for (const item of obj[key] as unknown[]) {
          const t = normalizeTemplate(item, "");
          if (t && t.type) out.push(t);
        }
        return out;
      }
    }

    // HashMap: ключ → шаблон
    const out: ConnectorTemplate[] = [];
    for (const [type, raw] of Object.entries(obj)) {
      const t = normalizeTemplate(raw, type);
      if (t) out.push(t);
    }
    return out;
  }

  return [];
}

function parseStatus(data: unknown): ConnectorStatus | null {
  if (!data || typeof data !== "object") return null;
  const o = data as Record<string, unknown>;
  const num = (k: string) =>
    typeof o[k] === "number" ? (o[k] as number) : undefined;
  const total = num("total_connectors") ?? num("total");
  const enabled = num("enabled_connectors") ?? num("enabled");
  if (total === undefined || enabled === undefined) return null;
  const disabled =
    num("disabled_connectors") ?? num("disabled") ?? total - enabled;
  return {
    total_connectors: total,
    enabled_connectors: enabled,
    disabled_connectors: disabled,
  };
}

function computeStatus(items: ConnectorInstance[]): ConnectorStatus {
  const enabled = items.filter((c) => c.enabled).length;
  return {
    total_connectors: items.length,
    enabled_connectors: enabled,
    disabled_connectors: items.length - enabled,
  };
}

function normalize(err: unknown): Error {
  const ax = err as AxiosError<{ error?: string }>;
  if (ax?.isAxiosError) {
    const serverMsg = ax.response?.data?.error;
    return new Error(serverMsg ?? ax.message);
  }
  return err instanceof Error ? err : new Error(String(err));
}

function foldersKey(baseUrl: string): string {
  return `cuttlefish.connectors.folders.${baseUrl}`;
}

export function createConnectorsApi(baseUrl: string) {
  const client = createApiClient(baseUrl);

  const call = async <T>(p: Promise<{ data: T }>): Promise<T> => {
    try {
      return (await p).data;
    } catch (e) {
      throw normalize(e);
    }
  };

  const fetchList = async (
    signal?: AbortSignal,
  ): Promise<ConnectorInstance[]> => {
    const data = await call<unknown>(client.get(CONNECTORS, { signal }));
    return unwrapList(data).map(toClient);
  };

  return {
    async listTemplates(signal?: AbortSignal): Promise<ConnectorTemplate[]> {
      const data = await call<unknown>(
        client.get(`${CONNECTORS}/templates`, { signal }),
      );
      return unwrapTemplates(data);
    },

    async list(signal?: AbortSignal): Promise<ConnectorInstance[]> {
      return fetchList(signal);
    },

    async status(signal?: AbortSignal): Promise<ConnectorStatus> {
      const raw = await call<unknown>(
        client.get(`${CONNECTORS}/status`, { signal }),
      );
      const parsed = parseStatus(raw);
      if (parsed) return parsed;
      return computeStatus(await fetchList(signal));
    },

    /** GET /admin/connectors/:name — карточка одного коннектора.
     *  Сервер отдаёт ConnectorInstance напрямую, без обёртки. */
    async one(name: string, signal?: AbortSignal): Promise<ConnectorInstance> {
      const data = await call<ServerConnector>(
        client.get(`${CONNECTORS}/${encodeURIComponent(name)}`, { signal }),
      );
      return toClient(data);
    },

    reload() {
      return call<void>(client.post(`${CONNECTORS}/reload`));
    },

    async create(input: ConnectorInput): Promise<ConnectorInstance> {
      const data = await call<ServerConnector>(
        client.post(CONNECTORS, toServer(input)),
      );
      return toClient(data);
    },

    async update(
      name: string,
      input: ConnectorInput,
    ): Promise<ConnectorInstance> {
      const data = await call<ServerConnector>(
        client.put(
          `${CONNECTORS}/${encodeURIComponent(name)}`,
          toServer(input),
        ),
      );
      return toClient(data);
    },

    remove(name: string) {
      return call<void>(
        client.delete(`${CONNECTORS}/${encodeURIComponent(name)}`),
      );
    },

    /** POST /admin/connectors/:name/enable — без тела. */
    enable(name: string) {
      return call<void>(
        client.post(`${CONNECTORS}/${encodeURIComponent(name)}/enable`),
      );
    },

    /** POST /admin/connectors/:name/disable — без тела. */
    disable(name: string) {
      return call<void>(
        client.post(`${CONNECTORS}/${encodeURIComponent(name)}/disable`),
      );
    },

    async test(_name: string): Promise<void> {
      throw new Error(
        "Функция тестирования соединения недоступна в текущей версии ядра",
      );
    },

    async listFolders(): Promise<string[]> {
      const raw = localStorage.getItem(foldersKey(baseUrl));
      if (!raw) return [];
      try {
        const parsed = JSON.parse(raw);
        return Array.isArray(parsed)
          ? parsed.filter((x) => typeof x === "string")
          : [];
      } catch {
        return [];
      }
    },

    async saveFolders(paths: string[]): Promise<void> {
      localStorage.setItem(foldersKey(baseUrl), JSON.stringify(paths));
    },
  };
}

export type ConnectorsApi = ReturnType<typeof createConnectorsApi>;