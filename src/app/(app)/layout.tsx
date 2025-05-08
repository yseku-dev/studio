import { AppTopbar } from '@/components/layout/app-topbar';

export default function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col min-h-screen">
      <AppTopbar />
      <main className="flex-1 flex-col bg-background p-4 md:p-6 lg:p-8 overflow-auto pt-20"> {/* Added pt-20 for topbar height */}
        {children}
      </main>
    </div>
  );
}
