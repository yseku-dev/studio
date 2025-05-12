
'use client'; // This layout is interactive, so needs to be a client component

import { AppSidebar } from '@/components/layout/app-sidebar';
import { DebugProvider, useDebug } from '@/contexts/DebugContext';
import { DebugLogWindow } from '@/components/debug-log-window';
import { cn } from '@/lib/utils';

function MainAppLayout({ children }: { children: React.ReactNode }) {
  const { isDebugModeActive, isLogWindowExpanded } = useDebug();

  let mainContentPaddingBottom = "pb-0"; // Default no padding

  if (isDebugModeActive) {
    if (isLogWindowExpanded) {
      // Header (h-12 = 3rem) + ScrollArea (h-64 = 16rem) = 19rem
      // Tailwind arbitrary values need to be like pb-[19rem]
      mainContentPaddingBottom = "pb-[19rem]"; 
    } else {
      // Only header (h-12 = 3rem)
      mainContentPaddingBottom = "pb-12";
    }
  }

  return (
    <div className="flex h-screen bg-background">
      <AppSidebar />
      <main className="flex-1 flex flex-col overflow-hidden"> {/* Changed overflow-auto to overflow-hidden */}
        <div className={cn(
          "flex-1 p-4 md:p-6 lg:p-8 overflow-y-auto transition-all duration-300",
          mainContentPaddingBottom
          )}>
          {children}
        </div>
      </main>
      <DebugLogWindow />
    </div>
  );
}


export default function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <DebugProvider>
      <MainAppLayout>{children}</MainAppLayout>
    </DebugProvider>
  );
}
