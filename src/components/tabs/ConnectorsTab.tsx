import { useMemo } from "react";
import type { Server } from "../../types";
import { createConnectorsApi } from "../../features/connectors/api";
import { createMockConnectorsApi } from "../../features/connectors/mockApi";
import { ConnectorsWidget } from "../../features/connectors/ConnectorsWidget";

/** true — виджет работает на встроенных моках, false — на реальном ядре. */
const USE_MOCK_API = true;

interface Props {
  server: Server;
}

export function ConnectorsTab({ server }: Props) {
  const api = useMemo(() => {
    if (USE_MOCK_API) return createMockConnectorsApi();

    const baseUrl =
      server.url.startsWith("http://") || server.url.startsWith("https://")
        ? server.url.replace(/\/$/, "")
        : `http://${server.url}:${server.port}`;

    return createConnectorsApi(baseUrl);
  }, [server]);

  return <ConnectorsWidget api={api} />;
}