import { useMemo } from "react";
import type { Server } from "../../types";
import { createPluginsApi } from "../../features/plugins/api";
import { createMockPluginsApi } from "../../features/plugins/mockApi";
import { PluginsWidget } from "../../features/plugins/PluginsWidget";

/** true — виджет работает на встроенных моках, false — на реальном ядре. */
const USE_MOCK_API = true;

interface Props {
  server: Server;
}

export function PluginsTab({ server }: Props) {
  const api = useMemo(() => {
    if (USE_MOCK_API) return createMockPluginsApi();

    const baseUrl =
      server.url.startsWith("http://") || server.url.startsWith("https://")
        ? server.url.replace(/\/$/, "")
        : `http://${server.url}:${server.port}`;

    return createPluginsApi(baseUrl);
  }, [server]);

  return <PluginsWidget api={api} />;
}