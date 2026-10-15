import { useQuery } from '@tanstack/react-query';
import { fetchHealth } from './api';

export function App() {
  const health = useQuery({ queryKey: ['health'], queryFn: fetchHealth, refetchInterval: 10_000 });

  return (
    <main className="mx-auto max-w-2xl p-8 font-sans text-slate-900">
      <h1 className="text-2xl font-semibold">E2E Buddy</h1>
      <section className="mt-6 rounded-lg border border-slate-200 p-4" aria-label="Server health">
        <h2 className="text-sm font-medium uppercase tracking-wide text-slate-500">Server</h2>
        {health.isPending && <p className="mt-2">Connecting…</p>}
        {health.isError && (
          <p className="mt-2 text-red-700" role="alert">
            Server unreachable: {health.error.message}
          </p>
        )}
        {health.isSuccess && (
          <dl className="mt-2 grid grid-cols-[max-content_1fr] gap-x-4 gap-y-1">
            <dt className="text-slate-500">Status</dt>
            <dd className="text-green-700">{health.data.status}</dd>
            <dt className="text-slate-500">Version</dt>
            <dd>{health.data.version}</dd>
            <dt className="text-slate-500">Uptime</dt>
            <dd>{health.data.uptimeSec}s</dd>
          </dl>
        )}
      </section>
    </main>
  );
}
