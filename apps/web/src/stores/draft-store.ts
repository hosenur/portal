import { create } from "zustand";

interface DraftState {
  drafts: Record<string, string | undefined>;
  setDraft: (sessionId: string, text: string) => void;
  consumeDraft: (sessionId: string) => string | undefined;
}

export const useDraftStore = create<DraftState>((set, get) => ({
  drafts: {},
  setDraft: (sessionId, text) =>
    set((state) => ({
      drafts: { ...state.drafts, [sessionId]: text },
    })),
  consumeDraft: (sessionId) => {
    const text = get().drafts[sessionId];
    if (text !== undefined) {
      set((state) => {
        const { [sessionId]: _, ...rest } = state.drafts;
        return { drafts: rest };
      });
    }
    return text;
  },
}));
