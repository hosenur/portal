import { create } from "zustand";
import { persist } from "zustand/middleware";

export type AccentColor =
  | "blue"
  | "zinc"
  | "red"
  | "orange"
  | "amber"
  | "yellow"
  | "lime"
  | "green"
  | "emerald";

interface AccentState {
  accentColor: AccentColor;
  setAccentColor: (color: AccentColor) => void;
}

export const useAccentStore = create<AccentState>()(
  persist(
    (set) => ({
      accentColor: "blue",
      setAccentColor: (color) => set({ accentColor: color }),
    }),
    {
      name: "opencode-accent-color",
    },
  ),
);
