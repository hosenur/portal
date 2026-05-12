import type { Agent } from "@opencode-ai/sdk/v2";

type AgentSelectionMetadata = Agent & {
  hidden?: boolean;
  mode?: string;
};

export function isUserSelectableAgent(agent: Agent) {
  const item = agent as AgentSelectionMetadata;
  return item.mode !== "subagent" && item.hidden !== true;
}

export function userSelectableAgents(agents: Agent[]) {
  return agents.filter(isUserSelectableAgent);
}

export function isValidUserSelectableAgent(agents: Agent[], name?: string) {
  if (!name) return false;
  return userSelectableAgents(agents).some((agent) => agent.name === name);
}

export function getDefaultUserSelectableAgentName(agents: Agent[]) {
  return userSelectableAgents(agents)[0]?.name;
}
