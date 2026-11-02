import { useEffect, useState } from "react";
import { login } from "../api/auth";
import { buildBaseUrl } from "../checkConnection";

interface AuthDialogProps {
  open: boolean;
  serverName: string;
  serverUrl: string;
  serverPort: number;
  onSubmit: (username: string, password: string) => void;
  onCancel: () => void;
}

export function AuthDialog({
  open,
  serverName,
  serverUrl,
  serverPort,
  onSubmit,
  onCancel,
}: AuthDialogProps) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (open) {
      setUsername("");
      setPassword("");
      setError("");
      setBusy(false);
    }
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !busy) onCancel();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, busy, onCancel]);

  if (!open) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (!username.trim() || !password.trim()) {
      setError("Введите имя пользователя и пароль");
      return;
    }

    setBusy(true);
    try {
      const baseUrl = buildBaseUrl(serverUrl, serverPort);
      await login(baseUrl, username, password);
      onSubmit(username, password);
    } catch (e) {
      const err = e as Error & { response?: { data?: { error?: string } } };
      setError(
        err.response?.data?.error ?? err.message ?? "Не удалось авторизоваться",
      );
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="modal-backdrop" onClick={busy ? undefined : onCancel}>
      <form
        className="modal"
        onClick={(e) => e.stopPropagation()}
        onSubmit={handleSubmit}
      >
        <h3>Авторизация — {serverName}</h3>

        <div className="field">
          <label>Имя пользователя</label>
          <input
            type="text"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            autoFocus
            disabled={busy}
          />
        </div>

        <div className="field">
          <label>Пароль</label>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            disabled={busy}
          />
        </div>

        {error && <p className="error">{error}</p>}

        <div className="modal-actions">
          <button type="button" className="btn" onClick={onCancel} disabled={busy}>
            Отмена
          </button>
          <button type="submit" className="btn primary" disabled={busy}>
            {busy ? "Вход…" : "Войти"}
          </button>
        </div>
      </form>
    </div>
  );
}