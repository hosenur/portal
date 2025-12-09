"use client";

import {
  ArrowRightOnRectangleIcon,
  Cog6ToothIcon,
  CommandLineIcon,
  Squares2X2Icon,
} from "@heroicons/react/24/outline";
import { Avatar } from "@/components/ui/avatar";
import { Breadcrumbs, BreadcrumbsItem } from "@/components/ui/breadcrumbs";
import {
  Menu,
  MenuContent,
  MenuHeader,
  MenuItem,
  MenuLabel,
  MenuSection,
  MenuSeparator,
  MenuTrigger,
} from "@/components/ui/menu";
import { SidebarNav, SidebarTrigger } from "@/components/ui/sidebar";
import { useRouter } from "next/router";
import { useEffect, useState } from "react";

interface Project {
  id: string;
  worktree: string;
  name?: string;
}

interface Session {
  id: string;
  title?: string;
}

export default function AppSidebarNav() {
  const router = useRouter();
  const [project, setProject] = useState<Project | null>(null);
  const [session, setSession] = useState<Session | null>(null);

  useEffect(() => {
    // Fetch current project
    fetch("/api/project/current")
      .then((res) => res.json())
      .then((data) => setProject(data.data || data))
      .catch(console.error);

    // Fetch session if we're on a session page
    if (router.pathname.startsWith("/session/")) {
      const sessionId = router.query.id as string;
      if (sessionId) {
        fetch(`/api/sessions/${sessionId}`)
          .then((res) => res.json())
          .then((data) => setSession(data.data || data))
          .catch(console.error);
      }
    } else {
      // Clear session when not on a session page
      setSession(null);
    }
  }, [router.pathname, router.query.id]);

  // Derive project name from worktree path
  const projectName = project?.worktree?.split("/").pop() || "Dashboard";

  return (
    <SidebarNav>
      <span className="flex items-center gap-x-4">
        <SidebarTrigger />
        <Breadcrumbs className="hidden md:flex">
          <BreadcrumbsItem href="/">{projectName}</BreadcrumbsItem>
          {session && (
            <BreadcrumbsItem>
              {session.title || `Session ${session.id}`}
            </BreadcrumbsItem>
          )}
        </Breadcrumbs>
      </span>
      <UserMenu />
    </SidebarNav>
  );
}

function UserMenu() {
  return (
    <Menu>
      <MenuTrigger className="ml-auto md:hidden" aria-label="Open Menu">
        <Avatar
          isSquare
          alt="kurt cobain"
          src="https://intentui.com/images/avatar/cobain.jpg"
        />
      </MenuTrigger>
      <MenuContent popover={{ placement: "bottom end" }} className="min-w-64">
        <MenuSection>
          <MenuHeader separator>
            <span className="block">Kurt Cobain</span>
            <span className="font-normal text-muted-fg">@cobain</span>
          </MenuHeader>
        </MenuSection>
        <MenuItem href="#dashboard">
          <Squares2X2Icon />
          <MenuLabel>Dashboard</MenuLabel>
        </MenuItem>
        <MenuItem href="#settings">
          <Cog6ToothIcon />
          <MenuLabel>Settings</MenuLabel>
        </MenuItem>
        <MenuSeparator />
        <MenuItem>
          <CommandLineIcon />
          <MenuLabel>Command Menu</MenuLabel>
        </MenuItem>
        <MenuSeparator />
        <MenuItem href="#contact-s">
          <MenuLabel>Contact Support</MenuLabel>
        </MenuItem>
        <MenuSeparator />
        <MenuItem href="#logout">
          <ArrowRightOnRectangleIcon />
          <MenuLabel>Log out</MenuLabel>
        </MenuItem>
      </MenuContent>
    </Menu>
  );
}
