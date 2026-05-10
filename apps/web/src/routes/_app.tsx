import { createFileRoute, Outlet, Navigate } from "@tanstack/react-router";
import { useEffect } from "react";
import AppSidebar from "@/components/app-sidebar";
import { AppSidebarNav } from "@/components/app-sidebar-nav";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";
import { BreadcrumbProvider } from "@/contexts/breadcrumb-context";
import { useInstances } from "@/hooks/use-opencode";
import { useInstanceStore } from "@/stores/instance-store";
import { useOpencodeEvents } from "@/hooks/use-opencode-events";
import type { BackendProvider } from "@/lib/backend-url";

export const Route = createFileRoute("/_app")({
  component: AppLayout,
});

function AppLayout() {
  const instance = useInstanceStore((s) => s.instance);
  const setInstance = useInstanceStore((s) => s.setInstance);
  const clearInstance = useInstanceStore((s) => s.clearInstance);
  const { data } = useInstances();
  const instances: Array<{
    id: string;
    name: string;
    port: number;
    provider?: BackendProvider;
  }> = data?.instances ?? [];

  useEffect(() => {
    if (!data) return;

    if (instances.length === 0) {
      if (instance) clearInstance();
      return;
    }

    const stillLive =
      instance &&
      instances.some(
        (item) =>
          item.id === instance.id &&
          item.port === instance.port &&
          (item.provider ?? "opencode") ===
            (instance.provider ?? "opencode"),
      );

    if (stillLive) return;

    const next = instances[0];
    setInstance({
      id: next.id,
      name: next.name,
      port: next.port,
      provider: next.provider ?? "opencode",
    });
  }, [clearInstance, data, instance, instances, setInstance]);

  useOpencodeEvents(instance?.port, instance?.provider);

  if (!instance) {
    if (data && instances.length > 0) return null;
    return <Navigate to="/instances" />;
  }

  return (
    <BreadcrumbProvider>
      <SidebarProvider className="h-dvh overflow-hidden">
        <AppSidebar intent="inset" collapsible="dock" />
        <SidebarInset className="overflow-hidden">
          <AppSidebarNav />
          <div className="flex-1 overflow-auto p-4">
            <Outlet />
          </div>
        </SidebarInset>
      </SidebarProvider>
    </BreadcrumbProvider>
  );
}
