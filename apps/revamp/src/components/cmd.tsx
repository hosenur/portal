import { useState, useEffect } from "react";
import { useNavigate, useParams, useLocation } from "@tanstack/react-router";
import {
  CommandMenu,
  CommandMenuItem,
  CommandMenuLabel,
  CommandMenuList,
  CommandMenuSearch,
  CommandMenuSection,
} from "@/components/ui/command-menu";
import {
  useSessions,
  useCreateSession,
  useDeleteSession,
  useInstances,
} from "@/hooks/use-opencode";
import { useInstanceStore, type Instance } from "@/stores/instance-store";
import { IconGridPlus } from "@/components/icons/grid-plus-icon";
import IconBox from "@/components/icons/box-icon";
import { IconThemeDark } from "@/components/icons/theme-dark-icon";
import { IconThemeLight } from "@/components/icons/theme-light-icon";
import { IconThemeSystem } from "@/components/icons/theme-system-icon";
import { IconManageInstances } from "@/components/icons/manage-instances-icon";
import {
  TrashIcon,
  ChatBubbleLeftIcon,
  ServerIcon,
} from "@heroicons/react/24/solid";
import { useTheme } from "@/providers/theme-provider";
import { toast } from "@/components/ui/toast";
import type { Session } from "@opencode-ai/sdk";

function truncateTitle(title: string, maxLength = 40): string {
  if (title.length <= maxLength) return title;
  const halfLength = Math.floor((maxLength - 3) / 2);
  return `${title.slice(0, halfLength)}...${title.slice(-halfLength)}`;
}

interface InstanceData {
  id: string;
  name: string;
  directory: string;
  port: number;
  hostname: string;
  pid: number;
  startedAt: string;
  state: "running";
  status: string;
}

export default function Cmd() {
  const [isOpen, setIsOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();
  const params = useParams({ strict: false });
  const { data: sessionsData, mutate } = useSessions();
  const { data: instancesData } = useInstances();
  const createSession = useCreateSession();
  const deleteSession = useDeleteSession();
  const { setTheme } = useTheme();
  const currentInstance = useInstanceStore((s) => s.instance);
  const setInstance = useInstanceStore((s) => s.setInstance);

  const sessions: Session[] = sessionsData ?? [];
  const instances: InstanceData[] = instancesData?.instances ?? [];
  const currentSessionId = params.id as string | undefined;
  const isOnSessionPage =
    location.pathname.startsWith("/session/") && currentSessionId;

  const recentSessions = sessions.slice(0, 5);

  useEffect(() => {
    setIsOpen(false);
  }, [location.pathname]);

  async function handleNewSession() {
    setCreating(true);
    setIsOpen(false);
    try {
      const newSession = await createSession();
      await mutate();
      toast.success("Session created");
      navigate({ to: "/session/$id", params: { id: newSession.id } });
    } catch (err) {
      console.error("Failed to create session:", err);
      toast.error("Failed to create session");
    } finally {
      setCreating(false);
    }
  }

  async function handleDeleteSession() {
    if (!currentSessionId) return;

    setIsOpen(false);
    try {
      await deleteSession(currentSessionId);
      await mutate();
      toast.success("Session deleted");
      navigate({ to: "/" });
    } catch (err) {
      console.error("Failed to delete session:", err);
      toast.error("Failed to delete session");
    }
  }

  function handleSessionSelect(sessionId: string) {
    setIsOpen(false);
    navigate({ to: "/session/$id", params: { id: sessionId } });
  }

  function handleThemeChange(theme: "light" | "dark" | "system") {
    setTheme(theme);
    setIsOpen(false);
  }

  function handleInstanceSelect(instance: InstanceData) {
    const newInstance: Instance = {
      id: instance.id,
      name: instance.name,
      port: instance.port,
    };
    setInstance(newInstance);
    toast.success(`Switched to ${instance.name}`);
    setIsOpen(false);
    navigate({ to: "/" });
  }

  return (
    <CommandMenu
      isOpen={isOpen}
      onOpenChange={setIsOpen}
      shortcut="k"
      isBlurred
    >
      <CommandMenuSearch placeholder="Search commands..." />
      <CommandMenuList>
        {isOnSessionPage && (
          <CommandMenuSection label="Session Actions">
            <CommandMenuItem
              textValue="Delete current session"
              intent="danger"
              onAction={handleDeleteSession}
            >
              <TrashIcon className="size-4" />
              <CommandMenuLabel>Delete Current Session</CommandMenuLabel>
            </CommandMenuItem>
          </CommandMenuSection>
        )}

        <CommandMenuSection label="Actions">
          <CommandMenuItem
            textValue="New session"
            onAction={handleNewSession}
            isDisabled={creating}
          >
            <IconGridPlus className="size-4 mr-2" />
            <CommandMenuLabel>
              {creating ? "Creating..." : "New Session"}
            </CommandMenuLabel>
          </CommandMenuItem>
          <CommandMenuItem
            textValue="Manage instances"
            onAction={() => {
              setIsOpen(false);
              navigate({ to: "/instances" });
            }}
          >
            <IconManageInstances className="size-4 mr-2" />
            <CommandMenuLabel>Manage Instances</CommandMenuLabel>
          </CommandMenuItem>
        </CommandMenuSection>

        {instances.length > 0 && (
          <CommandMenuSection label="Switch Instance">
            {instances.map((instance) => (
              <CommandMenuItem
                key={instance.id}
                textValue={instance.name}
                onAction={() => handleInstanceSelect(instance)}
              >
                {currentInstance?.id === instance.id ? (
                  <IconBox className="size-4 mr-2" />
                ) : (
                  <ServerIcon className="size-4 mr-2" />
                )}
                <CommandMenuLabel>{instance.name}</CommandMenuLabel>
                {currentInstance?.id === instance.id && (
                  <div className="absolute right-2 size-2 rounded-full bg-primary" />
                )}
              </CommandMenuItem>
            ))}
          </CommandMenuSection>
        )}

        <CommandMenuSection label="Theme">
          <CommandMenuItem
            textValue="Light theme"
            onAction={() => handleThemeChange("light")}
          >
            <IconThemeLight className="size-4 mr-2" />
            <CommandMenuLabel>Light</CommandMenuLabel>
          </CommandMenuItem>
          <CommandMenuItem
            textValue="Dark theme"
            onAction={() => handleThemeChange("dark")}
          >
            <IconThemeDark className="size-4 mr-2" />
            <CommandMenuLabel>Dark</CommandMenuLabel>
          </CommandMenuItem>
          <CommandMenuItem
            textValue="System theme"
            onAction={() => handleThemeChange("system")}
          >
            <IconThemeSystem className="size-4 mr-2" />
            <CommandMenuLabel>System</CommandMenuLabel>
          </CommandMenuItem>
        </CommandMenuSection>

        {recentSessions.length > 0 && (
          <CommandMenuSection label="Recent Sessions">
            {recentSessions.map((session) => (
              <CommandMenuItem
                key={session.id}
                textValue={session.title || `Session ${session.id.slice(0, 8)}`}
                onAction={() => handleSessionSelect(session.id)}
              >
                <ChatBubbleLeftIcon className="size-4" />
                <CommandMenuLabel>
                  {truncateTitle(
                    session.title || `Session ${session.id.slice(0, 8)}`,
                  )}
                </CommandMenuLabel>
              </CommandMenuItem>
            ))}
          </CommandMenuSection>
        )}
      </CommandMenuList>
    </CommandMenu>
  );
}
