import { useMemo } from "react";
import type { Server } from "../../types";
import { createCronApi } from "../../features/cron/api";
import { createMockCronApi } from "../../features/cron/mockApi";
import { CronWidget } from "../../features/cron/CronWidget";

/** true — виджет работает на встроенных моках, false — на реальном ядре. */
const USE_MOCK_API = true;

interface Props {
  server: Server;
}

export function CronTab({ server }: Props) {
  const api = useMemo(() => {
    if (USE_MOCK_API) return createMockCronApi();

    const baseUrl =
      server.url.startsWith("http://") || server.url.startsWith("https://")
        ? server.url.replace(/\/$/, "")
        : `http://${server.url}:${server.port}`;

    return createCronApi(baseUrl);
  }, [server]);

  return <CronWidget api={api} />;
}