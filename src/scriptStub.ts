// Заглушка "DAP-клиента".
// В реальной версии здесь будет WebSocket-клиент, отправляющий/принимающий
// сообщения по Debug Adapter Protocol. Сейчас — только состояние UI.

export interface ScriptFileNode {
  type: "folder" | "file";
  path: string;
  name: string;
  children?: ScriptFileNode[];
}

export type DebugStatus = "idle" | "running" | "paused";

export interface DebugState {
  status: DebugStatus;
  currentFile: string | null;
  currentLine: number | null;
}

export interface StackFrame {
  id: number;
  name: string;
  file: string;
  line: number;
}

export type OutputKind = "log" | "info" | "error" | "warn";

export interface OutputMessage {
  id: number;
  kind: OutputKind;
  time: string;
  text: string;
}

export interface Variable {
  name: string;
  value: string;
  type: string;
  children?: Variable[];
}

// --- Стаб-данные ---
export const STUB_FILES: ScriptFileNode[] = [
  {
    type: "folder",
    path: "/scripts",
    name: "scripts",
    children: [
      { type: "file", path: "/scripts/main.lua", name: "main.lua" },
      {
        type: "folder",
        path: "/scripts/lib",
        name: "lib",
        children: [
          { type: "file", path: "/scripts/lib/utils.lua", name: "utils.lua" },
          { type: "file", path: "/scripts/lib/helpers.lua", name: "helpers.lua" },
        ],
      },
      {
        type: "folder",
        path: "/scripts/config",
        name: "config",
        children: [
          { type: "file", path: "/scripts/config/settings.lua", name: "settings.lua" },
        ],
      },
    ],
  },
];

const FILE_CONTENTS: Record<string, string> = {
  "/scripts/main.lua": `-- main.lua
local utils = require("lib.utils")
local helpers = require("lib.helpers")

local function main()
    print("Hello from main")
    local result = utils.compute(42)
    helpers.log("Result: " .. tostring(result))
    return result
end

main()
`,
  "/scripts/lib/utils.lua": `-- utils.lua
local M = {}

function M.compute(x)
    if x == nil then
        error("x is nil")
    end
    return x * 2
end

return M
`,
  "/scripts/lib/helpers.lua": `-- helpers.lua
local M = {}

function M.log(msg)
    print("[LOG] " .. tostring(msg))
end

return M
`,
  "/scripts/config/settings.lua": `-- settings.lua
return {
    host = "localhost",
    port = 8080,
    debug = true,
}
`,
};

export function getFileContent(path: string): string {
  return FILE_CONTENTS[path] ?? "-- empty file\n";
}

export const STUB_STACK_FRAMES: StackFrame[] = [
  { id: 0, name: "main", file: "/scripts/main.lua", line: 7 },
  { id: 1, name: "compute", file: "/scripts/lib/utils.lua", line: 4 },
  { id: 2, name: "log", file: "/scripts/lib/helpers.lua", line: 4 },
];

export const STUB_MESSAGES: OutputMessage[] = [
  { id: 1, kind: "info", time: "12:00:01", text: "Debug session started" },
  { id: 2, kind: "log", time: "12:00:02", text: "Hello from main" },
  { id: 3, kind: "warn", time: "12:00:03", text: "Deprecated API used" },
  { id: 4, kind: "error", time: "12:00:04", text: "Attempt to index a nil value (local 'x')" },
];

export const STUB_VARIABLES: Variable[] = [
  { name: "x", value: "42", type: "number" },
  { name: "result", value: "84", type: "number" },
  { name: "msg", value: '"hello"', type: "string" },
  {
    name: "config",
    value: "{...}",
    type: "table",
    children: [
      { name: "host", value: '"localhost"', type: "string" },
      { name: "port", value: "8080", type: "number" },
      { name: "debug", value: "true", type: "boolean" },
    ],
  },
];

// --- "DAP-клиент" (заглушка) ---
type Listener = (state: DebugState) => void;

class StubDapClient {
  private state: DebugState = {
    status: "idle",
    currentFile: null,
    currentLine: null,
  };
  private listeners = new Set<Listener>();

  getState(): DebugState {
    return this.state;
  }

  subscribe(fn: Listener): () => void {
    this.listeners.add(fn);
    fn(this.state);
    return () => {
      this.listeners.delete(fn);
    };
  }

  private set(patch: Partial<DebugState>) {
    this.state = { ...this.state, ...patch };
    this.listeners.forEach((fn) => fn(this.state));
  }

  run() {
    console.log("[stub dap] run");
    this.set({ status: "running" });
  }
  stop() {
    console.log("[stub dap] stop");
    this.set({ status: "idle", currentFile: null, currentLine: null });
  }
  pause() {
    if (this.state.status !== "running") return;
    console.log("[stub dap] pause");
    this.set({ status: "paused" });
  }
  continue() {
    if (this.state.status !== "paused") return;
    console.log("[stub dap] continue");
    this.set({ status: "running" });
  }
  stepOver() {
    console.log("[stub dap] step over");
  }
  stepIn() {
    console.log("[stub dap] step in");
  }
  stepOut() {
    console.log("[stub dap] step out");
  }
  restart() {
    console.log("[stub dap] restart");
    this.set({ status: "running", currentFile: null, currentLine: null });
  }
}

export const stubDap = new StubDapClient();