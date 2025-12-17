import { EllipsisHorizontalIcon } from "@heroicons/react/16/solid";
import { TrashIcon } from "@heroicons/react/24/solid";
import { useRouter } from "next/router";
import { useCallback, useEffect, useState } from "react";
import { IconGridPlus } from "@/components/icons/grid-plus-icon";
import { Button } from "@/components/ui/button";
import { Keyboard } from "@/components/ui/keyboard";
import { Link } from "@/components/ui/link";
import { Menu, MenuContent, MenuItem, MenuTrigger } from "@/components/ui/menu";
import useMediaQuery from "@/hooks/use-media-query";
import { mutateSessions, useSessions } from "@/hooks/use-sessions";

function truncateTitle(title: string, maxLength = 40): string {
  if (title.length <= maxLength) return title;
  const halfLength = Math.floor((maxLength - 3) / 2);
  return `${title.slice(0, halfLength)}...${title.slice(-halfLength)}`;
}

export default function EmptyState() {
  const router = useRouter();
  const [creating, setCreating] = useState(false);
  const { isMobile } = useMediaQuery();
  const { sessions, error, isLoading } = useSessions();

  const handleNewSession = useCallback(async () => {
    setCreating(true);
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
  }, [router]);

  async function handleDeleteSession(sessionId: string) {
    try {
      const response = await fetch(`/api/sessions/${sessionId}`, {
        method: "DELETE",
      });
      if (!response.ok) {
        throw new Error("Failed to delete session");
      }

      mutateSessions();
    } catch (err) {
      console.error("Failed to delete session:", err);
    }
  }

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Enter" && event.shiftKey && !creating) {
        event.preventDefault();
        handleNewSession();
      }
    }

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [creating, handleNewSession]);

  // Mobile view with sessions list
  if (isMobile) {
    return (
      <div className="flex h-full flex-col">
        <div className="flex flex-col items-center pt-8 pb-6">
          <div className="flex items-center gap-x-2 mb-2">
            <img src="/logo.svg" alt="OpenCode Portal" className="size-8" />
            <h2 className="text-2xl font-medium text-gray-900 dark:text-gray-100">
              OpenCode <span className="text-muted-fg">Portal</span>
            </h2>
          </div>
        </div>

        <div className="px-4 pb-4">
          <Button
            intent="outline"
            onPress={handleNewSession}
            isDisabled={creating}
            className="w-full"
          >
            <IconGridPlus className="shrink-0" />
            {creating ? "Creating..." : "New Session"}
          </Button>
        </div>

        <div className="flex-1 overflow-y-auto px-4">
          <h3 className="text-sm font-medium text-muted-fg mb-2">Sessions</h3>

          {isLoading && (
            <p className="text-sm text-muted-fg py-2">Loading sessions...</p>
          )}

          {error && (
            <p className="text-sm text-red-500 py-2">Error: {error.message}</p>
          )}

          {!isLoading && !error && (!sessions || sessions.length === 0) && (
            <p className="text-sm text-muted-fg py-2">No sessions found</p>
          )}

          {!isLoading && !error && sessions && sessions.length > 0 && (
            <ul className="space-y-1">
              {sessions.map((session) => (
                <li
                  key={session.id}
                  className="group flex items-center justify-between rounded-lg hover:bg-secondary/50 transition-colors"
                >
                  <Link
                    href={`/session/${session.id}`}
                    className="flex-1 py-2 px-3 text-sm truncate"
                  >
                    {truncateTitle(
                      session.title || `Session ${session.id.slice(0, 8)}`,
                    )}
                  </Link>
                  <Menu>
                    <MenuTrigger className="p-2 opacity-0 group-hover:opacity-100 focus:opacity-100 transition-opacity">
                      <EllipsisHorizontalIcon className="size-4" />
                    </MenuTrigger>
                    <MenuContent
                      popover={{
                        offset: 0,
                        placement: "bottom end",
                      }}
                    >
                      <MenuItem
                        intent="danger"
                        onAction={() => handleDeleteSession(session.id)}
                      >
                        <TrashIcon />
                        Delete Session
                      </MenuItem>
                    </MenuContent>
                  </Menu>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    );
  }

  // Desktop view (original)
  return (
    <div className="flex h-full items-center justify-center">
      <div className="text-center max-w-md">
        <div className="flex items-center justify-center gap-x-2 mb-4">
          <img src="/logo.svg" alt="OpenCode Portal" className="size-8" />
          <h2 className="text-2xl font-medium text-gray-900 dark:text-gray-100">
            OpenCode Portal
          </h2>
        </div>
        <p className="text-gray-600 dark:text-gray-400 mb-6">
          Select an existing session from the left panel or create a new one to
          get started
        </p>
        <div className="text-sm text-gray-500 dark:text-gray-400">
          Press <Keyboard>Shift + Enter</Keyboard> to start a new session
        </div>
      </div>
    </div>
  );
}
