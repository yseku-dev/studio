import { AppTopbar } from '@/components/layout/app-topbar';

export default function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col min-h-screen">
      <AppTopbar />
      <main className="flex-1 flex-col bg-background p-4 md:p-6 lg:p-8 overflow-auto pt-14"> {/* Changed pt-20 to pt-14 */}
        {children}
      </main>
    </div>
  );
}

