import { create } from "zustand";
import { persist } from "zustand/middleware";

export type FontFamily = "inter" | "geist-sans" | "geist-mono" | "system";

interface FontState {
  fontFamily: FontFamily;
  setFontFamily: (font: FontFamily) => void;
}

export const useFontStore = create<FontState>()(
  persist(
    (set) => ({
      fontFamily: "inter",
      setFontFamily: (font) => set({ fontFamily: font }),
    }),
    {
      name: "opencode-font-family",
    },
  ),
);
