import { createFileRoute } from "@tanstack/react-router";
import { useEffect } from "react";
import EmptyState from "@/components/empty-state";
import { useBreadcrumb } from "@/contexts/breadcrumb-context";

export const Route = createFileRoute("/_app/")({
  component: AppIndex,
});

function AppIndex() {
  const { setPageTitle } = useBreadcrumb();

  useEffect(() => {
    setPageTitle(null);
    return () => setPageTitle(null);
  }, [setPageTitle]);

  return <EmptyState />;
}
