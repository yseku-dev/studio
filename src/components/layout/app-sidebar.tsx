
'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  Sidebar,
  SidebarHeader,
  SidebarContent,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
  SidebarTrigger, // Import SidebarTrigger
  useSidebar, // Import useSidebar to control toggle
} from '@/components/ui/sidebar';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { LayoutDashboard, ScanLine, GitCompareArrows, Settings, PackageSearch, FolderSearch, Sparkles, PanelLeft } from 'lucide-react';
import { cn } from '@/lib/utils';

const navItems = [
  { href: '/dashboard', label: 'Panel de Control', icon: LayoutDashboard },
  { href: '/analyze', label: 'Analizar Código', icon: ScanLine },
  { href: '/project-analysis', label: 'Analizar Proyecto', icon: FolderSearch },
  { href: '/autoupdate', label: 'AutoUpdate', icon: Sparkles },
  { href: '/versions', label: 'Versiones Guardadas', icon: GitCompareArrows },
  { href: '/settings', label: 'Configuración', icon: Settings },
];

export function AppSidebar() {
  const pathname = usePathname();
  const { state, toggleSidebar, isMobile } = useSidebar(); // Get toggleSidebar and state

  return (
    <Sidebar collapsible="icon" variant="sidebar" side="left" className="border-r">
      <SidebarHeader className="p-4 flex items-center justify-between group-data-[collapsible=icon]:justify-center">
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="icon" className="rounded-lg group-data-[collapsible=icon]:h-8 group-data-[collapsible=icon]:w-8" asChild>
            <Link href="/dashboard">
              <PackageSearch className="h-6 w-6 text-primary" />
            </Link>
          </Button>
          <h1 className="text-xl font-semibold text-primary group-data-[collapsible=icon]:hidden">
            YskCodeAlchemist
          </h1>
        </div>
        {/* Mostrar el SidebarTrigger solo en escritorio y cuando no está en modo icono por defecto */}
         <Button 
            variant="ghost" 
            size="icon" 
            onClick={toggleSidebar} 
            className="rounded-lg md:hidden group-data-[collapsible=icon]:hidden" // Oculto en modo icono en desktop, visible en mobile si se quiere
            aria-label="Toggle sidebar"
          >
           <PanelLeft className="h-5 w-5" />
         </Button>
      </SidebarHeader>
      <ScrollArea className="flex-1">
        <SidebarContent className="p-2">
          <SidebarMenu>
            {navItems.map((item) => (
              <SidebarMenuItem key={item.href}>
                <SidebarMenuButton
                  asChild
                  isActive={pathname === item.href || (item.href !== '/dashboard' && pathname.startsWith(item.href))}
                  tooltip={{ children: item.label, className: "bg-card text-card-foreground border shadow-md" }}
                  className={cn(
                    "justify-start",
                    (pathname === item.href || (item.href !== '/dashboard' && pathname.startsWith(item.href))) && "bg-sidebar-accent text-sidebar-accent-foreground"
                  )}
                >
                  <Link href={item.href} className="flex items-center gap-3">
                    <item.icon className="h-5 w-5" />
                    <span className="group-data-[collapsible=icon]:hidden">{item.label}</span>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
            ))}
          </SidebarMenu>
        </SidebarContent>
      </ScrollArea>
       {/* Botón para colapsar/expandir en la parte inferior de la barra lateral, visible en desktop */}
      {!isMobile && (
        <div className="p-2 border-t border-sidebar-border group-data-[collapsible=icon]:flex group-data-[collapsible=icon]:justify-center">
            <Button 
                variant="ghost" 
                size={state === 'collapsed' ? 'icon' : 'default'}
                onClick={toggleSidebar} 
                className="w-full group-data-[collapsible=icon]:w-auto"
                aria-label={state === 'collapsed' ? 'Expandir sidebar' : 'Colapsar sidebar'}
            >
            <PanelLeft className="h-5 w-5" />
            <span className="group-data-[collapsible=icon]:hidden ml-2">{state === 'collapsed' ? 'Expandir' : 'Colapsar'}</span>
          </Button>
        </div>
      )}
    </Sidebar>
  );
}
