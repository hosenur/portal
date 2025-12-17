"use client";

import { EllipsisHorizontalIcon } from "@heroicons/react/16/solid";
import { ChevronUpDownIcon } from "@heroicons/react/24/outline";
import {
  ArrowRightStartOnRectangleIcon,
  Cog6ToothIcon,
  CommandLineIcon,
  HomeIcon,
  LifebuoyIcon,
  ShieldCheckIcon,
  TrashIcon,
} from "@heroicons/react/24/solid";
import { useRouter } from "next/router";
import { useState } from "react";
import useSWR from "swr";
import IconBox from "@/components/icons/box-icon";
import { IconGridPlus } from "@/components/icons/grid-plus-icon";
import { mutateSessions, useSessions } from "@/hooks/use-sessions";
import { Avatar } from "@/components/ui/avatar";
import { Link } from "@/components/ui/link";
import {
  Menu,
  MenuContent,
  MenuHeader,
  MenuItem,
  MenuSection,
  MenuSeparator,
  MenuTrigger,
} from "@/components/ui/menu";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarItem,
  SidebarLabel,
  SidebarLink,
  SidebarMenuTrigger,
  SidebarRail,
  SidebarSection,
  SidebarSectionGroup,
} from "@/components/ui/sidebar";

interface Project {
  id: string;
  worktree: string;
  vcs?: string;
  vcsDir?: string;
  time?: {
    created?: number;
    initialized?: number;
    updated?: number;
  };
}

const projectFetcher = async (url: string) => {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error("Failed to fetch");
  }
  const data = await response.json();
  return data.data || data;
};

function getProjectName(worktree: string): string {
  const parts = worktree.split("/");
  return parts[parts.length - 1] || worktree;
}

function CurrentProject() {
  const { data: currentProject } = useSWR<Project>(
    "/api/project/current",
    projectFetcher,
  );

  const projectName = currentProject
    ? getProjectName(currentProject.worktree)
    : "Loading...";

  return (
    <div className="flex items-center gap-2 px-2 py-1.5">
      <IconBox className="shrink-0" />
      <div className="text-sm font-medium">{projectName}</div>
    </div>
  );
}

function truncateTitle(title: string, maxLength = 40): string {
  if (title.length <= maxLength) return title;
  const halfLength = Math.floor((maxLength - 3) / 2);
  return `${title.slice(0, halfLength)}...${title.slice(-halfLength)}`;
}

export default function AppSidebar(
  props: React.ComponentProps<typeof Sidebar>,
) {
  const router = useRouter();
  const [creating, setCreating] = useState(false);

  const { sessions, error, isLoading } = useSessions();

  async function handleNewSession() {
    setCreating(true);
    try {
      const response = await fetch("/api/sessions", { method: "POST" });
      if (!response.ok) {
        throw new Error("Failed to create session");
      }
      const data = await response.json();
      const newSession = data.data || data;

      // Refresh the sessions list
      mutateSessions();

      router.push(`/session/${newSession.id}`);
    } catch (err) {
      console.error("Failed to create session:", err);
    } finally {
      setCreating(false);
    }
  }

  async function handleDeleteSession(sessionId: string) {
    try {
      const response = await fetch(`/api/sessions/${sessionId}`, {
        method: "DELETE",
      });
      if (!response.ok) {
        throw new Error("Failed to delete session");
      }

      // Refresh the sessions list
      mutateSessions();

      // If we're on the deleted session's page, navigate away
      if (router.query.id === sessionId) {
        router.push("/");
      }
    } catch (err) {
      console.error("Failed to delete session:", err);
    }
  }

  return (
    <Sidebar {...props}>
      <SidebarHeader>
        <Link href="/" className="flex items-center gap-x-2">
          <img src="/logo.svg" alt="Logo" className="size-6" />
          <SidebarLabel className="font-medium">
            OpenCode <span className="text-muted-fg">Portal</span>
          </SidebarLabel>
        </Link>
      </SidebarHeader>
      <SidebarContent>
        <SidebarSectionGroup>
          <SidebarSection>
            <CurrentProject />
          </SidebarSection>

          <SidebarSection>
            <SidebarItem
              tooltip="New Session"
              onPress={handleNewSession}
              className="cursor-pointer gap-x-2"
            >
              <IconGridPlus className="shrink-0" />
              <SidebarLabel>
                {creating ? "Creating..." : "New Session"}
              </SidebarLabel>
            </SidebarItem>
            <SidebarItem tooltip="Terminal">
              <SidebarLink href="/terminal" className="gap-x-2">
                <CommandLineIcon className="size-4 shrink-0" />
                <SidebarLabel>Terminal</SidebarLabel>
              </SidebarLink>
            </SidebarItem>
          </SidebarSection>

          <SidebarSection label="Sessions">
            {isLoading && (
              <SidebarItem>
                <SidebarLabel className="text-muted-fg">
                  Loading sessions...
                </SidebarLabel>
              </SidebarItem>
            )}

            {error && (
              <SidebarItem>
                <SidebarLabel className="text-red-500">
                  Error: {error.message}
                </SidebarLabel>
              </SidebarItem>
            )}

            {!isLoading && !error && (!sessions || sessions.length === 0) && (
              <SidebarItem>
                <SidebarLabel className="text-muted-fg">
                  No sessions found
                </SidebarLabel>
              </SidebarItem>
            )}

            {!isLoading &&
              !error &&
              sessions?.map((session) => (
                <SidebarItem
                  key={session.id}
                  tooltip={session.title || session.id}
                >
                  {({ isCollapsed, isFocused }) => (
                    <>
                      <SidebarLink href={`/session/${session.id}`}>
                        <SidebarLabel>
                          {truncateTitle(
                            session.title ||
                              `Session ${session.id.slice(0, 8)}`,
                          )}
                        </SidebarLabel>
                      </SidebarLink>
                      {(!isCollapsed || isFocused) && (
                        <Menu>
                          <SidebarMenuTrigger aria-label="Session options">
                            <EllipsisHorizontalIcon />
                          </SidebarMenuTrigger>
                          <MenuContent
                            popover={{
                              offset: 0,
                              placement: "right top",
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
                      )}
                    </>
                  )}
                </SidebarItem>
              ))}
          </SidebarSection>
        </SidebarSectionGroup>
      </SidebarContent>

      <SidebarFooter className="flex flex-row justify-between gap-4 group-data-[state=collapsed]:flex-col">
        <Menu>
          <MenuTrigger
            className="flex w-full items-center justify-between"
            aria-label="Profile"
          >
            <div className="flex items-center gap-x-2">
              <Avatar
                className="size-8 *:size-8 group-data-[state=collapsed]:size-6 group-data-[state=collapsed]:*:size-6"
                isSquare
                src="https://intentui.com/images/avatar/cobain.jpg"
              />
              <div className="in-data-[collapsible=dock]:hidden text-sm">
                <SidebarLabel>Kurt Cobain</SidebarLabel>
                <span className="-mt-0.5 block text-muted-fg">
                  kurt@domain.com
                </span>
              </div>
            </div>
            <ChevronUpDownIcon data-slot="chevron" />
          </MenuTrigger>
          <MenuContent
            className="in-data-[sidebar-collapsible=collapsed]:min-w-56 min-w-(--trigger-width)"
            placement="bottom right"
          >
            <MenuSection>
              <MenuHeader separator>
                <span className="block">Kurt Cobain</span>
                <span className="font-normal text-muted-fg">@cobain</span>
              </MenuHeader>
            </MenuSection>

            <MenuItem href="#dashboard">
              <HomeIcon />
              Dashboard
            </MenuItem>
            <MenuItem href="/settings">
              <Cog6ToothIcon />
              Settings
            </MenuItem>
            <MenuItem href="#security">
              <ShieldCheckIcon />
              Security
            </MenuItem>
            <MenuSeparator />
            <MenuItem href="#contact">
              <LifebuoyIcon />
              Customer Support
            </MenuItem>
            <MenuSeparator />
            <MenuItem href="#logout">
              <ArrowRightStartOnRectangleIcon />
              Log out
            </MenuItem>
          </MenuContent>
        </Menu>
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  );
}
