import {
  createFileRoute,
  Outlet,
  Navigate,
  Link,
  useParams,
} from "@tanstack/react-router";
import { useEffect } from "react";
import AppSidebar from "@/components/app-sidebar";
import { AppSidebarNav } from "@/components/app-sidebar-nav";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";
import { BreadcrumbProvider } from "@/contexts/breadcrumb-context";
import { buttonStyles } from "@/components/ui/button";
import { Loader } from "@/components/ui/loader";
import { useInstances } from "@/hooks/use-opencode";
import { useResolveSessionInstance } from "@/hooks/use-resolve-session-instance";
import { useInstanceStore } from "@/stores/instance-store";
import { useOpencodeEvents } from "@/hooks/use-opencode-events";
import type { BackendProvider } from "@/lib/backend-url";

export const Route = createFileRoute("/_app")({
  component: AppLayout,
});

function FullScreenLoader() {
  return (
    <div className="flex h-dvh items-center justify-center">
      <Loader aria-label="Loading session" className="size-6" />
    </div>
  );
}

function SessionNotFound({ id }: { id: string }) {
  return (
    <div className="flex h-dvh flex-col items-center justify-center gap-3 p-6 text-center">
      <h1 className="text-lg font-semibold">Session not found</h1>
      <p className="text-muted-fg text-sm">
        No running instance owns the session{" "}
        <code className="font-mono">{id}</code>.
      </p>
      <Link to="/instances" className={buttonStyles()}>
        Choose an instance
      </Link>
    </div>
  );
}

function AppLayout() {
  const instance = useInstanceStore((s) => s.instance);
  const setInstance = useInstanceStore((s) => s.setInstance);
  const clearInstance = useInstanceStore((s) => s.clearInstance);
  const { data } = useInstances();
  const { id: sessionId } = useParams({ strict: false }) as { id?: string };
  const resolveStatus = useResolveSessionInstance(sessionId);
  const instances: Array<{
    id: string;
    name: string;
    port: number;
    provider?: BackendProvider;
  }> = data?.instances ?? [];

  useEffect(() => {
    if (!data) return;

    // Deep-linked session routes resolve their own instance via
    // useResolveSessionInstance; skip the generic auto-select here so we don't
    // pick the wrong instance in a multi-instance setup.
    if (sessionId) return;

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
  }, [clearInstance, data, instance, instances, sessionId, setInstance]);

  useOpencodeEvents(instance?.port, instance?.provider);

  if (sessionId) {
    if (resolveStatus === "notFound") return <SessionNotFound id={sessionId} />;
    if (!instance || resolveStatus === "resolving") {
      return <FullScreenLoader />;
    }
  } else if (!instance) {
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
