import { useMemo } from "react";
import type { Server } from "../../types";
import { buildBaseUrl } from "../../checkConnection";
import { createCronApi } from "../../features/cron/api";
import { createMockCronApi } from "../../features/cron/mockApi";
import { CronWidget } from "../../features/cron/CronWidget";

/** true — виджет работает на встроенных моках, false — на реальном ядре. */
const USE_MOCK_API = false;

interface Props {
  server: Server;
}

export function CronTab({ server }: Props) {
  const { api, baseUrl } = useMemo(() => {
    if (USE_MOCK_API) {
      return {
        api: createMockCronApi(),
        baseUrl: "mock://cron",
      };
    }

    let url: string;
    try {
      url = buildBaseUrl(server.url, server.port);
    } catch {
      // Некорректный URL — вкладка не должна падать.
      return {
        api: createMockCronApi(),
        baseUrl: "mock://cron",
      };
    }
    return { api: createCronApi(url), baseUrl: url };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [server.url, server.port]);

  return <CronWidget api={api} baseUrl={baseUrl} />;
}