import type { PluginListItem, PluginMetadata, PluginStatus } from "./types";

const TOKEN_KEY = "cuttlefish.token";

function authHeaders(): Record<string, string> {
  const token = localStorage.getItem(TOKEN_KEY);
  return token ? { Authorization: `Bearer ${token}` } : {};
}

export function createPluginsApi(baseUrl: string) {
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
    list(signal?: AbortSignal) {
      return json<PluginListItem[]>("/api/plugins", { signal });
    },
    status(signal?: AbortSignal) {
      return json<PluginStatus>("/api/plugins/status", { signal });
    },
    one(id: string, signal?: AbortSignal) {
      return json<PluginMetadata>(`/api/plugins/${encodeURIComponent(id)}`, { signal });
    },
    toggle(id: string) {
      return json<void>(`/api/plugins/${encodeURIComponent(id)}/enable`, {
        method: "POST",
      });
    },
    load(id: string) {
      return json<void>(`/api/plugins/${encodeURIComponent(id)}/load`, {
        method: "POST",
      });
    },
    unload(id: string) {
      return json<void>(`/api/plugins/${encodeURIComponent(id)}/unload`, {
        method: "POST",
      });
    },
    remove(id: string) {
      return json<void>(`/api/plugins/${encodeURIComponent(id)}`, {
        method: "DELETE",
      });
    },
    async download(id: string): Promise<Blob> {
      const res = await fetch(
        `${baseUrl}/api/plugins/${encodeURIComponent(id)}/download`,
        { headers: authHeaders() },
      );
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return res.blob();
    },
    upload(file: File, onProgress: (p: number) => void): Promise<void> {
      return new Promise((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        xhr.open("POST", `${baseUrl}/api/plugins/upload`);
        const token = localStorage.getItem(TOKEN_KEY);
        if (token) xhr.setRequestHeader("Authorization", `Bearer ${token}`);

        xhr.upload.onprogress = (e) => {
          if (e.lengthComputable) {
            onProgress(Math.round((e.loaded / e.total) * 100));
          }
        };
        xhr.onload = () =>
          xhr.status >= 200 && xhr.status < 300
            ? resolve()
            : reject(new Error(`HTTP ${xhr.status}`));
        xhr.onerror = () => reject(new Error("Сетевая ошибка"));
        xhr.onabort = () => reject(new Error("Загрузка отменена"));

        const form = new FormData();
        form.append("file", file);
        xhr.send(form);
      });
    },
  };
}

export type PluginsApi = ReturnType<typeof createPluginsApi>;