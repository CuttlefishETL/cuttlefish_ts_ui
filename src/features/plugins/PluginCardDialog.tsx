import { useEffect, useState } from "react";
import type { PluginsApi } from "./api";
import type { PluginMetadata } from "./types";

interface Props {
  api: PluginsApi;
  pluginId: string;
  onClose: () => void;
}

export function PluginCardDialog({ api, pluginId, onClose }: Props) {
  const [meta, setMeta] = useState<PluginMetadata | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    api
      .one(pluginId)
      .then((m) => alive && setMeta(m))
      .catch((e) => alive && setError((e as Error).message));
    return () => {
      alive = false;
    };
  }, [api, pluginId]);

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal plugins-card-modal" onClick={(e) => e.stopPropagation()}>
        <h3>Карточка плагина</h3>
        {error && <p className="plugins-error">{error}</p>}
        {!meta && !error && <p>Загрузка…</p>}
        {meta && (
          <table className="plugins-card">
            <tbody>
              <tr><td>Автор</td><td>{meta.author ?? "—"}</td></tr>
              <tr><td>Создан</td><td>{meta.created ?? "—"}</td></tr>
              <tr><td>Описание</td><td>{meta.description ?? "—"}</td></tr>
              <tr><td>Включён</td><td>{meta.enabled ? "да" : "нет"}</td></tr>
              <tr><td>Файл</td><td>{meta.filename}</td></tr>
              <tr><td>Имя</td><td>{meta.name}</td></tr>
              <tr><td>Примечание</td><td>{meta.note ?? "—"}</td></tr>
              <tr><td>Версия</td><td>{meta.version}</td></tr>
            </tbody>
          </table>
        )}
        <div className="modal-actions">
          <button className="btn" onClick={onClose}>Закрыть</button>
        </div>
      </div>
    </div>
  );
}