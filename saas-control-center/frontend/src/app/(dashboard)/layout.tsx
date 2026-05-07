'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Sidebar } from '@/components/layout/sidebar';
import { Topbar } from '@/components/layout/topbar';
import { useAuthStore } from '@/stores/auth-store';

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const { hydrate } = useAuthStore();

  useEffect(() => {
    hydrate();
  }, [hydrate]);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const token = localStorage.getItem('scc_access_token');
      if (!token) router.push('/login');
    }
  }, [router]);

  return (
    <div className="min-h-screen bg-background">
      <Sidebar />
      <div className="ml-60">
        <Topbar />
        <main className="p-6">{children}</main>
      </div>
    </div>
  );
}
