// src/components/layout/app-sidebar.tsx
'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Sheet, SheetTrigger, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { ScrollArea } from '@/components/ui/scroll-area';
import { 
  Menu, 
  FlaskConical,
  LayoutDashboard, 
  ScanLine, 
  GitCompareArrows, 
  Settings, 
  FolderSearch, 
  Sparkles, 
  CodeXml, 
  FolderPlus,
  ChevronsLeft,
  ChevronsRight,
  MessageCircle,
  Users2, 
  Workflow,
  GitPullRequestDraft // Icon for Refactor Project
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useIsMobile } from '@/hooks/use-mobile';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

const navItems = [
  { href: '/dashboard', label: 'Panel de Control', icon: LayoutDashboard },
  { href: '/generate-code', label: 'Generar Código', icon: CodeXml },
  { href: '/generate-project', label: 'Generar Proyecto', icon: FolderPlus },
  { href: '/refactor-project', label: 'Refactorizar Proyecto', icon: GitPullRequestDraft },
  { href: '/analyze', label: 'Analizar Código', icon: ScanLine },
  { href: '/project-analysis', label: 'Analizar Proyecto', icon: FolderSearch },
  { href: '/autoupdate', label: 'AutoUpdate', icon: Sparkles },
  { href: '/versions', label: 'Versiones Guardadas', icon: GitCompareArrows },
  { href: '/chat', label: 'Chat con IA', icon: MessageCircle },
  { href: '/agents', label: 'Agentes IA', icon: Users2 },
  { href: '/workgroups', label: 'Grupos de Trabajo IA', icon: Workflow },
  { href: '/settings', label: 'Configuración', icon: Settings },
];

export function AppSidebar() {
  const pathname = usePathname();
  const isMobile = useIsMobile();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [isCollapsed, setIsCollapsed] = useState(false);

  useEffect(() => {
    if (isMobile) {
      setIsCollapsed(false); 
    } else {
      const storedCollapseState = localStorage.getItem('sidebarCollapsed');
      if (storedCollapseState) {
        setIsCollapsed(JSON.parse(storedCollapseState));
      }
    }
  }, [isMobile]);

  const toggleCollapse = () => {
    if (!isMobile) {
      const newCollapsedState = !isCollapsed;
      setIsCollapsed(newCollapsedState);
      localStorage.setItem('sidebarCollapsed', JSON.stringify(newCollapsedState));
    }
  };

  const SidebarVisualElements = (
    <>
      <div className={cn(
          "flex items-center border-b p-4 h-14", 
          isCollapsed && !isMobile ? "justify-center" : "justify-between"
        )}>
        <Link 
          href="/dashboard" 
          className={cn("flex items-center gap-2", isCollapsed && !isMobile && "justify-center w-full")}
          onClick={() => { if (isMobile) setMobileMenuOpen(false); }}
        >
          <FlaskConical className="h-7 w-7 text-primary" /> 
          {!isCollapsed || isMobile ? (
            <span className="text-xl font-semibold text-primary">CodeAlchemist</span>
          ) : null}
        </Link>
        {!isMobile && !isCollapsed && ( 
          <Button
            variant="ghost"
            size="icon"
            onClick={toggleCollapse}
            aria-label={"Ocultar sidebar"}
          >
            <ChevronsLeft className="h-5 w-5" />
          </Button>
        )}
      </div>
      <ScrollArea className="flex-1">
        <nav className="flex flex-col gap-1 p-4">
          {navItems.map((item) => {
            const isActive = pathname === item.href || (item.href !== '/dashboard' && pathname.startsWith(item.href));
            const NavLinkContent = () => (
              <>
                <item.icon className={cn("h-5 w-5", isCollapsed && !isMobile && "mx-auto")} />
                {!isCollapsed || isMobile ? item.label : null}
              </>
            );

            if (isCollapsed && !isMobile) {
              return (
                <TooltipProvider key={item.href} delayDuration={0}>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Link
                        href={item.href}
                        className={cn(
                          'flex items-center rounded-md px-3 py-2.5 text-base font-medium transition-colors justify-center',
                          isActive
                            ? 'bg-primary/10 text-primary'
                            : 'text-foreground hover:bg-muted hover:text-foreground'
                        )}
                        onClick={() => { if (isMobile) setMobileMenuOpen(false); }}
                        aria-label={item.label}
                      >
                        <NavLinkContent />
                      </Link>
                    </TooltipTrigger>
                    <TooltipContent side="right" align="center">
                      <p>{item.label}</p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              );
            }

            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  'flex items-center gap-3 rounded-md px-3 py-2 text-base font-medium transition-colors',
                  isActive
                    ? 'bg-primary/10 text-primary'
                    : 'text-foreground hover:bg-muted hover:text-foreground'
                )}
                onClick={() => { if (isMobile) setMobileMenuOpen(false); }}
              >
                <NavLinkContent />
              </Link>
            );
          })}
        </nav>
      </ScrollArea>
       {!isMobile && (
         <div className="p-4 border-t mt-auto">
            <Button
                variant="ghost"
                size={isCollapsed ? "icon" : "default"}
                onClick={toggleCollapse}
                className={cn("w-full flex items-center", isCollapsed ? "justify-center" : "justify-start gap-2")}
                aria-label={isCollapsed ? "Mostrar sidebar" : "Ocultar sidebar"}
            >
                {isCollapsed ? <ChevronsRight className="h-5 w-5" /> : <ChevronsLeft className="h-5 w-5" />}
                {!isCollapsed && <span>Ocultar</span>}
            </Button>
         </div>
       )}
    </>
  );


  if (isMobile) {
    return (
      <Sheet open={mobileMenuOpen} onOpenChange={setMobileMenuOpen}>
        <div className="fixed top-0 left-0 p-2 z-50 bg-background/80 backdrop-blur-sm rounded-br-lg">
          <SheetTrigger asChild>
            <Button variant="ghost" size="icon">
              <Menu className="h-6 w-6" />
              <span className="sr-only">Abrir menú</span>
            </Button>
          </SheetTrigger>
        </div>
        <SheetContent side="left" className="w-72 p-0 bg-card border-r-0 flex flex-col">
          <SheetHeader className="sr-only">
            <SheetTitle>Barra lateral principal</SheetTitle>
          </SheetHeader>
          {SidebarVisualElements}
        </SheetContent>
      </Sheet>
    );
  }

  return (
    <div className={cn(
      "flex flex-col h-full bg-card border-r transition-all duration-300 ease-in-out",
      isCollapsed ? "w-20" : "w-72"
    )}>
      {SidebarVisualElements}
    </div>
  );
}
