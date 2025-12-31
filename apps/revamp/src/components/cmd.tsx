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
} from "@/hooks/use-opencode";
import { IconGridPlus } from "@/components/icons/grid-plus-icon";
import {
  TrashIcon,
  ChatBubbleLeftIcon,
  SunIcon,
  MoonIcon,
  ComputerDesktopIcon,
} from "@heroicons/react/24/solid";
import { useTheme } from "@/providers/theme-provider";
import type { Session } from "@opencode-ai/sdk";

function truncateTitle(title: string, maxLength = 40): string {
  if (title.length <= maxLength) return title;
  const halfLength = Math.floor((maxLength - 3) / 2);
  return `${title.slice(0, halfLength)}...${title.slice(-halfLength)}`;
}

export default function Cmd() {
  const [isOpen, setIsOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();
  const params = useParams({ strict: false });
  const { data: sessionsData, mutate } = useSessions();
  const createSession = useCreateSession();
  const deleteSession = useDeleteSession();
  const { setTheme } = useTheme();

  const sessions: Session[] = sessionsData ?? [];
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
      navigate({ to: "/session/$id", params: { id: newSession.id } });
    } catch (err) {
      console.error("Failed to create session:", err);
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
      navigate({ to: "/" });
    } catch (err) {
      console.error("Failed to delete session:", err);
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
        </CommandMenuSection>

        <CommandMenuSection label="Theme">
          <CommandMenuItem
            textValue="Light theme"
            onAction={() => handleThemeChange("light")}
          >
            <SunIcon className="size-4" />
            <CommandMenuLabel>Light</CommandMenuLabel>
          </CommandMenuItem>
          <CommandMenuItem
            textValue="Dark theme"
            onAction={() => handleThemeChange("dark")}
          >
            <MoonIcon className="size-4" />
            <CommandMenuLabel>Dark</CommandMenuLabel>
          </CommandMenuItem>
          <CommandMenuItem
            textValue="System theme"
            onAction={() => handleThemeChange("system")}
          >
            <ComputerDesktopIcon className="size-4" />
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
