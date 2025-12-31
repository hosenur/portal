"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/router";
import {
  CommandMenu,
  CommandMenuItem,
  CommandMenuLabel,
  CommandMenuList,
  CommandMenuSearch,
  CommandMenuSection,
} from "@/components/ui/command-menu";
import { mutateSessions, useSessions } from "@/hooks/use-sessions";
import { IconGridPlus } from "@/components/icons/grid-plus-icon";
import { TrashIcon, ChatBubbleLeftIcon } from "@heroicons/react/24/solid";

function truncateTitle(title: string, maxLength = 40): string {
  if (title.length <= maxLength) return title;
  const halfLength = Math.floor((maxLength - 3) / 2);
  return `${title.slice(0, halfLength)}...${title.slice(-halfLength)}`;
}

export default function Cmd() {
  const [isOpen, setIsOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const router = useRouter();
  const { sessions } = useSessions();

  const currentSessionId =
    typeof router.query.id === "string" ? router.query.id : undefined;
  const isOnSessionPage =
    router.pathname === "/session/[id]" && currentSessionId;

  const recentSessions = sessions?.slice(0, 5) || [];

  useEffect(() => {
    setIsOpen(false);
  }, [router.pathname, router.query.id]);

  async function handleNewSession() {
    setCreating(true);
    setIsOpen(false);
    try {
      const response = await fetch("/api/sessions", { method: "POST" });
      if (!response.ok) {
        throw new Error("Failed to create session");
      }
      const data = await response.json();
      const newSession = data.data || data;

      mutateSessions();
      router.push(`/session/${newSession.id}`);
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
      const response = await fetch(`/api/sessions/${currentSessionId}`, {
        method: "DELETE",
      });
      if (!response.ok) {
        throw new Error("Failed to delete session");
      }

      mutateSessions();
      router.push("/");
    } catch (err) {
      console.error("Failed to delete session:", err);
    }
  }

  function handleSessionSelect(sessionId: string) {
    setIsOpen(false);
    router.push(`/session/${sessionId}`);
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
