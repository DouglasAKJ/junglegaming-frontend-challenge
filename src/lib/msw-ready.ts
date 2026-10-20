import { startMockServiceWorker } from '@/mocks/browser';

let mswPromise: Promise<void> | null = null;

export function ensureMswStarted(): Promise<void> {
  if (typeof window === 'undefined') {
    return Promise.resolve();
  }
  if (!mswPromise) {
    mswPromise = startMockServiceWorker();
  }
  return mswPromise;
}
