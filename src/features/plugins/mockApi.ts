import type { PluginsApi } from "./api";
import type {
  PluginExtensions,
  PluginListItem,
  PluginMetadata,
  PluginStatus,
} from "./types";

const delay = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

const EMPTY_EXT: PluginExtensions = {
  connectors: 0,
  metrics: 0,
  config_params: 0,
  lua_functions: 0,
};

const INITIAL_ITEMS: PluginListItem[] = [
  {
    id: "custom-validator",
    name: "CustomValidator",
    version: "1.0.0",
    filename: "plugins/custom_validator.so",
    state: "Active",
    enabled: true,
    extensions: { ...EMPTY_EXT, connectors: 1, metrics: 2 },
  },
  {
    id: "lua-connectors-1-1",
    name: "connectors/1_1",
    version: "1.0.0",
    filename: "lua/connectors/1_1.lua",
    state: "Active",
    enabled: true,
    extensions: { ...EMPTY_EXT, lua_functions: 3 },
  },
  {
    id: "lua-connectors-1-2",
    name: "connectors/1_2",
    version: "1.0.0",
    filename: "lua/connectors/1_2.lua",
    state: "Inactive",
    enabled: false,
    extensions: EMPTY_EXT,
  },
  {
    id: "lua-cron-start",
    name: "cron/start",
    version: "1.0.0",
    filename: "lua/cron/start.lua",
    state: "Active",
    enabled: true,
    extensions: { ...EMPTY_EXT, lua_functions: 1 },
  },
  {
    id: "lua-cron-cleanup",
    name: "cron/cleanup",
    version: "1.0.0",
    filename: "lua/cron/cleanup.lua",
    state: "Unloaded",
    enabled: false,
    extensions: EMPTY_EXT,
  },
  {
    id: "report",
    name: "report",
    version: "1.0.0",
    filename: "report.lua",
    state: "Active",
    enabled: true,
    extensions: { ...EMPTY_EXT, lua_functions: 2 },
  },
  {
    id: "scheduler-test",
    name: "scheduler_test",
    version: "1.0.0",
    filename: "scheduler_test.lua",
    state: "Failed",
    enabled: true,
    extensions: EMPTY_EXT,
  },
  {
    id: "transform-in",
    name: "transform_in",
    version: "1.0.0",
    filename: "transform_in.lua",
    state: "Unloaded",
    enabled: false,
    extensions: { ...EMPTY_EXT, config_params: 1 },
  },
];

interface MockState {
  items: PluginListItem[];
}

function computeStatus(state: MockState): PluginStatus {
  return {
    total: state.items.length,
    active: state.items.filter((x) => x.state === "Active").length,
    api_version: 1,
    core_version: "1.4.2 (mock)",
  };
}

function toMetadata(item: PluginListItem): PluginMetadata {
  return {
    author: "mock-author",
    created: "2026-10-28T10:00:00Z",
    description: `Заглушка для плагина ${item.name}`,
    enabled: item.enabled,
    filename: item.filename,
    name: item.name,
    note: item.state === "Failed" ? "Ошибка загрузки" : "—",
    version: item.version,
    extensions: item.extensions,
  };
}

/**
 * Мок-реализация PluginsApi. Поведение и сигнатуры совпадают с реальным
 * клиентом, но данные живут в памяти, операции эмулируются с задержкой.
 */
export function createMockPluginsApi(): PluginsApi {
  const state: MockState = {
    items: INITIAL_ITEMS.map((p) => ({ ...p, extensions: { ...p.extensions } })),
  };

  return {
    async list() {
      await delay(200);
      return state.items.map((p) => ({ ...p, extensions: { ...p.extensions } }));
    },

    async status() {
      await delay(150);
      return computeStatus(state);
    },

    async one(id: string) {
      await delay(200);
      const item = state.items.find((x) => x.id === id);
      if (!item) throw new Error("Плагин не найден");
      return toMetadata(item);
    },

    async toggle(id: string) {
      await delay(250);
      const item = state.items.find((x) => x.id === id);
      if (!item) throw new Error("Плагин не найден");

      item.enabled = !item.enabled;
      if (item.enabled && item.state !== "Active" && item.state !== "Failed") {
        item.state = "Active";
      } else if (!item.enabled) {
        item.state = "Inactive";
      }
    },

    async load(id: string) {
      await delay(300);
      const item = state.items.find((x) => x.id === id);
      if (!item) throw new Error("Плагин не найден");

      // Демонстрация ошибочного сценария
      if (item.filename.endsWith("scheduler_test.lua")) {
        throw new Error(
          "Не удалось загрузить плагин: scheduler_test.lua: попытка вызвать nil",
        );
      }

      item.state = "Active";
      item.enabled = true;
    },

    async unload(id: string) {
      await delay(250);
      const item = state.items.find((x) => x.id === id);
      if (!item) throw new Error("Плагин не найден");
      item.state = "Unloaded";
    },

    async remove(id: string) {
      await delay(250);
      const idx = state.items.findIndex((x) => x.id === id);
      if (idx < 0) throw new Error("Плагин не найден");
      state.items.splice(idx, 1);
    },

    async download(id: string) {
      await delay(200);
      const item = state.items.find((x) => x.id === id);
      if (!item) throw new Error("Плагин не найден");
      return new Blob(
        [`mock plugin file\nid: ${item.id}\nfilename: ${item.filename}\n`],
        { type: "application/octet-stream" },
      );
    },

    async upload(file: File, onProgress: (p: number) => void) {
      for (let p = 0; p <= 100; p += 10) {
        await delay(80);
        onProgress(p);
      }
      const id = `uploaded-${Date.now()}`;
      state.items.push({
        id,
        name: file.name.replace(/\.[^.]+$/, ""),
        version: "1.0.0",
        filename: file.name,
        state: "Inactive",
        enabled: false,
        extensions: { ...EMPTY_EXT },
      });
    },
  };
}