import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo } from "react";
import { parseDiff, Diff, Hunk } from "react-diff-view";
import "react-diff-view/style/index.css";
import { Loader } from "@/components/ui/loader";
import { Button } from "@/components/ui/button";
import { useGitDiff } from "@/hooks/use-opencode";
import { useBreadcrumb } from "@/contexts/breadcrumb-context";
import { ArrowPathIcon } from "@heroicons/react/24/outline";

export const Route = createFileRoute("/_app/diff")({
  component: DiffPage,
});

function DiffPage() {
  const { data, error, isLoading, mutate } = useGitDiff();
  const { setPageTitle } = useBreadcrumb();

  useEffect(() => {
    setPageTitle("Git Diff");
    return () => setPageTitle(null);
  }, [setPageTitle]);

  const files = useMemo(() => {
    if (!data?.diff) return [];
    try {
      return parseDiff(data.diff);
    } catch {
      return [];
    }
  }, [data?.diff]);

  if (isLoading) {
    return (
      <div className="flex h-full items-center justify-center">
        <Loader className="size-8" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-4">
        <div className="text-danger">Error loading diff: {error.message}</div>
        <Button onPress={() => mutate()}>
          <ArrowPathIcon className="size-4" />
          Retry
        </Button>
      </div>
    );
  }

  if (!data?.diff || files.length === 0) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-4">
        <div className="text-muted-fg">No changes detected</div>
        <Button onPress={() => mutate()}>
          <ArrowPathIcon className="size-4" />
          Refresh
        </Button>
      </div>
    );
  }

  return (
    <div className="-m-4 flex h-full flex-col">
      <div className="flex items-center justify-between border-b border-border px-4 py-3">
        <h1 className="text-lg font-semibold">Git Diff</h1>
        <Button intent="secondary" size="sm" onPress={() => mutate()}>
          <ArrowPathIcon className="size-4" />
          Refresh
        </Button>
      </div>

      <div className="flex-1 overflow-auto">
        {files.map((file) => (
          <div
            key={file.oldPath + file.newPath}
            className="border-b border-border"
          >
            <div className="sticky top-0 z-10 bg-muted/50 px-4 py-2 font-mono text-sm backdrop-blur">
              {file.type === "delete" ? (
                <span className="text-danger">{file.oldPath}</span>
              ) : file.type === "add" ? (
                <span className="text-success">{file.newPath}</span>
              ) : file.oldPath === file.newPath ? (
                <span>{file.newPath}</span>
              ) : (
                <span>
                  {file.oldPath} → {file.newPath}
                </span>
              )}
            </div>
            <Diff viewType="unified" diffType={file.type} hunks={file.hunks}>
              {(hunks) =>
                hunks.map((hunk) => <Hunk key={hunk.content} hunk={hunk} />)
              }
            </Diff>
          </div>
        ))}
      </div>
    </div>
  );
}
