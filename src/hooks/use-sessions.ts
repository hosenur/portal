import useSWR, { mutate } from "swr";

export interface Session {
  id: string;
  title?: string;
  createdAt?: string;
  updatedAt?: string;
}

const SESSIONS_KEY = "/api/sessions";

const fetcher = async (url: string): Promise<Session[]> => {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error("Failed to fetch sessions");
  }
  const data = await response.json();
  return data.data || data || [];
};

export function useSessions() {
  const { data, error, isLoading } = useSWR<Session[]>(SESSIONS_KEY, fetcher);

  return {
    sessions: data,
    error,
    isLoading,
  };
}

export function mutateSessions() {
  // Revalidate both the sessions list and all individual session caches
  mutate(
    (key) => typeof key === "string" && key.startsWith("/api/sessions"),
    undefined,
    { revalidate: true },
  );
}

const sessionFetcher = async (url: string): Promise<Session> => {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error("Failed to fetch session");
  }
  const data = await response.json();
  return data.data || data;
};

export function useSession(sessionId: string | undefined) {
  const { data, error, isLoading } = useSWR<Session>(
    sessionId ? `/api/sessions/${sessionId}` : null,
    sessionFetcher,
  );

  return {
    session: data,
    error,
    isLoading,
  };
}
