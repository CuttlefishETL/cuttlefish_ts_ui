import type { CodeTreeNode } from "./types";

export const MOCK_CODE_TREE: CodeTreeNode[] = [
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

export function getMockCodeTree(): CodeTreeNode[] {
  // Глубокая копия, чтобы вызывающий не мог случайно мутировать константу.
  return JSON.parse(JSON.stringify(MOCK_CODE_TREE)) as CodeTreeNode[];
}
