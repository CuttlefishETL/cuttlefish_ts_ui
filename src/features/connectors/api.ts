import type {
  ConnectorInstance,
  ConnectorStatus,
  ConnectorTemplate,
} from "./types";

const TOKEN_KEY = "cuttlefish.token";

function authHeaders(): Record<string, string> {
  const token = localStorage.getItem(TOKEN_KEY);
  return token ? { Authorization: `Bearer ${token}` } : {};
}

export interface ConnectorInput {
  name: string;
  type: string;
  enabled: boolean;
  description?: string;
  params: Record<string, unknown>;
  tags?: string[];
  direction: string;
}

export function createConnectorsApi(baseUrl: string) {
  const json = async <T>(path: string, init?: RequestInit): Promise<T> => {
    const res = await fetch(`${baseUrl}${path}`, {
      ...init,
      headers: {
        "Content-Type": "application/json",
        ...authHeaders(),
        ...(init?.headers ?? {}),
      },
    });
    const text = await res.text();
    const data = text ? JSON.parse(text) : undefined;
    if (!res.ok) {
      const msg = (data as { error?: string })?.error ?? `HTTP ${res.status}`;
      throw new Error(msg);
    }
    return data as T;
  };

  return {
    listTemplates(signal?: AbortSignal) {
      return json<ConnectorTemplate[]>("/api/connectors/templates", { signal });
    },
    list(signal?: AbortSignal) {
      return json<ConnectorInstance[]>("/api/connectors", { signal });
    },
    status(signal?: AbortSignal) {
      return json<ConnectorStatus>("/api/connectors/status", { signal });
    },
    reload() {
      return json<void>("/api/connectors/reload", { method: "POST" });
    },
    create(input: ConnectorInput) {
      return json<ConnectorInstance>("/api/connectors", {
        method: "POST",
        body: JSON.stringify(input),
      });
    },
    update(name: string, input: ConnectorInput) {
      return json<ConnectorInstance>(
        `/api/connectors/${encodeURIComponent(name)}`,
        { method: "PUT", body: JSON.stringify(input) },
      );
    },
    remove(name: string) {
      return json<void>(`/api/connectors/${encodeURIComponent(name)}`, {
        method: "DELETE",
      });
    },
    async test(_name: string): Promise<void> {
      throw new Error(
        "Функция тестирования соединения недоступна в текущей версии ядра",
      );
    },
  };
}

export type ConnectorsApi = ReturnType<typeof createConnectorsApi>;
