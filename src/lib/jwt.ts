export type JwtPayload = Record<string, unknown>;

export function decodeJwtPayload(token?: string | null): JwtPayload | null {
  if (!token) {
    return null;
  }

  const [, payload] = token.split(".");

  if (!payload) {
    return null;
  }

  try {
    const normalized = payload.replace(/-/g, "+").replace(/_/g, "/");
    const padded = normalized.padEnd(
      normalized.length + ((4 - (normalized.length % 4)) % 4),
      "=",
    );
    const json = atob(padded);

    return JSON.parse(json) as JwtPayload;
  } catch {
    return null;
  }
}

export function getPermissionsFromJwt(payload: JwtPayload | null): string[] {
  if (!payload) {
    return [];
  }

  const claims = [
    payload.permissions,
    payload.permission,
    payload.roles,
    payload.role,
    payload.authorities,
    payload.scope,
    payload.scp,
  ];

  const flattened: string[] = [];

  for (const claim of claims) {
    if (Array.isArray(claim)) {
      for (const value of claim) {
        if (typeof value === "string") {
          flattened.push(value);
        }
      }
      continue;
    }

    if (typeof claim === "string") {
      flattened.push(...claim.split(/[\s,]+/));
    }
  }

  return Array.from(
    new Set(
      flattened
        .map((value) => value.trim().toUpperCase())
        .filter((value) => value.length > 0),
    ),
  );
}
