import type { CronApi } from "./api";
import type { CronEntry } from "./types";

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
    section: "maintenance/cleanup",
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

interface MockState {
  items: CronEntry[];
  sections: Set<string>;
}

export function createMockCronApi(): CronApi {
  const state: MockState = {
    items: INITIAL.map((e) => ({ ...e })),
    sections: new Set([
      "stats",
      "maintenance",
      "maintenance/cleanup",
      "ingest",
      "empty",
    ]),
  };

  return {
    async list() {
      await delay(180);
      return state.items.map((e) => ({ ...e }));
    },

    async create(input) {
      await delay(250);
      if (state.items.some((e) => e.name === input.name)) {
        throw new Error("Задача с таким именем уже существует");
      }
      state.items.push({ ...input });
      if (input.section) {
        const parts = input.section.split("/").filter(Boolean);
        for (let i = 1; i <= parts.length; i++) {
          state.sections.add(parts.slice(0, i).join("/"));
        }
      }
      return { ...input };
    },

    async update(oldName, input) {
      await delay(250);
      const idx = state.items.findIndex((e) => e.name === oldName);
      if (idx < 0) throw new Error("Задача не найдена");
      if (
        oldName !== input.name &&
        state.items.some((e) => e.name === input.name)
      ) {
        throw new Error("Задача с таким именем уже существует");
      }
      state.items[idx] = { ...input };
      if (input.section) {
        const parts = input.section.split("/").filter(Boolean);
        for (let i = 1; i <= parts.length; i++) {
          state.sections.add(parts.slice(0, i).join("/"));
        }
      }
      return { ...input };
    },

    async remove(name) {
      await delay(200);
      const idx = state.items.findIndex((e) => e.name === name);
      if (idx < 0) throw new Error("Задача не найдена");
      state.items.splice(idx, 1);
      return { success: true };
    },

    async listSections() {
      await delay(100);
      return Array.from(state.sections).sort();
    },

    async saveSections(paths) {
      await delay(100);
      state.sections.clear();
      for (const p of paths) {
        const trimmed = p.trim().replace(/\/+$/, "");
        if (trimmed) state.sections.add(trimmed);
      }
    },
  };
}