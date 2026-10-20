import { setupWorker } from 'msw/browser';
import { httpHandlers } from './handlers';
import { wsHandlers } from './ws';

export const worker = setupWorker(...httpHandlers, ...wsHandlers);

export async function startMockServiceWorker(): Promise<void> {
  const enableMsw = import.meta.env.VITE_ENABLE_MSW !== 'false';
  if (!enableMsw) return;

  await worker.start({
    onUnhandledRequest: 'bypass',
    quiet: true,
    serviceWorker: {
      url: '/mockServiceWorker.js',
    },
  });
}
