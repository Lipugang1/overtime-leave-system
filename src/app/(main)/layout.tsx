'use client';

import { AuthProvider } from '@/hooks/use-auth';
import { MainLayout } from '@/components/main-layout';

export default function MainLayoutWrapper({ children }: { children: React.ReactNode }) {
  return (
    <AuthProvider>
      <MainLayout>{children}</MainLayout>
    </AuthProvider>
  );
}
