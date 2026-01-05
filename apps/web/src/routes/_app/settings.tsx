import * as React from "react";
import { createFileRoute } from "@tanstack/react-router";
import { AccentSelector } from "@/components/accent-selector";
import { useTheme } from "@/providers/theme-provider";
import { useBreadcrumb } from "@/contexts/breadcrumb-context";
import { SwatchIcon, CpuChipIcon, KeyIcon } from "@heroicons/react/24/outline";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
} from "@/components/ui/select";
import { Tabs, TabList, Tab, TabPanel } from "@/components/ui/tabs";

const themes = [
  { id: "light", title: "Light" },
  { id: "dark", title: "Dark" },
  { id: "system", title: "System" },
];

function ThemeSetting() {
  const { theme, setTheme } = useTheme();

  return (
    <Select
      value={theme}
      onChange={(value) =>
        value && setTheme(value as "light" | "dark" | "system")
      }
      placeholder="Select theme"
    >
      <SelectTrigger className="max-w-sm" />
      <SelectContent>
        {themes.map((item) => (
          <SelectItem key={item.id} id={item.id} textValue={item.title}>
            {item.title}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

export const Route = createFileRoute("/_app/settings")({
  component: SettingsPage,
});

const models = [
  { id: "claude-3-5-sonnet", title: "Claude 3.5 Sonnet" },
  { id: "gpt-4o", title: "GPT-4o" },
  { id: "claude-3-opus", title: "Claude 3 Opus" },
];

const fonts = [
  { id: "inter", title: "Inter" },
  { id: "geist-sans", title: "Geist Sans" },
  { id: "geist-mono", title: "Geist Mono" },
  { id: "system", title: "System Default" },
];

function SettingsPage() {
  const { fontFamily, setFontFamily } = useTheme();
  const { setPageTitle } = useBreadcrumb();
  const [selectedModel, setSelectedModel] = React.useState<string | null>(
    "claude-3-5-sonnet",
  );

  React.useEffect(() => {
    setPageTitle("Settings");
    return () => setPageTitle(null);
  }, [setPageTitle]);

  return (
    <div className="container mx-auto space-y-8 px-4 py-10">
      <div className="space-y-2">
        <h1 className="bg-gradient-to-r from-fg to-muted-fg bg-clip-text text-3xl font-bold tracking-tight text-transparent sm:text-4xl">
          Settings
        </h1>
        <p className="text-lg text-muted-fg">
          Manage your interface preferences and configurations.
        </p>
      </div>

      <Tabs aria-label="Settings">
        <TabList>
          <Tab id="appearance">
            <SwatchIcon className="size-4" data-slot="icon" />
            Appearance
          </Tab>
          <Tab id="model">
            <CpuChipIcon className="size-4" data-slot="icon" />
            Model
          </Tab>
          <Tab id="api">
            <KeyIcon className="size-4" data-slot="icon" />
            API
          </Tab>
        </TabList>

        <TabPanel id="appearance" className="pt-6">
          <div className="space-y-6">
            <div>
              <h2 className="text-lg font-semibold">Appearance</h2>
              <p className="text-sm text-muted-fg">
                Customize the visual experience of the portal.
              </p>
            </div>

            <div className="space-y-6">
              <div className="space-y-2">
                <p className="text-sm font-medium">Accent Color</p>
                <p className="text-xs text-muted-fg">
                  Select a primary color for buttons and highlights.
                </p>
                <AccentSelector />
              </div>

              <div className="space-y-2">
                <p className="text-sm font-medium">Theme Preference</p>
                <p className="text-xs text-muted-fg">
                  Switch between light, dark, or system modes.
                </p>
                <ThemeSetting />
              </div>

              <div className="space-y-2">
                <p className="text-sm font-medium">Font Family</p>
                <p className="text-xs text-muted-fg">
                  Choose a typeface for the interface.
                </p>
                <Select
                  value={fontFamily}
                  onChange={(value) =>
                    setFontFamily(
                      value as "inter" | "geist-sans" | "geist-mono" | "system",
                    )
                  }
                  placeholder="Select a font"
                >
                  <SelectTrigger className="max-w-sm" />
                  <SelectContent>
                    {fonts.map((item) => (
                      <SelectItem
                        key={item.id}
                        id={item.id}
                        textValue={item.title}
                      >
                        {item.title}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>
        </TabPanel>

        <TabPanel id="model" className="pt-6">
          <div className="space-y-6">
            <div>
              <h2 className="text-lg font-semibold">Model Configuration</h2>
              <p className="text-sm text-muted-fg">
                Select the AI model that powers your assistant.
              </p>
            </div>

            <div className="space-y-6">
              <div className="space-y-2">
                <p className="text-sm font-medium">Default Model</p>
                <p className="text-xs text-muted-fg">
                  The model used for generating code and responses.
                </p>
                <Select
                  value={selectedModel}
                  onChange={(value) =>
                    setSelectedModel(value?.toString() ?? null)
                  }
                  placeholder="Select a model"
                >
                  <SelectTrigger className="max-w-sm" />
                  <SelectContent>
                    {models.map((item) => (
                      <SelectItem
                        key={item.id}
                        id={item.id}
                        textValue={item.title}
                      >
                        {item.title}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <p className="text-sm font-medium">Temperature</p>
                <p className="text-xs text-muted-fg">
                  Controls randomness in the model's output.
                </p>
                <div className="flex h-9 w-fit items-center rounded-lg border border-input px-3 text-sm text-muted-fg bg-muted/5">
                  0.7
                </div>
              </div>
            </div>
          </div>
        </TabPanel>

        <TabPanel id="api" className="pt-6">
          <div className="space-y-6">
            <div>
              <h2 className="text-lg font-semibold">API Connections</h2>
              <p className="text-sm text-muted-fg">
                Manage your connection settings and API keys.
              </p>
            </div>

            <div className="space-y-6">
              <div className="space-y-2">
                <p className="text-sm font-medium">OpenCode Endpoint</p>
                <p className="text-xs text-muted-fg">
                  The URL of your OpenCode server instance.
                </p>
                <Input
                  defaultValue="http://localhost:4000"
                  readOnly
                  className="w-fit font-mono text-sm text-muted-fg bg-muted/5"
                />
              </div>

              <div className="space-y-2">
                <p className="text-sm font-medium">API Key</p>
                <p className="text-xs text-muted-fg">
                  Your API key is stored locally and never sent to our servers.
                </p>
                <Input
                  type="password"
                  value="sk-................................"
                  readOnly
                  className="w-fit font-mono text-sm text-muted-fg bg-muted/5"
                />
              </div>
            </div>
          </div>
        </TabPanel>
      </Tabs>
    </div>
  );
}
