import { useRouter } from "next/router";
import { useCallback, useEffect, useState } from "react";
import { Keyboard } from "@/components/ui/keyboard";

export default function EmptyState() {
  const router = useRouter();
  const [creating, setCreating] = useState(false);

  const handleNewSession = useCallback(async () => {
    setCreating(true);
    try {
      const response = await fetch("/api/sessions", { method: "POST" });
      if (!response.ok) {
        throw new Error("Failed to create session");
      }
      const data = await response.json();
      const newSession = data.data || data;

      router.push(`/session/${newSession.id}`);
    } catch (err) {
      console.error("Failed to create session:", err);
    } finally {
      setCreating(false);
    }
  }, [router]);

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Enter" && event.shiftKey && !creating) {
        event.preventDefault();
        handleNewSession();
      }
    }

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [creating, handleNewSession]);

  return (
    <div className="flex h-full items-center justify-center">
      <div className="text-center max-w-md">
        <div className="flex items-center justify-center gap-x-2 mb-4">
          <img src="/logo.svg" alt="OpenCode Portal" className="size-8" />
          <h2 className="text-2xl font-medium text-gray-900 dark:text-gray-100">
            OpenCode Portal
          </h2>
        </div>
        <p className="text-gray-600 dark:text-gray-400 mb-6">
          Select an existing session from the left panel or create a new one to
          get started
        </p>
        <div className="text-sm text-gray-500 dark:text-gray-400">
          Press <Keyboard>Shift + Enter</Keyboard> to start a new session
        </div>
      </div>
    </div>
  );
}
