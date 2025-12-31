import { create } from "zustand";
import { persist } from "zustand/middleware";

interface Container {
  id: string;
  name: string;
  port: number;
}

interface ContainerState {
  container: Container | null;
  setContainer: (container: Container | null) => void;
  clearContainer: () => void;
}

export const useContainerStore = create<ContainerState>()(
  persist(
    (set) => ({
      container: null,
      setContainer: (container) => set({ container }),
      clearContainer: () => set({ container: null }),
    }),
    {
      name: "opencode-container",
    },
  ),
);
