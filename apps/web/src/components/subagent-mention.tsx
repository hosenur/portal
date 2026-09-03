import { IconBadgeSparkle } from "@/components/icons/lucide";
import { searchSubagents } from "@/lib/agent-selection";
import type { Agent } from "@opencode-ai/sdk/v2";

export interface MentionResult {
  type: "agent" | "file";
  value: string;
}

interface SubagentMentionProps {
  agents: Agent[];
  query: string;
  selectedIndex: number;
  onSelect: (name: string) => void;
  onSelectedIndexChange: (index: number) => void;
}

export function SubagentMentionRows({
  agents,
  query,
  selectedIndex,
  onSelect,
  onSelectedIndexChange,
}: SubagentMentionProps) {
  const results = searchSubagents(agents, query);

  if (results.length === 0) return null;

  return (
    <>
      {results.map((agent, index) => (
        <button
          type="button"
          key={`agent-${agent.name}`}
          className={`flex w-full items-center gap-3 rounded-lg px-2 py-2 text-left text-sm transition-all duration-150 ${
            index === selectedIndex
              ? "bg-primary/10 text-primary-fg"
              : "hover:bg-muted/50 active:bg-muted/70 text-foreground"
          }`}
          onMouseEnter={() => onSelectedIndexChange(index)}
          onClick={() => onSelect(agent.name)}
          onTouchEnd={() => onSelect(agent.name)}
        >
          <div
            className={`flex shrink-0 items-center justify-center rounded-md p-1.5 ${
              index === selectedIndex
                ? "bg-primary text-primary-fg"
                : "bg-[color-mix(in_oklab,var(--color-primary)_20%,var(--color-muted))] text-primary"
            }`}
          >
            <IconBadgeSparkle className="size-4" />
          </div>
          <div className="flex flex-col min-w-0 flex-1">
            <span
              className={`font-medium truncate leading-tight ${
                index === selectedIndex
                  ? "text-primary-fg"
                  : "text-foreground"
              }`}
            >
              @{agent.name}
            </span>
            <span
              className={`text-[10px] truncate leading-tight ${
                index === selectedIndex
                  ? "text-primary-fg/70"
                  : "text-muted-fg/70"
              }`}
            >
              {agent.description || "Subagent"}
            </span>
          </div>
        </button>
      ))}
    </>
  );
}

export function subagentResults(
  agents: Agent[],
  query: string,
): MentionResult[] {
  return searchSubagents(agents, query).map((agent) => ({
    type: "agent",
    value: agent.name,
  }));
}