import { useEffect } from "react";
import {
  Autocomplete,
  ListBox,
  Popover,
  useFilter,
} from "react-aria-components";
import { Label } from "@/components/ui/field";
import { Dialog } from "@/components/ui/dialog";
import { SearchField, SearchInput } from "@/components/ui/search-field";
import {
  Select,
  SelectItem,
  SelectSection,
  SelectTrigger,
} from "@/components/ui/select";
import { useModelStore } from "@/stores/model-store";
import { useProviders } from "@/hooks/use-opencode";

interface ModelItem {
  id: string;
  name: string;
}

interface ModelData {
  id: string;
  name: string;
  providerID: string;
}

interface Provider {
  id: string;
  name: string;
  models: Record<string, ModelData>;
}

interface ProviderWithModels {
  id: string;
  name: string;
  models: ModelItem[];
}

interface ModelsData {
  providers: ProviderWithModels[];
  defaultModel: string | null;
}

function transformProviders(data: {
  providers?: Provider[];
  default?: Record<string, string>;
}): ModelsData {
  const providers = data?.providers || [];
  const defaults = data?.default || {};

  let defaultModel: string | null = null;
  for (const [providerId, modelId] of Object.entries(defaults)) {
    if (modelId) {
      defaultModel = `${providerId}/${modelId}`;
      break;
    }
  }

  return {
    providers: providers.map((provider) => ({
      id: provider.id,
      name: provider.name,
      models: Object.values(provider.models || {}).map((model) => ({
        id: `${provider.id}/${model.id}`,
        name: model.name,
      })),
    })),
    defaultModel,
  };
}

export function ModelSelect() {
  const { data: rawData, isLoading } = useProviders();
  const { contains } = useFilter({ sensitivity: "base" });

  const selectedModel = useModelStore((s) => s.selectedModel);
  const setModelFromKey = useModelStore((s) => s.setModelFromKey);
  const setModelFromDefault = useModelStore((s) => s.setModelFromDefault);

  const data = rawData ? transformProviders(rawData) : null;
  const providers = data?.providers ?? [];
  const defaultModel = data?.defaultModel ?? null;
  const selectedModelKey = `${selectedModel.providerID}/${selectedModel.modelID}`;

  useEffect(() => {
    if (defaultModel) {
      setModelFromDefault(defaultModel);
    }
  }, [defaultModel, setModelFromDefault]);

  return (
    <Select
      aria-label="Model"
      placeholder={isLoading ? "Loading models..." : "Select a model"}
      className="min-w-48"
      selectedKey={selectedModelKey}
      onSelectionChange={(key) => {
        if (key) {
          setModelFromKey(String(key));
        }
      }}
    >
      <Label className="sr-only">Model</Label>
      <SelectTrigger className="w-48 ml-auto" />
      <Popover className="entering:fade-in exiting:fade-out flex max-h-96 w-(--trigger-width) entering:animate-in exiting:animate-out flex-col overflow-hidden rounded-lg border bg-overlay">
        <Dialog aria-label="Model">
          <Autocomplete filter={contains}>
            <div className="border-b bg-muted p-2">
              <SearchField className="rounded-lg bg-bg" autoFocus>
                <SearchInput placeholder="Search models..." />
              </SearchField>
            </div>
            <ListBox
              className="grid max-h-80 w-full grid-cols-[auto_1fr] flex-col gap-y-1 overflow-y-auto p-1 outline-hidden *:[[role='group']+[role=group]]:mt-4 *:[[role='group']+[role=separator]]:mt-1"
              items={providers}
            >
              {(provider) => (
                <SelectSection title={provider.name} items={provider.models}>
                  {(model) => (
                    <SelectItem id={model.id} textValue={model.name}>
                      {model.name}
                    </SelectItem>
                  )}
                </SelectSection>
              )}
            </ListBox>
          </Autocomplete>
        </Dialog>
      </Popover>
    </Select>
  );
}
