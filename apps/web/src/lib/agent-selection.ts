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

export function subagents(agents: Agent[]) {
  const items = agents as AgentSelectionMetadata[];
  return items.filter((agent) => agent.mode === "subagent");
}

const MENTION_REGEX = /@([\w.-]+)/g;

// Extract the subagent names referenced in a message via `@name`, filtered
// to agents that are actually subagents.
export function extractSubagentMentions(
  text: string,
  agents: Agent[],
): string[] {
  const subagentNames = new Set(subagents(agents).map((agent) => agent.name));
  const mentions: string[] = [];

  for (const match of text.matchAll(MENTION_REGEX)) {
    const name = match[1];
    if (subagentNames.has(name)) {
      mentions.push(name);
    }
  }

  return Array.from(new Set(mentions));
}

// Return subagents whose name matches the `@` query for the mention popover.
export function searchSubagents(agents: Agent[], query: string) {
  const q = query.trim().toLowerCase();
  return subagents(agents).filter(
    (agent) => !q || agent.name.toLowerCase().includes(q),
  );
}
