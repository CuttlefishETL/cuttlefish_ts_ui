import { useState } from "react";
import type { Server } from "../../types";
import { checkConnection } from "../../checkConnection";

interface SettingsTabProps {
  server: Server;
  readonly: boolean;
  onChange: (patch: Partial<Server>) => void;
  onSave: () => void;
  onEdit: () => void;
}

interface LocalResult {
  ok: boolean;
  message: string;
}

export function SettingsTab({
  server,
  readonly,
  onChange,
  onSave,
  onEdit,
}: SettingsTabProps) {
  const [checking, setChecking] = useState(false);
  const [result, setResult] = useState<LocalResult | null>(null);

  const handleCheck = async () => {
    setChecking(true);
    setResult(null);
    try {
      const res = await checkConnection(server.url, server.port);
      setResult({ ok: res.status === "ok", message: res.message });
    } finally {
      setChecking(false);
    }
  };

  const handleSave = () => {
    setResult(null);
    onSave();
  };

  const handleEdit = () => {
    setResult(null);
    onEdit();
  };

  return (
    <div className="settings-tab">
      <div className="settings-toolbar">
        {readonly ? (
          <button type="button" className="btn" onClick={handleEdit}>
            Редактировать
          </button>
        ) : (
          <button type="button" className="btn primary" onClick={handleSave}>
            Записать
          </button>
        )}
        <button
          type="button"
          className="btn"
          onClick={handleCheck}
          disabled={checking}
        >
          {checking ? "Проверка..." : "Проверить соединение"}
        </button>
      </div>

      {result && (
        <div className={`check-result ${result.ok ? "ok" : "err"}`}>
          {result.message}
        </div>
      )}

      <div className="settings-form">
        <div className="field">
          <label htmlFor="f-name">Наименование</label>
          <input
            id="f-name"
            value={server.name}
            readOnly={readonly}
            onChange={(e) => onChange({ name: e.target.value })}
          />
        </div>
        <div className="field">
          <label htmlFor="f-url">URL</label>
          <input
            id="f-url"
            value={server.url}
            readOnly={readonly}
            onChange={(e) => onChange({ url: e.target.value })}
          />
        </div>
        <div className="field">
          <label htmlFor="f-port">Порт</label>
          <input
            id="f-port"
            type="number"
            value={server.port}
            readOnly={readonly}
            onChange={(e) => onChange({ port: Number(e.target.value) || 0 })}
          />
        </div>
      </div>
    </div>
  );
}