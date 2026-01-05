import { useState } from "react";
import type { Route } from "./+types/home";
import { HomeLayout } from "fumadocs-ui/layouts/home";
import { Link } from "react-router";
import { baseOptions } from "@/lib/layout.shared";
import { AnimatedHero } from "@/components/animated-hero";

export function meta(_args: Route.MetaArgs) {
  const ogImageUrl =
    "/api/og?title=Portal&description=Portal%20is%20a%20comprehensive%20mobile-first%20web%20UI%20for%20OpenCode%2C%20with%20isolated%20workspaces%2C%20quick%20git%20integration%2C%20in%20browser%20terminal%20access.";

  return [
    { title: "Portal - Mobile-first Web UI for OpenCode" },
    {
      name: "description",
      content:
        "Portal is a comprehensive mobile-first web UI for OpenCode, with isolated workspaces, quick git integration, in browser terminal access. (More AI Agents coming soon)",
    },
    { name: "author", content: "Hosenur Rahman" },
    {
      property: "og:title",
      content: "Portal - Mobile-first Web UI for OpenCode",
    },
    {
      property: "og:description",
      content:
        "Portal is a comprehensive mobile-first web UI for OpenCode, with isolated workspaces, quick git integration, in browser terminal access. (More AI Agents coming soon)",
    },
    { property: "og:type", content: "website" },
    { property: "og:image", content: ogImageUrl },
    { property: "og:image:width", content: "1200" },
    { property: "og:image:height", content: "630" },
    { name: "twitter:card", content: "summary_large_image" },
    {
      name: "twitter:title",
      content: "Portal - Mobile-first Web UI for OpenCode",
    },
    {
      name: "twitter:description",
      content:
        "Portal is a comprehensive mobile-first web UI for OpenCode, with isolated workspaces, quick git integration, in browser terminal access. (More AI Agents coming soon)",
    },
    { name: "twitter:image", content: ogImageUrl },
  ];
}

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <button
      type="button"
      onClick={handleCopy}
      className="p-2 rounded-md hover:bg-fd-accent transition-colors text-fd-muted-foreground hover:text-fd-foreground"
      title="Copy to clipboard"
    >
      {copied ? (
        <svg
          xmlns="http://www.w3.org/2000/svg"
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-label="Copied"
          role="img"
        >
          <title>Copied</title>
          <polyline points="20 6 9 17 4 12" />
        </svg>
      ) : (
        <svg
          xmlns="http://www.w3.org/2000/svg"
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-label="Copy to clipboard"
          role="img"
        >
          <title>Copy to clipboard</title>
          <rect width="14" height="14" x="8" y="8" rx="2" ry="2" />
          <path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2" />
        </svg>
      )}
    </button>
  );
}

export default function Home() {
  const installCommand = "bunx openportal";

  return (
    <HomeLayout {...baseOptions()}>
      <div className="p-8 pt-40 flex flex-col items-start text-left flex-1 w-full max-w-350 mx-auto">
        <AnimatedHero />
        <p className="text-fd-muted-foreground mb-6 max-w-2xl text-lg">
          Portal is a comprehensive mobile-first web UI for OpenCode, with
          isolated workspaces, quick git integration, in browser terminal
          access. (More AI Agents coming soon)
        </p>
        <Link
          className="text-sm bg-fd-primary text-fd-primary-foreground rounded-full font-medium px-6 py-3 hover:bg-fd-primary/90 transition-colors"
          to="/docs"
        >
          Open Docs
        </Link>
        <div className="mt-8 w-full max-w-2xl">
          <p className="text-fd-muted-foreground mb-3 text-sm">
            Quick install:
          </p>
          <div className="bg-fd-muted rounded-lg p-4 font-mono text-sm overflow-x-auto flex items-center justify-between gap-4">
            <code>{installCommand}</code>
            <CopyButton text={installCommand} />
          </div>
        </div>
        <div className="mt-12 mb-8">
          <img
            src="/hero.png"
            alt="Portal Screenshot"
            className="max-w-full h-auto shadow-lg border rounded-xl"
          />
        </div>
      </div>
    </HomeLayout>
  );
}
