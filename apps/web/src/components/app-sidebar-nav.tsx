import { useState } from "react";
import { useMatch } from "@tanstack/react-router";
import { Breadcrumbs, BreadcrumbsItem } from "@/components/ui/breadcrumbs";
import { Button } from "@/components/ui/button";
import { SidebarNav, SidebarTrigger } from "@/components/ui/sidebar";
import { toast } from "@/components/ui/toast";
import ArrowDownCircleIcon from "@/components/icons/arrow-down-circle-icon";
import ArrowUpCircleIcon from "@/components/icons/arrow-up-circle-icon";
import IconGitPullRequest from "@/components/icons/git-pull-request-icon";
import { useInstanceStore } from "@/stores/instance-store";
import { useModelStore } from "@/stores/model-store";
import { useBreadcrumb } from "@/contexts/breadcrumb-context";
import { mutateSessionMessages } from "@/hooks/use-session-messages";
import { useSessions } from "@/hooks/use-opencode";
import posthog from "posthog-js";

const CREATE_PR_PROMPT = `Use gh CLI to create a pull request. Follow these steps:

1. First, check git status to see all changes
2. Stage all relevant changes with git add
3. Get the diff of staged changes
4. Generate a clear, descriptive commit message based on the changes
5. Commit the changes
6. Push to the remote branch (create branch if needed)
7. Create a PR using gh pr create with a descriptive title and body
8. After the PR is created, checkout to main branch

Make sure to:
- Write a meaningful commit message that explains WHY, not just WHAT
- The PR title should be concise but descriptive
- The PR body should summarize the changes and their purpose
- Always checkout to main after successfully creating the PR`;

const PULL_CHANGES_PROMPT = `Pull the latest changes from the remote repository. Follow these steps:

1. First, check git status to see if there are any uncommitted changes
2. If there are uncommitted changes, stash them with a descriptive message
3. Run git pull to fetch and merge the latest changes from the remote
4. If there were stashed changes, pop the stash and resolve any conflicts if needed
5. Show a summary of what was pulled (new commits, files changed)

Make sure to:
- Handle any merge conflicts gracefully
- Report what changes were pulled
- Restore any stashed changes after pulling`;

const PUSH_CHANGES_PROMPT = `Push the current changes to the remote repository. Follow these steps:

1. First, check git status to see all uncommitted changes
2. If there are uncommitted changes:
   - Stage all relevant changes with git add
   - Generate a clear, descriptive commit message based on the changes
   - Commit the changes
3. Check if the current branch has an upstream branch set
4. Push to the remote (set upstream if needed)
5. Show a summary of what was pushed

Make sure to:
- Write a meaningful commit message that explains WHY, not just WHAT
- Handle any push rejections (e.g., if remote has new commits, pull first)
- Report the result of the push operation`;

export function AppSidebarNav() {
  const instance = useInstanceStore((s) => s.instance);
  const port = instance?.port ?? 0;
  const { pageTitle } = useBreadcrumb();
  const selectedModel = useModelStore((s) => s.selectedModel);
  const { mutate: mutateSessions } = useSessions();

  const [isCreatingPR, setIsCreatingPR] = useState(false);
  const [isPulling, setIsPulling] = useState(false);
  const [isPushing, setIsPushing] = useState(false);

  const sessionMatch = useMatch({
    from: "/_app/session/$id",
    shouldThrow: false,
  });
  const sessionId = sessionMatch?.params?.id;

  const sendPrompt = async (prompt: string) => {
    if (!sessionId || !port) {
      toast.error("Please open a session first");
      return;
    }

    const response = await fetch(
      `/api/opencode/${port}/session/${sessionId}/prompt`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: prompt, model: selectedModel }),
      },
    );

    if (!response.ok) {
      throw new Error("Failed to send request");
    }

    mutateSessionMessages(port, sessionId);
    mutateSessions();
  };

  const handleCreatePR = async () => {
    setIsCreatingPR(true);
    try {
      await sendPrompt(CREATE_PR_PROMPT);
      posthog.capture("git_create_pr");
      toast.success("PR creation request sent");
    } catch (err) {
      console.error("Failed to create PR:", err);
      toast.error("Failed to send PR creation request");
    } finally {
      setIsCreatingPR(false);
    }
  };

  const handlePull = async () => {
    setIsPulling(true);
    try {
      await sendPrompt(PULL_CHANGES_PROMPT);
      posthog.capture("git_pull");
      toast.success("Pull request sent");
    } catch (err) {
      console.error("Failed to pull:", err);
      toast.error("Failed to send pull request");
    } finally {
      setIsPulling(false);
    }
  };

  const handlePush = async () => {
    setIsPushing(true);
    try {
      await sendPrompt(PUSH_CHANGES_PROMPT);
      posthog.capture("git_push");
      toast.success("Push request sent");
    } catch (err) {
      console.error("Failed to push:", err);
      toast.error("Failed to send push request");
    } finally {
      setIsPushing(false);
    }
  };

  const isLoading = isCreatingPR || isPulling || isPushing;

  return (
    <SidebarNav isSticky>
      <span className="flex items-center gap-x-4">
        <SidebarTrigger className="-ml-2" />
        <Breadcrumbs className="hidden md:flex">
          <BreadcrumbsItem href="/">
            {instance?.name ?? "Instance"}
          </BreadcrumbsItem>
          {pageTitle && <BreadcrumbsItem>{pageTitle}</BreadcrumbsItem>}
        </Breadcrumbs>
      </span>
      <span className="flex items-center gap-x-2 ml-auto">
        <Button
          size="xs"
          intent="outline"
          className="uppercase font-mono"
          onPress={handlePull}
          isDisabled={isLoading || !sessionId}
        >
          <ArrowDownCircleIcon size="14px" />
          {isPulling ? "Pulling..." : "Pull"}
        </Button>
        <Button
          size="xs"
          intent="outline"
          className="uppercase font-mono"
          onPress={handlePush}
          isDisabled={isLoading || !sessionId}
        >
          <ArrowUpCircleIcon size="14px" />
          {isPushing ? "Pushing..." : "Push"}
        </Button>
        <Button
          size="xs"
          intent="outline"
          className="uppercase font-mono"
          onPress={handleCreatePR}
          isDisabled={isLoading || !sessionId}
        >
          <IconGitPullRequest size="14px" />
          {isCreatingPR ? "Creating..." : "Create PR"}
        </Button>
      </span>
    </SidebarNav>
  );
}
