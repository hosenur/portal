import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/_app/session/$id")({
  component: SessionPage,
});

function SessionPage() {
  const { id } = Route.useParams();

  return (
    <div className="space-y-4">
      <div className="rounded-lg border border-border bg-overlay p-6">
        <h1 className="text-xl font-semibold text-fg">Session {id}</h1>
        <p className="mt-2 text-muted-fg">
          This is a placeholder for session content. The actual chat interface
          would go here.
        </p>
      </div>

      <div className="rounded-lg border border-border bg-overlay p-4">
        <div className="flex items-center gap-2 text-sm text-muted-fg">
          <span>Session ID:</span>
          <code className="rounded bg-muted px-2 py-0.5 text-fg">{id}</code>
        </div>
      </div>
    </div>
  );
}
