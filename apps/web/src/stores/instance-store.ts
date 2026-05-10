import { create } from "zustand";
import type { BackendProvider } from "@/lib/backend-url";

export interface Instance {
  id: string;
  name: string;
  port: number;
  provider?: BackendProvider;
}

interface InstanceState {
  instance: Instance | null;
  setInstance: (instance: Instance | null) => void;
  clearInstance: () => void;
}

if (typeof window !== "undefined") {
  window.localStorage.removeItem("opencode-instance");
}

export const useInstanceStore = create<InstanceState>()(
  (set) => ({
    instance: null,
    setInstance: (instance) => set({ instance }),
    clearInstance: () => set({ instance: null }),
  }),
);
