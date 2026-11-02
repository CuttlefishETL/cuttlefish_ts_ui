import { useMemo } from "react";
import type { Server } from "../../types";
import { buildBaseUrl } from "../../checkConnection";
import { createPluginsApi } from "../../features/plugins/api";
import { createMockPluginsApi } from "../../features/plugins/mockApi";
import { PluginsWidget } from "../../features/plugins/PluginsWidget";

/** true — виджет работает на встроенных моках, false — на реальном ядре. */
const USE_MOCK_API = false;

interface Props {
  server: Server;
}

export function PluginsTab({ server }: Props) {
  const api = useMemo(() => {
    if (USE_MOCK_API) return createMockPluginsApi();

    let baseUrl: string;
    try {
      baseUrl = buildBaseUrl(server.url, server.port);
    } catch {
      // Некорректный URL — отдадим мок, чтобы вкладка не падала при рендере.
      // Пользователь увидит ошибку health-чека в сайдбаре.
      return createMockPluginsApi();
    }
    return createPluginsApi(baseUrl);
    // зависимость — только примитивы, иначе api пересоздаётся на каждый рендер
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [server.url, server.port]);

  return <PluginsWidget api={api} />;
}