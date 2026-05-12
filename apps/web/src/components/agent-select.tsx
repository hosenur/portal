import { useEffect } from "react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
} from "@/components/ui/select";
import { useAgents } from "@/hooks/use-opencode";
import {
  getDefaultUserSelectableAgentName,
  isValidUserSelectableAgent,
  userSelectableAgents,
} from "@/lib/agent-selection";
import { useAgentStore } from "@/stores/agent-store";
import type { Agent } from "@opencode-ai/sdk/v2";

interface AgentSelectProps {
  sessionId: string | null;
}

export function AgentSelect({ sessionId }: AgentSelectProps) {
  const { data, isLoading } = useAgents();
  const agents = userSelectableAgents((data ?? []) as Agent[]);

  const selectedAgent = useAgentStore((s) => s.getSelectedAgent(sessionId));
  const setSelectedAgent = useAgentStore((s) => s.setSelectedAgent);

  useEffect(() => {
    if (!sessionId || agents.length === 0) return;
    if (isValidUserSelectableAgent(agents, selectedAgent)) return;

    const fallback = getDefaultUserSelectableAgentName(agents);
    if (fallback) {
      setSelectedAgent(sessionId, fallback);
    }
  }, [agents, sessionId, selectedAgent, setSelectedAgent]);

  return (
    <Select
      aria-label="Agent"
      placeholder={isLoading ? "Loading agents..." : "Select agent"}
      className="w-auto"
      selectedKey={selectedAgent}
      onSelectionChange={(key) => {
        if (sessionId && key) {
          setSelectedAgent(sessionId, String(key));
        }
      }}
    >
      <SelectTrigger className="w-28" />
      <SelectContent items={agents}>
        {(agent) => (
          <SelectItem id={agent.name} textValue={agent.name}>
            {agent.name}
          </SelectItem>
        )}
      </SelectContent>
    </Select>
  );
}
