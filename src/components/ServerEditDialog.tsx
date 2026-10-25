import { useEffect, useMemo, useState } from "react";
import { NodeId, ServerNode } from "../types";
import { findNode, isDescendant, isServer, listFolders } from "../treeUtils";

export interface ServerEditDraft {
  kind: "folder" | "server";
  name: string;
  parentId: NodeId | null;
  url: string;
  port: number;
}

interface Props {
  servers: ServerNode[];
  mode: "add" | "edit";
  initial: ServerEditDraft;
  editingId: NodeId | null;
  onSave: (draft: ServerEditDraft) => void;
  onCancel: () => void;
}

export function ServerEditDialog({
  servers,
  mode,
  initial,
  editingId,
  onSave,
  onCancel,
}: Props) {
  const [draft, setDraft] = useState<ServerEditDraft>(initial);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => setDraft(initial), [initial]);

  const parentOptions = useMemo(() => {
    return listFolders(servers).filter((f) => {
      if (!editingId) return true;
      if (f.id === editingId) return false;
      return !isDescendant(servers, editingId, f.id);
    });
  }, [servers, editingId]);

  const siblings: ServerNode[] = useMemo(() => {
    if (draft.parentId === null) return servers;
    const parent = findNode(servers, draft.parentId);
    return parent && !isServer(parent) ? parent.children : [];
  }, [servers, draft.parentId]);

  const submit = () => {
    setError(null);
    const name = draft.name.trim();
    if (!name) {
      setError("Имя не может быть пустым");
      return;
    }
    if (
      siblings.some(
        (s) => s.name.toLowerCase() === name.toLowerCase() && s.id !== editingId,
      )
    ) {
      setError("Имя уже используется в этом родителе");
      return;
    }
    if (draft.kind === "server") {
      if (!draft.url.trim()) {
        setError("URL не может быть пустым");
        return;
      }
      if (!Number.isInteger(draft.port) || draft.port < 1 || draft.port > 65535) {
        setError("Порт должен быть целым числом от 1 до 65535");
        return;
      }
    }
    onSave({ ...draft, name });
  };

  return (
    <div className="dialog-backdrop">
      <div className="dialog" role="dialog" aria-modal="true">
        <h3>{mode === "add" ? "Добавить" : "Изменить"}</h3>

        <label className="dialog-row">
          <span>Тип</span>
          <select
            value={draft.kind}
            disabled={mode === "edit"}
            onChange={(e) =>
              setDraft({ ...draft, kind: e.target.value as "folder" | "server" })
            }
          >
            <option value="server">Сервер</option>
            <option value="folder">Папка</option>
          </select>
        </label>

        <label className="dialog-row">
          <span>Имя</span>
          <input
            value={draft.name}
            onChange={(e) => setDraft({ ...draft, name: e.target.value })}
            autoFocus
          />
        </label>

        <label className="dialog-row">
          <span>Родитель</span>
          <select
            value={draft.parentId ?? ""}
            onChange={(e) =>
              setDraft({
                ...draft,
                parentId: e.target.value === "" ? null : e.target.value,
              })
            }
          >
            <option value="">— Корень —</option>
            {parentOptions.map((f) => (
              <option key={f.id} value={f.id}>
                {"\u00A0".repeat(f.depth * 2) + f.name}
              </option>
            ))}
          </select>
        </label>

        {draft.kind === "server" && (
          <>
            <label className="dialog-row">
              <span>URL</span>
              <input
                value={draft.url}
                onChange={(e) => setDraft({ ...draft, url: e.target.value })}
              />
            </label>
            <label className="dialog-row">
              <span>Порт</span>
              <input
                type="number"
                value={draft.port}
                min={1}
                max={65535}
                onChange={(e) =>
                  setDraft({ ...draft, port: Number(e.target.value) })
                }
              />
            </label>
          </>
        )}

        {error && <div className="dialog-error">{error}</div>}

        <div className="dialog-actions">
          <button onClick={onCancel}>Отмена</button>
          <button className="primary" onClick={submit}>
            {mode === "add" ? "Добавить" : "Сохранить"}
          </button>
        </div>
      </div>
    </div>
  );
}