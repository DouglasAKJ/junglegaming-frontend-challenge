import React from 'react';
import ReactDOM from 'react-dom/client';
import { QueryClientProvider } from '@tanstack/react-query';
import { RouterProvider } from '@tanstack/react-router';
import { ensureMswStarted } from '@/lib/msw-ready';
import { createAppQueryClient } from '@/lib/query';
import { ToastProvider } from '@/components/ui/toast-provider';
import { AuthProvider } from '@/features/auth/auth-context';
import { router } from './router';
import './index.css';

const queryClient = createAppQueryClient();

async function bootstrap() {
  await ensureMswStarted();

  const rootElement = document.getElementById('root');
  if (!rootElement) return;

  ReactDOM.createRoot(rootElement).render(
    <React.StrictMode>
      <QueryClientProvider client={queryClient}>
        <ToastProvider>
          <AuthProvider>
            <RouterProvider router={router} />
          </AuthProvider>
        </ToastProvider>
      </QueryClientProvider>
    </React.StrictMode>
  );
}

bootstrap();
