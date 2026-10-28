import { useCallback, useEffect, useRef, useState } from "react";
import { getCurrentWindow } from "@tauri-apps/api/window";

export interface UseWindowCloseResult {
  pendingClose: boolean;
  confirmClose: () => Promise<void>;
  cancelClose: () => void;
  exit: () => Promise<void>;
}

export function useWindowClose(isDirty: boolean): UseWindowCloseResult {
  const [pendingClose, setPendingClose] = useState(false);
  const bypassRef = useRef(false);
  const dirtyRef = useRef(isDirty);
  dirtyRef.current = isDirty;

  useEffect(() => {
    let unlisten: (() => void) | undefined;
    let cancelled = false;
    (async () => {
      try {
        const appWindow = getCurrentWindow();
        const fn = await appWindow.onCloseRequested(async (event) => {
          if (bypassRef.current) return;
          if (dirtyRef.current) {
            event.preventDefault();
            setPendingClose(true);
          }
        });
        if (cancelled) fn();
        else unlisten = fn;
      } catch (err) {
        console.warn("Не удалось подписаться на закрытие окна:", err);
      }
    })();
    return () => {
      cancelled = true;
      unlisten?.();
    };
  }, []);

  const confirmClose = useCallback(async () => {
    setPendingClose(false);
    bypassRef.current = true;
    try {
      await getCurrentWindow().destroy();
    } catch (err) {
      console.error("Ошибка закрытия окна:", err);
      bypassRef.current = false;
    }
  }, []);

  const cancelClose = useCallback(() => setPendingClose(false), []);

  const exit = useCallback(async () => {
    if (dirtyRef.current) {
      setPendingClose(true);
      return;
    }
    try {
      await getCurrentWindow().destroy();
    } catch (err) {
      console.error("Ошибка выхода из программы:", err);
    }
  }, []);

  return { pendingClose, confirmClose, cancelClose, exit };
}