import { AppSidebar } from '@/components/layout/app-sidebar';

export default function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex h-screen bg-background">
      <AppSidebar />
      <main className="flex-1 flex flex-col overflow-auto">
        {/* Placeholder for a potential top bar inside the main content area if needed later */}
        {/* <header className="h-14 flex items-center border-b px-6 bg-card sticky top-0 z-30">
          Page Title or Breadcrumbs
        </header> */}
        <div className="flex-1 p-4 md:p-6 lg:p-8 overflow-y-auto">
          {children}
        </div>
      </main>
    </div>
  );
}
