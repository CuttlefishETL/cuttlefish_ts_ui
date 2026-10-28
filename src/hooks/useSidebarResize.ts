import { useEffect, useState } from "react";

const MIN_WIDTH = 160;
const MAX_WIDTH = 600;
const DEFAULT_WIDTH = 260;
const STORAGE_KEY = "sidebar-width";

function loadSidebarWidth(): number {
  const raw = localStorage.getItem(STORAGE_KEY);
  const num = raw ? Number(raw) : NaN;
  if (Number.isFinite(num)) {
    return Math.min(Math.max(num, MIN_WIDTH), MAX_WIDTH);
  }
  return DEFAULT_WIDTH;
}

export interface UseSidebarResizeResult {
  sidebarWidth: number;
  isResizing: boolean;
  startResize: () => void;
}

export function useSidebarResize(): UseSidebarResizeResult {
  const [sidebarWidth, setSidebarWidth] = useState<number>(loadSidebarWidth);
  const [isResizing, setIsResizing] = useState(false);

  useEffect(() => {
    if (!isResizing) return;

    const onMove = (e: MouseEvent) => {
      setSidebarWidth(Math.min(Math.max(e.clientX, MIN_WIDTH), MAX_WIDTH));
    };
    const onUp = () => setIsResizing(false);

    document.addEventListener("mousemove", onMove);
    document.addEventListener("mouseup", onUp);

    const prevCursor = document.body.style.cursor;
    const prevSelect = document.body.style.userSelect;
    document.body.style.cursor = "col-resize";
    document.body.style.userSelect = "none";

    return () => {
      document.removeEventListener("mousemove", onMove);
      document.removeEventListener("mouseup", onUp);
      document.body.style.cursor = prevCursor;
      document.body.style.userSelect = prevSelect;
    };
  }, [isResizing]);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, String(sidebarWidth));
  }, [sidebarWidth]);

  const startResize = () => setIsResizing(true);

  return { sidebarWidth, isResizing, startResize };
}