import type { AxiosError } from "axios";
import { createApiClient, TOKEN_KEY as _TOKEN } from "../../api/http";
import type { PluginListItem, PluginMetadata, PluginStatus } from "./types";

/** Приводим AxiosError к обычному Error с осмысленным сообщением. */
function normalize(err: unknown): Error {
  const ax = err as AxiosError<{ error?: string }>;
  if (ax?.isAxiosError) {
    const serverMsg = ax.response?.data?.error;
    return new Error(serverMsg ?? ax.message);
  }
  return err instanceof Error ? err : new Error(String(err));
}

export function createPluginsApi(baseUrl: string) {
  const client = createApiClient(baseUrl);

  const call = async <T>(p: Promise<{ data: T }>): Promise<T> => {
    try {
      return (await p).data;
    } catch (e) {
      throw normalize(e);
    }
  };

  return {
    list(signal?: AbortSignal) {
      return call<PluginListItem[]>(client.get("/api/plugins", { signal }));
    },
    status(signal?: AbortSignal) {
      return call<PluginStatus>(client.get("/api/plugins/status", { signal }));
    },
    one(id: string, signal?: AbortSignal) {
      return call<PluginMetadata>(
        client.get(`/api/plugins/${encodeURIComponent(id)}`, { signal }),
      );
    },
    toggle(id: string) {
      return call<void>(client.post(`/api/plugins/${encodeURIComponent(id)}/enable`));
    },
    load(id: string) {
      return call<void>(client.post(`/api/plugins/${encodeURIComponent(id)}/load`));
    },
    unload(id: string) {
      return call<void>(client.post(`/api/plugins/${encodeURIComponent(id)}/unload`));
    },
    remove(id: string) {
      return call<void>(client.delete(`/api/plugins/${encodeURIComponent(id)}`));
    },
    async download(id: string): Promise<Blob> {
      return call<Blob>(
        client.get(`/api/plugins/${encodeURIComponent(id)}/download`, {
          responseType: "blob",
        }),
      );
    },
    async upload(file: File, onProgress: (p: number) => void): Promise<void> {
      const form = new FormData();
      form.append("file", file);
      try {
        await client.post("/api/plugins/upload", form, {
          // Content-Type выставит браузер (multipart + boundary).
          // axios автоматически "снимает" дефолтный application/json для FormData.
          onUploadProgress: (e) => {
            if (e.total) onProgress(Math.round((e.loaded / e.total) * 100));
          },
        });
      } catch (e) {
        throw normalize(e);
      }
    },
  };
}

export type PluginsApi = ReturnType<typeof createPluginsApi>;