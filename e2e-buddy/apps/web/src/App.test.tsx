import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { App } from './App';

function renderApp() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <App />
    </QueryClientProvider>,
  );
}

describe('App', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('shows the server version from /api/health', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(
        new Response(JSON.stringify({ status: 'ok', version: '0.1.0', uptimeSec: 12 })),
      );
    vi.stubGlobal('fetch', fetchMock);

    renderApp();

    expect(await screen.findByText('0.1.0')).toBeInTheDocument();
    expect(screen.getByText('12s')).toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledWith('/api/health');
  });

  it('shows an error when the server is unreachable', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('', { status: 502 })));

    renderApp();

    expect(await screen.findByRole('alert')).toHaveTextContent('502');
  });
});
