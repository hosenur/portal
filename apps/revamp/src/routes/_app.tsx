import { createFileRoute, Outlet, Navigate } from "@tanstack/react-router";
import AppSidebar from "@/components/app-sidebar";
import {
  SidebarInset,
  SidebarProvider,
  SidebarNav,
  SidebarTrigger,
} from "@/components/ui/sidebar";
import { useInstanceStore } from "@/stores/instance-store";

export const Route = createFileRoute("/_app")({
  component: AppLayout,
});

function AppLayout() {
  const instance = useInstanceStore((s) => s.instance);

  if (!instance) {
    return <Navigate to="/instances" />;
  }

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
