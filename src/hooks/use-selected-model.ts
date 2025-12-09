import { useState, useEffect, useCallback } from "react";

const STORAGE_KEY = "opencode-selected-model";

export interface SelectedModel {
  providerID: string;
  modelID: string;
}

const DEFAULT_MODEL: SelectedModel = {
  providerID: "opencode",
  modelID: "grok-code",
};

function parseModelKey(key: string): SelectedModel {
  const [providerID, ...rest] = key.split("/");
  const modelID = rest.join("/");
  return { providerID, modelID };
}

function toModelKey(model: SelectedModel): string {
  return `${model.providerID}/${model.modelID}`;
}

export function useSelectedModel() {
  const [selectedModel, setSelectedModel] =
    useState<SelectedModel>(DEFAULT_MODEL);
  const [isInitialized, setIsInitialized] = useState(false);

  // Load from localStorage on mount
  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored) as SelectedModel;
        if (parsed.providerID && parsed.modelID) {
          setSelectedModel(parsed);
        }
      }
    } catch (e) {
      console.error("Failed to load model from localStorage:", e);
    }
    setIsInitialized(true);
  }, []);

  // Save to localStorage when model changes (after initialization)
  useEffect(() => {
    if (isInitialized) {
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(selectedModel));
        console.log("Selected model:", toModelKey(selectedModel));
      } catch (e) {
        console.error("Failed to save model to localStorage:", e);
      }
    }
  }, [selectedModel, isInitialized]);

  const setModelFromKey = useCallback((key: string) => {
    const model = parseModelKey(key);
    setSelectedModel(model);
  }, []);

  const setModelFromDefault = useCallback((defaultKey: string | null) => {
    // Only set from default if we don't have a stored value
    if (defaultKey && !localStorage.getItem(STORAGE_KEY)) {
      const model = parseModelKey(defaultKey);
      setSelectedModel(model);
    }
  }, []);

  return {
    selectedModel,
    selectedModelKey: toModelKey(selectedModel),
    setSelectedModel,
    setModelFromKey,
    setModelFromDefault,
    isInitialized,
  };
}
