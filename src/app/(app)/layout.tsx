
import { AppSidebar } from '@/components/layout/app-sidebar';
import { DebugProvider } from '@/contexts/DebugContext';
import { DebugLogWindow } from '@/components/debug-log-window';

export default function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <DebugProvider>
      <div className="flex h-screen bg-background">
        <AppSidebar />
        <main className="flex-1 flex flex-col overflow-auto">
          <div className="flex-1 p-4 md:p-6 lg:p-8 overflow-y-auto">
            {children}
          </div>
        </main>
      </div>
      <DebugLogWindow />
    </DebugProvider>
  );
}
