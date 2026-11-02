import type { AxiosError } from "axios";
import { createApiClient } from "../../api/http";
import type { CodeTreeNode } from "./types";
import { getMockCodeTree } from "./mockApi";

const ADMIN_PREFIX = "/admin";
const CODE_ALL = `${ADMIN_PREFIX}/code/all`;

function normalizeError(err: unknown): Error {
  const ax = err as AxiosError<{ error?: string }>;
  if (ax?.isAxiosError) {
    const serverMsg = ax.response?.data?.error;
    return new Error(serverMsg ?? ax.message);
  }
  return err instanceof Error ? err : new Error(String(err));
}

function normalizeTreeNode(raw: unknown): CodeTreeNode | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;

  const name = typeof o.name === "string" ? o.name : "";
  const rawPath = typeof o.path === "string" ? o.path : "";
  const path = rawPath || name;

  const childrenRaw = o.children;
  const children = Array.isArray(childrenRaw)
    ? (childrenRaw
        .map(normalizeTreeNode)
        .filter((x): x is CodeTreeNode => x !== null))
    : undefined;

  const hasChildren = !!children && children.length > 0;
  const isFolderExplicit =
    o.type === "folder" ||
    o.type === "directory" ||
    o.type === "dir" ||
    o.type === "root";

  const type: CodeTreeNode["type"] =
    isFolderExplicit || hasChildren ? "folder" : "file";

  if (!name && !path) return null;
  return { name, path, type, children };
}

function pathsToTree(paths: string[]): CodeTreeNode[] {
  const root: CodeTreeNode = {
    name: "",
    path: "",
    type: "folder",
    children: [],
  };

  for (const raw of paths) {
    const clean = raw.replace(/^\/+|\/+$/g, "");
    if (!clean) continue;
    const parts = clean.split("/");
    let current = root;

    for (let i = 0; i < parts.length; i++) {
      const seg = parts[i];
      const isLast = i === parts.length - 1;
      const path = parts.slice(0, i + 1).join("/");

      let next = current.children?.find((c) => c.name === seg);
      if (!next) {
        next = {
          name: seg,
          path,
          type: isLast ? "file" : "folder",
          children: isLast ? undefined : [],
        };
        current.children!.push(next);
      }
      current = next;
    }
  }

  const sortRec = (list: CodeTreeNode[]) => {
    list.sort((a, b) => {
      if (a.type !== b.type) return a.type === "folder" ? -1 : 1;
      return a.name.localeCompare(b.name);
    });
    list.forEach((n) => n.children && sortRec(n.children));
  };
  if (root.children) sortRec(root.children);

  return root.children ?? [];
}

function unwrapScriptTree(data: unknown): CodeTreeNode[] {
  if (Array.isArray(data)) {
    const nodes = data
      .map(normalizeTreeNode)
      .filter((x): x is CodeTreeNode => x !== null);
    if (nodes.length > 0) return nodes;

    const paths = data.filter((x): x is string => typeof x === "string");
    if (paths.length > 0) return pathsToTree(paths);
    return [];
  }

  if (data && typeof data === "object") {
    const o = data as Record<string, unknown>;

    for (const key of ["tree", "files", "nodes", "items", "data"]) {
      const v = o[key];
      if (Array.isArray(v)) {
        const nodes = v
          .map(normalizeTreeNode)
          .filter((x): x is CodeTreeNode => x !== null);
        if (nodes.length > 0) return nodes;
        const strs = v.filter((x): x is string => typeof x === "string");
        if (strs.length > 0) return pathsToTree(strs);
      }
    }

    const root = normalizeTreeNode(data);
    if (root) return [root];

    if (Array.isArray(o.children)) {
      return unwrapScriptTree(o.children);
    }
  }

  return [];
}

export function createCodeApi(baseUrl: string) {
  const client = createApiClient(baseUrl);

  return {
    /** GET /admin/code/all → дерево файлов. */
    async listTree(signal?: AbortSignal): Promise<CodeTreeNode[]> {
      try {
        const res = await client.get<unknown>(CODE_ALL, { signal });
        return unwrapScriptTree(res.data);
      } catch (e) {
        throw normalizeError(e);
      }
    },

    /**
     * GET /admin/code/:filename — содержимое файла.
     * Сервер (utoipa `get_code_handler`) отдаёт raw text,
     * поэтому `responseType: "text"`.
     */
    async getFile(
      filename: string,
      signal?: AbortSignal,
    ): Promise<string> {
      try {
        const res = await client.get<unknown>(
          `${ADMIN_PREFIX}/code/${encodeURIComponent(filename)}`,
          { signal, responseType: "text" },
        );
        return typeof res.data === "string"
          ? res.data
          : String(res.data ?? "");
      } catch (e) {
        throw normalizeError(e);
      }
    },

    /**
     * POST /admin/code/:filename — сохранить содержимое.
     * Тело — raw text (`Content-Type: text/plain`).
     * Если бэкенд ждёт JSON-строку, поменять на
     * `client.post(url, JSON.stringify(content))` без явного заголовка.
     */
    async saveFile(filename: string, content: string): Promise<void> {
      try {
        await client.post(
          `${ADMIN_PREFIX}/code/${encodeURIComponent(filename)}`,
          content,
          { headers: { "Content-Type": "text/plain; charset=utf-8" } },
        );
      } catch (e) {
        throw normalizeError(e);
      }
    },

    /** DELETE /admin/code/:filename. */
    async deleteFile(filename: string): Promise<void> {
      try {
        await client.delete(
          `${ADMIN_PREFIX}/code/${encodeURIComponent(filename)}`,
        );
      } catch (e) {
        throw normalizeError(e);
      }
    },
  };
}

export type CodeApi = ReturnType<typeof createCodeApi>;

/* ------------------------------------------------------------------ */
/*  Синглтоны для дерева (кэш + дедупликация)                          */
/* ------------------------------------------------------------------ */

const treeCache = new Map<string, CodeTreeNode[]>();
const inflight = new Map<string, Promise<CodeTreeNode[]>>();

function isMock(baseUrl: string): boolean {
  return baseUrl.startsWith("mock://");
}

export function hasCachedCodeTree(baseUrl: string): boolean {
  return treeCache.has(baseUrl);
}

export function getCachedCodeTree(baseUrl: string): CodeTreeNode[] | null {
  return treeCache.get(baseUrl) ?? null;
}

export async function loadCodeTree(
  baseUrl: string,
  opts: { force?: boolean } = {},
): Promise<CodeTreeNode[]> {
  if (isMock(baseUrl)) {
    const data = getMockCodeTree();
    treeCache.set(baseUrl, data);
    return data;
  }

  const pending = inflight.get(baseUrl);
  if (pending) return pending;

  if (!opts.force) {
    const cached = treeCache.get(baseUrl);
    if (cached) return cached;
  }

  const api = createCodeApi(baseUrl);
  const promise = api
    .listTree()
    .then((tree) => {
      treeCache.set(baseUrl, tree);
      inflight.delete(baseUrl);
      return tree;
    })
    .catch((e) => {
      inflight.delete(baseUrl);
      throw e;
    });

  inflight.set(baseUrl, promise);
  return promise;
}

export function invalidateCodeTree(baseUrl?: string): void {
  if (baseUrl) treeCache.delete(baseUrl);
  else treeCache.clear();
}

/* ------------------------------------------------------------------ */
/*  Синглтон-клиентов для операций с файлами                           */
/* ------------------------------------------------------------------ */

const clients = new Map<string, CodeApi>();

function getClient(baseUrl: string): CodeApi {
  let c = clients.get(baseUrl);
  if (!c) {
    c = createCodeApi(baseUrl);
    clients.set(baseUrl, c);
  }
  return c;
}

export function getCodeFile(
  baseUrl: string,
  filename: string,
  signal?: AbortSignal,
): Promise<string> {
  if (isMock(baseUrl)) {
    return Promise.resolve(mockFileContent(filename));
  }
  return getClient(baseUrl).getFile(filename, signal);
}

export function saveCodeFile(
  baseUrl: string,
  filename: string,
  content: string,
): Promise<void> {
  if (isMock(baseUrl)) {
    // Мок: просто сообщаем, что сохранили.
    return Promise.resolve();
  }
  return getClient(baseUrl).saveFile(filename, content);
}

export function deleteCodeFile(
  baseUrl: string,
  filename: string,
): Promise<void> {
  if (isMock(baseUrl)) return Promise.resolve();
  return getClient(baseUrl).deleteFile(filename);
}

function mockFileContent(filename: string): string {
  const name = filename.split("/").pop() ?? filename;
  return `-- ${name}\n-- (mock)\n\nlocal function main()\n  print("hello from ${name}")\nend\n\nreturn main\n`;
}