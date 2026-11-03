import { useMemo } from "react";
import type { Server } from "../../types";
import { buildBaseUrl } from "../../checkConnection";
import { createSecurityApi } from "../../features/security/api";
import { SecurityWidget } from "../../features/security/SecurityWidget";
import { getToken } from "../../api/tokenStore";

interface JwtClaims {
  sub?: string;
  role?: string;
  exp?: number;
}

function decodeJwt(token: string): JwtClaims {
  try {
    const payload = token.split(".")[1];
    if (!payload) return {};
    const json = atob(payload.replace(/-/g, "+").replace(/_/g, "/"));
    return JSON.parse(json) as JwtClaims;
  } catch {
    return {};
  }
}

interface Props {
  server: Server;
}

export function SecurityTab({ server }: Props) {
  const baseUrl = useMemo(() => {
    try {
      return buildBaseUrl(server.url, server.port);
    } catch {
      return "";
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [server.url, server.port]);

  const api = useMemo(
    () => (baseUrl ? createSecurityApi(baseUrl) : null),
    [baseUrl],
  );

  const claims = useMemo<JwtClaims>(() => {
    if (!baseUrl) return {};
    const token = getToken(baseUrl);
    return token ? decodeJwt(token) : {};
  }, [baseUrl]);

  const currentSessionId = claims.sub ?? null;
  const currentRole = claims.role ?? "";
  const tokenExpiresAt = claims.exp
    ? new Date(claims.exp * 1000).toISOString()
    : null;

  if (!baseUrl || !api) {
    return (
      <div className="security-tab">
        <div className="sec-hint">
          Не удалось определить адрес сервера (проверьте URL и порт).
        </div>
      </div>
    );
  }

  return (
    <SecurityWidget
      api={api}
      currentSessionId={currentSessionId}
      currentRole={currentRole}
      tokenExpiresAt={tokenExpiresAt}
    />
  );
}