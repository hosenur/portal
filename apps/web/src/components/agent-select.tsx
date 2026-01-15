import { useEffect } from "react";
import { InformationCircleIcon } from "@heroicons/react/24/outline";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectLabel,
  SelectTrigger,
} from "@/components/ui/select";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useAgents } from "@/hooks/use-opencode";
import { useAgentStore } from "@/stores/agent-store";
import type { Agent } from "@opencode-ai/sdk";

interface AgentSelectProps {
  sessionId: string | null;
}

function isValidAgent(agents: Agent[], name?: string) {
  if (!name) return false;
  return agents.some((agent) => agent.name === name);
}

function getDefaultAgentName(agents: Agent[]) {
  return agents.find((agent) => agent.name === "plan")?.name ?? agents[0]?.name;
}

export function AgentSelect({ sessionId }: AgentSelectProps) {
  const { data, isLoading } = useAgents();
  const agents = (data ?? []) as Agent[];

  const selectedAgent = useAgentStore((s) => s.getSelectedAgent(sessionId));
  const setSelectedAgent = useAgentStore((s) => s.setSelectedAgent);

  useEffect(() => {
    if (!sessionId || agents.length === 0) return;
    if (isValidAgent(agents, selectedAgent)) return;

    const fallback = getDefaultAgentName(agents);
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
      <SelectTrigger className="w-40" />
      <SelectContent items={agents}>
        {(agent) => (
          <SelectItem id={agent.name} textValue={agent.name}>
            <SelectLabel>{agent.name}</SelectLabel>
            {agent.description && (
              <div className="col-start-2 row-start-2 flex items-center gap-2 text-muted-fg text-xs">
                <span className="truncate max-w-[200px]">
                  {agent.description}
                </span>
                <Tooltip delay={0}>
                  <TooltipTrigger
                    aria-label={`${agent.name} description`}
                    className="p-0.5 text-muted-fg hover:text-fg"
                    onPress={(event) => event.stopPropagation()}
                  >
                    <InformationCircleIcon className="size-4" />
                  </TooltipTrigger>
                  <TooltipContent placement="right" className="max-w-xs">
                    {agent.description}
                  </TooltipContent>
                </Tooltip>
              </div>
            )}
          </SelectItem>
        )}
      </SelectContent>
    </Select>
  );
}
