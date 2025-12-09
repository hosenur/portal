"use client";

import { useEffect } from "react";
import {
  Autocomplete,
  ListBox,
  Popover,
  useFilter,
} from "react-aria-components";
import useSWR from "swr";
import { Dialog } from "@/components/ui/dialog";
import { SearchField, SearchInput } from "@/components/ui/search-field";
import {
  Select,
  SelectItem,
  SelectSection,
  SelectTrigger,
} from "@/components/ui/select";
import { useSelectedModel } from "@/hooks/use-selected-model";

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

interface ConfigResponse {
  data?: {
    providers?: Provider[];
    default?: Record<string, string>;
  };
  providers?: Provider[];
  default?: Record<string, string>;
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

const fetcher = async (url: string): Promise<ModelsData> => {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error("Failed to fetch models");
  }
  const json: ConfigResponse = await response.json();
  const providers = json.data?.providers || json.providers || [];
  const defaults = json.data?.default || json.default || {};

  // Get the default model - format is "provider/model"
  // The defaults object has provider IDs as keys and model IDs as values
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
};

export function ModelSelect() {
  const { data, isLoading } = useSWR("/api/models", fetcher);
  const { contains } = useFilter({ sensitivity: "base" });
  const { selectedModelKey, setModelFromKey, setModelFromDefault } =
    useSelectedModel();

  const providers = data?.providers ?? [];
  const defaultModel = data?.defaultModel ?? null;

  // Set from API default if no stored value exists
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
      <SelectTrigger className="w-min ml-auto" />
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
