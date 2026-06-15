import { useEffect, useRef, useState } from "react";
import { useInstances } from "@/hooks/use-opencode";
import { useInstanceStore, type Instance } from "@/stores/instance-store";
import { backendBasePath, type BackendProvider } from "@/lib/backend-url";

export type ResolveStatus = "idle" | "resolving" | "found" | "notFound";

interface InstanceData {
  id: string;
  name: string;
  port: number;
  provider?: BackendProvider;
}

function toInstance(item: InstanceData): Instance {
  return {
    id: item.id,
    name: item.name,
    port: item.port,
    provider: item.provider ?? "opencode",
  };
}

function sameInstance(a: Instance | null, b: Instance | null): boolean {
  if (!a || !b) return false;
  return (
    a.id === b.id &&
    a.port === b.port &&
    (a.provider ?? "opencode") === (b.provider ?? "opencode")
  );
}

async function instanceOwnsSession(
  instance: Instance,
  sessionId: string,
): Promise<boolean> {
  try {
    const res = await fetch(
      `${backendBasePath(instance.provider, instance.port)}/sessions`,
    );
    if (!res.ok) return false;
    const list = await res.json();
    return (
      Array.isArray(list) &&
      list.some((session) => session?.id === sessionId)
    );
  } catch {
    return false;
  }
}

/**
 * Find which running instance owns the given session id. Checks the currently
 * selected instance first (fast path), then scans the rest in parallel.
 */
export async function findInstanceForSession(
  instances: Instance[],
  sessionId: string,
  selected: Instance | null,
): Promise<Instance | null> {
  if (selected && (await instanceOwnsSession(selected, sessionId))) {
    return selected;
  }

  const others = instances.filter((item) => !sameInstance(item, selected));
  const matches = await Promise.all(
    others.map(async (item) =>
      (await instanceOwnsSession(item, sessionId)) ? item : null,
    ),
  );

  return matches.find((item): item is Instance => item !== null) ?? null;
}

/**
 * Resolves the instance that owns a deep-linked session id and selects it.
 *
 * - When an instance is already selected, the UI is not blocked (status stays
 *   "found"); resolution still runs in the background to correct cross-instance
 *   links.
 * - When no instance is selected yet (fresh load / shared link), status is
 *   "resolving" until the owning instance is located.
 */
export function useResolveSessionInstance(
  sessionId: string | undefined,
): ResolveStatus {
  const { data } = useInstances();
  const instance = useInstanceStore((s) => s.instance);
  const setInstance = useInstanceStore((s) => s.setInstance);
  const [status, setStatus] = useState<ResolveStatus>("idle");
  const resolvedFor = useRef<string | null>(null);

  useEffect(() => {
    if (!sessionId) {
      resolvedFor.current = null;
      setStatus("idle");
      return;
    }

    if (resolvedFor.current === sessionId) return;

    if (!data) {
      if (!instance) setStatus("resolving");
      return;
    }

    const instances: Instance[] = (
      (data.instances ?? []) as InstanceData[]
    ).map(toInstance);

    let cancelled = false;

    setStatus(instance ? "found" : "resolving");

    void (async () => {
      const match = await findInstanceForSession(
        instances,
        sessionId,
        instance,
      );
      if (cancelled) return;

      if (match) {
        if (!sameInstance(instance, match)) setInstance(match);
        resolvedFor.current = sessionId;
        setStatus("found");
      } else {
        resolvedFor.current = sessionId;
        setStatus("notFound");
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [sessionId, data, instance, setInstance]);

  return status;
}
