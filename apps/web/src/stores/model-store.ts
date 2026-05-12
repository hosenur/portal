import { create } from "zustand";
import { persist } from "zustand/middleware";

export interface SelectedModel {
  providerID: string;
  modelID: string;
  variant?: string;
}

const DEFAULT_MODEL: SelectedModel = {
  providerID: "",
  modelID: "",
};

function decodeModelKeyPart(value: string) {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

export function parseModelKey(key: string): SelectedModel {
  if (key.includes("|")) {
    const [providerID = "", modelID = "", variant = ""] = key
      .split("|")
      .map(decodeModelKeyPart);

    return {
      providerID,
      modelID,
      ...(variant ? { variant } : {}),
    };
  }

  const [providerID = "", ...rest] = key.split("/");
  const modelID = rest.join("/");
  return { providerID, modelID };
}

export function toModelKey(model: SelectedModel): string {
  return [model.providerID, model.modelID, model.variant ?? ""]
    .map(encodeURIComponent)
    .join("|");
}

interface ModelState {
  selectedModel: SelectedModel;
  isInitialized: boolean;
  setSelectedModel: (model: SelectedModel) => void;
  setModelFromKey: (key: string) => void;
  setModelFromDefault: (defaultKey: string | null) => void;
  getModelKey: () => string;
}

export const useModelStore = create<ModelState>()(
  persist(
    (set, get) => ({
      selectedModel: DEFAULT_MODEL,
      isInitialized: true,
      setSelectedModel: (model) => set({ selectedModel: model }),
      setModelFromKey: (key) => {
        const model = parseModelKey(key);
        set({ selectedModel: model });
      },
      setModelFromDefault: (defaultKey) => {
        const current = get().selectedModel;
        const isDefault =
          current.providerID === DEFAULT_MODEL.providerID &&
          current.modelID === DEFAULT_MODEL.modelID &&
          !current.variant;

        if (defaultKey && isDefault) {
          const model = parseModelKey(defaultKey);
          set({ selectedModel: model });
        }
      },
      getModelKey: () => toModelKey(get().selectedModel),
    }),
    {
      name: "opencode-selected-model",
    },
  ),
);
