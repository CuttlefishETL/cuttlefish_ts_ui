import { useEffect, useState } from "react";

interface AuthDialogProps {
  open: boolean;
  serverName: string;
  onSubmit: (username: string, password: string) => void;
  onCancel: () => void;
}

export function AuthDialog({
  open,
  serverName,
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
      if (e.key === "Escape") onCancel();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onCancel]);

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
      // TODO: реальная авторизация через invoke("authenticate", ...)
      await new Promise((r) => setTimeout(r, 400));
      onSubmit(username, password);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="modal-backdrop" onMouseDown={onCancel}>
      <form
        className="modal"
        onMouseDown={(e) => e.stopPropagation()}
        onSubmit={handleSubmit}
      >
        <h3>Подключение к «{serverName}»</h3>
        <p>Введите учётные данные для подключения.</p>

        <div className="field">
          <label htmlFor="auth-user">Имя пользователя</label>
          <input
            id="auth-user"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            autoFocus
            disabled={busy}
          />
        </div>

        <div className="field">
          <label htmlFor="auth-pass">Пароль</label>
          <input
            id="auth-pass"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            disabled={busy}
          />
        </div>

        {error && <div className="check-result err">{error}</div>}

        <div className="modal-actions">
          <button
            type="button"
            className="btn"
            onClick={onCancel}
            disabled={busy}
          >
            Отмена
          </button>
          <button type="submit" className="btn primary" disabled={busy}>
            {busy ? "Подключение..." : "Подключиться"}
          </button>
        </div>
      </form>
    </div>
  );
}