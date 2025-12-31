import { createFileRoute } from "@tanstack/react-router";
import EmptyState from "@/components/empty-state";

export const Route = createFileRoute("/_app/")({
  component: AppIndex,
});

function AppIndex() {
  return <EmptyState />;
}
