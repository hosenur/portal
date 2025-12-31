import { EllipsisHorizontalIcon } from "@heroicons/react/16/solid";
import { ChevronUpDownIcon } from "@heroicons/react/24/outline";
import {
  ArrowRightStartOnRectangleIcon,
  Cog6ToothIcon,
  HomeIcon,
  LifebuoyIcon,
  ShieldCheckIcon,
  TrashIcon,
  CubeIcon,
  PlusIcon,
} from "@heroicons/react/24/solid";
import { Link } from "@tanstack/react-router";
import { useState } from "react";
import { Avatar } from "@/components/ui/avatar";
import { Link as UILink } from "@/components/ui/link";
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

interface Session {
  id: string;
  title: string;
}

const DUMMY_SESSIONS: Session[] = [
  { id: "1", title: "Fix authentication bug" },
  { id: "2", title: "Add dark mode support" },
  { id: "3", title: "Refactor API endpoints" },
  { id: "4", title: "Update dependencies" },
  { id: "5", title: "Implement caching" },
];

function truncateTitle(title: string, maxLength = 40): string {
  if (title.length <= maxLength) return title;
  const halfLength = Math.floor((maxLength - 3) / 2);
  return `${title.slice(0, halfLength)}...${title.slice(-halfLength)}`;
}

export default function AppSidebar(
  props: React.ComponentProps<typeof Sidebar>,
) {
  const [creating, setCreating] = useState(false);
  const hostname = "localhost";
  const sessions = DUMMY_SESSIONS;

  async function handleNewSession() {
    setCreating(true);
    setTimeout(() => {
      setCreating(false);
    }, 1000);
  }

  async function handleDeleteSession(sessionId: string) {
    console.log("Deleting session:", sessionId);
  }

  return (
    <Sidebar {...props}>
      <SidebarHeader>
        <UILink href="/" className="flex items-center gap-x-2">
          <CubeIcon className="size-6 text-primary" data-slot="icon" />
          <SidebarLabel className="font-medium">
            OpenCode <span className="text-muted-fg">Portal</span>
          </SidebarLabel>
        </UILink>
      </SidebarHeader>
      <SidebarContent>
        <SidebarSectionGroup>
          <SidebarSection>
            <div className="flex items-center gap-2 px-2 py-1.5">
              <CubeIcon className="size-4 shrink-0 text-muted-fg" />
              <div className="text-sm font-medium">My Project</div>
            </div>
          </SidebarSection>

          <SidebarSection>
            <SidebarItem
              tooltip="New Session"
              onPress={handleNewSession}
              className="cursor-pointer gap-x-2"
            >
              <PlusIcon className="size-4 shrink-0" data-slot="icon" />
              <SidebarLabel>
                {creating ? "Creating..." : "New Session"}
              </SidebarLabel>
            </SidebarItem>
          </SidebarSection>

          <SidebarSection label="Sessions">
            {sessions.map((session) => (
              <SidebarItem key={session.id} tooltip={session.title}>
                {({ isCollapsed, isFocused }) => (
                  <>
                    <SidebarLink href={`/session/${session.id}`}>
                      <SidebarLabel>
                        {truncateTitle(session.title)}
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
                initials={hostname.slice(0, 2).toUpperCase()}
              />
              <div className="in-data-[collapsible=dock]:hidden text-sm">
                <SidebarLabel>{hostname}</SidebarLabel>
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
                <span className="block">{hostname}</span>
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
