import type { AxiosError } from "axios";
import { createApiClient } from "../../api/http";
import type { PluginListItem, PluginMetadata, PluginStatus } from "./types";

/** Все плагин-эндпоинты живут под этим префиксом. При переезде — одна правка. */
const ADMIN_PREFIX = "/admin";
const PLUGINS = `${ADMIN_PREFIX}/plugins`;

/** Формат ответа GET /admin/plugins/list. */
interface PluginsListResponse {
  plugins: PluginListItem[];
  total: number;
  active: number;
  api_version: string;
  core_version: string;
}

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

  const fetchList = (signal?: AbortSignal) =>
    call<PluginsListResponse>(client.get(`${PLUGINS}/list`, { signal }));

  return {
    async list(signal?: AbortSignal): Promise<PluginListItem[]> {
      const data = await fetchList(signal);
      return Array.isArray(data.plugins) ? data.plugins : [];
    },

    async status(signal?: AbortSignal): Promise<PluginStatus> {
      const data = await fetchList(signal);
      return {
        total: data.total,
        active: data.active,
        api_version: data.api_version,
        core_version: data.core_version,
      };
    },

  async one(id: string, signal?: AbortSignal): Promise<PluginMetadata> {
    const data = await call<{ plugin: PluginMetadata }>(
      client.get(`${PLUGINS}/${encodeURIComponent(id)}`, { signal }),
    );
    return data.plugin;
  },

    /**
     * Установить флаг enabled.
     *
     * Сервер: PUT /admin/plugins/:id/enable, body { enabled: bool }.
     * При enabled=false сервер сам выгружает плагин (state -> "Unloaded").
     * При enabled=true только ставит флаг, загрузка — отдельный шаг.
     */
    toggle(id: string, enabled: boolean) {
      return call<void>(
        client.put(`${PLUGINS}/${encodeURIComponent(id)}/enable`, { enabled }),
      );
    },

    /**
     * Загрузить плагин. На сервере выделенного /load нет;
     * reload_plugin_handler перечитывает файл и, как правило,
     * загружает выгруженный плагин. Если на бэке появится /load —
     * заменить URL ниже.
     */
    load(id: string) {
      return call<void>(
        client.post(`${PLUGINS}/${encodeURIComponent(id)}/reload`),
      );
    },

    /**
     * Выгрузить плагин.
     *
     * На сервере нет отдельного «unload без disable»: enable_plugin_handler
     * при enabled=false сам вызывает unload_plugin. Поэтому «выгрузить»
     * == «установить enabled=false».
     *
     * Если хотите оставить кнопку «Выгрузить», она должна идти сюда же,
     * что и toggle(id, false). Сейчас метод оставлен ради совместимости
     * с интерфейсом PluginsApi, но, по сути, дублирует toggle.
     */
    unload(id: string) {
      return call<void>(
        client.put(`${PLUGINS}/${encodeURIComponent(id)}/enable`, {
          enabled: false,
        }),
      );
    },

    remove(id: string) {
      return call<void>(
        client.delete(`${PLUGINS}/${encodeURIComponent(id)}`),
      );
    },

    async download(id: string): Promise<Blob> {
      return call<Blob>(
        client.get(`${PLUGINS}/${encodeURIComponent(id)}/file`, {
          responseType: "blob",
        }),
      );
    },

    async upload(file: File, onProgress: (p: number) => void): Promise<void> {
      const form = new FormData();
      form.append("file", file);
      try {
        await client.post(`${PLUGINS}/upload`, form, {
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