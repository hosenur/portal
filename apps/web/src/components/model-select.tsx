import { useEffect, useMemo, useState } from "react";
import {
  Select,
  SelectContent,
  SelectDescription,
  SelectItem,
  SelectLabel,
  SelectSection,
  SelectTrigger,
} from "@/components/ui/select";
import { SearchField, SearchInput } from "@/components/ui/search-field";
import { useModelStore } from "@/stores/model-store";
import { useProviders } from "@/hooks/use-opencode";

interface ModelItem {
  id: string;
  name: string;
  providerName: string;
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
        providerName: provider.name,
      })),
    })),
    defaultModel,
  };
}

function getFirstModelKey(providers: ProviderWithModels[]) {
  return (
    providers.find((provider) => provider.models.length > 0)?.models[0]?.id ??
    null
  );
}

export function ModelSelect() {
  const { data: rawData, isLoading } = useProviders();
  const [search, setSearch] = useState("");

  const selectedModel = useModelStore((s) => s.selectedModel);
  const setModelFromKey = useModelStore((s) => s.setModelFromKey);
  const setModelFromDefault = useModelStore((s) => s.setModelFromDefault);

  const data = useMemo(
    () => (rawData ? transformProviders(rawData) : null),
    [rawData],
  );
  const providers = data?.providers ?? [];
  const defaultModel = data?.defaultModel ?? null;
  const filteredProviders = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return providers;

    return providers
      .map((provider) => ({
        ...provider,
        models: provider.models.filter((model) =>
          `${model.name} ${model.providerName} ${model.id}`
            .toLowerCase()
            .includes(query),
        ),
      }))
      .filter((provider) => provider.models.length > 0);
  }, [providers, search]);
  const selectedModelKey = `${selectedModel.providerID}/${selectedModel.modelID}`;
  const modelKeys = useMemo(
    () =>
      new Set(
        providers.flatMap((provider) =>
          provider.models.map((model) => model.id),
        ),
      ),
    [providers],
  );
  const fallbackModel =
    defaultModel && modelKeys.has(defaultModel)
      ? defaultModel
      : getFirstModelKey(providers);
  const displayModelKey = modelKeys.has(selectedModelKey)
    ? selectedModelKey
    : fallbackModel;

  useEffect(() => {
    if (!fallbackModel) return;

    if (!modelKeys.has(selectedModelKey)) {
      setModelFromKey(fallbackModel);
      return;
    }

    setModelFromDefault(fallbackModel);
  }, [
    fallbackModel,
    modelKeys,
    selectedModelKey,
    setModelFromDefault,
    setModelFromKey,
  ]);

  return (
    <Select
      aria-label="Model"
      placeholder={isLoading ? "Loading models..." : "Select a model"}
      className="w-auto"
      isDisabled={isLoading || providers.length === 0}
      selectedKey={displayModelKey ?? null}
      onSelectionChange={(key) => {
        if (key) {
          setModelFromKey(String(key));
          setSearch("");
        }
      }}
    >
      <SelectTrigger className="w-52" />
      <SelectContent
        items={filteredProviders}
        popover={{ placement: "bottom end" }}
        search={
          <SearchField
            aria-label="Search models"
            value={search}
            onChange={setSearch}
          >
            <SearchInput placeholder="Search models..." />
          </SearchField>
        }
        renderEmptyState={() => (
          <div className="col-span-full px-3 py-6 text-center text-sm text-muted-fg">
            No models found
          </div>
        )}
      >
        {(provider) => (
          <SelectSection title={provider.name} items={provider.models}>
            {(model) => (
              <SelectItem id={model.id} textValue={model.name}>
                <SelectLabel className="min-w-0 truncate">
                  {model.name}
                </SelectLabel>
                <SelectDescription>{model.providerName}</SelectDescription>
              </SelectItem>
            )}
          </SelectSection>
        )}
      </SelectContent>
    </Select>
  );
}
