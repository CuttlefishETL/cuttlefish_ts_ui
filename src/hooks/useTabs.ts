import { useCallback, useRef, useState } from "react";
import type { ServerNode, TabId } from "../types";
import { findNodeById } from "../treeUtils";

export interface UseTabsResult {
  openTabs: string[];
  activeTab: string | null;
  selectedId: string | null;
  activeSubTabs: Record<string, TabId>;
  activeSubTab: TabId;
  open: (id: string) => void;
  close: (id: string) => void;
  select: (id: string) => void;
  selectSub: (tabId: TabId) => void;
  handleSelectNode: (id: string) => void;
  removeMany: (ids: Set<string>) => void;
  reset: () => void;
  setLoaded: (firstId: string | null) => void;
}

export function useTabs(servers: ServerNode[]): UseTabsResult {
  const [openTabs, setOpenTabs] = useState<string[]>([]);
  const [activeTab, setActiveTab] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [activeSubTabs, setActiveSubTabs] = useState<Record<string, TabId>>({});

  const serversRef = useRef(servers);
  serversRef.current = servers;

  const activeSubTab: TabId = activeTab
    ? activeSubTabs[activeTab] ?? "settings"
    : "settings";

  const open = useCallback((id: string) => {
    setSelectedId(id);
    setOpenTabs((prev) => (prev.includes(id) ? prev : [...prev, id]));
    setActiveTab(id);
  }, []);

  const close = useCallback((id: string) => {
    setOpenTabs((prev) => {
      const next = prev.filter((x) => x !== id);
      setActiveTab((cur) => {
        if (cur !== id) return cur;
        return next.length > 0 ? next[next.length - 1] : null;
      });
      setSelectedId((cur) => (cur === id ? null : cur));
      return next;
    });
  }, []);

  const select = useCallback((id: string) => setActiveTab(id), []);

  const selectSub = useCallback((tabId: TabId) => {
    setActiveTab((cur) => {
      if (!cur) return cur;
      setActiveSubTabs((prev) => ({ ...prev, [cur]: tabId }));
      return cur;
    });
  }, []);

  const handleSelectNode = useCallback(
    (id: string) => {
      const node = findNodeById(serversRef.current, id);
      if (node && node.kind === "server") open(id);
      else setSelectedId(id);
    },
    [open],
  );

  const removeMany = useCallback((ids: Set<string>) => {
    setOpenTabs((prev) => {
      const next = prev.filter((x) => !ids.has(x));
      setActiveTab((cur) => {
        if (cur && ids.has(cur)) {
          return next.length > 0 ? next[next.length - 1] : null;
        }
        return cur;
      });
      setSelectedId((cur) => (cur && ids.has(cur) ? null : cur));
      return next;
    });
    setActiveSubTabs((prev) => {
      const next = { ...prev };
      ids.forEach((id) => delete next[id]);
      return next;
    });
  }, []);

  const reset = useCallback(() => {
    setOpenTabs([]);
    setActiveTab(null);
    setSelectedId(null);
    setActiveSubTabs({});
  }, []);

  const setLoaded = useCallback((firstId: string | null) => {
    setOpenTabs(firstId ? [firstId] : []);
    setActiveTab(firstId);
    setSelectedId(firstId);
    setActiveSubTabs({});
  }, []);

  return {
    openTabs,
    activeTab,
    selectedId,
    activeSubTabs,
    activeSubTab,
    open,
    close,
    select,
    selectSub,
    handleSelectNode,
    removeMany,
    reset,
    setLoaded,
  };
}