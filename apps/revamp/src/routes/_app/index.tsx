import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/_app/")({
  component: AppIndex,
});

function AppIndex() {
  return (
    <div className="space-y-6">
      <div className="rounded-lg border border-border bg-overlay p-6">
        <h1 className="text-2xl font-semibold text-fg">
          Welcome to OpenCode Portal
        </h1>
        <p className="mt-2 text-muted-fg">
          Select a session from the sidebar or create a new one to get started.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        <div className="rounded-lg border border-border bg-overlay p-4">
          <h2 className="font-medium text-fg">Quick Stats</h2>
          <p className="mt-1 text-3xl font-bold text-primary">5</p>
          <p className="text-sm text-muted-fg">Active Sessions</p>
        </div>
        <div className="rounded-lg border border-border bg-overlay p-4">
          <h2 className="font-medium text-fg">Recent Activity</h2>
          <p className="mt-1 text-3xl font-bold text-success">12</p>
          <p className="text-sm text-muted-fg">Messages Today</p>
        </div>
        <div className="rounded-lg border border-border bg-overlay p-4">
          <h2 className="font-medium text-fg">Model</h2>
          <p className="mt-1 text-lg font-bold text-fg">GPT-4</p>
          <p className="text-sm text-muted-fg">Current Model</p>
        </div>
      </div>
    </div>
  );
}
