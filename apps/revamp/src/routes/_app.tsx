import { createFileRoute, Outlet } from "@tanstack/react-router";
import AppSidebar from "@/components/app-sidebar";
import {
  SidebarInset,
  SidebarProvider,
  SidebarNav,
  SidebarTrigger,
} from "@/components/ui/sidebar";

export const Route = createFileRoute("/_app")({
  component: AppLayout,
});

function AppLayout() {
  return (
    <SidebarProvider className="h-dvh overflow-hidden">
      <AppSidebar intent="inset" collapsible="dock" />
      <SidebarInset className="overflow-hidden">
        <SidebarNav isSticky>
          <SidebarTrigger className="-ml-2" />
        </SidebarNav>
        <div className="flex-1 overflow-auto p-4">
          <Outlet />
        </div>
      </SidebarInset>
    </SidebarProvider>
  );
}
