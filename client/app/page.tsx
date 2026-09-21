import { Suspense } from "react";
import { apiGet, type HealthResponse } from "@/lib/api";

type StatusResult =
  | { kind: "ok"; health: HealthResponse }
  | { kind: "unexpected"; health: HealthResponse }
  | { kind: "error"; message: string };

async function loadStatus(): Promise<StatusResult> {
  try {
    const health = await apiGet<HealthResponse>("/api/v1/health");
    if (health.status === "ok") {
      return { kind: "ok", health };
    }
    return { kind: "unexpected", health };
  } catch (error) {
    return {
      kind: "error",
      message: error instanceof Error ? error.message : "Unknown connection error",
    };
  }
}

async function ApiStatus() {
  const result = await loadStatus();

  if (result.kind === "error") {
    return (
      <div className="rounded-lg border border-danger/20 bg-danger-soft px-4 py-3 text-sm text-danger">
        <p className="font-medium">API unavailable</p>
        <p className="mt-1 text-xs opacity-90">{result.message}</p>
        <p className="mt-2 text-xs text-muted">
          Start the backend with{" "}
          <code className="rounded bg-white/70 px-1 py-0.5 font-mono">
            cd server && uv run fastapi dev
          </code>
        </p>
      </div>
    );
  }

  const connected = result.kind === "ok";

  return (
    <div
      className={`rounded-lg border px-4 py-3 text-sm ${
        connected
          ? "border-accent/20 bg-accent-soft text-accent"
          : "border-danger/20 bg-danger-soft text-danger"
      }`}
    >
      <p className="font-medium">
        API {connected ? "connected" : "unexpected response"}
      </p>
      <p className="mt-1 font-mono text-xs opacity-80">
        GET /api/v1/health → {JSON.stringify(result.health)}
      </p>
    </div>
  );
}

function ApiStatusFallback() {
  return (
    <div className="rounded-lg border border-border bg-surface px-4 py-3 text-sm text-muted">
      Checking API…
    </div>
  );
}

export default function Home() {
  return (
    <div className="flex flex-1 flex-col">
      <header className="border-b border-border bg-surface">
        <div className="mx-auto flex w-full max-w-3xl items-center justify-between px-6 py-4">
          <p className="text-lg font-semibold tracking-tight text-foreground">
            PhysioDesk
          </p>
        </div>
      </header>

      <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-8 px-6 py-10">

        <section className="space-y-3">
          <h2 className="text-sm font-medium uppercase tracking-wide text-muted">
            Backend status
          </h2>
          <Suspense fallback={<ApiStatusFallback />}>
            <ApiStatus />
          </Suspense>
        </section>
      </main>
    </div>
  );
}
