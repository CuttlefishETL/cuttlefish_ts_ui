import type { ConnectorsApi, ConnectorInput } from "./api";
import type {
  ConnectorInstance,
  ConnectorStatus,
  ConnectorTemplate,
  Direction,
} from "./types";

const delay = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

const TEMPLATES: Record<string, ConnectorTemplate> = {
  rest: {
    type: "rest",
    label: "REST HTTP Client",
    description: "Встроенный HTTP-клиент для REST API",
    builtin: true,
    direction: "Duplex",
    params: {
      base_url: {
        description: "Базовый URL сервиса",
        data_type: "uri",
        required: true,
        order: 1,
      },
      timeout_sec: {
        description: "Таймаут запроса, секунды",
        data_type: "integer",
        required: false,
        default: 30,
        min: 1,
        max: 300,
        order: 2,
      },
      auth_type: {
        description: "Тип авторизации",
        data_type: "choice",
        required: false,
        default: "none",
        choices: ["none", "basic", "bearer", "api_key"],
        order: 3,
      },
      auth_token: {
        description: "Токен или пароль",
        data_type: "secret",
        required: false,
        order: 4,
      },
    },
  },
  rest_server: {
    type: "rest_server",
    label: "REST Server (HTTP listener)",
    description: "Входящий HTTP-эндпоинт на Lua",
    builtin: true,
    direction: "Duplex",
    params: {
      lua_script: {
        description: "Lua-скрипт-обработчик",
        data_type: "string",
        required: true,
        order: 1,
      },
      allowed_methods: {
        description: "Разрешённые методы (через запятую)",
        data_type: "string",
        required: false,
        order: 2,
      },
      timeout_sec: {
        description: "Таймаут, секунды",
        data_type: "integer",
        required: false,
        default: 30,
        min: 1,
        max: 300,
        order: 3,
      },
      mode: {
        description: "Режим исполнения Lua",
        data_type: "choice",
        required: false,
        default: "sandboxed",
        choices: ["sandboxed", "admin"],
        order: 4,
      },
    },
  },
  sql: {
    type: "sql",
    label: "SQL Database",
    description: "Подключение к реляционной БД",
    builtin: false,
    direction: "Duplex",
    params: {
      driver: {
        description: "Драйвер",
        data_type: "choice",
        required: true,
        default: "postgres",
        choices: ["postgres", "mysql"],
        order: 1,
      },
      host: {
        description: "Хост",
        data_type: "hostname",
        required: true,
        order: 2,
      },
      port: {
        description: "Порт",
        data_type: "integer",
        required: true,
        default: 5432,
        min: 1,
        max: 65535,
        order: 3,
      },
      database: {
        description: "База данных",
        data_type: "string",
        required: true,
        order: 4,
      },
      user: {
        description: "Пользователь",
        data_type: "string",
        required: true,
        order: 5,
      },
      password: {
        description: "Пароль",
        data_type: "secret",
        required: true,
        order: 6,
      },
      pool_size: {
        description: "Размер пула соединений",
        data_type: "integer",
        required: false,
        default: 10,
        min: 1,
        max: 100,
        order: 7,
      },
      max_lifetime: {
        description: "Время жизни соединения (30s, 5m, 2h)",
        data_type: "duration",
        required: false,
        default: "30m",
        order: 8,
      },
    },
  },
  redb: {
    type: "redb",
    label: "REDB Storage",
    description: "Встроенное key-value хранилище",
    builtin: false,
    direction: "Duplex",
    params: {
      path: {
        description: "Путь к файлу БД",
        data_type: "string",
        required: true,
        order: 1,
      },
      read_only: {
        description: "Только чтение",
        data_type: "boolean",
        required: false,
        default: false,
        order: 2,
      },
    },
  },
};

const INITIAL_INSTANCES: ConnectorInstance[] = [
  {
    name: "rest_api",
    type: "rest",
    enabled: true,
    description: "Основной REST API",
    direction: "Duplex",
    tags: ["api", "prod"],
    metadata: { folder: "prod" },
    params: {
      base_url: "https://api.example.com",
      timeout_sec: 30,
      auth_type: "bearer",
      auth_token: "tok_live_xxx",
    },
  },
  {
    name: "rest_server_main",
    type: "rest_server",
    enabled: true,
    description: "Входящий HTTP-эндпоинт",
    direction: "Duplex",
    tags: ["api"],
    metadata: { folder: "prod/api" },
    params: {
      lua_script: "handler.lua",
      allowed_methods: "GET,POST",
      timeout_sec: 30,
      mode: "sandboxed",
    },
  },
  {
    name: "main_db",
    type: "sql",
    enabled: true,
    description: "Основная БД",
    direction: "Source",
    tags: ["prod", "db"],
    metadata: { folder: "prod" },
    params: {
      driver: "postgres",
      host: "db.local",
      port: 5432,
      database: "app",
      user: "app",
      password: "secret",
      pool_size: 10,
      max_lifetime: "30m",
    },
  },
  {
    name: "cache_redb",
    type: "redb",
    enabled: false,
    description: "Кэш на redb",
    direction: "Duplex",
    tags: ["cache"],
    metadata: { folder: "dev" },
    params: {
      path: "/var/cache/cf.redb",
      read_only: false,
    },
  },
];

interface MockState {
  items: ConnectorInstance[];
  folders: Set<string>;
}

function computeStatus(s: MockState): ConnectorStatus {
  const enabled = s.items.filter((c) => c.enabled).length;
  return {
    total_connectors: s.items.length,
    enabled_connectors: enabled,
    disabled_connectors: s.items.length - enabled,
  };
}

function clone(c: ConnectorInstance): ConnectorInstance {
  return {
    ...c,
    params: { ...c.params },
    tags: c.tags ? [...c.tags] : undefined,
    metadata: c.metadata ? { ...c.metadata } : undefined,
  };
}

export function createMockConnectorsApi(): ConnectorsApi {
  const state: MockState = {
    items: INITIAL_INSTANCES.map(clone),
    folders: new Set(["prod", "prod/api", "dev"]),
  };

  return {
    async listTemplates() {
      await delay(150);
      return Object.values(TEMPLATES).map((t) => ({ ...t }));
    },

    async list() {
      await delay(200);
      return state.items.map(clone);
    },

    async status() {
      await delay(100);
      return computeStatus(state);
    },

    async reload() {
      await delay(300);
    },

    async create(input: ConnectorInput) {
      await delay(300);
      if (state.items.some((c) => c.name === input.name)) {
        throw new Error("Коннектор с таким именем уже существует");
      }
      const created: ConnectorInstance = {
        name: input.name,
        type: input.type,
        enabled: input.enabled,
        description: input.description,
        direction: input.direction as Direction,
        params: { ...input.params },
        tags: input.tags,
        metadata: input.metadata ? { ...input.metadata } : undefined,
      };
      state.items.push(created);
      return clone(created);
    },

    async update(name: string, input: ConnectorInput) {
      await delay(300);
      const idx = state.items.findIndex((c) => c.name === name);
      if (idx < 0) throw new Error("Коннектор не найден");
      if (
        name !== input.name &&
        state.items.some((c) => c.name === input.name)
      ) {
        throw new Error("Коннектор с таким именем уже существует");
      }
      const prev = state.items[idx];
      const updated: ConnectorInstance = {
        name: input.name,
        type: input.type,
        enabled: input.enabled,
        description: input.description,
        direction: input.direction as Direction,
        params: { ...input.params },
        tags: input.tags,
        metadata: input.metadata
          ? { ...input.metadata }
          : prev.metadata
            ? { ...prev.metadata }
            : undefined,
      };
      state.items[idx] = updated;
      return clone(updated);
    },

    async remove(name: string) {
      await delay(250);
      const idx = state.items.findIndex((c) => c.name === name);
      if (idx < 0) throw new Error("Коннектор не найден");
      state.items.splice(idx, 1);
    },

    async test(name: string) {
      await delay(600);
      const item = state.items.find((c) => c.name === name);
      if (!item) throw new Error("Коннектор не найден");
      if (item.name === "cache_redb") {
        throw new Error("Не удалось подключиться: файл БД не найден");
      }
      if (item.type === "sql" && !item.params.password) {
        throw new Error("Не удалось подключиться: отсутствует пароль");
      }
    },

    async listFolders() {
      await delay(100);
      return Array.from(state.folders).sort();
    },

    async saveFolders(paths: string[]) {
      await delay(100);
      state.folders.clear();
      for (const p of paths) {
        const trimmed = p.trim().replace(/\/+$/, "");
        if (trimmed) state.folders.add(trimmed);
      }
    },
  };
}