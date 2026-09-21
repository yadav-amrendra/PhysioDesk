const DEFAULT_API_URL = "http://127.0.0.1:8000";

/** Server-side API base URL (not exposed to the browser). */
export function getApiUrl(): string {
  return process.env.API_URL ?? DEFAULT_API_URL;
}

export class ApiError extends Error {
  constructor(
    message: string,
    public status: number,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

export async function apiGet<T>(path: string): Promise<T> {
  const url = `${getApiUrl()}${path.startsWith("/") ? path : `/${path}`}`;
  const res = await fetch(url);

  if (!res.ok) {
    throw new ApiError(`API request failed: ${res.status} ${res.statusText}`, res.status);
  }

  return res.json() as Promise<T>;
}

export type HealthResponse = {
  status: string;
  database?: string;
  app?: string;
  version?: string;
};
