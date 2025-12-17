import useSWR from "swr";

export interface Project {
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

const PROJECT_KEY = "/api/project/current";

const fetcher = async (url: string): Promise<Project> => {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error("Failed to fetch project");
  }
  const data = await response.json();
  return data.data || data;
};

export function useCurrentProject() {
  const { data, error, isLoading } = useSWR<Project>(PROJECT_KEY, fetcher);

  return {
    project: data,
    error,
    isLoading,
  };
}
