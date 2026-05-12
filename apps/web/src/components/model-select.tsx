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
import { toModelKey, useModelStore } from "@/stores/model-store";
import { useProviders } from "@/hooks/use-opencode";

interface ModelItem {
  id: string;
  name: string;
  providerName: string;
  variant?: string;
}

interface ModelData {
  id: string;
  name: string;
  providerID: string;
  variants?: Record<string, unknown>;
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

function formatVariantName(variant: string) {
  const normalized = variant.trim();
  const thinkingLabels: Record<string, string> = {
    none: "Thinking none",
    minimal: "Thinking minimal",
    low: "Thinking low",
    medium: "Thinking medium",
    high: "Thinking high",
    xhigh: "Thinking x-high",
    max: "Thinking max",
  };

  return (
    thinkingLabels[normalized.toLowerCase()] ??
    normalized
      .replace(/[-_]+/g, " ")
      .replace(/\b\w/g, (char) => char.toUpperCase())
  );
}

function modelItems(provider: Provider, model: ModelData): ModelItem[] {
  const base = {
    id: toModelKey({ providerID: provider.id, modelID: model.id }),
    name: model.name,
    providerName: provider.name,
  };
  const variants = Object.keys(model.variants ?? {}).map((variant) => ({
    id: toModelKey({
      providerID: provider.id,
      modelID: model.id,
      variant,
    }),
    name: `${model.name} (${formatVariantName(variant)})`,
    providerName: provider.name,
    variant,
  }));

  return [base, ...variants];
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
      defaultModel = toModelKey({ providerID: providerId, modelID: modelId });
      break;
    }
  }

  return {
    providers: providers.map((provider) => ({
      id: provider.id,
      name: provider.name,
      models: Object.values(provider.models || {}).flatMap((model) =>
        modelItems(provider, model),
      ),
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
  const selectedModelKey = toModelKey(selectedModel);
  const selectedBaseModelKey = toModelKey({
    providerID: selectedModel.providerID,
    modelID: selectedModel.modelID,
  });
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
    : modelKeys.has(selectedBaseModelKey)
      ? selectedBaseModelKey
      : fallbackModel;

  useEffect(() => {
    if (!fallbackModel) return;

    if (!modelKeys.has(selectedModelKey)) {
      setModelFromKey(
        modelKeys.has(selectedBaseModelKey)
          ? selectedBaseModelKey
          : fallbackModel,
      );
      return;
    }

    setModelFromDefault(fallbackModel);
  }, [
    fallbackModel,
    modelKeys,
    selectedBaseModelKey,
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
                <SelectDescription>
                  {model.variant
                    ? `${model.providerName} - ${formatVariantName(model.variant)}`
                    : model.providerName}
                </SelectDescription>
              </SelectItem>
            )}
          </SelectSection>
        )}
      </SelectContent>
    </Select>
  );
}
