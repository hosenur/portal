import { create } from "zustand";

interface AgentState {
  selectedAgents: Record<string, string | undefined>;
  setSelectedAgent: (sessionId: string, agent: string) => void;
  getSelectedAgent: (
    sessionId: string | null | undefined,
  ) => string | undefined;
}

export const useAgentStore = create<AgentState>((set, get) => ({
  selectedAgents: {},
  setSelectedAgent: (sessionId, agent) =>
    set((state) => ({
      selectedAgents: { ...state.selectedAgents, [sessionId]: agent },
    })),
  getSelectedAgent: (sessionId) => {
    if (!sessionId) return undefined;
    return get().selectedAgents[sessionId];
  },
}));
