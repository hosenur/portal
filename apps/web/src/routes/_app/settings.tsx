import { createFileRoute } from "@tanstack/react-router";
import { AccentSelector } from "@/components/accent-selector";
import { useTheme } from "@/providers/theme-provider";
import { Menu, MenuContent, MenuItem, MenuTrigger } from "@/components/ui/menu";
import {
  MoonIcon,
  SunIcon,
  ComputerDesktopIcon,
} from "@heroicons/react/24/outline";
import { Button } from "@/components/ui/button";

function ThemeSetting() {
  const { setTheme, resolvedTheme } = useTheme();

  return (
    <Menu>
      <MenuTrigger aria-label="Toggle theme">
        <Button intent="plain" size="sq-sm">
          {resolvedTheme === "dark" ? (
            <MoonIcon className="size-4" />
          ) : (
            <SunIcon className="size-4" />
          )}
        </Button>
      </MenuTrigger>
      <MenuContent placement="top">
        <MenuItem onAction={() => setTheme("light")}>
          <SunIcon className="size-4" />
          Light
        </MenuItem>
        <MenuItem onAction={() => setTheme("dark")}>
          <MoonIcon className="size-4" />
          Dark
        </MenuItem>
        <MenuItem onAction={() => setTheme("system")}>
          <ComputerDesktopIcon className="size-4" />
          System
        </MenuItem>
      </MenuContent>
    </Menu>
  );
}

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
          <div className="flex items-center justify-between">
            <div>
              <h2 className="font-medium text-fg">Appearance</h2>
              <p className="mt-1 text-sm text-muted-fg">
                Customize the look and feel of the portal.
              </p>
            </div>
            <div className="flex items-center gap-2">
              <AccentSelector />
              <ThemeSetting />
            </div>
          </div>
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
