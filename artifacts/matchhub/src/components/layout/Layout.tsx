import { ReactNode } from 'react';
import { Header } from './Header';
import { BottomNav } from './BottomNav';
import { InvitationToaster } from '@/components/InvitationToaster';

interface LayoutProps {
  children: ReactNode;
}

export function Layout({ children }: LayoutProps) {
  return (
    <div className="flex min-h-screen flex-col bg-background">
      <Header />
      <main className="flex-1 pb-16 md:pb-0">{children}</main>
      <BottomNav />
      <InvitationToaster />
    </div>
  );
}
