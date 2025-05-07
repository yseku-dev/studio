
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
} from '@/components/ui/sidebar';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { LayoutDashboard, ScanLine, GitCompareArrows, Settings, PackageSearch, FolderSearch, Sparkles } from 'lucide-react';
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

  return (
    <Sidebar collapsible="icon" variant="sidebar" side="left" className="border-r">
      <SidebarHeader className="p-4">
        <div className="flex items-center gap-2 group-data-[collapsible=icon]:justify-center">
          <Button variant="ghost" size="icon" className="rounded-lg group-data-[collapsible=icon]:h-8 group-data-[collapsible=icon]:w-8" asChild>
            <Link href="/dashboard">
              <PackageSearch className="h-6 w-6 text-primary" />
            </Link>
          </Button>
          <h1 className="text-xl font-semibold text-primary group-data-[collapsible=icon]:hidden">
            CodeAlchemist
          </h1>
        </div>
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
    </Sidebar>
  );
}

