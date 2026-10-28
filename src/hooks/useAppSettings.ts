import { useCallback, useState } from "react";
import {
  loadAppSettings,
  saveAppSettings,
  type AppSettings,
} from "../appSettings";

export interface UseAppSettingsResult {
  settings: AppSettings;
  isOpen: boolean;
  open: () => void;
  close: () => void;
  save: (next: AppSettings) => void;
}

export function useAppSettings(): UseAppSettingsResult {
  const [settings, setSettings] = useState<AppSettings>(loadAppSettings);
  const [isOpen, setIsOpen] = useState(false);

  const open = useCallback(() => setIsOpen(true), []);
  const close = useCallback(() => setIsOpen(false), []);

  const save = useCallback((next: AppSettings) => {
    setSettings(next);
    saveAppSettings(next);
    setIsOpen(false);
  }, []);

  return { settings, isOpen, open, close, save };
}