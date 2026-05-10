import {
  ArrowRightStartOnRectangleIcon,
  ChevronUpDownIcon,
  Cog6ToothIcon,
  EllipsisHorizontalIcon,
  FileDiffIcon,
  HomeIcon,
  LifebuoyIcon,
  PlusIcon,
  ShieldCheckIcon,
  TrashIcon,
} from "@/components/icons/lucide";
import { ProviderIcon } from "@/components/icons/provider-icon";
import { useEffect, useState, useMemo } from "react";
import { parsePatchFiles } from "@pierre/diffs";
import { Avatar } from "@/components/ui/avatar";
import {
  ComboBox,
  ComboBoxContent,
  ComboBoxDescription,
  ComboBoxInput,
  ComboBoxItem,
  ComboBoxLabel,
} from "@/components/ui/combo-box";
import { Link as UILink } from "@/components/ui/link";
import { toast } from "@/components/ui/toast";
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
import {
  useSessions,
  useCreateSession,
  useDeleteSession,
  useHostname,
  useGitDiff,
  useInstances,
} from "@/hooks/use-opencode";
import { useInstanceStore } from "@/stores/instance-store";
import { useNavigate, useMatch } from "@tanstack/react-router";
import type { Session } from "@opencode-ai/sdk/v2";
import type { BackendProvider } from "@/lib/backend-url";

interface InstanceData {
  id: string;
  name: string;
  provider?: BackendProvider;
  directory: string;
  port: number;
}

function formatDirectoryPath(directory: string): string {
  const normalized = directory.replace(/\\+/g, "/").replace(/\/+$/g, "");
  const homePath =
    normalized.match(/^\/Users\/[^/]+\/(.+)$/) ??
    normalized.match(/^\/home\/[^/]+\/(.+)$/) ??
    normalized.match(/^[A-Za-z]:\/Users\/[^/]+\/(.+)$/);

  if (homePath?.[1]) return homePath[1];
  if (normalized.startsWith("~/")) return normalized.slice(2);
  if (normalized.startsWith("/")) return normalized.slice(1) || "/";

  return normalized || directory;
}

function InstanceSwitcher() {
  const navigate = useNavigate();
  const instance = useInstanceStore((s) => s.instance);
  const setInstance = useInstanceStore((s) => s.setInstance);
  const { data } = useInstances();
  const instances: InstanceData[] = data?.instances ?? [];
  const [inputValue, setInputValue] = useState(instance?.name ?? "");

  useEffect(() => {
    setInputValue(instance?.name ?? "");
  }, [instance?.id, instance?.name]);

  const filteredInstances = useMemo(() => {
    const query = inputValue.trim().toLowerCase();

    if (!query || query === instance?.name.toLowerCase()) {
      return instances;
    }

    return instances.filter((item) =>
      `${item.name} ${item.directory} ${item.port}`
        .toLowerCase()
        .includes(query),
    );
  }, [inputValue, instance?.name, instances]);

  const handleSelectionChange = (key: React.Key | null) => {
    if (key == null) return;

    const selected = instances.find((item) => item.id === String(key));
    if (!selected) return;

    setInstance({
      id: selected.id,
      name: selected.name,
      port: selected.port,
      provider: selected.provider ?? "opencode",
    });
    setInputValue(selected.name);
    navigate({ to: "/" });
  };

  return (
    <div className="col-span-full min-w-0 py-1 in-data-[state=collapsed]:hidden">
      <ComboBox
        aria-label="Switch instance"
        selectedKey={instance?.id ?? null}
        inputValue={inputValue}
        onInputChange={setInputValue}
        onSelectionChange={handleSelectionChange}
        isDisabled={!data || instances.length === 0}
      >
        <ComboBoxInput
          prefix={
            <ProviderIcon
              provider={instance?.provider}
              data-slot="icon"
              className="size-4 text-muted-fg"
              aria-hidden="true"
            />
          }
          placeholder={data ? "Select instance" : "Loading instances..."}
          className="h-8 rounded-md px-2.5 py-0"
        />
        <ComboBoxContent
          items={filteredInstances}
          popover={{
            placement: "bottom start",
            className: "w-(--trigger-width)",
          }}
        >
          {(item) => (
            <ComboBoxItem id={item.id} textValue={item.name}>
              <ProviderIcon
                provider={item.provider}
                data-slot="icon"
                className="size-4"
              />
              <ComboBoxLabel className="min-w-0 truncate">
                {item.name}
              </ComboBoxLabel>
              <ComboBoxDescription className="flex min-w-0 items-center gap-2 text-xs">
                <span className="truncate">
                  {formatDirectoryPath(item.directory)}
                </span>
                <span className="shrink-0 tabular-nums">:{item.port}</span>
              </ComboBoxDescription>
            </ComboBoxItem>
          )}
        </ComboBoxContent>
      </ComboBox>
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
  const [creating, setCreating] = useState(false);
  const navigate = useNavigate();
  const instance = useInstanceStore((s) => s.instance);
  const { data: hostnameData } = useHostname();
  const hostname = hostnameData?.hostname ?? "Loading...";
  const { data: sessionsData, mutate: mutateSessions } = useSessions();
  const createSession = useCreateSession();
  const deleteSession = useDeleteSession();
  const sessions: Session[] = sessionsData ?? [];

  const { data: diffData } = useGitDiff();
  const diffFileCount = useMemo(() => {
    if (!diffData?.diff) return 0;
    try {
      const patches = parsePatchFiles(diffData.diff);
      return patches.reduce((count, patch) => count + patch.files.length, 0);
    } catch {
      return 0;
    }
  }, [diffData?.diff]);

  async function handleNewSession() {
    if (creating) return;
    setCreating(true);
    try {
      const session = await createSession();
      await mutateSessions();
      toast.success("Session created");
      navigate({ to: "/session/$id", params: { id: session.id } });
    } catch (error) {
      console.error("Failed to create session:", error);
      toast.error("Failed to create session");
    } finally {
      setCreating(false);
    }
  }

  const currentSessionMatch = useMatch({
    from: "/_app/session/$id",
    shouldThrow: false,
  });
  const currentSessionId = currentSessionMatch?.params?.id;

  async function handleDeleteSession(sessionId: string) {
    try {
      await deleteSession(sessionId);
      await mutateSessions();
      toast.success("Session deleted");
      // If we deleted the current session, navigate to home
      if (currentSessionId === sessionId) {
        navigate({ to: "/" });
      }
    } catch (error) {
      console.error("Failed to delete session:", error);
      toast.error("Failed to delete session");
    }
  }

  return (
    <Sidebar {...props}>
      <SidebarHeader>
        <UILink href="/" className="flex items-center gap-x-2">
          <img src="/logo.svg" alt="OpenCode Portal" className="size-6" />
          <SidebarLabel className="font-medium">
            OpenCode <span className="text-muted-fg">Portal</span>
          </SidebarLabel>
        </UILink>
      </SidebarHeader>
      <SidebarContent>
        <SidebarSectionGroup>
          <SidebarSection>
            <InstanceSwitcher />
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
            <SidebarItem
              tooltip="View Git Diff"
              href="/diff"
              className="cursor-pointer gap-x-2"
              badge={diffFileCount > 0 ? diffFileCount : undefined}
            >
              <FileDiffIcon className="size-4 shrink-0" data-slot="icon" />
              <SidebarLabel>Diff</SidebarLabel>
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
                {instance && (
                  <span className="block text-muted-fg text-xs">
                    {instance.name}
                  </span>
                )}
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
            <MenuItem href="https://openportal.space/contact">
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
