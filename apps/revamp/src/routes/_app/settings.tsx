import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/_app/settings")({
  component: SettingsPage,
});

function SettingsPage() {
  return (
    <div className="space-y-6">
      <div className="rounded-lg border border-border bg-overlay p-6">
        <h1 className="text-2xl font-semibold text-fg">Settings</h1>
        <p className="mt-2 text-muted-fg">
          Configure your OpenCode Portal preferences.
        </p>
      </div>

      <div className="space-y-4">
        <div className="rounded-lg border border-border bg-overlay p-4">
          <h2 className="font-medium text-fg">Appearance</h2>
          <p className="mt-1 text-sm text-muted-fg">
            Customize the look and feel of the portal.
          </p>
        </div>

        <div className="rounded-lg border border-border bg-overlay p-4">
          <h2 className="font-medium text-fg">Model Selection</h2>
          <p className="mt-1 text-sm text-muted-fg">
            Choose your preferred AI model.
          </p>
        </div>

        <div className="rounded-lg border border-border bg-overlay p-4">
          <h2 className="font-medium text-fg">API Configuration</h2>
          <p className="mt-1 text-sm text-muted-fg">
            Configure API endpoints and authentication.
          </p>
        </div>
      </div>
    </div>
  );
}
