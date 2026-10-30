import type { CronApi } from "./api";
import type { CodeTreeNode, CronEntry } from "./types";

const delay = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

const INITIAL: CronEntry[] = [
  {
    name: "daily_report",
    schedule: "0 0 6 * * *",
    script: "report.lua",
    uid: "admin",
    section: "stats",
    enabled: true,
    description: "Ежедневный отчёт в 6:00",
  },
  {
    name: "hourly_cleanup",
    schedule: "0 0 * * * *",
    script: "cleanup.lua",
    uid: "system",
    section: "maintenance",
    enabled: true,
    description: "Очистка временных файлов раз в час",
  },
  {
    name: "test_task",
    schedule: "0 30 3 * * *",
    script: "plugin_test.lua",
    uid: "admin",
    section: "maintenance",
    enabled: false,
    description: "Тестовая задача",
  },
  {
    name: "weekly_stats",
    schedule: "0 0 3 * * 1",
    script: "report.lua",
    uid: "admin",
    section: "stats",
    enabled: true,
    description: "Недельный отчёт по понедельникам",
  },
  {
    name: "transform_in",
    schedule: "*/10 * * * * *",
    script: "transform_in.lua",
    uid: "system",
    section: "ingest",
    enabled: true,
  },
];

const SCRIPT_TREE: CodeTreeNode[] = [
  {
    name: "lua",
    path: "lua",
    type: "folder",
    children: [
      {
        name: "connectors",
        path: "lua/connectors",
        type: "folder",
        children: [
          { name: "1_1.lua", path: "lua/connectors/1_1.lua", type: "file" },
          { name: "1_2.lua", path: "lua/connectors/1_2.lua", type: "file" },
        ],
      },
      {
        name: "cron",
        path: "lua/cron",
        type: "folder",
        children: [
          { name: "start.lua", path: "lua/cron/start.lua", type: "file" },
          { name: "cleanup.lua", path: "lua/cron/cleanup.lua", type: "file" },
        ],
      },
    ],
  },
  { name: "report.lua", path: "report.lua", type: "file" },
  { name: "plugin_test.lua", path: "plugin_test.lua", type: "file" },
  { name: "transform_in.lua", path: "transform_in.lua", type: "file" },
];

export function createMockCronApi(): CronApi {
  const items: CronEntry[] = INITIAL.map((e) => ({ ...e }));

  return {
    async list() {
      await delay(180);
      return items.map((e) => ({ ...e }));
    },
    async create(input) {
      await delay(250);
      if (items.some((e) => e.name === input.name)) {
        throw new Error("Задача с таким именем уже существует");
      }
      items.push({ ...input });
      return { ...input };
    },
    async update(oldName, input) {
      await delay(250);
      const idx = items.findIndex((e) => e.name === oldName);
      if (idx < 0) throw new Error("Задача не найдена");
      if (oldName !== input.name && items.some((e) => e.name === input.name)) {
        throw new Error("Задача с таким именем уже существует");
      }
      items[idx] = { ...input };
      return { ...input };
    },
    async remove(name) {
      await delay(200);
      const idx = items.findIndex((e) => e.name === name);
      if (idx < 0) throw new Error("Задача не найдена");
      items.splice(idx, 1);
    },
    async listScripts() {
      await delay(150);
      return SCRIPT_TREE;
    },
  };
}