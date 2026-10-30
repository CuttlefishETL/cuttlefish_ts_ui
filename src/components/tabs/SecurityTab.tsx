import { useMemo } from "react";
import type { Server } from "../../types";
import { createMockSecurityApi } from "../../features/security/mockApi";
import { SecurityWidget } from "../../features/security/SecurityWidget";

/** true — виджет работает на встроенных моках, false — на реальном ядре. */
const USE_MOCK_API = true;

interface Props {
  server: Server;
}

function readAuthFromStorage(): {
  sessionId: string | null;
  role: string;
  expiresAt: string | null;
} {
  const token = localStorage.getItem("cuttlefish.token");
  if (!token) {
    return { sessionId: null, role: "admin", expiresAt: null };
  }
  try {
    const [, payload] = token.split(".");
    const data = JSON.parse(atob(payload));
    return {
      sessionId: data.sub ?? null,
      role: data.role ?? "user",
      expiresAt: data.exp ? new Date(data.exp * 1000).toISOString() : null,
    };
  } catch {
    return { sessionId: null, role: "user", expiresAt: null };
  }
}

export function SecurityTab({ server }: Props) {
  const api = useMemo(() => {
    if (USE_MOCK_API) return createMockSecurityApi();

    // Когда появится реальный API:
    // const baseUrl =
    //   server.url.startsWith("http://") || server.url.startsWith("https://")
    //     ? server.url.replace(/\/$/, "")
    //     : `http://${server.url}:${server.port}`;
    // return createSecurityApi(baseUrl);

    return createMockSecurityApi();
  }, [server]);

  const auth = useMemo(() => readAuthFromStorage(), []);

  return (
    <SecurityWidget
      api={api}
      currentSessionId={auth.sessionId}
      currentRole={auth.role}
      tokenExpiresAt={auth.expiresAt}
    />
  );
}