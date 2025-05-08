
'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetTrigger, SheetClose, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Menu, PackageSearch, LayoutDashboard, ScanLine, GitCompareArrows, Settings, FolderSearch, Sparkles, CodeXml, FolderPlus } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useIsMobile } from '@/hooks/use-mobile';

const navItems = [
  { href: '/dashboard', label: 'Panel de Control', icon: LayoutDashboard },
  { href: '/generate-code', label: 'Generar Código', icon: CodeXml },
  { href: '/generate-project', label: 'Generar Proyecto', icon: FolderPlus },
  { href: '/analyze', label: 'Analizar Código', icon: ScanLine },
  { href: '/project-analysis', label: 'Analizar Proyecto', icon: FolderSearch },
  { href: '/autoupdate', label: 'AutoUpdate', icon: Sparkles },
  { href: '/versions', label: 'Versiones Guardadas', icon: GitCompareArrows },
  { href: '/settings', label: 'Configuración', icon: Settings },
];

export function AppTopbar() {
  const pathname = usePathname();
  const isMobile = useIsMobile();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  return (
    <header className="fixed top-0 left-0 right-0 z-50 flex h-16 items-center justify-between border-b bg-card px-4 md:px-6 shadow-sm">
      <div className="flex items-center gap-2">
        <Button variant="ghost" size="icon" className="rounded-lg" asChild>
          <Link href="/dashboard">
            <PackageSearch className="h-7 w-7 text-primary" />
            <span className="sr-only">YskCodeAlchemist Home</span>
          </Link>
        </Button>
        <Link href="/dashboard" className="text-xl font-semibold text-primary hidden sm:block">
          YskCodeAlchemist
        </Link>
      </div>

      {isMobile ? (
        <Sheet open={mobileMenuOpen} onOpenChange={setMobileMenuOpen}>
          <SheetTrigger asChild>
            <Button variant="ghost" size="icon" className="rounded-lg">
              <Menu className="h-6 w-6" />
              <span className="sr-only">Abrir menú</span>
            </Button>
          </SheetTrigger>
          <SheetContent side="left" className="w-72 p-0 bg-card">
            <SheetHeader className="p-4 border-b flex flex-row items-center justify-start text-left space-y-0">
                <PackageSearch className="h-7 w-7 text-primary" />
              <SheetTitle className="text-xl font-semibold text-primary ml-2">
                YskCodeAlchemist
              </SheetTitle>
            </SheetHeader>
            <ScrollArea className="h-[calc(100vh-4rem)]"> {/* Adjust height considering header */}
              <nav className="flex flex-col gap-1 p-4">
                {navItems.map((item) => (
                  <SheetClose asChild key={item.href}>
                    <Link
                      href={item.href}
                      className={cn(
                        'flex items-center gap-3 rounded-md px-3 py-2 text-base font-medium transition-colors',
                        pathname === item.href || (item.href !== '/dashboard' && pathname.startsWith(item.href))
                          ? 'bg-primary/10 text-primary'
                          : 'text-foreground hover:bg-muted hover:text-foreground'
                      )}
                      onClick={() => setMobileMenuOpen(false)}
                    >
                      <item.icon className="h-5 w-5" />
                      {item.label}
                    </Link>
                  </SheetClose>
                ))}
              </nav>
            </ScrollArea>
          </SheetContent>
        </Sheet>
      ) : (
        <div className="flex items-center gap-x-1 md:gap-x-2">
          <nav className="flex items-center">
            {navItems
              .filter(item => item.href !== '/settings') // Exclude settings from main nav links for desktop
              .map((item) => (
              <Button
                key={item.href}
                asChild
                variant="ghost"
                size="sm"
                className={cn(
                  'text-sm font-medium transition-colors px-2 py-1 md:px-3',
                  pathname === item.href || (item.href !== '/dashboard' && pathname.startsWith(item.href))
                    ? 'text-primary'
                    : 'text-muted-foreground hover:text-foreground'
                )}
              >
                <Link href={item.href} className="flex items-center gap-1.5">
                  <item.icon className="h-4 w-4" />
                  {item.label}
                </Link>
              </Button>
            ))}
          </nav>
          {/* Standalone Settings Button for desktop */}
          <Button
            asChild
            variant="ghost"
            size="icon"
            className={cn(
              'transition-colors ml-2', // Added margin for separation
              pathname === '/settings'
                ? 'text-primary bg-primary/10'
                : 'text-muted-foreground hover:text-foreground hover:bg-muted/50'
            )}
            aria-label="Configuración"
          >
            <Link href="/settings">
              <Settings className="h-5 w-5" />
            </Link>
          </Button>
        </div>
      )}
    </header>
  );
}
