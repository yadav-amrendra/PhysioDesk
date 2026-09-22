const DEFAULT_API_URL = "http://127.0.0.1:8000";

/** API base URL for server and browser. Prefer NEXT_PUBLIC_ for client bundles. */
export function getApiUrl(): string {
  return (
    process.env.NEXT_PUBLIC_API_URL ??
    process.env.API_URL ??
    DEFAULT_API_URL
  );
}

export class ApiError extends Error {
  constructor(
    message: string,
    public status: number,
    public body?: unknown,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

type RequestOptions = {
  method?: string;
  body?: unknown;
  token?: string | null;
  auth?: boolean;
};

function getStoredAccessToken(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem("physiodesk_access_token");
}

export async function apiRequest<T>(
  path: string,
  options: RequestOptions = {},
): Promise<T> {
  const { method = "GET", body, token, auth = false } = options;
  const headers: Record<string, string> = {
    Accept: "application/json",
  };

  if (body !== undefined) {
    headers["Content-Type"] = "application/json";
  }

  const bearer = token ?? (auth ? getStoredAccessToken() : null);
  if (bearer) {
    headers.Authorization = `Bearer ${bearer}`;
  }

  const url = `${getApiUrl()}${path.startsWith("/") ? path : `/${path}`}`;
  const res = await fetch(url, {
    method,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });

  if (!res.ok) {
    let errorBody: unknown;
    try {
      errorBody = await res.json();
    } catch {
      errorBody = undefined;
    }
    const detail =
      typeof errorBody === "object" &&
      errorBody &&
      "detail" in errorBody &&
      typeof (errorBody as { detail: unknown }).detail === "string"
        ? (errorBody as { detail: string }).detail
        : `API request failed: ${res.status} ${res.statusText}`;
    throw new ApiError(detail, res.status, errorBody);
  }

  if (res.status === 204) {
    return undefined as T;
  }

  return res.json() as Promise<T>;
}

export function apiGet<T>(path: string, auth = false): Promise<T> {
  return apiRequest<T>(path, { auth });
}

export function apiPost<T>(path: string, body: unknown, auth = false): Promise<T> {
  return apiRequest<T>(path, { method: "POST", body, auth });
}

export type HealthResponse = {
  status: string;
  database?: string;
  app?: string;
  version?: string;
};

export type TokenResponse = {
  access_token: string;
  refresh_token: string;
  token_type: string;
};

export type UserRole = "admin" | "staff";

export type User = {
  id: number;
  email: string;
  full_name: string;
  role: UserRole;
  is_active: boolean;
};
