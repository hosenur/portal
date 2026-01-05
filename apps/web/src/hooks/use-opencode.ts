import useSWR from "swr";
import { useInstanceStore } from "@/stores/instance-store";

const fetcher = async (url: string) => {
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`Request failed: ${res.status}`);
  }
  return res.json();
};

function usePort() {
  const instance = useInstanceStore((s) => s.instance);
  return instance?.port ?? null;
}

export function useInstances() {
  return useSWR("/api/instances", fetcher);
}

export function useSessions() {
  const port = usePort();

  return useSWR(port ? `/api/opencode/${port}/sessions` : null, fetcher);
}

export function useSession(id: string | null) {
  const port = usePort();

  return useSWR(
    port && id ? `/api/opencode/${port}/session/${id}` : null,
    fetcher,
  );
}

export function useSessionMessages(id: string | null) {
  const port = usePort();

  return useSWR(
    port && id ? `/api/opencode/${port}/session/${id}/messages` : null,
    fetcher,
  );
}

export function useConfig() {
  const port = usePort();

  return useSWR(port ? `/api/opencode/${port}/config` : null, fetcher);
}

export function useProviders() {
  const port = usePort();

  return useSWR(port ? `/api/opencode/${port}/providers` : null, fetcher);
}

export function useHealth() {
  const port = usePort();

  return useSWR(port ? `/api/opencode/${port}/health` : null, fetcher);
}

export function useCurrentProject() {
  const port = usePort();

  return useSWR(port ? `/api/opencode/${port}/project/current` : null, fetcher);
}

export function useHostname() {
  return useSWR("/api/system/hostname", fetcher);
}

export function useCreateSession() {
  const port = usePort();

  return async (title?: string) => {
    if (!port) throw new Error("No instance selected");

    const res = await fetch(`/api/opencode/${port}/session/create`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title }),
    });

    if (!res.ok) {
      throw new Error(`Failed to create session: ${res.status}`);
    }

    return res.json();
  };
}

export function useDeleteSession() {
  const port = usePort();

  return async (sessionId: string) => {
    if (!port) throw new Error("No instance selected");

    const res = await fetch(`/api/opencode/${port}/session/${sessionId}`, {
      method: "DELETE",
    });

    if (!res.ok) {
      throw new Error(`Failed to delete session: ${res.status}`);
    }

    return res.json();
  };
}

export function useGitDiff() {
  const port = usePort();

  return useSWR<{ diff: string; worktree: string }>(
    port ? `/api/opencode/${port}/git/diff` : null,
    fetcher,
  );
}
