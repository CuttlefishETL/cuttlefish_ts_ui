import { useMemo } from "react";
import type { Server } from "../../types";
import { buildBaseUrl } from "../../checkConnection";
import { createConnectorsApi } from "../../features/connectors/api";
import { createMockConnectorsApi } from "../../features/connectors/mockApi";
import { ConnectorsWidget } from "../../features/connectors/ConnectorsWidget";

/** true — виджет работает на встроенных моках, false — на реальном ядре. */
const USE_MOCK_API = false;

interface Props {
  server: Server;
}

export function ConnectorsTab({ server }: Props) {
  const api = useMemo(() => {
    if (USE_MOCK_API) return createMockConnectorsApi();

    let baseUrl: string;
    try {
      baseUrl = buildBaseUrl(server.url, server.port);
    } catch {
      // Некорректный URL — падать вкладке не нужно.
      return createMockConnectorsApi();
    }
    return createConnectorsApi(baseUrl);
    // зависимости — примитивы, иначе api пересоздаётся каждый рендер
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [server.url, server.port]);

  return <ConnectorsWidget api={api} server={server} />;
}